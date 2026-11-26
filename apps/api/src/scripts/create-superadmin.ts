// Crea (o promueve) el SUPERADMIN de la plataforma: el administrador del SaaS, por encima de las empresas.
//
//   npm run superadmin:create                  -> pregunta el email por consola
//   npm run superadmin:create -- --email tu@correo.com [--first Nombre] [--last Apellido]
//
// La contraseña se pide por consola con entrada oculta y NUNCA se guarda en archivos (.env, historial).
// Para automatizar (CI), se puede pasar en la variable SUPERADMIN_PASSWORD solo para ese comando.
import { emailSchema, registerSchema } from '@erp/contracts';
import { NestFactory } from '@nestjs/core';
import { eq } from 'drizzle-orm';
import { parseArgs } from 'node:util';
import { AppModule } from '../app.module.js';
import { AuditService } from '../modules/audit/audit.service.js';
import { PasswordService } from '../modules/identity/auth/password.service.js';
import { users } from '../modules/identity/identity.schema.js';
import { DB, type Database } from '../shared/database/database.module.js';
import { argOrAsk, cleanArg, readNewPassword } from './cli-prompt.js';

async function main() {
  const { values } = parseArgs({
    options: {
      email: { type: 'string' },
      first: { type: 'string', default: 'Super' },
      last: { type: 'string', default: 'Admin' },
    },
  });

  const email = { data: await argOrAsk(values.email, 'Email del superadmin: ', emailSchema, '--email') };
  values.first = registerSchema.shape.firstName.parse(cleanArg(values.first));
  values.last = registerSchema.shape.lastName.parse(cleanArg(values.last));

  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  try {
    const db = app.get<Database>(DB);
    const audit = app.get(AuditService);
    const [existing] = await db.select().from(users).where(eq(users.email, email.data)).limit(1);

    if (existing) {
      // Usuario existente: solo se promueve (conserva su contraseña).
      if (existing.isSuperuser) {
        console.log(`${email.data} ya es superadmin. Sin cambios.`);
        return;
      }
      await db.update(users).set({ isSuperuser: true }).where(eq(users.id, existing.id));
      await audit.record({ userId: existing.id, source: 'SYSTEM', entityType: 'User', entityId: existing.id, action: 'PROMOTE_SUPERADMIN' });
      console.log(`✔ ${email.data} ahora es superadmin (conserva su contraseña actual).`);
      return;
    }

    console.log(`Creando superadmin ${email.data}`);
    const passwordHash = await app.get(PasswordService).hash(await readNewPassword('SUPERADMIN_PASSWORD'));
    const [user] = await db
      .insert(users)
      .values({
        email: email.data,
        passwordHash,
        firstName: values.first!,
        lastName: values.last!,
        isSuperuser: true,
        emailVerifiedAt: new Date(),
      })
      .returning({ id: users.id });
    await audit.record({ userId: user.id, source: 'SYSTEM', entityType: 'User', entityId: user.id, action: 'CREATE_SUPERADMIN' });
    console.log(`✔ Superadmin creado. Ya puedes iniciar sesión en http://localhost:3000/login con ${email.data}`);
  } finally {
    await app.close();
  }
}

main().catch((error: unknown) => {
  console.error(`✖ ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
