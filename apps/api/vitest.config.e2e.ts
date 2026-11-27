import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    // Se definen antes de importar AppModule (ConfigModule lee el entorno al importarse).
    // Tienen prioridad sobre el .env: los tests ejercitan el registro aunque en local esté desactivado.
    // Las imágenes subidas en los tests van a una carpeta temporal (no a storage/ del proyecto).
    env: {
      ALLOW_SIGNUP: 'true',
      MEDIA_STORAGE_ROOT: join(tmpdir(), 'erp-e2e-media'),
      // Llave fija SOLO para tests (32 bytes en base64); Shopify se simula con fetch.
      TOKEN_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString('base64'),
    },
  },
});
