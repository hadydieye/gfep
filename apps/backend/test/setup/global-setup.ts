import { execFileSync } from 'child_process';
import { mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { PrismaClient } from '@prisma/client';
import { backendRoot, testDatabaseUrl, testStorageDir } from './test-database.js';

// Crée la base de test si besoin puis applique les migrations (une fois par `npm test`)
export default async function globalSetup() {
  const databaseUrl = testDatabaseUrl();
  const databaseName = new URL(databaseUrl).pathname.slice(1);

  const maintenanceUrl = new URL(databaseUrl);
  maintenanceUrl.pathname = '/postgres';
  const admin = new PrismaClient({ datasourceUrl: maintenanceUrl.toString() });
  try {
    const existing = await admin.$queryRaw<unknown[]>`
      SELECT 1 FROM pg_database WHERE datname = ${databaseName}`;
    if (existing.length === 0) {
      await admin.$executeRawUnsafe(`CREATE DATABASE "${databaseName}"`);
    }
  } finally {
    await admin.$disconnect();
  }

  // Fichiers de documents isolés, jamais ceux du développement
  rmSync(testStorageDir(), { recursive: true, force: true });
  mkdirSync(testStorageDir(), { recursive: true });

  execFileSync(join(backendRoot, '../../node_modules/.bin/prisma'), ['migrate', 'deploy'], {
    cwd: backendRoot,
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: 'pipe',
  });
}
