import type { NestExpressApplication } from '@nestjs/platform-express';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { CREDENTIALS, createTestApp, resetDatabase, seedOrThrow, sessionCookie, testPrisma } from './helpers.js';

/** Étape 2.7 — mappings groupe AD → rôle (R32, M22) : SA et ITA ; SUPER_ADMIN réservé au SA. */
type RoleKey = keyof typeof CREDENTIALS;
const ROLE_KEYS = Object.keys(CREDENTIALS) as RoleKey[];
const ALLOWED: RoleKey[] = ['admin', 'itAdmin'];
const GROUPS = 'ou=Informatique,dc=gnpaytrust,dc=local';

describe('Mappings groupe AD → rôle (intégration)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaClient;
  let sessions: Record<RoleKey, string>;
  let roleIds: Map<string, string>;
  let counter = 0;

  beforeAll(async () => {
    prisma = testPrisma();
    await resetDatabase(prisma);
    seedOrThrow();
    app = await createTestApp();
    sessions = {} as Record<RoleKey, string>;
    for (const key of ROLE_KEYS) sessions[key] = await sessionCookie(app, CREDENTIALS[key]);
    roleIds = new Map((await prisma.role.findMany()).map((r) => [r.name, r.id]));
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  const api = (key: RoleKey) => ({
    list: () => request(app.getHttpServer()).get('/api/v1/access/ad-mappings').set('Cookie', sessions[key]),
    create: (adGroupDn: string, role: string) =>
      request(app.getHttpServer()).post('/api/v1/access/ad-mappings').set('Cookie', sessions[key]).send({ adGroupDn, roleId: roleIds.get(role) }),
    remove: (id: string) => request(app.getHttpServer()).delete(`/api/v1/access/ad-mappings/${id}`).set('Cookie', sessions[key]),
  });
  const dn = () => {
    counter += 1;
    return `cn=GFEP-Test-${counter},${GROUPS}`;
  };

  it.each(ROLE_KEYS)('%s : lecture, création et suppression', async (key) => {
    const allowed = ALLOWED.includes(key);
    expect((await api(key).list()).status).toBe(allowed ? 200 : 403);
    const created = await api(key).create(dn(), 'EMPLOYEE');
    expect(created.status).toBe(allowed ? 201 : 403);
    const target = allowed
      ? created.body.id
      : (await prisma.adGroupRoleMapping.create({ data: { adGroupDn: dn(), roleId: roleIds.get('EMPLOYEE')! } })).id;
    expect((await api(key).remove(target)).status).toBe(allowed ? 204 : 403);
    expect(await prisma.adGroupRoleMapping.count({ where: { id: target } })).toBe(allowed ? 0 : 1);
  });

  describe('garde-fou SUPER_ADMIN (M22)', () => {
    it('l’IT_ADMINISTRATOR ne crée pas de mapping vers SUPER_ADMIN ; le SUPER_ADMIN le peut', async () => {
      const groupDn = `cn=GFEP-SuperAdmins,${GROUPS}`;
      expect((await api('itAdmin').create(groupDn, 'SUPER_ADMIN')).status).toBe(403);
      expect(await prisma.adGroupRoleMapping.count({ where: { adGroupDn: groupDn } })).toBe(0);
      const created = await api('admin').create(groupDn, 'SUPER_ADMIN');
      expect(created.status).toBe(201);
      expect(created.body).toMatchObject({ adGroupDn: groupDn, role: { name: 'SUPER_ADMIN' } });
    });

    it('l’IT_ADMINISTRATOR ne supprime pas un mapping vers SUPER_ADMIN ; il gère les autres rôles', async () => {
      const superAdmin = await prisma.adGroupRoleMapping.findFirstOrThrow({ where: { roleId: roleIds.get('SUPER_ADMIN') } });
      expect((await api('itAdmin').remove(superAdmin.id)).status).toBe(403);
      expect(await prisma.adGroupRoleMapping.count({ where: { id: superAdmin.id } })).toBe(1);
      const accountants = await api('itAdmin').create(dn(), 'ACCOUNTANT');
      expect(accountants.status).toBe(201);
      expect((await api('itAdmin').remove(accountants.body.id)).status).toBe(204);
      expect((await api('admin').remove(superAdmin.id)).status).toBe(204);
    });
  });

  describe('validation et audit', () => {
    it('DN invalide ou trop long → 400 ; rôle inexistant → 400 ; doublon → 409 ; inconnu → 404', async () => {
      expect((await api('admin').create('pas un DN', 'EMPLOYEE')).status).toBe(400);
      expect((await api('admin').create(`cn=${'x'.repeat(500)},${GROUPS}`, 'EMPLOYEE')).status).toBe(400);
      const unknownRole = await request(app.getHttpServer())
        .post('/api/v1/access/ad-mappings')
        .set('Cookie', sessions.admin)
        .send({ adGroupDn: dn(), roleId: '00000000-0000-4000-8000-000000000000' });
      expect(unknownRole.status).toBe(400);
      expect(unknownRole.body.message).toBe('Rôle inexistant.');
      const groupDn = dn();
      expect((await api('admin').create(groupDn, 'EMPLOYEE')).status).toBe(201);
      const duplicate = await api('admin').create(groupDn, 'AUDITOR');
      expect(duplicate.status).toBe(409);
      expect((await api('admin').remove('00000000-0000-4000-8000-000000000000')).status).toBe(404);
    });

    it('création et suppression auditées (ad_mapping.create, ad_mapping.delete)', async () => {
      const groupDn = dn();
      const created = await api('itAdmin').create(groupDn, 'IT_TECHNICIAN');
      await api('itAdmin').remove(created.body.id);
      const logs = await prisma.auditLog.findMany({ where: { resourceId: created.body.id }, orderBy: { timestamp: 'asc' } });
      expect(logs.map((l) => l.action)).toEqual(['ad_mapping.create', 'ad_mapping.delete']);
      expect(logs[0].newValues).toEqual({ adGroupDn: groupDn, role: 'IT_TECHNICIAN' });
      expect(logs[1].oldValues).toEqual({ adGroupDn: groupDn, role: 'IT_TECHNICIAN' });
    });
  });
});
