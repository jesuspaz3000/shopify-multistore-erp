import { defineConfig } from 'vitest/config';

// Tests unitarios de lógica pura del frontend (sin DOM): *.test.ts junto al código.
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    include: ['src/**/*.test.ts'],
  },
});
