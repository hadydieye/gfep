import type { NestExpressApplication } from '@nestjs/platform-express';
import { BadRequestFilter, createValidationPipe } from './common/invalid-data.js';

/** Configuration HTTP de l'application, partagée par main.ts et les tests. */
export function configureApp<T extends NestExpressApplication>(app: T): T {
  app.setGlobalPrefix('api/v1');
  // Le proxy Next.js (rewrites) relaie l'IP cliente via X-Forwarded-For
  app.set('trust proxy', 'loopback');
  app.useGlobalPipes(createValidationPipe());
  app.useGlobalFilters(new BadRequestFilter());
  return app;
}
