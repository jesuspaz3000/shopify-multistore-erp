import type { ConfigService } from '@nestjs/config';
import { connectShopifySchema, missingShopifyScopes, normalizeShopDomain } from '@erp/contracts';
import { ShopifyAdminClient, ShopifyError } from './shopify-admin.client.js';

const client = () => new ShopifyAdminClient({ get: () => '2026-10' } as unknown as ConfigService<never, true>);
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

describe('dominio y permisos de Shopify', () => {
  it('normaliza lo que se pega y rechaza cualquier host que no sea *.myshopify.com', () => {
    expect(normalizeShopDomain('yisus-store-hgooxdku.myshopify.com')).toBe('yisus-store-hgooxdku.myshopify.com');
    expect(normalizeShopDomain(' https://Mi-Tienda.myshopify.com/admin/products ')).toBe('mi-tienda.myshopify.com');
    expect(normalizeShopDomain('mi-tienda')).toBe('mi-tienda.myshopify.com');
    expect(normalizeShopDomain('https://admin.shopify.com/store/mi-tienda/products')).toBe('mi-tienda.myshopify.com');
    for (const bad of ['evil.com', 'mi-tienda.myshopify.com.evil.com', '127.0.0.1', 'http://localhost:8080', 'a@b.myshopify.com']) {
      expect(normalizeShopDomain(bad)).toBeNull();
    }
    expect(connectShopifySchema.safeParse({ myshopifyDomain: 'evil.com', clientId: 'a', clientSecret: 'b' }).success).toBe(false);
  });

  it('write_* cubre su read_*; informa los que faltan', () => {
    expect(missingShopifyScopes(['write_products', 'write_inventory', 'read_locations', 'write_files', 'write_publications'])).toEqual([]);
    expect(missingShopifyScopes(['read_products'])).toContain('write_products');
  });
});

describe('ShopifyAdminClient', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('tienda inexistente (404) y errores como texto ({ errors: "..." }) dan un ShopifyError, no un fallo interno', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json(404, { errors: 'Not Found' })));
    await expect(client().graphql('t.myshopify.com', 'tok', '{ shop { name } }')).rejects.toMatchObject({ code: 'SHOP_NOT_FOUND' });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json(402, { errors: 'Unavailable Shop' })));
    await expect(client().graphql('t.myshopify.com', 'tok', '{ shop { name } }')).rejects.toMatchObject({
      code: 'GRAPHQL',
      message: 'Unavailable Shop',
    });
  });

  it('pide el token con client credentials (form-urlencoded) y lee scopes y vencimiento', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json(200, { access_token: 'tok', scope: 'read_products,write_products', expires_in: 86399 }));
    vi.stubGlobal('fetch', fetchMock);
    const token = await client().requestAccessToken('t.myshopify.com', 'cid', 'secret');
    expect(token.token).toBe('tok');
    expect(token.scopes).toEqual(['read_products', 'write_products']);
    expect(token.expiresAt.getTime()).toBeGreaterThan(Date.now() + 86_000_000);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://t.myshopify.com/admin/oauth/access_token');
    expect(String(init.body)).toBe('grant_type=client_credentials&client_id=cid&client_secret=secret');
  });

  it('traduce los rechazos de Shopify a errores claros', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json(400, { error: 'shop_not_permitted' })));
    await expect(client().requestAccessToken('t.myshopify.com', 'c', 's')).rejects.toMatchObject({ code: 'NOT_SAME_ORGANIZATION' });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json(401, { error: 'invalid_client' })));
    await expect(client().requestAccessToken('t.myshopify.com', 'c', 's')).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
    await expect(client().requestAccessToken('evil.com', 'c', 's')).rejects.toBeInstanceOf(ShopifyError);
  });

  it('consulta GraphQL en la versión fijada y espera si Shopify limita (THROTTLED)', async () => {
    const throttled = {
      errors: [{ message: 'Throttled', extensions: { code: 'THROTTLED' } }],
      extensions: { cost: { requestedQueryCost: 10, throttleStatus: { currentlyAvailable: 0, restoreRate: 100 } } },
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json(200, throttled))
      .mockResolvedValueOnce(json(200, { data: { shop: { name: 'X' } } }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(client().graphql('t.myshopify.com', 'tok', 'query { shop { name } }')).resolves.toEqual({ shop: { name: 'X' } });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).toBe('https://t.myshopify.com/admin/api/2026-10/graphql.json');
    expect(fetchMock.mock.calls[0][1].headers['X-Shopify-Access-Token']).toBe('tok');
  });

  it('reintenta una consulta ante 5xx, pero nunca repite una mutación que pudo haberse aplicado', async () => {
    const queryMock = vi.fn().mockResolvedValueOnce(json(502, {})).mockResolvedValueOnce(json(200, { data: { ok: true } }));
    vi.stubGlobal('fetch', queryMock);
    await expect(client().graphql('t.myshopify.com', 'tok', 'query { ok }')).resolves.toEqual({ ok: true });
    expect(queryMock).toHaveBeenCalledTimes(2);

    const mutationMock = vi.fn().mockResolvedValue(json(502, {}));
    vi.stubGlobal('fetch', mutationMock);
    await expect(client().graphql('t.myshopify.com', 'tok', 'mutation { productCreate }')).rejects.toMatchObject({ code: 'UNAVAILABLE' });
    expect(mutationMock).toHaveBeenCalledTimes(1);
  });

  it('errores GraphQL y token rechazado', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json(200, { errors: [{ message: 'Field x does not exist' }] })));
    await expect(client().graphql('t.myshopify.com', 'tok', 'query { x }')).rejects.toMatchObject({ code: 'GRAPHQL' });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json(401, {})));
    await expect(client().graphql('t.myshopify.com', 'tok', 'query { x }')).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });
});
