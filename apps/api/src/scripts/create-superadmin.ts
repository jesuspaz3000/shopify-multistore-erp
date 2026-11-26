// Crea (o promueve) el SUPERADMIN de la plataforma: el administrador del SaaS, por encima de las empresas.
//
//   npm run superadmin:create -- --email tu@correo.com [--first Nombre] [--last Apellido]
//
// La contraseña se pide por consola con entrada oculta y NUNCA se guarda en archivos (.env, historial).
// Para automatizar (CI), se puede pasar en la variable SUPERADMIN_PASSWORD solo para ese comando.
import { emailSchema, passwordSchema } from '@erp/contracts';
import { NestFactory } from '@nestjs/core';
import { eq } from 'drizzle-orm';
import { parseArgs } from 'node:util';
import { AppModule } from '../app.module.js';
import { AuditService } from '../modules/audit/audit.service.js';
import { PasswordService } from '../modules/identity/auth/password.service.js';
import { users } from '../modules/identity/identity.schema.js';
import { DB, type Database } from '../shared/database/database.module.js';

/** Lee una línea sin mostrarla (muestra * por cada carácter). */
function askHidden(prompt: string): Promise<string> {
  const { stdin, stdout } = process;
  stdout.write(prompt);
  if (!stdin.isTTY) throw new Error('Ejecuta el comando en una terminal interactiva o usa SUPERADMIN_PASSWORD.');

  return new Promise((resolve) => {
    let value = '';
    stdin.setRawMode(true);
    stdin.setEncoding('utf8');
    stdin.resume();
    const onData = (chunk: string) => {
      for (const char of chunk) {
        if (char === '\r' || char === '\n') {
          stdin.setRawMode(false);
          stdin.pause();
          stdin.off('data', onData);
          stdout.write('\n');
          resolve(value);
          return;
        }
        if (char === '\u0003') {
          stdout.write('\nCancelado.\n');
          process.exit(130);
        }
        if (char === '\u007f' || char === '\b') {
          if (value.length > 0) {
            value = value.slice(0, -1);
            stdout.write('\b \b');
          }
          continue;
        }
        value += char;
        stdout.write('*');
      }
    };
    stdin.on('data', onData);
  });
}

async function readPassword(): Promise<string> {
  const fromEnv = process.env.SUPERADMIN_PASSWORD;
  if (fromEnv) return passwordSchema.parse(fromEnv);

  for (;;) {
    const password = await askHidden('Contraseña: ');
    const parsed = passwordSchema.safeParse(password);
    if (!parsed.success) {
      console.error(`  ${parsed.error.issues[0].message}`);
      continue;
    }
    if ((await askHidden('Repite la contraseña: ')) !== password) {
      console.error('  Las contraseñas no coinciden.');
      continue;
    }
    return password;
  }
}

async function main() {
  const { values } = parseArgs({
    options: {
      email: { type: 'string' },
      first: { type: 'string', default: 'Super' },
      last: { type: 'string', default: 'Admin' },
    },
  });

  const email = emailSchema.safeParse(values.email);
  if (!email.success) {
    console.error('Uso: npm run superadmin:create -- --email tu@correo.com [--first Nombre] [--last Apellido]');
    process.exitCode = 1;
    return;
  }

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
    const passwordHash = await app.get(PasswordService).hash(await readPassword());
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

await main();
