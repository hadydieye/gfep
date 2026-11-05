import { readFileSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { parseEnv } from 'util';

const backendRoot = join(dirname(fileURLToPath(import.meta.url)), '../..');

/**
 * URL de la base de test : TEST_DATABASE_URL si fournie, sinon DATABASE_URL
 * (environnement ou apps/backend/.env) avec le nom de base suffixé par `_test`.
 * Lit .env sans modifier process.env.
 */
export function testDatabaseUrl(): string {
  if (process.env.TEST_DATABASE_URL) {
    return assertTestDatabaseUrl(process.env.TEST_DATABASE_URL);
  }
  let devUrl = process.env.DATABASE_URL;
  if (!devUrl) {
    const env = parseEnv(readFileSync(join(backendRoot, '.env'), 'utf8'));
    devUrl = env.DATABASE_URL;
  }
  if (!devUrl) {
    throw new Error('DATABASE_URL introuvable : impossible de dériver la base de test.');
  }
  const url = new URL(devUrl);
  const name = url.pathname.slice(1);
  if (!name.endsWith('_test')) url.pathname = `/${name}_test`;
  return assertTestDatabaseUrl(url.toString());
}

/** Garde-fou : refuse toute base dont le nom ne se termine pas par `_test`. */
export function assertTestDatabaseUrl(databaseUrl: string | undefined): string {
  const name = databaseUrl ? new URL(databaseUrl).pathname.slice(1) : '';
  if (!name.endsWith('_test')) {
    throw new Error(`Base "${name}" refusée : les tests n'utilisent qu'une base suffixée _test.`);
  }
  return databaseUrl!;
}

/** Répertoire des fichiers de documents pendant les tests, vidé par le globalSetup. */
export function testStorageDir(): string {
  return join(tmpdir(), 'gfep-test-documents');
}

export { backendRoot };
