import { join } from 'path';
import { defineConfig } from 'vitest/config';
import { backendRoot, testDatabaseUrl, testStorageDir } from './test/setup/test-database.js';

/**
 * Tests contre le LDAP de test Docker (étape 2.7, critère de passage) :
 *   ./infra/ldap-test/generate-certs.sh && docker compose --profile ad-test up -d ldap-test
 *   npm run test:ad -w apps/backend
 * Jamais un vrai AD. Mots de passe de l'annuaire de test : infra/ldap-test/README.md.
 */
const port = process.env.LDAP_TEST_PORT || '636';

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['test/**/*.ad-spec.ts'],
    globalSetup: ['./test/setup/global-setup.ts'],
    env: {
      DATABASE_URL: testDatabaseUrl(),
      NODE_ENV: 'test',
      SESSION_COOKIE_NAME: 'gfep_session',
      DOCUMENTS_STORAGE_DIR: testStorageDir(),
      AD_LDAP_URL: `ldaps://127.0.0.1:${port}`,
      AD_BASE_DN: 'dc=gnpaytrust,dc=local',
      AD_USER_ID_ATTRIBUTE: 'uid',
      AD_MAIL_ATTRIBUTE: 'mail',
      AD_GROUPS_ATTRIBUTE: 'memberOf',
      AD_GUID_ATTRIBUTE: 'entryUUID',
      AD_SID_ATTRIBUTE: '',
      AD_BIND_DN: 'cn=svc-ldapreader,ou=ServiceAccounts,dc=gnpaytrust,dc=local',
      AD_BIND_PASSWORD: process.env.AD_TEST_BIND_PASSWORD || 'SvcReader-2026!',
      AD_CA_CERT_PATH: join(backendRoot, '../../infra/ldap-test/certs/ca.crt'),
      AD_TIMEOUT_MS: '3000',
      LDAP_TEST_CONTAINER: process.env.LDAP_TEST_CONTAINER || 'gfep_ldap_test',
    },
    fileParallelism: false,
    testTimeout: 60_000,
    hookTimeout: 120_000,
  },
});
