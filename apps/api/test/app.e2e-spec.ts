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

    it('productos: opciones y variantes, SKU único, edición que conserva variantes y concurrencia', async () => {
      const a = await registerCompany('Empresa Catalogo E2E');
      const b = await registerCompany('Empresa Catalogo B E2E');
      const base = `/tenants/${a.slug}/products`;

      // Sin opciones: una sola variante "Default Title".
      const simple = (
        await a.agent
          .post(base)
          .send({ title: 'Taza Blanca', status: 'ACTIVE', variants: [{ optionValues: [], sku: 'TAZA-01', price: '12.5', cost: '4' }] })
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
