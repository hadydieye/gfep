import { defineConfig } from 'vitest/config';
import { testDatabaseUrl, testStorageDir } from './test/setup/test-database.js';

export default defineConfig({
  // Resolves the path aliases declared in tsconfig.json, including the ones
  // added by `nest g library`. Requires Vite 8, which ships this option.
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['src/**/*.spec.ts', 'test/**/*.int-spec.ts', 'test/**/*.e2e-spec.ts'],
    // Base isolée (suffixe _test), jamais la base de développement
    globalSetup: ['./test/setup/global-setup.ts'],
    env: {
      DATABASE_URL: testDatabaseUrl(),
      NODE_ENV: 'test',
      SESSION_COOKIE_NAME: 'gfep_session',
      DOCUMENTS_STORAGE_DIR: testStorageDir(),
      // npm test sans annuaire : AD non configuré (les tests AD réels passent par npm run test:ad)
      AD_LDAP_URL: '',
    },
    // Les suites partagent la base de test : exécution séquentielle
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
