import { setTimeout as sleep } from 'node:timers/promises';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { normalizeShopDomain } from '@erp/contracts';
import type { Env } from '../../config/env.schema.js';

/** Error de Shopify con un código propio y un mensaje para mostrar al usuario. */
export class ShopifyError extends Error {
  constructor(
    readonly code:
      | 'INVALID_DOMAIN'
      | 'SHOP_NOT_FOUND'
      | 'INVALID_CREDENTIALS'
      | 'NOT_SAME_ORGANIZATION'
      | 'APP_NOT_INSTALLED'
      | 'UNAUTHORIZED'
      | 'THROTTLED'
      | 'GRAPHQL'
      | 'UNAVAILABLE',
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
  }
}

export type AccessToken = { token: string; scopes: string[]; expiresAt: Date };

type GraphqlResponse<T> = {
  data?: T;
  errors?: { message: string; extensions?: { code?: string } }[];
  extensions?: {
    cost?: { requestedQueryCost: number; throttleStatus: { currentlyAvailable: number; restoreRate: number } };
  };
};

const TIMEOUT_MS = 20_000;
const MAX_ATTEMPTS = 4;

/**
 * Cliente mínimo del Admin API de Shopify (GraphQL, versión estable fijada).
 * - Solo llama a hosts *.myshopify.com (el dominio viene del usuario: evita SSRF).
 * - Reintenta con espera si Shopify limita (THROTTLED / 429) o falla temporalmente (5xx, red).
 */
@Injectable()
export class ShopifyAdminClient {
  private readonly logger = new Logger(ShopifyAdminClient.name);
  readonly apiVersion: string;

  constructor(config: ConfigService<Env, true>) {
    this.apiVersion = config.get('SHOPIFY_API_VERSION', { infer: true });
  }

  /** Client credentials grant: token de 24 h para apps de la misma organización que la tienda. */
  async requestAccessToken(domain: string, clientId: string, clientSecret: string): Promise<AccessToken> {
    const host = this.safeHost(domain);
    const res = await this.fetchWithRetry(`https://${host}/admin/oauth/access_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: new URLSearchParams({ grant_type: 'client_credentials', client_id: clientId, client_secret: clientSecret }),
    });
    const body = (await res.json().catch(() => ({}))) as {
      access_token?: string;
      scope?: string;
      expires_in?: number;
      error?: string;
      error_description?: string;
      errors?: string;
    };
    if (res.ok && body.access_token) {
      return {
        token: body.access_token,
        scopes: (body.scope ?? '').split(',').map((s) => s.trim()).filter(Boolean),
        expiresAt: new Date(Date.now() + (body.expires_in ?? 86_399) * 1000),
      };
    }
    const code = body.error ?? '';
    this.logger.warn('Shopify rechazó el token', { host, status: res.status, error: code });
    if (res.status === 404) throw new ShopifyError('SHOP_NOT_FOUND', `No existe una tienda Shopify en ${host}`);
    if (code === 'shop_not_permitted') {
      throw new ShopifyError(
        'NOT_SAME_ORGANIZATION',
        'La app y la tienda no pertenecen a la misma organización de Shopify (client credentials solo funciona en ese caso)',
      );
    }
    if (code === 'app_not_installed' || /not installed/i.test(body.error_description ?? '')) {
      throw new ShopifyError('APP_NOT_INSTALLED', 'La app no está instalada en esta tienda: instálala desde el Dev Dashboard');
    }
    if (res.status === 400 || res.status === 401 || res.status === 403) {
      throw new ShopifyError(
        'INVALID_CREDENTIALS',
        'Shopify rechazó las credenciales: revisa el ID y el secreto de cliente, y que la app esté instalada en esta tienda',
        code || undefined,
      );
    }
    throw new ShopifyError('UNAVAILABLE', `Shopify respondió ${res.status} al pedir el token`);
  }

  /** Consulta GraphQL del Admin API. Lanza ShopifyError si hay errores (los `userErrors` los revisa quien llama). */
  async graphql<T>(domain: string, token: string, query: string, variables?: Record<string, unknown>): Promise<T> {
    const url = `https://${this.safeHost(domain)}/admin/api/${this.apiVersion}/graphql.json`;
    // Una mutación que falló por red o 5xx pudo haberse aplicado: no se repite (sí ante 429/THROTTLED).
    const safeToRepeat = !/^\s*mutation\b/.test(query);
    for (let attempt = 1; ; attempt++) {
      const res = await this.fetchWithRetry(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-Shopify-Access-Token': token },
        body: JSON.stringify({ query, variables }),
      }, safeToRepeat);
      if (res.status === 401 || res.status === 403) {
        throw new ShopifyError('UNAUTHORIZED', 'Shopify rechazó el token de acceso');
      }
      if (res.status === 404) {
        throw new ShopifyError('SHOP_NOT_FOUND', 'Shopify no encontró la tienda: revisa que el dominio siga existiendo');
      }
      const body = (await res.json().catch(() => ({}))) as GraphqlResponse<T>;
      // Fuera de GraphQL (ej. 400/402/423) Shopify responde { errors: "texto" }: se normaliza a lista.
      if (typeof body.errors === 'string') body.errors = [{ message: body.errors }];
      else if (body.errors && !Array.isArray(body.errors)) body.errors = [{ message: JSON.stringify(body.errors) }];
      const throttled = body.errors?.some((e) => e.extensions?.code === 'THROTTLED');
      if (throttled && attempt < MAX_ATTEMPTS) {
        await sleep(this.throttleWaitMs(body));
        continue;
      }
      if (throttled) throw new ShopifyError('THROTTLED', 'Shopify está limitando las llamadas; intenta en unos segundos');
      if (body.errors?.length) {
        this.logger.warn('Error GraphQL de Shopify', { errors: body.errors.map((e) => e.message) });
        throw new ShopifyError('GRAPHQL', body.errors.map((e) => e.message).join('; '), body.errors);
      }
      if (!res.ok || !body.data) throw new ShopifyError('UNAVAILABLE', `Shopify respondió ${res.status}`);
      return body.data;
    }
  }

  /** Espera hasta que el balde de costo tenga puntos para la consulta (restoreRate = puntos por segundo). */
  private throttleWaitMs(body: GraphqlResponse<unknown>): number {
    const cost = body.extensions?.cost;
    if (!cost) return 1000;
    const missing = cost.requestedQueryCost - cost.throttleStatus.currentlyAvailable;
    return Math.min(10_000, Math.max(500, Math.ceil((missing / Math.max(cost.throttleStatus.restoreRate, 1)) * 1000)));
  }

  /** fetch con tiempo límite y reintentos ante fallos de red, 429 (Retry-After) y 5xx. */
  private async fetchWithRetry(url: string, init: RequestInit, safeToRepeat = true): Promise<Response> {
    for (let attempt = 1; ; attempt++) {
      let res: Response;
      try {
        res = await fetch(url, { ...init, redirect: 'error', signal: AbortSignal.timeout(TIMEOUT_MS) });
      } catch (error) {
        if (safeToRepeat && attempt < MAX_ATTEMPTS) {
          await sleep(500 * 2 ** attempt);
          continue;
        }
        this.logger.warn('No se pudo contactar a Shopify', { url: new URL(url).host, error: (error as Error).message });
        throw new ShopifyError('UNAVAILABLE', 'No se pudo contactar a Shopify. Revisa el dominio o intenta más tarde');
      }
      const retryable = res.status === 429 || (safeToRepeat && res.status >= 500);
      if (!retryable || attempt >= MAX_ATTEMPTS) return res;
      const retryAfter = Number(res.headers.get('Retry-After'));
      await sleep(retryAfter > 0 ? Math.min(retryAfter, 10) * 1000 : 500 * 2 ** attempt);
    }
  }

  private safeHost(domain: string): string {
    const host = normalizeShopDomain(domain);
    if (!host || host !== domain) throw new ShopifyError('INVALID_DOMAIN', 'Dominio de tienda inválido');
    return host;
  }
}
