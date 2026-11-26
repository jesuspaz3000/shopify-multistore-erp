import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { canGrant, DEFAULT_TENANT_ROLES, hasPermission } from './permissions.js';

const OWNER = ['*'];
const role = (name: string) => DEFAULT_TENANT_ROLES.find((r) => r.name === name)!.permissions;

describe('permisos', () => {
  it('Dueño (*) tiene cualquier permiso; Solo lectura solo lectura', () => {
    expect(hasPermission(OWNER, 'settings:manage')).toBe(true);
    expect(hasPermission(role('Solo lectura'), 'orders:read')).toBe(true);
    expect(hasPermission(role('Solo lectura'), 'orders:write')).toBe(false);
  });

  // Evita que el código y la migración que creó las copias por empresa se desincronicen.
  it('la migración de roles por empresa coincide con DEFAULT_TENANT_ROLES', () => {
    const sql = readFileSync(join(import.meta.dirname, '../../../drizzle/0003_tenant_default_roles.sql'), 'utf8');
    for (const { name, description } of DEFAULT_TENANT_ROLES) {
      expect(sql).toContain(`'${name}', '${description}'`);
    }
  });
});

describe('canGrant (nadie otorga más poder del que tiene)', () => {
  it('el Dueño puede otorgar cualquier rol, incluido Dueño', () => {
    for (const r of DEFAULT_TENANT_ROLES) expect(canGrant(OWNER, r.permissions)).toBe(true);
    expect(canGrant(OWNER, OWNER)).toBe(true);
  });

  it('el Administrador otorga roles menores pero no Dueño', () => {
    expect(canGrant(role('Administrador'), role('Solo lectura'))).toBe(true);
    expect(canGrant(role('Administrador'), role('Encargado de bodega'))).toBe(true);
    expect(canGrant(role('Administrador'), OWNER)).toBe(false);
  });

  it('un rol no puede otorgar permisos que no tiene', () => {
    expect(canGrant(role('Contabilidad'), role('Encargado de bodega'))).toBe(false);
  });
});
