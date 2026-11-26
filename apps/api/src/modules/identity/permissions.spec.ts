import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { GLOBAL_ROLES, hasPermission } from './permissions.js';

describe('permisos', () => {
  it('OWNER (*) tiene cualquier permiso; VIEWER solo lectura', () => {
    expect(hasPermission(GLOBAL_ROLES.OWNER, 'settings:manage')).toBe(true);
    expect(hasPermission(GLOBAL_ROLES.VIEWER, 'orders:read')).toBe(true);
    expect(hasPermission(GLOBAL_ROLES.VIEWER, 'orders:write')).toBe(false);
  });

  // Evita que el código y la migración de roles se desincronicen.
  it('la migración de roles coincide con GLOBAL_ROLES', () => {
    const sql = readFileSync(join(import.meta.dirname, '../../../drizzle/0001_seed_global_roles.sql'), 'utf8');
    for (const [name, permissions] of Object.entries(GLOBAL_ROLES)) {
      const match = new RegExp(`'${name}',[^']*'[^']*',\\s*'(\\[[^\\]]*\\])'`).exec(sql);
      expect(match, `rol ${name} en la migración`).not.toBeNull();
      expect(JSON.parse(match![1])).toEqual(permissions);
    }
  });
});
