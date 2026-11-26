import { StandardSchemaValidationPipe } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
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
describe('API (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
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
      .post('/auth/register')
      .send({ companyName: 'Empresa E2E', firstName: 'Ana', lastName: 'Prueba', email, password: 'clave-segura-123' })
      .expect(201);
    expect(registered.body.memberships[0]).toMatchObject({ role: 'OWNER', companyName: 'Empresa E2E' });

    await agent.get('/auth/me').expect(200);
    await agent.post('/auth/logout').expect(204);
    await agent.get('/auth/me').expect(401);
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
