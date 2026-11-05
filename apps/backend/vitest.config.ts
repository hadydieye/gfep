import { defineConfig } from 'vitest/config';
import { testDatabaseUrl } from './test/setup/test-database.js';

export default defineConfig({
  // Resolves the path aliases declared in tsconfig.json, including the ones
  // added by `nest g library`. Requires Vite 8, which ships this option.
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['src/**/*.spec.ts', 'test/**/*.int-spec.ts'],
    // Base isolée (suffixe _test), jamais la base de développement
    globalSetup: ['./test/setup/global-setup.ts'],
    env: {
      DATABASE_URL: testDatabaseUrl(),
      NODE_ENV: 'test',
      SESSION_COOKIE_NAME: 'gfep_session',
    },
    // Les suites partagent la base de test : exécution séquentielle
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
