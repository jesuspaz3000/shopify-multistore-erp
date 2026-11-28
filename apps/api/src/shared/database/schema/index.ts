// Re-exporta las tablas de todos los módulos: lo usan drizzle-kit (migraciones) y el cliente tipado.
export * from '../../../modules/identity/identity.schema.js';
export * from '../../../modules/shops/shops.schema.js';
export * from '../../../modules/audit/audit.schema.js';
export * from '../../../modules/inventory/infrastructure/persistence/inventory.schema.js';
export * from '../../../modules/catalog/infrastructure/persistence/catalog.schema.js';
export * from '../../../modules/sync/infrastructure/persistence/sync.schema.js';
export * from '../../../modules/catalog/taxonomy/taxonomy.schema.js';
