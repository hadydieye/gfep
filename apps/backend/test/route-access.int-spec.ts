import { Controller, Get, RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants.js';
import { ModulesContainer, Reflector } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { IS_PUBLIC_KEY } from '../src/auth/decorators/public.decorator.js';
import { AUTHENTICATED_ONLY_KEY } from '../src/rbac/decorators/authenticated-only.decorator.js';
import { PERMISSION_KEY } from '../src/rbac/decorators/permission.decorator.js';
import { Roles } from '../src/rbac/decorators/roles.decorator.js';
import { ROLES_KEY } from '../src/rbac/decorators/roles.decorator.js';
import {
  CREDENTIALS,
  createTestApp,
  resetDatabase,
  seedOrThrow,
  sessionCookie,
  testPrisma,
} from './helpers.js';

// Seules routes autorisées sans session
// POST /auth/login-ad (étape 2.7, T1.3) : point d'entrée d'authentification AD, équivalent de /auth/login
const ALLOWED_PUBLIC = ['GET /api/v1/health', 'POST /api/v1/auth/login', 'POST /api/v1/auth/login-ad'];

interface RouteInfo {
  key: string;
  path: string;
  method: string;
  isPublic: boolean;
  authenticatedOnly: boolean;
  roles: string[] | undefined;
  permission: unknown;
}

/** Inventaire des routes à partir des contrôleurs enregistrés dans le conteneur Nest. */
function discoverRoutes(app: NestExpressApplication): RouteInfo[] {
  const reflector = app.get(Reflector);
  const routes: RouteInfo[] = [];
  for (const moduleRef of app.get(ModulesContainer).values()) {
    for (const wrapper of moduleRef.controllers.values()) {
      const controller = wrapper.metatype as (new (...args: never[]) => unknown) | undefined;
      if (!controller) continue;
      const base = String(Reflect.getMetadata(PATH_METADATA, controller) ?? '');
      for (const name of Object.getOwnPropertyNames(controller.prototype)) {
        const handler = controller.prototype[name];
        if (name === 'constructor' || typeof handler !== 'function') continue;
        const subPath = Reflect.getMetadata(PATH_METADATA, handler);
        if (subPath === undefined) continue;
        const method = RequestMethod[Reflect.getMetadata(METHOD_METADATA, handler) as number];
        const path = ['/api/v1', base, String(subPath)]
          .map((part) => part.replace(/^\/|\/$/g, ''))
          .filter(Boolean)
          .join('/');
        const targets = [handler, controller];
        routes.push({
          key: `${method} /${path}`,
          path: `/${path}`,
          method,
          isPublic: reflector.getAllAndOverride(IS_PUBLIC_KEY, targets) === true,
          authenticatedOnly: reflector.getAllAndOverride(AUTHENTICATED_ONLY_KEY, targets) === true,
          roles: reflector.getAllAndOverride(ROLES_KEY, targets),
          permission: reflector.getAllAndOverride(PERMISSION_KEY, targets),
        });
      }
    }
  }
  return routes;
}

/** Routes réellement montées dans Express (contrôle croisé de l'inventaire). */
function expressRoutes(app: NestExpressApplication): string[] {
  const instance = app.getHttpAdapter().getInstance();
  const stack = (instance.router ?? instance._router).stack as Array<{
    route?: { path: string; methods: Record<string, boolean> };
  }>;
  return stack
    .filter((layer) => layer.route)
    .flatMap(({ route }) =>
      Object.keys(route!.methods).map((m) => `${m.toUpperCase()} ${route!.path}`),
    );
}

describe('Interdiction par défaut (intégration)', () => {
  let app: NestExpressApplication;
  let routes: RouteInfo[];

  beforeAll(async () => {
    app = await createTestApp();
    routes = discoverRoutes(app);
  });

  afterAll(async () => {
    await app.close();
  });

  it('l’inventaire couvre toutes les routes montées dans Express', () => {
    // Nest monte un gestionnaire « route introuvable » sur le préfixe nu, pour toutes les méthodes
    const mounted = expressRoutes(app).filter((key) => !key.endsWith(' /api/v1'));
    expect(routes.length).toBeGreaterThan(0);
    expect(routes.map((r) => r.key).sort()).toEqual([...new Set(mounted)].sort());
  });

  it('le préfixe nu /api/v1 ne sert rien (404)', async () => {
    expect((await request(app.getHttpServer()).get('/api/v1')).status).toBe(404);
  });

  it('seules /health, /auth/login et /auth/login-ad sont @Public()', () => {
    expect(routes.filter((r) => r.isPublic).map((r) => r.key).sort()).toEqual(
      [...ALLOWED_PUBLIC].sort(),
    );
  });

  it('chaque route non publique a @AuthenticatedOnly() ou @Roles() ET @Permission()', () => {
    const missing = routes
      .filter((r) => !r.isPublic && !r.authenticatedOnly)
      .filter((r) => !r.roles?.length || !r.permission)
      .map((r) => r.key);
    expect(missing, 'routes sans métadonnées d’autorisation').toEqual([]);
  });

  it('chaque route non publique renvoie 401 sans session, les routes publiques non', async () => {
    const uuid = '00000000-0000-4000-8000-000000000000';
    for (const route of routes) {
      const path = route.path.replace(/:[^/]+/g, uuid);
      const call = request(app.getHttpServer())[
        route.method.toLowerCase() as 'get' | 'post' | 'patch' | 'put' | 'delete'
      ](path);
      const { status } = await call.set('X-Forwarded-For', '10.77.0.1').send({});
      if (route.isPublic) {
        expect(status, route.key).not.toBe(401);
      } else {
        expect(status, route.key).toBe(401);
      }
    }
  });
});

// Contrôleurs volontairement incomplets : ils ne doivent jamais être accessibles
@Controller('test-sans-decorateur')
class UndecoratedController {
  @Get()
  open() {
    return 'accessible';
  }
}

@Controller('test-roles-seuls')
class RolesOnlyController {
  @Get()
  @Roles('SUPER_ADMIN')
  open() {
    return 'accessible';
  }
}

describe('Interdiction par défaut : routes sans métadonnées', () => {
  let app: NestExpressApplication;
  let prisma: PrismaClient;
  let adminCookie: string;

  beforeAll(async () => {
    prisma = testPrisma();
    await resetDatabase(prisma);
    seedOrThrow();
    app = await createTestApp({ controllers: [UndecoratedController, RolesOnlyController] });
    adminCookie = await sessionCookie(app, CREDENTIALS.admin);
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it.each(['/api/v1/test-sans-decorateur', '/api/v1/test-roles-seuls'])(
    '%s : 401 sans session, 403 même pour SUPER_ADMIN',
    async (path) => {
      expect((await request(app.getHttpServer()).get(path)).status).toBe(401);
      const asAdmin = await request(app.getHttpServer()).get(path).set('Cookie', adminCookie);
      expect(asAdmin.status).toBe(403);
      expect(asAdmin.text).not.toContain('accessible');
    },
  );
});
