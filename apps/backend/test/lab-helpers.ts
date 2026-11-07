import type { Type } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { LabModule } from '../src/lab/lab.module.js';
import { assertTestDatabaseUrl, backendRoot } from './setup/test-database.js';
import { createTestApp } from './helpers.js';

export { createTestApp } from './helpers.js';

/**
 * Application Nest avec LabModule importé explicitement — simule LAB_MODE=true
 * sans dépendre de process.env (qui est évalué au chargement du module ESM).
 *
 * Utilisée par tous les tests de scénarios lab pour la branche "exploitation".
 */
export async function createLabTestApp(
  options: { controllers?: Type[]; overrides?: Array<{ provide: unknown; useValue: unknown }> } = {},
): Promise<NestExpressApplication> {
  assertTestDatabaseUrl(process.env.DATABASE_URL);
  // Positionner LAB_MODE pour que LabPingController et les scénarios le détectent au runtime.
  process.env.LAB_MODE = 'true';
  let builder = Test.createTestingModule({
    imports: [AppModule, LabModule],
    controllers: options.controllers ?? [],
  });
  for (const { provide, useValue } of options.overrides ?? []) {
    builder = builder.overrideProvider(provide).useValue(useValue);
  }
  const moduleRef = await builder.compile();
  const app = configureApp(moduleRef.createNestApplication<NestExpressApplication>({ logger: false }));
  await app.init();
  return app;
}

export { assertTestDatabaseUrl, backendRoot };
