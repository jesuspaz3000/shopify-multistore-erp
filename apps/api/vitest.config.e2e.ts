import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    // Se definen antes de importar AppModule (ConfigModule lee el entorno al importarse).
    // Tienen prioridad sobre el .env: los tests ejercitan el registro aunque en local esté desactivado.
    env: { ALLOW_SIGNUP: 'true' },
  },
});
