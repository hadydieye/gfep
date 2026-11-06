import type { NestExpressApplication } from '@nestjs/platform-express';
import { PrismaClient, UserStatus } from '@prisma/client';
import { LOCK_DURATION_MS } from '../src/auth/auth.service.js';
import {
  CREDENTIALS,
  createTestApp,
  login,
  nextIp,
  resetDatabase,
  seedOrThrow,
  setCookieFrom,
  testPrisma,
} from './helpers.js';

const GENERIC_401 = { message: 'Identifiants invalides.', error: 'Unauthorized', statusCode: 401 };

describe('Verrouillage temporaire (intégration, horloge simulée)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaClient;

  beforeAll(async () => {
    prisma = testPrisma();
    await resetDatabase(prisma);
    seedOrThrow();
    app = await createTestApp();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  const user = (username: string) => prisma.user.findUniqueOrThrow({ where: { username } });

  /** 5 échecs depuis une même IP : le compte passe LOCKED (horloge réelle). */
  async function lock(username: string) {
    const ip = nextIp();
    for (let i = 0; i < 5; i += 1) {
      expect((await login(app, { username, password: 'mauvais' }, ip)).status).toBe(401);
    }
    expect((await user(username)).status).toBe(UserStatus.LOCKED);
  }

  /** Avance l'horloge de l'application ; seule Date est simulée (Postgres garde l'heure réelle). */
  function advanceClock(ms: number) {
    const now = Date.now();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(now + ms);
  }

  it('pendant le verrou, le bon mot de passe est refusé sans différence observable', async () => {
    await lock(CREDENTIALS.employee.username);

    const wrong = await login(app, { username: CREDENTIALS.admin.username, password: 'mauvais' });
    const lockedGood = await login(app, CREDENTIALS.employee);

    expect(lockedGood.status).toBe(401);
    expect(lockedGood.body).toEqual(GENERIC_401);
    expect(lockedGood.body).toEqual(wrong.body);
    expect(setCookieFrom(lockedGood)).toBeUndefined();
  });

  it('toujours verrouillé juste avant 15 minutes', async () => {
    advanceClock(LOCK_DURATION_MS - 60_000);
    const response = await login(app, CREDENTIALS.employee);
    expect(response.status).toBe(401);
    expect((await user('m.diallo')).status).toBe(UserStatus.LOCKED);
  });

  it('déverrouillé au premier essai après 15 minutes, compteur remis à zéro', async () => {
    advanceClock(LOCK_DURATION_MS + 1_000);
    const response = await login(app, CREDENTIALS.employee);

    expect(response.status).toBe(200);
    expect(setCookieFrom(response)).toBeDefined();
    const unlocked = await user('m.diallo');
    expect(unlocked.status).toBe(UserStatus.ACTIVE);
    expect(unlocked.failedLoginCount).toBe(0);
  });

  it('après expiration, un mauvais mot de passe repart d’un compteur à 1', async () => {
    await lock(CREDENTIALS.manager.username);
    advanceClock(LOCK_DURATION_MS + 1_000);

    const response = await login(app, { username: CREDENTIALS.manager.username, password: 'mauvais' });
    expect(response.status).toBe(401);
    expect(response.body).toEqual(GENERIC_401);
    const afterExpiry = await user(CREDENTIALS.manager.username);
    expect(afterExpiry.status).toBe(UserStatus.ACTIVE);
    expect(afterExpiry.failedLoginCount).toBe(1);
  });

  it('un nouveau verrou repart pour 15 minutes', async () => {
    // f.camara : 1 échec déjà compté, 4 de plus reverrouillent le compte
    const ip = nextIp();
    for (let i = 0; i < 4; i += 1) {
      await login(app, { username: CREDENTIALS.manager.username, password: 'mauvais' }, ip);
    }
    expect((await user(CREDENTIALS.manager.username)).status).toBe(UserStatus.LOCKED);
    expect((await login(app, CREDENTIALS.manager)).status).toBe(401);
  });

  it('un compte verrouillé sans événement ACCOUNT_LOCKED reste verrouillé', async () => {
    await prisma.user.update({ where: { username: CREDENTIALS.admin.username }, data: { status: UserStatus.LOCKED } });
    advanceClock(24 * 60 * 60 * 1000);
    expect((await login(app, CREDENTIALS.admin)).status).toBe(401);
    expect((await user(CREDENTIALS.admin.username)).status).toBe(UserStatus.LOCKED);
  });
});
