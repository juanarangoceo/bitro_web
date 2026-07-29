import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Los paquetes exponen TypeScript sin build; Vitest los transpila al vuelo.
    include: ['packages/**/*.test.ts', 'apps/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/.next/**'],
    environment: 'node',
  },
});
