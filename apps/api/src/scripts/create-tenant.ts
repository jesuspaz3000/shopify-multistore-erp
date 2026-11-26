// Crea una EMPRESA (tenant) con su dueño (OWNER). Es la forma de dar de alta empresas cuando
// el registro público está desactivado (ALLOW_SIGNUP=false, administración privada).
//
//   npm run tenant:create                      -> pregunta los datos por consola (recomendado)
//   npm run tenant:create -- --company "Mi Empresa" --owner dueno@correo.com [--first Nombre] [--last Apellido]
//
// - Si el email del dueño YA existe (ej. tu superadmin), se le asigna la empresa: conserva su contraseña.
// - Si NO existe, se crea el usuario y se pide su contraseña por consola (entrada oculta).
//   Para automatizar se puede pasar en OWNER_PASSWORD solo para ese comando.
import { emailSchema, registerSchema } from '@erp/contracts';
import { NestFactory } from '@nestjs/core';
import { parseArgs } from 'node:util';
import { AppModule } from '../app.module.js';
import { PasswordService } from '../modules/identity/auth/password.service.js';
import { IdentityRepository } from '../modules/identity/identity.repository.js';
import { TenantProvisioningService } from '../modules/identity/tenant-provisioning.service.js';
import { argOrAsk, readNewPassword } from './cli-prompt.js';

async function main() {
  const { values } = parseArgs({
    options: {
      company: { type: 'string' },
      owner: { type: 'string' },
      first: { type: 'string' },
      last: { type: 'string' },
    },
  });

  // Se validan los datos ANTES de conectar a la base de datos.
  const companyName = await argOrAsk(values.company, 'Nombre de la empresa: ', registerSchema.shape.companyName, '--company');
  const ownerEmail = await argOrAsk(values.owner, 'Email del dueño: ', emailSchema, '--owner');

  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  try {
    const repo = app.get(IdentityRepository);
    const provisioning = app.get(TenantProvisioningService);
    const existing = await repo.findUserByEmail(ownerEmail);

    // Datos y contraseña del dueño nuevo: se piden ANTES de abrir la transacción.
    let newUser: { firstName: string; lastName: string; passwordHash: string } | undefined;
    if (existing) {
      console.log(`El usuario ${ownerEmail} ya existe: será el dueño (conserva su contraseña).`);
    } else {
      console.log(`El usuario ${ownerEmail} no existe: se creará.`);
      const firstName = await argOrAsk(values.first, 'Nombre del dueño: ', registerSchema.shape.firstName, '--first');
      const lastName = await argOrAsk(values.last, 'Apellido del dueño: ', registerSchema.shape.lastName, '--last');
      const passwordHash = await app.get(PasswordService).hash(await readNewPassword('OWNER_PASSWORD'));
      newUser = { firstName, lastName, passwordHash };
    }

    const tenant = await repo.transaction(async (tx) => {
      const ownerId =
        existing?.id ?? (await repo.insertUser({ email: ownerEmail, emailVerifiedAt: new Date(), ...newUser! }, tx)).id;
      return provisioning.createTenantWithOwner(
        { companyName, billingEmail: ownerEmail, ownerUserId: ownerId, source: 'SYSTEM' },
        tx,
      );
    });

    console.log(`✔ Empresa "${tenant.companyName}" creada (slug: ${tenant.slug}).`);
    console.log(`  Entra en http://localhost:3000/login y abre http://localhost:3000/${tenant.slug}/all`);
  } finally {
    await app.close();
  }
}

main().catch((error: unknown) => {
  console.error(`✖ ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
