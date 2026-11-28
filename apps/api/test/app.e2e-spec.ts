import { StandardSchemaValidationPipe } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test, type TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { eq } from 'drizzle-orm';
import { AppModule } from './../src/app.module.js';
import { auditLogs } from './../src/modules/audit/audit.schema.js';
import { shops } from './../src/modules/shops/shops.schema.js';
import { ShopifyConnectionService } from './../src/modules/shopify/index.js';
import { parseTaxonomy } from './../src/modules/catalog/taxonomy/taxonomy-parser.js';
import { TaxonomyRepository } from './../src/modules/catalog/taxonomy/taxonomy.repository.js';
import { tenants, tenantUsers, users } from './../src/modules/identity/identity.schema.js';
import { DB, type Database } from './../src/shared/database/database.module.js';
import { AUTH_LIMITS } from './../src/shared/http/rate-limit.js';

// Requiere PostgreSQL en marcha (npm run db:up) con las migraciones aplicadas.

// Cada registro simula una IP distinta (como detrás de un proxy): el límite de registro
// por IP (5/hora) no debe frenar a la suite. El límite en sí se prueba en el test de login.
let ipCounter = 0;
const nextIp = () => `198.51.100.${(++ipCounter % 250) + 1}`;

describe('API (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    (app as unknown as NestExpressApplication).set('trust proxy', true);
    app.use(cookieParser());
    app.useGlobalPipes(new StandardSchemaValidationPipe());
    await app.init();

    // Rama de snowboard de la taxonomía real de Shopify (una base nueva puede no tener cargada la
    // taxonomía). Solo se insertan las que faltan: no se pisa una taxonomía completa ya cargada.
    const { entries } = parseTaxonomy(
      [
        '# Shopify Product Taxonomy - Categories: 2026-11',
        'gid://shopify/TaxonomyCategory/sg : Equipamiento deportivo',
        'gid://shopify/TaxonomyCategory/sg-4 : Equipamiento deportivo > Actividades al aire libre',
        'gid://shopify/TaxonomyCategory/sg-4-17 : Equipamiento deportivo > Actividades al aire libre > Actividades y deportes de invierno',
        'gid://shopify/TaxonomyCategory/sg-4-17-2 : Equipamiento deportivo > Actividades al aire libre > Actividades y deportes de invierno > Esquí y snowboard',
        'gid://shopify/TaxonomyCategory/sg-4-17-2-17 : Equipamiento deportivo > Actividades al aire libre > Actividades y deportes de invierno > Esquí y snowboard > Tablas de snowboard',
      ].join('\n'),
    );
    const taxonomy = app.get(TaxonomyRepository);
    const existing = await taxonomy.findByIds(entries.map((e) => e.id));
    if (existing.size < entries.length) await taxonomy.upsertAll(entries.filter((e) => !existing.has(e.id)), '2026-11');
  });

  const createdEmails: string[] = [];

  afterAll(async () => {
    // Limpia lo creado por los tests (tenant y usuario; el resto cae en cascada).
    const db = app.get<Database>(DB);
    for (const email of createdEmails) {
      const [user] = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
      if (!user) continue;
      const owned = await db
        .select({ tenantId: tenantUsers.tenantId })
        .from(tenantUsers)
        .where(eq(tenantUsers.userId, user.id));
      await db.delete(auditLogs).where(eq(auditLogs.userId, user.id));
      for (const { tenantId } of owned) await db.delete(tenants).where(eq(tenants.id, tenantId));
      await db.delete(users).where(eq(users.id, user.id));
    }
    await app.close();
  });

  it('GET /health responde sin sesión', () => {
    return request(app.getHttpServer()).get('/health').expect(200).expect({ status: 'ok' });
  });

  it('GET /ready confirma la base de datos', () => {
    return request(app.getHttpServer()).get('/ready').expect(200).expect({ status: 'ok', database: 'up' });
  });

  it('GET /auth/me sin sesión responde 401', () => {
    return request(app.getHttpServer()).get('/auth/me').expect(401);
  });

  it('POST /auth/login con body inválido responde 400', () => {
    return request(app.getHttpServer()).post('/auth/login').send({ email: 'no-es-email' }).expect(400);
  });

  it('GET /auth/config es público e informa el registro', () => {
    return request(app.getHttpServer())
      .get('/auth/config')
      .expect(200)
      .expect({ signupEnabled: true, googleEnabled: false });
  });

  it('registro -> me -> logout -> me (401)', async () => {
    const agent = request.agent(app.getHttpServer());
    const email = `e2e-${Date.now()}@example.com`;
    createdEmails.push(email);

    const registered = await agent
      .post('/auth/register').set('X-Forwarded-For', nextIp())
      .send({ companyName: 'Empresa E2E', firstName: 'Ana', lastName: 'Prueba', email, password: 'clave-segura-123' })
      .expect(201);
    expect(registered.body.memberships[0]).toMatchObject({ role: 'OWNER', companyName: 'Empresa E2E' });

    await agent.get('/auth/me').expect(200);
    await agent.post('/auth/logout').expect(204);
    await agent.get('/auth/me').expect(401);
  });

  describe('tiendas (/tenants/:tenant/shops)', () => {
    async function registerCompany(companyName: string) {
      const agent = request.agent(app.getHttpServer());
      const email = `e2e-shops-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.com`;
      createdEmails.push(email);
      const res = await agent
        .post('/auth/register').set('X-Forwarded-For', nextIp())
        .send({ companyName, firstName: 'Ana', lastName: 'Prueba', email, password: 'clave-segura-123' })
        .expect(201);
      return { agent, slug: res.body.memberships[0].slug as string };
    }

    it('crea, lista, edita y elimina tiendas de la propia empresa', async () => {
      const { agent, slug } = await registerCompany('Empresa Tiendas E2E');
      const base = `/tenants/${slug}/shops`;

      const created = await agent
        .post(base)
        .send({ name: 'Tienda Lima', currencyCode: 'pen', countryCode: 'pe', ianaTimezone: 'America/Lima' })
        .expect(201);
      expect(created.body).toMatchObject({
        handle: 'tienda-lima',
        currencyCode: 'PEN',
        countryCode: 'PE',
        status: 'pending_connection',
      });

      // Mismo nombre -> handle distinto; "All" nunca puede ser un handle (es la vista consolidada).
      expect((await agent.post(base).send({ name: 'Tienda Lima', currencyCode: 'USD' }).expect(201)).body.handle).toBe(
        'tienda-lima-2',
      );
      expect((await agent.post(base).send({ name: 'All', currencyCode: 'USD' }).expect(201)).body.handle).toBe('all-2');

      expect((await agent.get(base).expect(200)).body).toMatchObject({ total: 3, page: 1, totalPages: 1 });

      // Paginación y búsqueda por query params
      const page2 = (await agent.get(`${base}?page=2&pageSize=2`).expect(200)).body;
      expect(page2).toMatchObject({ total: 3, page: 2, pageSize: 2, totalPages: 2 });
      expect(page2.items).toHaveLength(1);
      const found = (await agent.get(`${base}?q=lima`).expect(200)).body;
      expect(found.items.map((s: { handle: string }) => s.handle)).toEqual(['tienda-lima', 'tienda-lima-2']);
      expect((await agent.get(`${base}?q=100%25`).expect(200)).body.total).toBe(0); // % no es comodín
      // Valores inválidos en la URL no rompen la consulta: vuelven a los valores por defecto.
      expect((await agent.get(`${base}?page=abc&pageSize=9999`).expect(200)).body).toMatchObject({ page: 1, pageSize: 20 });
      expect((await agent.get(`${base}/options`).expect(200)).body).toHaveLength(3);

      // Renombrar no cambia el handle; '' en un campo opcional lo borra.
      const updated = await agent.patch(`${base}/${created.body.id}`).send({ name: 'Lima Centro', countryCode: '' }).expect(200);
      expect(updated.body).toMatchObject({ name: 'Lima Centro', handle: 'tienda-lima', countryCode: null });

      await agent.delete(`${base}/${created.body.id}`).expect(204);
      await agent.delete(`${base}/${created.body.id}`).expect(404);
    });

    it('valida el body y no deja ver ni tocar tiendas de otra empresa', async () => {
      const a = await registerCompany('Empresa A E2E');
      const b = await registerCompany('Empresa B E2E');
      const shop = (await a.agent.post(`/tenants/${a.slug}/shops`).send({ name: 'Tienda A', currencyCode: 'USD' }).expect(201))
        .body;

      await a.agent.post(`/tenants/${a.slug}/shops`).send({ name: 'X', currencyCode: 'dolar' }).expect(400);
      // B no pertenece a la empresa A: 404 (no se revela que exista).
      await b.agent.get(`/tenants/${a.slug}/shops`).expect(404);
      // B tampoco puede tocar una tienda de A a través de su propia empresa.
      await b.agent.patch(`/tenants/${b.slug}/shops/${shop.id}`).send({ name: 'Hackeada' }).expect(404);
      // Sin sesión: 401.
      await request(app.getHttpServer()).get(`/tenants/${a.slug}/shops`).expect(401);
    });

    it('shopify: conectar crea la tienda con los datos de Shopify, cifra secretos, renueva el token, reconecta y desconecta', async () => {
      const a = await registerCompany('Empresa Shopify E2E');
      const b = await registerCompany('Empresa Shopify B E2E');
      const base = `/tenants/${a.slug}/shops`;
      const domain = `e2e-${Date.now()}.myshopify.com`;

      // Shopify simulado: solo se interceptan las llamadas a *.myshopify.com.
      const realFetch = globalThis.fetch;
      const calls: string[] = [];
      let tokenCounter = 0;
      let shopName = 'Yisus Store';
      let grantedScopes = 'write_products,write_inventory,read_locations,write_files,write_publications';
      vi.stubGlobal('fetch', async (input: string | URL, init?: RequestInit) => {
        const url = String(input);
        if (!url.includes('.myshopify.com')) return realFetch(input, init);
        calls.push(url);
        const json = (status: number, body: unknown) =>
          new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
        if (url.endsWith('/admin/oauth/access_token')) {
          const form = new URLSearchParams(init?.body as string);
          if (form.get('client_secret') !== 'shpss_correcto') return json(401, { error: 'invalid_client' });
          return json(200, { access_token: `shpat_token_${++tokenCounter}`, scope: grantedScopes, expires_in: 86399 });
        }
        return json(200, {
          data: {
            shop: {
              id: 'gid://shopify/Shop/987654321',
              name: shopName,
              email: 'owner@example.com',
              contactEmail: 'tienda@example.com',
              currencyCode: 'PEN',
              enabledPresentmentCurrencies: ['PEN', 'USD'],
              ianaTimezone: 'America/Lima',
              myshopifyDomain: domain,
              taxesIncluded: true,
              primaryDomain: { host: domain },
              plan: { publicDisplayName: 'Development' },
              shopAddress: { countryCodeV2: 'PE' },
              currencyFormats: { moneyFormat: 'S/ {{amount}}' },
            },
            currentAppInstallation: { accessScopes: grantedScopes.split(',').map((handle) => ({ handle })) },
          },
        });
      });

      try {
        const connectUrl = `${base}/connect`;
        const credentials = { myshopifyDomain: domain, clientId: 'cid', clientSecret: 'shpss_correcto' };
        // Dominio que no es de Shopify: 400 sin llamar a nadie (no hay SSRF).
        await a.agent.post(connectUrl).send({ ...credentials, myshopifyDomain: 'evil.com' }).expect(400);
        expect(calls).toHaveLength(0);
        // Secreto incorrecto: 400 con un mensaje útil y no se crea ninguna tienda.
        const wrong = await a.agent.post(connectUrl).send({ ...credentials, clientSecret: 'otro' }).expect(400);
        expect(wrong.body.message).toMatch(/credenciales/);
        expect((await a.agent.get(base).expect(200)).body.total).toBe(0);

        // Conectar crea la tienda con el nombre y los datos de Shopify.
        const connected = await a.agent
          .post(connectUrl)
          .send({ ...credentials, myshopifyDomain: `https://${domain}/admin` })
          .expect(201);
        const shop = connected.body;
        expect(shop).toMatchObject({
          name: 'Yisus Store',
          handle: 'yisus-store',
          status: 'installed',
          myshopifyDomain: domain,
          currencyCode: 'PEN',
          countryCode: 'PE',
          ianaTimezone: 'America/Lima',
          shopify: { clientId: 'cid', apiVersion: '2026-10', planName: 'Development', missingScopes: [] },
        });
        expect(JSON.stringify(shop)).not.toMatch(/shpss_|shpat_/);
        expect(calls.at(-1)).toBe(`https://${domain}/admin/api/2026-10/graphql.json`);
        // Sus datos vienen de Shopify: no se editan a mano en el ERP.
        await a.agent.patch(`${base}/${shop.id}`).send({ name: 'Otro nombre' }).expect(409);

        // En la base: cifrados (sin el secreto ni el token en claro).
        const db = app.get<Database>(DB);
        const [row] = await db.select().from(shops).where(eq(shops.id, shop.id));
        expect(row.encryptedClientSecret).toMatch(/^v1\./);
        expect(row.encryptedClientSecret).not.toContain('shpss_correcto');
        expect(row.encryptedAccessToken).not.toContain('shpat_');

        // Token vigente: se usa el guardado sin llamar a Shopify. Por vencer: se renueva solo.
        const connection = app.get(ShopifyConnectionService);
        const before = calls.length;
        expect(await connection.session(row.tenantId, shop.id)).toEqual({ domain, token: 'shpat_token_1' });
        expect(calls).toHaveLength(before);
        await db.update(shops).set({ tokenExpiresAt: new Date(Date.now() + 60_000) }).where(eq(shops.id, shop.id));
        const [s1, s2] = await Promise.all([connection.session(row.tenantId, shop.id), connection.session(row.tenantId, shop.id)]);
        expect(s1.token).toBe('shpat_token_2');
        expect(s2.token).toBe('shpat_token_2'); // dos pedidos simultáneos comparten una sola renovación
        expect(calls.filter((c) => c.endsWith('/access_token'))).toHaveLength(3);

        // Renombrada en Shopify: "Actualizar desde Shopify" trae el nombre nuevo (la URL del ERP no cambia).
        shopName = 'Yisus Store Perú';
        const refreshed = await a.agent.post(`${base}/${shop.id}/shopify/refresh`).expect(200);
        expect(refreshed.body).toMatchObject({ name: 'Yisus Store Perú', handle: 'yisus-store' });

        // Conectar otra vez el mismo dominio reutiliza la tienda (no la duplica).
        expect((await a.agent.post(connectUrl).send(credentials).expect(201)).body.id).toBe(shop.id);
        expect((await a.agent.get(base).expect(200)).body.total).toBe(1);
        // La misma tienda de Shopify no puede quedar conectada en otra empresa.
        await b.agent.post(`/tenants/${b.slug}/shops/connect`).send(credentials).expect(409);
        // Otra empresa no puede actualizar ni desconectar la tienda de A.
        await b.agent.post(`/tenants/${b.slug}/shops/${shop.id}/shopify/refresh`).expect(404);
        await b.agent.delete(`/tenants/${b.slug}/shops/${shop.id}/shopify`).expect(404);

        // Una tienda conectada no se puede eliminar; primero se desconecta.
        await a.agent.delete(`${base}/${shop.id}`).expect(409);
        const disconnected = await a.agent.delete(`${base}/${shop.id}/shopify`).expect(200);
        // Conserva su identidad (dominio) para reconectar la misma tienda; las credenciales se borran.
        expect(disconnected.body).toMatchObject({ status: 'pending_connection', shopify: null, myshopifyDomain: domain });
        const [cleared] = await db.select().from(shops).where(eq(shops.id, shop.id));
        expect(cleared.encryptedClientSecret).toBeNull();
        expect(cleared.encryptedAccessToken).toBeNull();
        await expect(connection.session(row.tenantId, shop.id)).rejects.toThrow(/no está conectada/);

        // Permisos insuficientes: reconecta, pero informa cuáles faltan.
        grantedScopes = 'read_products';
        const partial = await a.agent.post(connectUrl).send(credentials).expect(201);
        expect(partial.body.id).toBe(shop.id);
        expect(partial.body.shopify.missingScopes).toContain('write_products');

        // Desconectada, ya se puede eliminar.
        await a.agent.delete(`${base}/${shop.id}/shopify`).expect(200);
        await a.agent.delete(`${base}/${shop.id}`).expect(204);
      } finally {
        vi.unstubAllGlobals();
      }
    });

    it('shopify: importar trae ubicaciones, productos, imágenes y stock; reimportar no duplica y aplica los cambios', async () => {
      const a = await registerCompany('Empresa Importar E2E');
      const b = await registerCompany('Empresa Importar B E2E');
      const domain = `imp-${Date.now()}.myshopify.com`;
      const gid = (type: string, n: number) => `gid://shopify/${type}/${n}`;
      // PNG mínimo (firma + IHDR 2x2): basta para que el ERP lo reconozca como imagen.
      const png = Buffer.alloc(40);
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(png);
      png.writeUInt32BE(13, 8);
      png.write('IHDR', 12, 'latin1');
      png.writeUInt32BE(2, 16);
      png.writeUInt32BE(2, 20);

      const item = (n: number, tracked = true) => ({
        id: gid('InventoryItem', n),
        tracked,
        requiresShipping: true,
        unitCost: { amount: '10.0' },
        countryCodeOfOrigin: null,
        harmonizedSystemCode: null,
        measurement: { weight: { value: 0.3, unit: 'KILOGRAMS' } },
      });
      const variant = (n: number, title: string, options: { name: string; value: string }[], sku: string) => ({
        id: gid('ProductVariant', n),
        title,
        sku,
        price: '49.90',
        compareAtPrice: null,
        inventoryPolicy: 'DENY',
        taxable: true,
        position: n,
        barcodes: { nodes: [{ value: `77500${n}` }] },
        selectedOptions: options,
        inventoryItem: item(n),
      });
      // Estado de la tienda simulada (se modifica entre importaciones).
      const polera = {
        id: gid('Product', 1),
        handle: 'polera-shopify',
        title: 'Polera Shopify',
        descriptionHtml: '<p>Algodón <script>alert(1)</script></p>',
        vendor: 'Yisus',
        productType: 'Ropa',
        category: { id: 'gid://shopify/TaxonomyCategory/sg-4-17-2-17' } as { id: string } | null,
        status: 'ACTIVE',
        tags: ['verano'],
        updatedAt: '2026-11-01T10:00:00Z',
        seo: { title: null, description: null },
        options: [{ name: 'Talla', position: 1, optionValues: [{ name: 'S', hasVariants: true }, { name: 'M', hasVariants: true }] }],
        media: {
          nodes: [{ id: gid('MediaImage', 1), alt: 'Frente', mediaContentType: 'IMAGE', image: { url: 'https://cdn.shopify.com/s/files/polera.png', width: 2, height: 2 } }],
        },
        variants: [variant(1, 'S', [{ name: 'Talla', value: 'S' }], 'IMP-POL-S'), variant(2, 'M', [{ name: 'Talla', value: 'M' }], 'IMP-POL-M')],
      };
      const taza = {
        ...polera,
        id: gid('Product', 2),
        handle: 'taza',
        // Categoría de una taxonomía más nueva que la cargada: se importa sin categoría (con aviso).
        category: { id: 'gid://shopify/TaxonomyCategory/zz-1' },
        title: 'Taza',
        descriptionHtml: '',
        status: 'DRAFT',
        options: [{ name: 'Title', position: 1, optionValues: [{ name: 'Default Title', hasVariants: true }] }],
        media: { nodes: [] },
        variants: [variant(3, 'Default Title', [{ name: 'Title', value: 'Default Title' }], 'IMP-TAZA')],
      };
      const catalog = [polera, taza];
      const levels: Record<string, Record<string, number>> = {
        [gid('Location', 1)]: { [gid('InventoryItem', 1)]: 5, [gid('InventoryItem', 2)]: -2 },
        [gid('Location', 2)]: { [gid('InventoryItem', 3)]: 7 },
        // Ubicación de una app de logística (3PL): también tiene stock de la taza.
        [gid('Location', 3)]: { [gid('InventoryItem', 3)]: 4 },
      };
      const shopifyLocation = (n: number, name: string) => ({
        id: gid('Location', n),
        legacyResourceId: String(n),
        name,
        isActive: true,
        fulfillsOnlineOrders: true,
        hasActiveInventory: true,
        isFulfillmentService: false,
        fulfillmentService: null as { handle: string } | null,
        address: { address1: 'Av. Siempre Viva 123', address2: null, city: 'Lima', province: 'Lima', provinceCode: 'LIM', countryCode: 'PE', zip: '15001', phone: null },
      });
      const page = <T,>(nodes: T[]) => ({ pageInfo: { hasNextPage: false, endCursor: null }, nodes });

      const realFetch = globalThis.fetch;
      let imageDownloads = 0;
      vi.stubGlobal('fetch', async (input: string | URL, init?: RequestInit) => {
        const url = String(input);
        const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
        if (url.startsWith('https://cdn.shopify.com/')) {
          imageDownloads++;
          return new Response(png, { status: 200, headers: { 'Content-Type': 'image/png' } });
        }
        if (!url.includes('.myshopify.com')) return realFetch(input, init);
        if (url.endsWith('/admin/oauth/access_token')) {
          return json({ access_token: 'shpat_import', scope: 'write_products,write_inventory,read_locations,write_files,write_publications', expires_in: 86399 });
        }
        const { query, variables } = JSON.parse(init?.body as string) as { query: string; variables: { id?: string } };
        if (query.includes('query ImportLocations')) return json({ data: { locations: page([
                shopifyLocation(1, 'Almacén Central'),
                shopifyLocation(2, 'bodega lima'),
                { ...shopifyLocation(3, 'Snow City Warehouse'), isFulfillmentService: true, fulfillmentService: { handle: 'snow-city-warehouse' } },
              ]) } });
        if (query.includes('query ImportLevels')) {
          const byItem = levels[variables.id!] ?? {};
          return json({
            data: {
              location: {
                inventoryLevels: page(Object.entries(byItem).map(([id, quantity]) => ({ item: { id }, quantities: [{ name: 'available', quantity }] }))),
              },
            },
          });
        }
        if (query.includes('query ImportProductIds')) return json({ data: { products: page(catalog.map(({ id, title, updatedAt, category }) => ({ id, title, updatedAt, category }))) } });
        if (query.includes('query ImportProduct')) {
          const found = catalog.find((p) => p.id === variables.id);
          return json({ data: { product: found ? { ...found, variants: page(found.variants) } : null } });
        }
        return json({
          data: {
            shop: {
              id: gid('Shop', 5),
              name: 'Tienda Importar',
              email: 'owner@example.com',
              contactEmail: null,
              currencyCode: 'PEN',
              enabledPresentmentCurrencies: ['PEN'],
              ianaTimezone: 'America/Lima',
              myshopifyDomain: domain,
              taxesIncluded: true,
              primaryDomain: { host: domain },
              plan: { publicDisplayName: 'Development' },
              shopAddress: { countryCodeV2: 'PE' },
              currencyFormats: { moneyFormat: 'S/ {{amount}}' },
            },
            currentAppInstallation: { accessScopes: [{ handle: 'write_products' }, { handle: 'write_inventory' }, { handle: 'read_locations' }, { handle: 'write_files' }, { handle: 'write_publications' }] },
          },
        });
      });

      try {
        const t = `/tenants/${a.slug}`;
        // Bodega del ERP con el mismo nombre que una ubicación de Shopify: se empareja (no se duplica).
        const lima = (await a.agent.post(`${t}/locations`).send({ code: 'BOD-LIMA', name: 'Bodega Lima' }).expect(201)).body;
        const shop = (await a.agent.post(`${t}/shops/connect`).send({ myshopifyDomain: domain, clientId: 'cid', clientSecret: 'shpss_x' }).expect(201)).body;
        const importUrl = `${t}/shops/${shop.id}/shopify/import`;

        const first = (await a.agent.post(importUrl).expect(200)).body;
        expect(first).toEqual({
          locations: { total: 3, created: 2, linked: 1 },
          products: { total: 2, created: 2, updated: 0, unchanged: 0, failed: 0 },
          stock: { adjusted: 3 }, // -2 en Shopify queda en 0 en el ERP (sin movimiento)
          warnings: [{ product: 'Taza', message: expect.stringMatching(/categoría/) }],
        });
        expect(imageDownloads).toBe(1);

        const locations = (await a.agent.get(`${t}/locations`).expect(200)).body.items as { id: number; code: string; name: string; city: string }[];
        expect(locations.map((l) => l.name).sort()).toEqual(['Almacén Central', 'Bodega Lima', 'Snow City Warehouse']);
        // La de la app de logística entra como bodega de un tercero (3PL).
        expect(locations.find((l) => l.name === 'Snow City Warehouse')).toMatchObject({ type: '3pl' });
        const central = locations.find((l) => l.name === 'Almacén Central')!;
        expect(central).toMatchObject({ code: 'ALMACEN-CENTRAL', city: 'Lima' });

        const list = (await a.agent.get(`${t}/products`).expect(200)).body;
        expect(list.total).toBe(2);
        // Cada producto dice en qué tienda está; filtrar por tienda trae solo los suyos.
        expect(list.items.map((p: { shops: { name: string }[] }) => p.shops.map((s) => s.name))).toEqual([['Tienda Importar'], ['Tienda Importar']]);
        const local = (await a.agent.post(`${t}/products`).send({ title: 'Solo en el ERP', variants: [{ optionValues: [], price: '1' }] }).expect(201)).body;
        const all = (await a.agent.get(`${t}/products`).expect(200)).body;
        expect(all.total).toBe(3);
        expect(all.items.find((p: { id: number }) => p.id === local.id).shops).toEqual([]);
        const inShop = (await a.agent.get(`${t}/products?shop=${shop.handle}&q=polera`).expect(200)).body;
        expect(inShop.items.map((p: { title: string }) => p.title)).toEqual(['Polera Shopify']);
        expect((await a.agent.get(`${t}/products?shop=${shop.handle}`).expect(200)).body.total).toBe(2);
        await a.agent.get(`${t}/products?shop=no-existe`).expect(404);
        await a.agent.delete(`${t}/products/${local.id}`).expect(204);
        const poleraId = list.items.find((p: { title: string }) => p.title === 'Polera Shopify').id;
        const detail = (await a.agent.get(`${t}/products/${poleraId}`).expect(200)).body;
        expect(detail).toMatchObject({
          handle: 'polera-shopify',
          vendor: 'Yisus',
          status: 'ACTIVE',
          category: { id: 'gid://shopify/TaxonomyCategory/sg-4-17-2-17', name: 'Tablas de snowboard' },
          options: [{ name: 'Talla', values: ['S', 'M'] }],
          media: [{ alt: 'Frente', mimeType: 'image/png', filename: 'polera.png' }], // nombre del archivo en Shopify
        });
        expect(detail.description).not.toContain('script');
        expect(detail.variants.map((v: { sku: string; barcode: string; available: number }) => [v.sku, v.barcode, v.available])).toEqual([
          ['IMP-POL-S', '775001', 5],
          ['IMP-POL-M', '775002', 0],
        ]);
        expect(detail.variants[0].levels).toEqual([{ locationId: central.id, available: 5 }]);
        // Inventario sin bodega elegida = todas (mismo total que la ficha), con el reparto por bodega.
        const stockRows = (await a.agent.get(`${t}/inventory?q=IMP-POL-S`).expect(200)).body.items;
        expect(stockRows).toEqual([
          expect.objectContaining({
            sku: 'IMP-POL-S',
            variantTitle: 'S',
            imageUrl: detail.media[0].url, // imagen principal del producto (como en Shopify)
            available: 5,
            levels: [{ locationId: central.id, available: 5 }],
          }),
        ]);
        expect((await a.agent.get(`${t}/inventory?q=IMP-POL-S&locationId=${lima.id}`).expect(200)).body.items[0]).toMatchObject({ available: 0, levels: [] });
        const tazaDetail = (await a.agent.get(`${t}/products/${list.items.find((p: { title: string }) => p.title === 'Taza').id}`).expect(200)).body;
        const snowCity = locations.find((l) => l.name === 'Snow City Warehouse')!;
        expect(tazaDetail).toMatchObject({
          status: 'DRAFT',
          options: [],
          // 7 en Bodega Lima + 4 en la bodega de la app de logística.
          variants: [{ available: 11, levels: expect.arrayContaining([{ locationId: lima.id, available: 7 }, { locationId: snowCity.id, available: 4 }]) }],
        });

        // Reimportar sin cambios: no duplica ni vuelve a descargar imágenes.
        const second = (await a.agent.post(importUrl).expect(200)).body;
        expect(second).toMatchObject({ locations: { created: 0 }, products: { created: 0, updated: 0, unchanged: 2 }, stock: { adjusted: 0 } });
        expect((await a.agent.get(`${t}/products`).expect(200)).body.total).toBe(2);

        // Cambios en Shopify: renombrar, quitar una variante y vender 2 unidades.
        Object.assign(polera, {
          title: 'Polera Pro',
          updatedAt: '2026-11-02T10:00:00Z',
          options: [{ name: 'Talla', position: 1, optionValues: [{ name: 'S', hasVariants: true }] }],
          variants: [polera.variants[0]],
        });
        levels[gid('Location', 1)][gid('InventoryItem', 1)] = 3;
        const third = (await a.agent.post(importUrl).expect(200)).body;
        expect(third).toMatchObject({ products: { created: 0, updated: 1, unchanged: 1, failed: 0 }, stock: { adjusted: 1 } });
        const changed = (await a.agent.get(`${t}/products/${poleraId}`).expect(200)).body;
        expect(changed.title).toBe('Polera Pro');
        expect(changed.variants).toHaveLength(1);
        expect(changed.variants[0]).toMatchObject({ id: detail.variants[0].id, available: 3 }); // misma variante
        expect(imageDownloads).toBe(1);

        // El kardex registra el origen Shopify: inicial y luego la corrección.
        const kardex = (await a.agent.get(`${t}/inventory/adjustments?inventoryItemId=${detail.variants[0].inventoryItemId}`).expect(200)).body;
        expect(kardex.items.map((k: { reason: string; source: string; delta: number }) => [k.reason, k.source, k.delta])).toEqual([
          ['correction', 'SHOPIFY', -2],
          ['initial', 'SHOPIFY', 5],
        ]);

        // Otra empresa no puede importar la tienda de A.
        await b.agent.post(`/tenants/${b.slug}/shops/${shop.id}/shopify/import`).expect(404);
        // Desconectada no se importa.
        await a.agent.delete(`${t}/shops/${shop.id}/shopify`).expect(200);
        await a.agent.post(importUrl).expect(409);
      } finally {
        vi.unstubAllGlobals();
      }
    });

    it('bodegas: crear, código único, tiendas que abastece con su regla de stock y baja lógica', async () => {
      const a = await registerCompany('Empresa Bodegas E2E');
      const b = await registerCompany('Empresa Bodegas B E2E');
      const base = `/tenants/${a.slug}/locations`;
      const shopA = (await a.agent.post(`/tenants/${a.slug}/shops`).send({ name: 'Tienda Uno', currencyCode: 'USD' }).expect(201)).body;
      const shopA2 = (await a.agent.post(`/tenants/${a.slug}/shops`).send({ name: 'Tienda Dos', currencyCode: 'USD' }).expect(201)).body;
      const shopB = (await b.agent.post(`/tenants/${b.slug}/shops`).send({ name: 'Tienda B', currencyCode: 'USD' }).expect(201)).body;

      const created = (
        await a.agent.post(base).send({ code: 'bod-lima-01', name: 'Bodega Lima', city: 'Lima', countryCode: 'pe', phone: '' }).expect(201)
      ).body;
      expect(created).toMatchObject({ code: 'BOD-LIMA-01', type: 'warehouse', countryCode: 'PE', phone: null, isActive: true, shops: [] });
      // El código es único por empresa (sin distinguir mayúsculas), pero otra empresa puede repetirlo.
      await a.agent.post(base).send({ code: 'BOD-LIMA-01', name: 'Otra' }).expect(409);
      await b.agent.post(`/tenants/${b.slug}/locations`).send({ code: 'BOD-LIMA-01', name: 'Bodega B' }).expect(201);
      await a.agent.post(base).send({ code: 'con espacios', name: 'X' }).expect(400);
      await a.agent.post(base).send({ code: 'BOD-CUSCO', name: 'Bodega Cusco', type: '3pl' }).expect(201);

      expect((await a.agent.get(`${base}?q=lima`).expect(200)).body).toMatchObject({ total: 1, items: [{ code: 'BOD-LIMA-01' }] });
      expect((await a.agent.get(`${base}?pageSize=1&page=2`).expect(200)).body).toMatchObject({ total: 2, totalPages: 2 });

      // Tiendas que abastece: cada modo exige sus parámetros; tiendas de otra empresa no cuentan.
      const url = `${base}/${created.id}/shops`;
      await a.agent.put(url).send({ shops: [{ shopId: shopA.id, stockSyncMode: 'PERCENTAGE' }] }).expect(400);
      await a.agent.put(url).send({ shops: [{ shopId: shopB.id, stockSyncMode: 'MIRROR' }] }).expect(400);
      const linked = (
        await a.agent
          .put(url)
          .send({
            shops: [
              { shopId: shopA.id, stockSyncMode: 'PERCENTAGE', stockPercentage: 50 },
              { shopId: shopA2.id, stockSyncMode: 'BUFFER', stockBuffer: 3 },
            ],
          })
          .expect(200)
      ).body;
      expect(linked.shops).toEqual([
        { shopId: shopA2.id, stockSyncMode: 'BUFFER', stockPercentage: null, stockBuffer: 3 },
        { shopId: shopA.id, stockSyncMode: 'PERCENTAGE', stockPercentage: 50, stockBuffer: null },
      ]);
      // Reemplazar: la que no viene se desvincula y la otra cambia de regla.
      const replaced = (await a.agent.put(url).send({ shops: [{ shopId: shopA.id, stockSyncMode: 'MIRROR' }] }).expect(200)).body;
      expect(replaced.shops).toEqual([{ shopId: shopA.id, stockSyncMode: 'MIRROR', stockPercentage: null, stockBuffer: null }]);

      expect((await a.agent.patch(`${base}/${created.id}`).send({ isActive: false }).expect(200)).body.isActive).toBe(false);
      expect((await a.agent.get(`${base}/options`).expect(200)).body.map((l: { code: string }) => l.code)).toEqual(['BOD-CUSCO']);

      // Otra empresa no la ve ni la toca.
      await b.agent.patch(`/tenants/${b.slug}/locations/${created.id}`).send({ name: 'Hackeada' }).expect(404);

      // Baja lógica: desaparece, libera el código y ya no se puede editar.
      await a.agent.delete(`${base}/${created.id}`).expect(204);
      await a.agent.patch(`${base}/${created.id}`).send({ name: 'Otro nombre' }).expect(404);
      expect((await a.agent.get(base).expect(200)).body.total).toBe(1);
      await a.agent.post(base).send({ code: 'BOD-LIMA-01', name: 'Bodega Lima nueva' }).expect(201);
    });

    it('stock por bodega: ajustes, conteo con compare-and-set, concurrencia y kardex', async () => {
      const a = await registerCompany('Empresa Stock E2E');
      const b = await registerCompany('Empresa Stock B E2E');
      const t = `/tenants/${a.slug}`;
      const lima = (await a.agent.post(`${t}/locations`).send({ code: 'LIMA', name: 'Bodega Lima' }).expect(201)).body;
      const cusco = (await a.agent.post(`${t}/locations`).send({ code: 'CUSCO', name: 'Bodega Cusco' }).expect(201)).body;
      const product = (
        await a.agent
          .post(`${t}/products`)
          .send({
            title: 'Polera',
            options: [{ name: 'Talla', values: ['S', 'M'] }],
            variants: [
              { optionValues: ['S'], sku: 'P-S', price: '10' },
              { optionValues: ['M'], sku: 'P-M', price: '10' },
            ],
          })
          .expect(201)
      ).body;
      const [s, m] = product.variants;
      const adjust = (body: object, agent = a.agent) => agent.post(`${t}/inventory/adjustments`).send(body);

      // Recepción: +10 S y +4 M en Lima; +3 S en Cusco.
      const received = await adjust({
        locationId: lima.id,
        reason: 'received',
        note: 'Guía 001',
        changes: [
          { inventoryItemId: s.inventoryItemId, delta: 10 },
          { inventoryItemId: m.inventoryItemId, delta: 4 },
        ],
      }).expect(200);
      expect(received.body.levels).toEqual([
        { inventoryItemId: s.inventoryItemId, available: 10, onHand: 10 },
        { inventoryItemId: m.inventoryItemId, available: 4, onHand: 4 },
      ]);
      await adjust({ locationId: cusco.id, reason: 'received', changes: [{ inventoryItemId: s.inventoryItemId, delta: 3 }] }).expect(200);

      // Stock por bodega y sumado.
      const atLima = (await a.agent.get(`${t}/inventory?locationId=${lima.id}`).expect(200)).body;
      expect(atLima.items.map((r: { sku: string; available: number }) => [r.sku, r.available])).toEqual([
        ['P-S', 10],
        ['P-M', 4],
      ]);
      expect(atLima.items[0]).toMatchObject({ productTitle: 'Polera', variantTitle: 'S', onHand: 10, committed: 0, unavailable: 0 });
      const all = (await a.agent.get(`${t}/inventory`).expect(200)).body;
      expect(all.items.find((r: { sku: string }) => r.sku === 'P-S').available).toBe(13);
      expect((await a.agent.get(`${t}/inventory?q=p-m`).expect(200)).body.total).toBe(1);
      // El producto muestra el disponible total por variante.
      const detail = (await a.agent.get(`${t}/products/${product.id}`).expect(200)).body;
      expect(detail.variants.map((v: { available: number }) => v.available)).toEqual([13, 4]);

      // Conteo (cantidad nueva) con compare-and-set: si el stock cambió, 409 y no se aplica nada.
      await adjust({
        locationId: lima.id,
        reason: 'cycle_count_available',
        changes: [
          { inventoryItemId: s.inventoryItemId, quantity: 8, compareQuantity: 10 },
          { inventoryItemId: m.inventoryItemId, quantity: 0, compareQuantity: 99 },
        ],
      }).expect(409);
      expect((await a.agent.get(`${t}/inventory?locationId=${lima.id}&q=p-s`).expect(200)).body.items[0].available).toBe(10);
      await adjust({
        locationId: lima.id,
        reason: 'cycle_count_available',
        changes: [{ inventoryItemId: s.inventoryItemId, quantity: 8, compareQuantity: 10 }],
      }).expect(200);

      // No se puede dejar el disponible en negativo; validaciones del body.
      await adjust({ locationId: lima.id, reason: 'shrinkage', changes: [{ inventoryItemId: m.inventoryItemId, delta: -5 }] }).expect(400);
      await adjust({ locationId: lima.id, reason: 'shrinkage', changes: [{ inventoryItemId: m.inventoryItemId }] }).expect(400);
      await adjust({ locationId: lima.id, reason: 'inventado', changes: [{ inventoryItemId: m.inventoryItemId, delta: 1 }] }).expect(400);
      // Ítems o bodegas de otra empresa no existen para esta.
      await adjust({ locationId: lima.id, reason: 'correction', changes: [{ inventoryItemId: s.inventoryItemId, delta: 1 }] }, b.agent)
        .expect(404);
      await b.agent
        .post(`/tenants/${b.slug}/inventory/adjustments`)
        .send({ locationId: lima.id, reason: 'correction', changes: [{ inventoryItemId: s.inventoryItemId, delta: 1 }] })
        .expect(404);

      // 20 ajustes simultáneos de +1: el bloqueo de fila no pierde ninguno.
      await Promise.all(
        Array.from({ length: 20 }, () =>
          adjust({ locationId: lima.id, reason: 'correction', changes: [{ inventoryItemId: m.inventoryItemId, delta: 1 }] }).expect(200),
        ),
      );
      expect((await a.agent.get(`${t}/inventory?locationId=${lima.id}&q=p-m`).expect(200)).body.items[0].available).toBe(24);

      // Kardex: más reciente primero, con cantidad resultante, motivo, nota y usuario.
      const kardex = (await a.agent.get(`${t}/inventory/adjustments?inventoryItemId=${s.inventoryItemId}&locationId=${lima.id}`).expect(200))
        .body;
      expect(kardex.items.map((k: { delta: number; quantityAfter: number; reason: string }) => [k.delta, k.quantityAfter, k.reason])).toEqual([
        [-2, 8, 'cycle_count_available'],
        [10, 10, 'received'],
      ]);
      expect(kardex.items[1]).toMatchObject({ note: 'Guía 001', locationCode: 'LIMA', variantTitle: 'S', userName: 'Ana Prueba', source: 'ERP' });

      // Una bodega con stock no se puede eliminar; sin stock, sí.
      await a.agent.delete(`${t}/locations/${cusco.id}`).expect(409);
      await adjust({ locationId: cusco.id, reason: 'correction', changes: [{ inventoryItemId: s.inventoryItemId, quantity: 0 }] }).expect(200);
      await a.agent.delete(`${t}/locations/${cusco.id}`).expect(204);
      // Bodega eliminada: ya no admite ajustes.
      await adjust({ locationId: cusco.id, reason: 'received', changes: [{ inventoryItemId: s.inventoryItemId, delta: 1 }] }).expect(404);
    });

    it('categorías: taxonomía de Shopify (navegar, buscar sin tildes) y categoría del producto', async () => {
      // La rama de snowboard se asegura en beforeAll.
      const a = await registerCompany('Empresa Categorías E2E');
      const t = `/tenants/${a.slug}`;
      const roots = (await a.agent.get(`${t}/taxonomy/categories`).expect(200)).body;
      expect(roots).toContainEqual(expect.objectContaining({ id: 'gid://shopify/TaxonomyCategory/sg', name: 'Equipamiento deportivo', level: 0 }));
      const children = (await a.agent.get(`${t}/taxonomy/categories?parentId=gid://shopify/TaxonomyCategory/sg-4-17`).expect(200)).body;
      expect(children).toContainEqual(expect.objectContaining({ id: 'gid://shopify/TaxonomyCategory/sg-4-17-2', name: 'Esquí y snowboard', isLeaf: false }));
      // Sin tildes ni mayúsculas; lo que tiene las palabras en su propio nombre va primero.
      const found = (await a.agent.get(`${t}/taxonomy/categories?q=${encodeURIComponent('TABLAS Snowboard')}`).expect(200)).body;
      expect(found[0]).toMatchObject({ id: 'gid://shopify/TaxonomyCategory/sg-4-17-2-17', name: 'Tablas de snowboard' });
      const accents = (await a.agent.get(`${t}/taxonomy/categories?q=${encodeURIComponent('esqui y snowboard')}`).expect(200)).body;
      expect(accents.map((c: { id: string }) => c.id)).toContain('gid://shopify/TaxonomyCategory/sg-4-17-2');
      await a.agent.get(`${t}/taxonomy/categories?parentId=${encodeURIComponent("x'; drop")}`).expect(400);

      const base = { title: 'Tabla', variants: [{ optionValues: [], price: '10' }] };
      // Se acepta el código corto o el GID; se guarda y devuelve con su ruta completa.
      const product = (await a.agent.post(`${t}/products`).send({ ...base, categoryId: 'sg-4-17-2-17' }).expect(201)).body;
      expect(product.category).toMatchObject({
        id: 'gid://shopify/TaxonomyCategory/sg-4-17-2-17',
        name: 'Tablas de snowboard',
        fullName: expect.stringMatching(/^Equipamiento deportivo > .* > Tablas de snowboard$/),
      });
      // Una categoría que no existe: 400. Sin categoría: null.
      await a.agent.post(`${t}/products`).send({ ...base, categoryId: 'gid://shopify/TaxonomyCategory/zz-999' }).expect(400);
      await a.agent.post(`${t}/products`).send({ ...base, categoryId: 'no válida' }).expect(400);
      const cleared = (
        await a.agent
          .put(`${t}/products/${product.id}`)
          .send({ ...base, categoryId: '', variants: [{ id: product.variants[0].id, optionValues: [], price: '10' }] })
          .expect(200)
      ).body;
      expect(cleared.category).toBeNull();
    });

    it('productos: stock inicial por bodega, inventario en la lista, aduana, acciones en bloque y sugerencias', async () => {
      const a = await registerCompany('Empresa Lista E2E');
      const t = `/tenants/${a.slug}`;
      const lima = (await a.agent.post(`${t}/locations`).send({ code: 'LIMA', name: 'Bodega Lima' }).expect(201)).body;
      const cusco = (await a.agent.post(`${t}/locations`).send({ code: 'CUSCO', name: 'Bodega Cusco' }).expect(201)).body;

      const created = (
        await a.agent
          .post(`${t}/products`)
          .send({
            title: 'Polera',
            vendor: 'Marca X',
            productType: 'Poleras',
            tags: ['verano'],
            options: [{ name: 'Talla', values: ['S', 'M'] }],
            variants: [
              {
                optionValues: ['S'],
                price: '10',
                countryCodeOfOrigin: 'pe',
                harmonizedSystemCode: '610910',
                quantities: [
                  { locationId: lima.id, quantity: 5 },
                  { locationId: cusco.id, quantity: 2 },
                ],
              },
              { optionValues: ['M'], price: '10', quantities: [{ locationId: lima.id, quantity: 0 }] },
            ],
          })
          .expect(201)
      ).body;
      const [s, m] = created.variants;
      expect(s).toMatchObject({ available: 7, countryCodeOfOrigin: 'PE', harmonizedSystemCode: '610910' });
      expect(s.levels).toEqual([
        { locationId: cusco.id, available: 2 },
        { locationId: lima.id, available: 5 },
      ]);
      expect(m).toMatchObject({ available: 0, levels: [] });
      // El stock inicial queda en el kardex como "initial".
      const kardex = (await a.agent.get(`${t}/inventory/adjustments?inventoryItemId=${s.inventoryItemId}`).expect(200)).body;
      expect(kardex.items.map((k: { reason: string; delta: number }) => [k.reason, k.delta]).sort()).toEqual([
        ['initial', 2],
        ['initial', 5],
      ]);
      // "initial" no es un motivo de ajuste manual.
      await a.agent
        .post(`${t}/inventory/adjustments`)
        .send({ locationId: lima.id, reason: 'initial', changes: [{ inventoryItemId: s.inventoryItemId, delta: 1 }] })
        .expect(400);
      // Bodega inválida al crear: no se crea nada.
      await a.agent
        .post(`${t}/products`)
        .send({ title: 'Otro', variants: [{ optionValues: [], price: '1', quantities: [{ locationId: 999999, quantity: 1 }] }] })
        .expect(400);
      expect((await a.agent.get(`${t}/products`).expect(200)).body.total).toBe(1);

      // Lista: "7 en existencias para 2 variantes"; un producto sin seguimiento: 0 variantes con stock.
      await a.agent.post(`${t}/products`).send({ title: 'Servicio', variants: [{ optionValues: [], price: '5', tracked: false }] }).expect(201);
      const list = (await a.agent.get(`${t}/products`).expect(200)).body.items;
      expect(list.find((p: { title: string }) => p.title === 'Polera')).toMatchObject({ trackedVariants: 2, available: 7 });
      expect(list.find((p: { title: string }) => p.title === 'Servicio')).toMatchObject({ trackedVariants: 0, available: 0 });

      // Sugerencias del formulario.
      expect((await a.agent.get(`${t}/products/facets`).expect(200)).body).toEqual({
        productTypes: ['Poleras'],
        vendors: ['Marca X'],
        tags: ['verano'],
      });

      // Acciones en bloque.
      const ids = list.map((p: { id: number }) => p.id);
      expect((await a.agent.post(`${t}/products/bulk`).send({ action: 'archive', ids: [...ids, 999999] }).expect(200)).body).toEqual({
        affected: 2,
      });
      expect((await a.agent.get(`${t}/products?status=ARCHIVED`).expect(200)).body.total).toBe(2);
      await a.agent.post(`${t}/products/bulk`).send({ action: 'publicar', ids }).expect(400);
      expect((await a.agent.post(`${t}/products/bulk`).send({ action: 'delete', ids }).expect(200)).body.affected).toBe(2);
      expect((await a.agent.get(`${t}/products`).expect(200)).body.total).toBe(0);
    });

    it('multimedia: sube imágenes verificando los bytes, las asigna al producto y las sirve solo a la empresa', async () => {
      const a = await registerCompany('Empresa Media E2E');
      const b = await registerCompany('Empresa Media B E2E');
      const t = `/tenants/${a.slug}`;
      const png = Buffer.alloc(64);
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(png, 0);
      png.writeUInt32BE(800, 16);
      png.writeUInt32BE(600, 20);

      const uploaded = (await a.agent.post(`${t}/media`).attach('file', png, 'foto.png').expect(201)).body;
      expect(uploaded).toMatchObject({ mimeType: 'image/png', width: 800, height: 600, fileSize: 64, alt: null, filename: 'foto.png' });
      // El nombre en UTF-8 llega en un campo aparte (el del archivo multipart puede llegar mal codificado).
      const other = Buffer.concat([png, Buffer.from([1])]);
      const named = (await a.agent.post(`${t}/media`).field('filename', 'carpeta/Póster ñandú.png').attach('file', other, 'x.png').expect(201)).body;
      expect(named.filename).toBe('Póster ñandú.png');
      expect(uploaded.url).toBe(`/tenants/${a.slug}/media/${uploaded.id}/file`);
      // Mismo archivo otra vez: se reutiliza (sin duplicados).
      expect((await a.agent.post(`${t}/media`).attach('file', png, 'otra.png').expect(201)).body.id).toBe(uploaded.id);
      // Un HTML disfrazado de .jpg se rechaza por sus bytes; sin archivo, 400.
      await a.agent.post(`${t}/media`).attach('file', Buffer.from('<html><script>alert(1)</script></html>'), 'foto.jpg').expect(415);
      await a.agent.post(`${t}/media`).expect(400);

      // Se sirve con su tipo real; otra empresa no puede verla.
      const file = await a.agent.get(`${t}/media/${uploaded.id}/file`).expect(200);
      expect(file.headers['content-type']).toBe('image/png');
      expect(file.headers['x-content-type-options']).toBe('nosniff');
      expect(Buffer.compare(file.body as Buffer, png)).toBe(0);
      await b.agent.get(`/tenants/${b.slug}/media/${uploaded.id}/file`).expect(404);

      // Producto con imágenes (en orden, con texto alternativo) y descripción HTML limpiada.
      const product = (
        await a.agent
          .post(`${t}/products`)
          .send({
            title: 'Polera',
            description: '<p onclick="x()">Algodón <strong>100%</strong></p><script>alert(1)</script>',
            media: [{ id: uploaded.id, alt: 'Polera roja de frente' }],
            variants: [{ optionValues: [], price: '10' }],
          })
          .expect(201)
      ).body;
      expect(product.description).toBe('<p>Algodón <strong>100%</strong></p>');
      expect(product.media).toEqual([{ ...uploaded, alt: 'Polera roja de frente' }]);
      expect((await a.agent.get(`${t}/products`).expect(200)).body.items[0].imageUrl).toBe(uploaded.url);
      // Detalle (como en Shopify): en cuántos productos se usa; se puede renombrar.
      expect((await a.agent.get(`${t}/media/${uploaded.id}`).expect(200)).body).toMatchObject({ filename: 'foto.png', usage: { products: 1 } });
      expect((await a.agent.get(`${t}/media/${named.id}`).expect(200)).body.usage).toEqual({ products: 0 });
      const renamed = (await a.agent.patch(`${t}/media/${uploaded.id}`).send({ filename: '  Polera frente.png ' }).expect(200)).body;
      expect(renamed).toMatchObject({ filename: 'Polera frente.png', usage: { products: 1 } });
      await a.agent.patch(`${t}/media/${uploaded.id}`).send({ filename: '../etc/passwd' }).expect(400);
      await a.agent.patch(`${t}/media/${uploaded.id}`).send({ filename: '' }).expect(400);
      await b.agent.get(`/tenants/${b.slug}/media/${uploaded.id}`).expect(404);
      await b.agent.patch(`/tenants/${b.slug}/media/${uploaded.id}`).send({ filename: 'x.png' }).expect(404);
      // Una imagen de otra empresa no se puede asignar.
      const foreign = (await b.agent.post(`/tenants/${b.slug}/media`).attach('file', png, 'x.png').expect(201)).body;
      await a.agent
        .put(`${t}/products/${product.id}`)
        .send({ title: 'Polera', media: [{ id: foreign.id }], variants: [{ id: product.variants[0].id, optionValues: [], price: '10' }] })
        .expect(400);
      // Quitar las imágenes.
      const cleared = (
        await a.agent
          .put(`${t}/products/${product.id}`)
          .send({ title: 'Polera', media: [], variants: [{ id: product.variants[0].id, optionValues: [], price: '10' }] })
          .expect(200)
      ).body;
      expect(cleared.media).toEqual([]);
    });

    it('productos: opciones y variantes, SKU único, edición que conserva variantes y concurrencia', async () => {
      const a = await registerCompany('Empresa Catalogo E2E');
      const b = await registerCompany('Empresa Catalogo B E2E');
      const base = `/tenants/${a.slug}/products`;

      // Sin opciones: una sola variante "Default Title".
      const simple = (
        await a.agent
          .post(base)
          .send({ title: 'Taza Blanca', variants: [{ optionValues: [], sku: 'TAZA-01', price: '12.5', cost: '4' }] })
          .expect(201)
      ).body;
      expect(simple).toMatchObject({ handle: 'taza-blanca', status: 'ACTIVE', currency: 'USD', version: 1, options: [] });
      expect(simple.variants).toMatchObject([
        { title: 'Default Title', sku: 'TAZA-01', price: '12.50', cost: '4', tracked: true, inventoryPolicy: 'DENY', compareAtPrice: null },
      ]);

      // Como en Shopify: precio obligatorio (0 vale), precio comparativo mayor que el precio, URL y SEO editables.
      await a.agent.post(base).send({ title: 'Sin precio', variants: [{ optionValues: [] }] }).expect(400);
      await a.agent.post(base).send({ title: 'Comparativo', variants: [{ optionValues: [], price: '10', compareAtPrice: '9' }] }).expect(400);
      const custom = (
        await a.agent
          .post(base)
          .send({
            title: 'Gorro',
            handle: 'Gorro-Lana',
            seoTitle: 'Gorro de lana',
            seoDescription: 'Abrigado',
            variants: [{ optionValues: [], price: '0', compareAtPrice: '15', inventoryPolicy: 'CONTINUE' }],
          })
          .expect(201)
      ).body;
      expect(custom).toMatchObject({ handle: 'gorro-lana', seoTitle: 'Gorro de lana', seoDescription: 'Abrigado' });
      expect(custom.variants[0]).toMatchObject({ price: '0', compareAtPrice: '15', inventoryPolicy: 'CONTINUE' });
      await a.agent.post(base).send({ title: 'Otro', handle: 'gorro-lana', variants: [{ optionValues: [], price: '1' }] }).expect(409);
      await a.agent
        .put(`${base}/${simple.id}`)
        .send({ title: 'Taza Blanca', handle: 'gorro-lana', variants: [{ id: simple.variants[0].id, optionValues: [], sku: 'TAZA-01', price: '12.5' }] })
        .expect(409);
      await a.agent.delete(`${base}/${custom.id}`).expect(204);

      // Con opciones: valores normalizados según la opción; validaciones de combinaciones.
      const shirt = {
        status: 'DRAFT',
        title: 'Polera Básica',
        vendor: 'Marca X',
        tags: ['verano', 'Verano', 'algodón'],
        options: [
          { name: 'Color', values: ['Rojo', 'Azul'] },
          { name: 'Talla', values: ['S', 'M'] },
        ],
        variants: [
          { optionValues: ['rojo', 'S'], sku: 'POL-R-S', price: '20' },
          { optionValues: ['Rojo', 'M'], sku: 'POL-R-M', price: '22.9' },
          { optionValues: ['Azul', 'S'], sku: 'POL-A-S', price: '20' },
        ],
      };
      await a.agent.post(base).send({ ...shirt, variants: [...shirt.variants, { optionValues: ['Verde', 'S'] }] }).expect(400);
      await a.agent.post(base).send({ ...shirt, variants: [shirt.variants[0], { ...shirt.variants[0], sku: 'OTRO' }] }).expect(400);
      // SKU ya usado por otro producto (sin distinguir mayúsculas): 409 con mensaje claro.
      const dup = await a.agent.post(base).send({ ...shirt, variants: [{ ...shirt.variants[0], sku: 'taza-01' }] }).expect(409);
      expect(dup.body.message).toContain('Taza Blanca');

      const created = (await a.agent.post(base).send(shirt).expect(201)).body;
      expect(created.tags).toEqual(['Verano', 'algodón']);
      expect(created.variants.map((v: { title: string }) => v.title)).toEqual(['Rojo / S', 'Rojo / M', 'Azul / S']);
      expect(created.variants[1]).toMatchObject({ optionValues: ['Rojo', 'M'], price: '22.90' });

      // Lista: rango de precios, búsqueda por SKU, filtro por estado.
      const list = (await a.agent.get(base).expect(200)).body;
      expect(list.total).toBe(2);
      expect(list.items.find((p: { id: number }) => p.id === created.id)).toMatchObject({
        variantsCount: 3,
        minPrice: '20',
        maxPrice: '22.90',
        status: 'DRAFT',
      });
      expect((await a.agent.get(`${base}?q=pol-a`).expect(200)).body.items.map((p: { id: number }) => p.id)).toEqual([created.id]);
      expect((await a.agent.get(`${base}?status=ACTIVE`).expect(200)).body.items.map((p: { id: number }) => p.id)).toEqual([simple.id]);
      expect((await a.agent.get(`${base}?status=raro`).expect(200)).body.total).toBe(2); // filtro inválido = sin filtro

      // Editar: se conserva la variante con id (mismo ítem), se quita otra, se agrega una y se intercambian SKUs.
      const [rs, rm] = created.variants;
      const edited = (
        await a.agent
          .put(`${base}/${created.id}`)
          .send({
            ...shirt,
            title: 'Polera Premium',
            version: created.version,
            options: [
              { name: 'Color', values: ['Rojo', 'Azul', 'Negro'] },
              { name: 'Talla', values: ['S', 'M'] },
            ],
            variants: [
              { id: rs.id, optionValues: ['Rojo', 'S'], sku: 'POL-R-M', price: '25' },
              { id: rm.id, optionValues: ['Rojo', 'M'], sku: 'POL-R-S', price: '25' },
              { optionValues: ['Negro', 'M'], sku: 'POL-N-M', price: '30' },
            ],
          })
          .expect(200)
      ).body;
      expect(edited).toMatchObject({ title: 'Polera Premium', handle: 'polera-basica', version: 2 });
      expect(edited.variants.map((v: { id: number; sku: string }) => [v.id, v.sku])).toEqual([
        [rs.id, 'POL-R-M'],
        [rm.id, 'POL-R-S'],
        [expect.any(Number), 'POL-N-M'],
      ]);
      // El SKU de la variante quitada queda libre.
      await a.agent
        .put(`${base}/${simple.id}`)
        .send({ title: 'Taza Blanca', variants: [{ id: simple.variants[0].id, optionValues: [], sku: 'POL-A-S', price: '12.5' }] })
        .expect(200);

      // Edición con una versión vieja: 409 (otra persona guardó antes).
      await a.agent.put(`${base}/${created.id}`).send({ ...shirt, version: created.version }).expect(409);
      // Una variante de otro producto no se puede "adoptar".
      await a.agent
        .put(`${base}/${created.id}`)
        .send({ title: 'X', variants: [{ id: simple.variants[0].id, optionValues: [], price: '1' }] })
        .expect(400);

      // Otra empresa no lo ve; baja lógica.
      await b.agent.get(`/tenants/${b.slug}/products/${created.id}`).expect(404);
      await a.agent.delete(`${base}/${created.id}`).expect(204);
      await a.agent.get(`${base}/${created.id}`).expect(404);
      expect((await a.agent.get(base).expect(200)).body.total).toBe(1);
      // Su handle y sus SKU quedan libres (POL-A-S ahora es de la taza: sigue ocupado).
      await a.agent.post(base).send(shirt).expect(409);
      const again = (await a.agent.post(base).send({ ...shirt, variants: shirt.variants.slice(0, 2) }).expect(201)).body;
      expect(again.handle).toBe('polera-basica');
    });
  });

  describe('usuarios e invitaciones', () => {
    const tokenOf = (url: string) => url.split('/invite/')[1];

    it('invitar -> aceptar (cuenta nueva) -> permisos -> cambiar rol -> quitar', async () => {
      const owner = request.agent(app.getHttpServer());
      const ownerEmail = `e2e-owner-${Date.now()}@example.com`;
      createdEmails.push(ownerEmail);
      const reg = await owner
        .post('/auth/register').set('X-Forwarded-For', nextIp())
        .send({ companyName: 'Empresa Equipo E2E', firstName: 'Olga', lastName: 'Dueña', email: ownerEmail, password: 'clave-segura-123' })
        .expect(201);
      const slug = reg.body.memberships[0].slug as string;
      const shop = (await owner.post(`/tenants/${slug}/shops`).send({ name: 'Tienda Norte', currencyCode: 'USD' }).expect(201)).body;
      await owner.post(`/tenants/${slug}/shops`).send({ name: 'Tienda Sur', currencyCode: 'USD' }).expect(201);

      // Invitar como Solo lectura con acceso solo a "Tienda Norte"
      const guestEmail = `e2e-guest-${Date.now()}@example.com`;
      createdEmails.push(guestEmail);
      const invite = await owner
        .post(`/tenants/${slug}/invitations`)
        .send({ email: guestEmail, roleName: 'Solo lectura', allShopsAccess: false, shopIds: [shop.id] })
        .expect(201);
      expect(invite.body).toMatchObject({ status: 'pending', role: 'Solo lectura', allShopsAccess: false, shopIds: [shop.id] });
      const token = tokenOf(invite.body.inviteUrl);
      await owner.post(`/tenants/${slug}/invitations`).send({ email: guestEmail, roleName: 'Solo lectura', allShopsAccess: true }).expect(409);

      // Pantalla pública y aceptación con cuenta nueva
      const preview = await request(app.getHttpServer()).get(`/invitations/${token}`).expect(200);
      expect(preview.body).toMatchObject({ companyName: 'Empresa Equipo E2E', email: guestEmail, userExists: false });
      const guest = request.agent(app.getHttpServer());
      await guest.post(`/invitations/${token}/accept`).send({ firstName: 'Gabi', lastName: 'Invitada', password: 'corta' }).expect(400);
      expect((await guest.post(`/invitations/${token}/accept`).send({ firstName: 'Gabi', lastName: 'Invitada', password: 'clave-segura-123' }).expect(200)).body).toEqual({ slug });
      await request(app.getHttpServer()).post(`/invitations/${token}/accept`).send({ password: 'clave-segura-123' }).expect(410);

      // La invitada (Solo lectura) ve solo su tienda y no puede gestionar usuarios
      const guestShops = (await guest.get(`/tenants/${slug}/shops`).expect(200)).body.items;
      expect(guestShops.map((s: { name: string }) => s.name)).toEqual(['Tienda Norte']);
      await guest.get(`/tenants/${slug}/members`).expect(403);
      await guest.post(`/tenants/${slug}/shops`).send({ name: 'No permitida', currencyCode: 'USD' }).expect(403);

      // El dueño la ve, la asciende a Administradora con todas las tiendas
      const members = (await owner.get(`/tenants/${slug}/members`).expect(200)).body.items;
      expect((await owner.get(`/tenants/${slug}/members?q=gabi`).expect(200)).body.total).toBe(1);
      const guestMember = members.find((m: { email: string }) => m.email === guestEmail);
      const ownerMember = members.find((m: { isYou: boolean }) => m.isYou);
      expect(guestMember).toMatchObject({ role: 'Solo lectura', allShopsAccess: false, shopIds: [shop.id] });
      await owner.patch(`/tenants/${slug}/members/${guestMember.tenantUserId}`).send({ roleName: 'Administrador', allShopsAccess: true }).expect(204);
      expect((await guest.get(`/tenants/${slug}/shops`).expect(200)).body.total).toBe(2);

      // Reglas: la Administradora no toca al Dueño ni otorga Dueño; el Dueño no se cambia a sí mismo
      await guest.patch(`/tenants/${slug}/members/${ownerMember.tenantUserId}`).send({ roleName: 'Solo lectura', allShopsAccess: true }).expect(403);
      await guest
        .post(`/tenants/${slug}/invitations`)
        .send({ email: `x-${Date.now()}@example.com`, roleName: 'OWNER', allShopsAccess: true })
        .expect(403);
      await owner.patch(`/tenants/${slug}/members/${ownerMember.tenantUserId}`).send({ roleName: 'Solo lectura', allShopsAccess: true }).expect(403);

      // Quitar a la invitada: pierde el acceso al instante
      await owner.delete(`/tenants/${slug}/members/${guestMember.tenantUserId}`).expect(204);
      await guest.get(`/tenants/${slug}/shops`).expect(404);
    });

    it('reenviar invalida el link anterior; cancelar lo invalida; cuenta existente acepta con su contraseña', async () => {
      const owner = request.agent(app.getHttpServer());
      const ownerEmail = `e2e-owner2-${Date.now()}@example.com`;
      createdEmails.push(ownerEmail);
      const slug = (
        await owner
          .post('/auth/register').set('X-Forwarded-For', nextIp())
          .send({ companyName: 'Empresa Links E2E', firstName: 'Omar', lastName: 'Dueño', email: ownerEmail, password: 'clave-segura-123' })
          .expect(201)
      ).body.memberships[0].slug as string;

      // Invitar a alguien que YA tiene cuenta (el dueño de la otra prueba no; se usa una cuenta nueva)
      const existingEmail = `e2e-existing-${Date.now()}@example.com`;
      createdEmails.push(existingEmail);
      await request(app.getHttpServer())
        .post('/auth/register').set('X-Forwarded-For', nextIp())
        .send({ companyName: 'Otra Empresa E2E', firstName: 'Eva', lastName: 'Existente', email: existingEmail, password: 'clave-segura-123' })
        .expect(201);

      const first = (await owner.post(`/tenants/${slug}/invitations`).send({ email: existingEmail, roleName: 'Contabilidad', allShopsAccess: true }).expect(201)).body;
      const resent = (await owner.post(`/tenants/${slug}/invitations/${first.id}/resend`).expect(200)).body;
      await request(app.getHttpServer()).get(`/invitations/${tokenOf(first.inviteUrl)}`).expect(404); // link viejo ya no sirve

      const preview = (await request(app.getHttpServer()).get(`/invitations/${tokenOf(resent.inviteUrl)}`).expect(200)).body;
      expect(preview.userExists).toBe(true);
      await request(app.getHttpServer()).post(`/invitations/${tokenOf(resent.inviteUrl)}/accept`).send({ password: 'incorrecta' }).expect(401);
      const eva = request.agent(app.getHttpServer());
      await eva.post(`/invitations/${tokenOf(resent.inviteUrl)}/accept`).send({ password: 'clave-segura-123' }).expect(200);
      expect((await eva.get('/auth/me').expect(200)).body.memberships).toHaveLength(2); // su empresa + la nueva

      // Cancelar una invitación invalida su link
      const other = (await owner.post(`/tenants/${slug}/invitations`).send({ email: `e2e-cancel-${Date.now()}@example.com`, roleName: 'Solo lectura', allShopsAccess: true }).expect(201)).body;
      await owner.delete(`/tenants/${slug}/invitations/${other.id}`).expect(204);
      await request(app.getHttpServer()).get(`/invitations/${tokenOf(other.inviteUrl)}`).expect(410);
      expect((await owner.get(`/tenants/${slug}/invitations`).expect(200)).body.total).toBe(0);
    });
  });

  describe('roles personalizados', () => {
    it('crear, asignar, editar (efecto inmediato), proteger predefinidos y no borrar en uso', async () => {
      const owner = request.agent(app.getHttpServer());
      const ownerEmail = `e2e-roles-${Date.now()}@example.com`;
      createdEmails.push(ownerEmail);
      const slug = (
        await owner
          .post('/auth/register')
          .set('X-Forwarded-For', nextIp())
          .send({ companyName: 'Empresa Roles E2E', firstName: 'Rita', lastName: 'Dueña', email: ownerEmail, password: 'clave-segura-123' })
          .expect(201)
      ).body.memberships[0].slug as string;
      const rolesUrl = `/tenants/${slug}/roles`;

      // Validaciones: nombre reservado, permiso inexistente, sin permisos
      await owner.post(rolesUrl).send({ name: 'Owner', permissions: ['orders:read'] }).expect(400);
      await owner.post(rolesUrl).send({ name: 'Raro', permissions: ['*'] }).expect(400);
      await owner.post(rolesUrl).send({ name: 'Vacío', permissions: [] }).expect(400);

      // Crear "Vendedor" (solo ver órdenes) y verlo junto a los predefinidos
      await owner.post(rolesUrl).send({ name: 'Vendedor', description: 'Atiende ventas', permissions: ['orders:read'] }).expect(201);
      await owner.post(rolesUrl).send({ name: 'Vendedor', permissions: ['orders:read'] }).expect(409);
      const roles = (await owner.get(rolesUrl).expect(200)).body.items as { id: number; name: string; isSystem: boolean }[];
      expect((await owner.get(`${rolesUrl}/options`).expect(200)).body).toHaveLength(roles.length);
      const vendedor = roles.find((r) => r.name === 'Vendedor')!;
      const ownerRole = roles.find((r) => r.name === 'OWNER')!;
      const readOnly = roles.find((r) => r.name === 'Solo lectura')!;
      expect(vendedor.isSystem).toBe(false);
      // Dueño (sistema) + 4 roles por defecto de la empresa + Vendedor
      expect(roles.filter((r) => r.isSystem).map((r) => r.name)).toEqual(['OWNER']);
      expect(roles).toHaveLength(6);

      // El Dueño (sistema) no se edita ni se borra
      await owner.patch(`${rolesUrl}/${ownerRole.id}`).send({ name: 'Jefe', permissions: ['orders:read'] }).expect(403);
      await owner.delete(`${rolesUrl}/${ownerRole.id}`).expect(403);
      // Los roles por defecto de la empresa SÍ se editan (y se borran si no están en uso)
      await owner.patch(`${rolesUrl}/${readOnly.id}`).send({ name: 'Solo lectura', permissions: ['orders:read'] }).expect(204);
      await owner.delete(`${rolesUrl}/${readOnly.id}`).expect(204);

      // Invitar con el rol propio y aceptar
      const email = `e2e-vendedor-${Date.now()}@example.com`;
      createdEmails.push(email);
      const invite = (await owner.post(`/tenants/${slug}/invitations`).send({ email, roleName: 'Vendedor', allShopsAccess: true }).expect(201)).body;
      const seller = request.agent(app.getHttpServer());
      await seller
        .post(`/invitations/${invite.inviteUrl.split('/invite/')[1]}/accept`)
        .send({ firstName: 'Vale', lastName: 'Vendedora', password: 'clave-segura-123' })
        .expect(200);
      await seller.post(`/tenants/${slug}/shops`).send({ name: 'No puede', currencyCode: 'USD' }).expect(403);

      // Conteo de miembros por rol (Dueño: 1, Vendedor: 1)
      const counts = Object.fromEntries(
        ((await owner.get(rolesUrl).expect(200)).body.items as { name: string; membersCount: number }[]).map((r) => [r.name, r.membersCount]),
      );
      expect(counts).toMatchObject({ OWNER: 1, Vendedor: 1, Administrador: 0 });

      // Darle "Tiendas" al rol: el vendedor puede crear tiendas AL INSTANTE (sin volver a entrar)
      await owner.patch(`${rolesUrl}/${vendedor.id}`).send({ name: 'Vendedor', permissions: ['orders:read', 'shops:manage'] }).expect(204);
      await seller.post(`/tenants/${slug}/shops`).send({ name: 'Ahora sí', currencyCode: 'USD' }).expect(201);

      // En uso: no se puede borrar
      await owner.delete(`${rolesUrl}/${vendedor.id}`).expect(409);
    });
  });

  // Debe ir AL FINAL: agota el límite de login de esta IP para el resto del archivo.
  it('POST /auth/login responde 429 al superar el límite por IP', async () => {
    // Otros tests ya consumieron parte del límite: se envían intentos hasta recibir 429.
    const server = app.getHttpServer();
    const statuses: number[] = [];
    for (let i = 0; i <= AUTH_LIMITS.login.limit; i++) {
      const res = await request(server).post('/auth/login').send({ email: 'nadie@example.com', password: 'x' });
      statuses.push(res.status);
      if (res.status === 429) break;
    }
    expect(statuses.at(-1)).toBe(429);
    expect(statuses.slice(0, -1).every((s) => s === 401)).toBe(true);

    // Cualquier otra ruta sigue respondiendo: el límite estricto es solo para el login.
    await request(server).get('/health').expect(200);
  });
});
