import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  HttpException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { type ConnectShopifyData, type ShopResponse } from '@erp/contracts';
import { isUniqueViolation } from '../../shared/database/pg-errors.js';
import { TokenCipher } from '../../shared/crypto/token-cipher.js';
import type { TenantContext } from '../../shared/http/request-context.js';
import { AuditService } from '../audit/audit.service.js';
import { nextAvailableSlug, slugify } from '../identity/index.js';
import { type ShopRow, ShopsRepository, ShopsService, toShopResponse } from '../shops/index.js';
import { type AccessToken, ShopifyAdminClient, ShopifyError } from './shopify-admin.client.js';

const SHOP_INFO_QUERY = /* GraphQL */ `
  query ErpShopInfo {
    shop {
      id
      name
      email
      contactEmail
      currencyCode
      enabledPresentmentCurrencies
      ianaTimezone
      myshopifyDomain
      taxesIncluded
      primaryDomain { host }
      plan { publicDisplayName }
      shopAddress { countryCodeV2 }
      currencyFormats { moneyFormat }
    }
    currentAppInstallation { accessScopes { handle } }
  }
`;

type ShopInfo = {
  shop: {
    id: string;
    name: string;
    email: string;
    contactEmail: string;
    currencyCode: string;
    enabledPresentmentCurrencies: string[];
    ianaTimezone: string;
    myshopifyDomain: string;
    taxesIncluded: boolean;
    primaryDomain: { host: string } | null;
    plan: { publicDisplayName: string } | null;
    shopAddress: { countryCodeV2: string | null } | null;
    currencyFormats: { moneyFormat: string } | null;
  };
  currentAppInstallation: { accessScopes: { handle: string }[] };
};

/** Sesión lista para llamar al Admin API de una tienda conectada. */
export type ShopifySession = { domain: string; token: string };

/** Margen antes del vencimiento para pedir un token nuevo (dura 24 h). */
const REFRESH_MARGIN_MS = 5 * 60_000;

const secretContext = (shopId: number) => `shop:${shopId}:client_secret`;
const tokenContext = (shopId: number) => `shop:${shopId}:access_token`;

@Injectable()
export class ShopifyConnectionService {
  /** Renovaciones en curso por tienda: dos llamadas simultáneas comparten el mismo token nuevo. */
  private readonly refreshing = new Map<number, Promise<ShopifySession>>();

  constructor(
    private readonly client: ShopifyAdminClient,
    private readonly cipher: TokenCipher,
    private readonly shops: ShopsService,
    private readonly repo: ShopsRepository,
    private readonly audit: AuditService,
  ) {}

  /**
   * Conecta una tienda de Shopify: valida las credenciales pidiendo un token, lee los datos de
   * la tienda y la crea en el ERP con su nombre, moneda, país y zona horaria (secretos cifrados).
   * Si ese dominio ya estaba en la empresa (p. ej. desconectado), la reconecta en vez de duplicarla.
   */
  async connect(tenant: TenantContext, userId: number, input: ConnectShopifyData): Promise<ShopResponse> {
    if (!this.cipher.configured) {
      throw new ServiceUnavailableException(
        'Falta configurar TOKEN_ENCRYPTION_KEY en el servidor para poder guardar credenciales de Shopify',
      );
    }
    const access = await this.call(() => this.client.requestAccessToken(input.myshopifyDomain, input.clientId, input.clientSecret));
    const info = await this.call(() => this.client.graphql<ShopInfo>(input.myshopifyDomain, access.token, SHOP_INFO_QUERY));
    const existing = await this.repo.findByDomain(tenant.tenantId, info.shop.myshopifyDomain);
    if (existing && tenant.allowedShopIds && !tenant.allowedShopIds.includes(existing.id)) {
      throw new ConflictException('Esa tienda de Shopify ya está en la empresa, pero no tienes acceso a ella');
    }

    try {
      const saved = await this.repo.transaction(async (tx) => {
        let shop = existing;
        if (!shop) {
          // La URL del ERP (/{empresa}/{handle}) se genera del nombre en Shopify y no cambia después.
          const base = slugify(info.shop.name);
          const handle = nextAvailableSlug(base, await this.repo.takenHandles(tenant.tenantId, base, tx));
          shop = await this.repo.insert(
            { tenantId: tenant.tenantId, handle, name: info.shop.name, currencyCode: info.shop.currencyCode },
            tx,
          );
        }
        const row = await this.repo.update(
          tenant.tenantId,
          shop.id,
          {
            ...this.shopInfoValues(info),
            shopifyClientId: input.clientId,
            encryptedClientSecret: this.cipher.encrypt(input.clientSecret, secretContext(shop.id)),
            encryptedAccessToken: this.cipher.encrypt(access.token, tokenContext(shop.id)),
            tokenExpiresAt: access.expiresAt,
            encryptionKeyVersion: TokenCipher.KEY_VERSION,
            status: 'installed',
            installedAt: new Date(),
            uninstalledAt: null,
          },
          tx,
        );
        await this.audit.record(
          {
            tenantId: tenant.tenantId,
            shopId: shop.id,
            userId,
            source: 'ERP_USER',
            entityType: 'Shop',
            entityId: shop.id,
            action: existing ? 'SHOPIFY_RECONNECT' : 'SHOPIFY_CONNECT',
            // Nunca secretos en la auditoría.
            changes: {
              new: {
                name: info.shop.name,
                myshopifyDomain: info.shop.myshopifyDomain,
                clientId: input.clientId,
                scopes: row!.grantedScopes,
              },
            },
          },
          tx,
        );
        return row!;
      });
      this.refreshing.delete(saved.id);
      return toShopResponse(saved);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException('Esa tienda de Shopify ya está conectada en otra empresa del ERP');
      }
      throw error;
    }
  }

  /** Vuelve a leer de Shopify el nombre, la moneda, el país, la zona horaria y los permisos. */
  async refreshInfo(tenant: TenantContext, userId: number, shopId: number): Promise<ShopResponse> {
    const shop = await this.shops.findAccessible(tenant, shopId);
    const session = await this.session(tenant.tenantId, shopId);
    const info = await this.call(() => this.client.graphql<ShopInfo>(session.domain, session.token, SHOP_INFO_QUERY));
    const values = this.shopInfoValues(info);
    const updated = await this.repo.transaction(async (tx) => {
      const row = await this.repo.update(tenant.tenantId, shopId, values, tx);
      await this.audit.record(
        {
          tenantId: tenant.tenantId,
          shopId,
          userId,
          source: 'SHOPIFY_SYNC',
          entityType: 'Shop',
          entityId: shopId,
          action: 'SHOPIFY_REFRESH',
          changes: { old: { name: shop.name, currencyCode: shop.currencyCode }, new: { name: values.name, currencyCode: values.currencyCode } },
        },
        tx,
      );
      return row!;
    });
    return toShopResponse(updated);
  }

  /**
   * Quita las credenciales: la tienda queda "pendiente de conexión" pero conserva su identidad
   * (dominio y GID), así al volver a conectar se reutiliza la misma tienda con sus datos.
   */
  async disconnect(tenant: TenantContext, userId: number, shopId: number): Promise<ShopResponse> {
    const shop = await this.shops.findAccessible(tenant, shopId);
    const updated = await this.repo.transaction(async (tx) => {
      const row = await this.repo.update(
        tenant.tenantId,
        shopId,
        {
          shopifyClientId: null,
          encryptedClientSecret: null,
          encryptedAccessToken: null,
          encryptedRefreshToken: null,
          tokenExpiresAt: null,
          status: 'pending_connection',
          uninstalledAt: new Date(),
        },
        tx,
      );
      await this.audit.record(
        {
          tenantId: tenant.tenantId,
          shopId,
          userId,
          source: 'ERP_USER',
          entityType: 'Shop',
          entityId: shopId,
          action: 'SHOPIFY_DISCONNECT',
          changes: { old: { myshopifyDomain: shop.myshopifyDomain } },
        },
        tx,
      );
      return row!;
    });
    this.refreshing.delete(shopId);
    return toShopResponse(updated);
  }

  /** Datos de la tienda que manda Shopify (son los de la tienda real: el ERP no los edita). */
  private shopInfoValues(info: ShopInfo) {
    const legacyId = Number(info.shop.id.split('/').pop());
    return {
      name: info.shop.name,
      shopifyGid: info.shop.id,
      shopifyLegacyId: Number.isSafeInteger(legacyId) ? legacyId : null,
      myshopifyDomain: info.shop.myshopifyDomain,
      email: info.shop.email,
      contactEmail: info.shop.contactEmail,
      primaryDomain: info.shop.primaryDomain?.host ?? null,
      currencyCode: info.shop.currencyCode,
      enabledPresentmentCurrencies: info.shop.enabledPresentmentCurrencies,
      countryCode: info.shop.shopAddress?.countryCodeV2 ?? null,
      ianaTimezone: info.shop.ianaTimezone,
      moneyFormat: info.shop.currencyFormats?.moneyFormat.slice(0, 50) ?? null,
      planDisplayName: info.shop.plan?.publicDisplayName ?? null,
      taxesIncluded: info.shop.taxesIncluded,
      apiVersion: this.client.apiVersion,
      grantedScopes: info.currentAppInstallation.accessScopes.map((s) => s.handle),
    };
  }

  /**
   * Token vigente de una tienda conectada (para los módulos de sincronización).
   * Si vence en menos de 5 minutos, pide uno nuevo con las credenciales guardadas.
   */
  async session(tenantId: number, shopId: number): Promise<ShopifySession> {
    const shop = await this.repo.findById(tenantId, shopId);
    if (!shop || shop.status !== 'installed' || !shop.myshopifyDomain || !shop.encryptedAccessToken) {
      throw new ConflictException('La tienda no está conectada a Shopify');
    }
    const expiresAt = shop.tokenExpiresAt?.getTime() ?? 0;
    if (expiresAt - Date.now() > REFRESH_MARGIN_MS) {
      return { domain: shop.myshopifyDomain, token: this.cipher.decrypt(shop.encryptedAccessToken, tokenContext(shopId)) };
    }
    const pending = this.refreshing.get(shopId);
    if (pending) return pending;
    const refresh = this.refresh(shop).finally(() => this.refreshing.delete(shopId));
    this.refreshing.set(shopId, refresh);
    return refresh;
  }

  private async refresh(shop: ShopRow): Promise<ShopifySession> {
    if (!shop.shopifyClientId || !shop.encryptedClientSecret || !shop.myshopifyDomain) {
      throw new ConflictException('Faltan las credenciales de Shopify: vuelve a conectar la tienda');
    }
    const secret = this.cipher.decrypt(shop.encryptedClientSecret, secretContext(shop.id));
    const access: AccessToken = await this.call(() =>
      this.client.requestAccessToken(shop.myshopifyDomain!, shop.shopifyClientId!, secret),
    );
    await this.repo.update(shop.tenantId, shop.id, {
      encryptedAccessToken: this.cipher.encrypt(access.token, tokenContext(shop.id)),
      tokenExpiresAt: access.expiresAt,
      grantedScopes: access.scopes.length ? access.scopes : shop.grantedScopes,
    });
    return { domain: shop.myshopifyDomain, token: access.token };
  }

  /** Traduce los errores de Shopify a respuestas HTTP con un mensaje útil. */
  private async call<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      if (error instanceof HttpException || !(error instanceof ShopifyError)) throw error;
      if (error.code === 'UNAVAILABLE' || error.code === 'THROTTLED') throw new BadGatewayException(error.message);
      throw new BadRequestException(error.message);
    }
  }
}
