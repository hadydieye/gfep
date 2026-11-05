import { spawnSync } from 'child_process';
import type { Type } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { assertTestDatabaseUrl, backendRoot } from './setup/test-database.js';

export const SESSION_COOKIE = 'gfep_session';

export const CREDENTIALS = {
  admin: { username: 'm.keita', password: 'GF_Admin2026!' },
  manager: { username: 'f.camara', password: 'GF_Mgr2026!' },
  employee: { username: 'm.diallo', password: 'GF_Emp2026!' },
} as const;

/** Client Prisma de test : refuse de se connecter à une base non suffixée _test. */
export function testPrisma(): PrismaClient {
  return new PrismaClient({ datasourceUrl: assertTestDatabaseUrl(process.env.DATABASE_URL) });
}

/**
 * Application Nest complète, configurée par configureApp() comme src/main.ts.
 * `controllers` permet d'ajouter des contrôleurs de test (ex. interdiction par défaut).
 */
export async function createTestApp(
  options: { controllers?: Type[] } = {},
): Promise<NestExpressApplication> {
  assertTestDatabaseUrl(process.env.DATABASE_URL);
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
    controllers: options.controllers ?? [],
  }).compile();
  const app = configureApp(moduleRef.createNestApplication<NestExpressApplication>({ logger: false }));
  await app.init();
  return app;
}

/** Vide toutes les tables de la base de test (hors historique des migrations). */
export async function resetDatabase(prisma: PrismaClient): Promise<void> {
  assertTestDatabaseUrl(process.env.DATABASE_URL);
  const tables = await prisma.$queryRaw<Array<{ tablename: string }>>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  const list = tables.map(({ tablename }) => `"public"."${tablename}"`).join(', ');
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
}

/** Exécute le script de seed dans un processus séparé, contre la base de test. */
export function runSeed(env: Record<string, string> = {}) {
  const databaseUrl = assertTestDatabaseUrl(process.env.DATABASE_URL);
  return spawnSync(process.execPath, ['--import', 'tsx', 'prisma/seed-mvp1.ts'], {
    cwd: backendRoot,
    env: { ...process.env, DATABASE_URL: databaseUrl, ...env },
    encoding: 'utf8',
  });
}

export function seedOrThrow(): void {
  const result = runSeed();
  if (result.status !== 0) {
    throw new Error(`Seed échoué (code ${result.status}) : ${result.stderr}`);
  }
}

// Chaque appel renvoie une IP distincte, pour isoler les tests du rate limiting par IP
let ipCounter = 0;
export function nextIp(): string {
  ipCounter += 1;
  return `10.42.${Math.floor(ipCounter / 250)}.${(ipCounter % 250) + 1}`;
}

export function login(
  app: NestExpressApplication,
  credentials: { username: string; password: string },
  ip = nextIp(),
) {
  return request(app.getHttpServer())
    .post('/api/v1/auth/login')
    .set('X-Forwarded-For', ip)
    .send(credentials);
}

/** Valeur brute du cookie de session dans une réponse, ou undefined. */
export function sessionTokenFrom(response: request.Response): string | undefined {
  return setCookieFrom(response)?.split(';')[0].split('=')[1];
}

export function setCookieFrom(response: request.Response): string | undefined {
  const header = response.headers['set-cookie'] as unknown as string[] | undefined;
  return header?.find((cookie) => cookie.startsWith(`${SESSION_COOKIE}=`));
}

/** Se connecte et renvoie l'en-tête Cookie à rejouer. */
export async function sessionCookie(
  app: NestExpressApplication,
  credentials: { username: string; password: string },
): Promise<string> {
  const response = await login(app, credentials);
  if (response.status !== 200) {
    throw new Error(`Connexion de ${credentials.username} échouée : ${response.status}`);
  }
  return `${SESSION_COOKIE}=${sessionTokenFrom(response)}`;
}
