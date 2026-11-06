import { randomUUID } from 'crypto';
import { readFile } from 'fs/promises';
import type { NestExpressApplication } from '@nestjs/platform-express';
import {
  ConfidentialityLevel,
  DocumentPermissionType,
  DocumentValidationStatus,
  PrismaClient,
} from '@prisma/client';
import request from 'supertest';
import { writeDocumentFile } from '../src/documents/document-storage.js';
import {
  CREDENTIALS,
  createTestApp,
  resetDatabase,
  seedOrThrow,
  sessionCookie,
  testPrisma,
} from './helpers.js';

type SessionSet = { admin: string; manager: string; employeeCf: string; employeeDg: string };

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jzMsAAAAASUVORK5CYII=',
  'base64',
);
const PDF = Buffer.from('%PDF-1.7\nGFEP test document\n');
const NON_EXISTENT_ID = '00000000-0000-4000-8000-000000000000';

let documentCounter = 0;

describe('Documents (intégration)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaClient;
  let sessions: SessionSet;
  let departments: Map<string, { id: string; categoryId: string; employeeId: string; userId: string }>;

  beforeAll(async () => {
    prisma = testPrisma();
    await resetDatabase(prisma);
    seedOrThrow();
    app = await createTestApp();
    sessions = {
      admin: await sessionCookie(app, CREDENTIALS.admin),
      manager: await sessionCookie(app, CREDENTIALS.manager),
      employeeCf: await sessionCookie(app, CREDENTIALS.employee),
      employeeDg: await sessionCookie(app, { username: 'm.sylla', password: 'GF_Emp2026!' }), // EMPLOYEE, Direction générale
    };
    const records = await Promise.all(
      ['CF', 'RH', 'IT', 'DG', 'AC'].map(async (code) => {
        const department = await prisma.department.findUniqueOrThrow({ where: { code } });
        const category = await prisma.documentCategory.findFirstOrThrow({ where: { departmentId: department.id } });
        // Premier employé du département titulaire du seul rôle EMPLOYEE (étape 2.4 : t.balde est SUPER_ADMIN)
        const employee = await prisma.employee.findFirstOrThrow({
          where: {
            departmentId: department.id,
            identity: { is: { user: { userRoles: { every: { role: { name: 'EMPLOYEE' } } } } } },
          },
          orderBy: { employeeNumber: 'asc' },
          include: { identity: true },
        });
        return [code, { id: department.id, categoryId: category.id, employeeId: employee.id, userId: employee.identity!.userId }] as const;
      }),
    );
    departments = new Map(records);
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  const url = (path: string) => `/api/v1${path}`;
  const get = (path: string, cookie: string) => request(app.getHttpServer()).get(url(path)).set('Cookie', cookie);
  const callRoute = (
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
    path: string,
    cookie?: string,
    body: object = {},
  ) => {
    const server = request(app.getHttpServer());
    let call =
      method === 'GET'
        ? server.get(url(path))
        : method === 'POST'
          ? server.post(url(path))
          : method === 'PATCH'
            ? server.patch(url(path))
            : server.delete(url(path));
    if (cookie) call = call.set('Cookie', cookie);
    return call.send(body);
  };
  const createRecord = async (options: {
    category?: string;
    owner?: string;
    confidentiality?: ConfidentialityLevel;
    validationStatus?: DocumentValidationStatus;
    mimeType?: string;
    bytes?: Buffer;
  } = {}) => {
    documentCounter += 1;
    const category = departments.get(options.category ?? 'CF')!;
    const owner = departments.get(options.owner ?? options.category ?? 'CF')!;
    const storagePath = await writeDocumentFile(options.bytes ?? PDF);
    return prisma.document.create({
      data: {
        title: `Document de test ${documentCounter}`,
        categoryId: category.categoryId,
        ownerId: owner.employeeId,
        storagePath,
        mimeType: options.mimeType ?? 'application/pdf',
        fileSize: (options.bytes ?? PDF).length,
        confidentialityLevel: options.confidentiality ?? ConfidentialityLevel.INTERNAL,
        validationStatus: options.validationStatus ?? DocumentValidationStatus.PENDING,
      },
    });
  };
  const upload = (
    cookie: string,
    categoryId: string,
    file: Buffer,
    filename = 'client-name.pdf',
    contentType = 'application/pdf',
  ) =>
    request(app.getHttpServer())
      .post(url('/documents'))
      .set('Cookie', cookie)
      .field('title', `Document importé ${randomUUID()}`)
      .field('categoryId', categoryId)
      .field('confidentialityLevel', 'INTERNAL')
      .attach('file', file, { filename, contentType });

  describe('contrôles de route', () => {
    it('autorise les trois rôles Documents existants et rejette sans session (401)', async () => {
      const publicDocument = await createRecord({ confidentiality: ConfidentialityLevel.PUBLIC });
      const allDocumentRoutes: Array<[string, 'GET' | 'POST' | 'PATCH' | 'DELETE']> = [
        ['/documents', 'GET'],
        ['/documents/categories', 'GET'],
        [`/documents/${publicDocument.id}`, 'GET'],
        [`/documents/${publicDocument.id}/download`, 'GET'],
        [`/documents/${publicDocument.id}/preview`, 'GET'],
        [`/documents/${publicDocument.id}/validation`, 'PATCH'],
        [`/documents/${publicDocument.id}/permissions`, 'GET'],
        [`/documents/${publicDocument.id}/share-recipients`, 'GET'],
        [`/documents/${publicDocument.id}/permissions`, 'POST'],
        [`/documents/${publicDocument.id}/permissions/${NON_EXISTENT_ID}`, 'DELETE'],
        [`/documents/${publicDocument.id}`, 'DELETE'],
        ['/documents', 'POST'],
      ];
      for (const [path, method] of allDocumentRoutes) {
        expect((await callRoute(method, path)).status, `${method} ${path}`).toBe(401);
      }

      for (const cookie of Object.values(sessions)) {
        expect((await get('/documents', cookie)).status).toBe(200);
        expect((await get('/documents/categories', cookie)).status).toBe(200);
        expect((await get(`/documents/${publicDocument.id}`, cookie)).status).toBe(200);
        expect((await get(`/documents/${publicDocument.id}/download`, cookie)).status).toBe(200);
        expect((await get(`/documents/${publicDocument.id}/preview`, cookie)).status).toBe(200);
      }
      const validationTarget = await createRecord({ category: 'AC', owner: 'CF' });
      expect((await callRoute('PATCH', `/documents/${validationTarget.id}/validation`, sessions.admin, { status: 'VALIDATED' })).status).toBe(200);
      const secondTarget = await createRecord({ category: 'AC', owner: 'CF' });
      expect((await callRoute('PATCH', `/documents/${secondTarget.id}/validation`, sessions.manager, { status: 'VALIDATED' })).status).toBe(200);
      expect((await callRoute('PATCH', `/documents/${secondTarget.id}/validation`, sessions.employeeCf, { status: 'REJECTED' })).status).toBe(403);
      expect((await callRoute('PATCH', `/documents/${secondTarget.id}/validation`, sessions.employeeDg, { status: 'REJECTED' })).status).toBe(403);

      expect((await callRoute('POST', '/documents', sessions.admin)).status).toBe(400);
      const invalidDto = await callRoute('POST', '/documents', sessions.employeeCf, { title: 'T', categoryId: 'x', confidentialityLevel: 'INTERNAL', extra: true });
      expect(invalidDto.status).toBe(400);
    });
  });

  describe('visibilité et département', () => {
    it('isole les EMPLOYEE par département, avec PUBLIC, propriété et partage explicite', async () => {
      const ownInternal = await createRecord({ category: 'CF', owner: 'CF' });
      const otherInternal = await createRecord({ category: 'DG', owner: 'DG' });
      const publicOther = await createRecord({ category: 'DG', owner: 'DG', confidentiality: ConfidentialityLevel.PUBLIC });
      const privateOther = await createRecord({ category: 'DG', owner: 'DG', confidentiality: ConfidentialityLevel.CONFIDENTIAL });
      const sharedOther = await createRecord({ category: 'DG', owner: 'CF', confidentiality: ConfidentialityLevel.RESTRICTED });
      const ownSensitive = await createRecord({ category: 'DG', owner: 'CF', confidentiality: ConfidentialityLevel.CONFIDENTIAL });
      await prisma.documentPermission.create({
        data: {
          documentId: sharedOther.id,
          userId: departments.get('CF')!.userId,
          grantedBy: departments.get('DG')!.userId,
          permission: DocumentPermissionType.READ,
        },
      });

      const cfList = await get('/documents?limit=100', sessions.employeeCf);
      const cfIds = new Set(cfList.body.data.map((item: { id: string }) => item.id));
      expect(cfIds).toContain(ownInternal.id);
      expect(cfIds).toContain(publicOther.id);
      expect(cfIds).toContain(sharedOther.id);
      expect(cfIds).toContain(ownSensitive.id);
      expect(cfIds).not.toContain(otherInternal.id);
      expect(cfIds).not.toContain(privateOther.id);

      const dgList = await get('/documents?limit=100', sessions.employeeDg);
      const dgIds = new Set(dgList.body.data.map((item: { id: string }) => item.id));
      expect(dgIds).toContain(otherInternal.id);
      expect(dgIds).not.toContain(ownInternal.id);
      expect(dgIds).not.toContain(sharedOther.id);

      const allDocuments = await prisma.document.findMany({
        include: {
          category: { select: { departmentId: true } },
          owner: { select: { departmentId: true } },
          permissions: { select: { userId: true } },
        },
      });
      for (const [ids, userId, employeeId, departmentId] of [
        [cfIds, departments.get('CF')!.userId, departments.get('CF')!.employeeId, departments.get('CF')!.id],
        [dgIds, departments.get('DG')!.userId, departments.get('DG')!.employeeId, departments.get('DG')!.id],
      ] as const) {
        const expected = allDocuments
          .filter((document) => {
            const docDepartmentId = document.category.departmentId ?? document.owner.departmentId;
            return (
              document.ownerId === employeeId ||
              document.confidentialityLevel === ConfidentialityLevel.PUBLIC ||
              (document.confidentialityLevel === ConfidentialityLevel.INTERNAL && docDepartmentId === departmentId) ||
              document.permissions.some((permission) => permission.userId === userId)
            );
          })
          .map(({ id }) => id);
        expect([...ids].sort((a, b) => a.localeCompare(b))).toEqual(
          expected.sort((a, b) => a.localeCompare(b)),
        );
      }

      expect((await get(`/documents/${privateOther.id}`, sessions.employeeCf)).status).toBe(404);
      expect((await get(`/documents/${privateOther.id}/download`, sessions.employeeCf)).status).toBe(404);
      expect((await get(`/documents/${privateOther.id}/preview`, sessions.employeeCf)).status).toBe(404);
      expect((await get(`/documents/${privateOther.id}`, sessions.admin)).status).toBe(200);
    });

    it('utilise le département du propriétaire quand la catégorie ne porte aucun département', async () => {
      const category = await prisma.documentCategory.create({ data: { name: `Sans département ${randomUUID()}` } });
      const cfDocument = await createRecord({ category: 'CF' });
      const ownUnassigned = await prisma.document.create({
        data: {
          title: `Document sans département ${randomUUID()}`,
          categoryId: category.id,
          ownerId: departments.get('CF')!.employeeId,
          storagePath: await writeDocumentFile(PDF),
          mimeType: 'application/pdf',
          fileSize: PDF.length,
          confidentialityLevel: ConfidentialityLevel.INTERNAL,
        },
      });
      const dgUnassigned = await prisma.document.create({
        data: {
          title: `Document sans département ${randomUUID()}`,
          categoryId: category.id,
          ownerId: departments.get('DG')!.employeeId,
          storagePath: await writeDocumentFile(PDF),
          mimeType: 'application/pdf',
          fileSize: PDF.length,
          confidentialityLevel: ConfidentialityLevel.INTERNAL,
        },
      });
      const cfList = await get('/documents?limit=100', sessions.employeeCf);
      const ids = new Set(cfList.body.data.map((item: { id: string }) => item.id));
      expect(ids).toContain(ownUnassigned.id);
      expect(ids).not.toContain(dgUnassigned.id);
      expect((await get(`/documents/${cfDocument.id}`, sessions.employeeCf)).status).toBe(200);
    });
  });

  describe('upload', () => {
    it('détecte le contenu réel, ignore le nom et le type déclarés, puis crée PENDING', async () => {
      const result = await upload(sessions.employeeCf, departments.get('CF')!.categoryId, PNG);
      expect(result.status).toBe(201);
      expect(result.body).toMatchObject({ mimeType: 'image/png', validationStatus: 'PENDING' });
      expect(result.body.id).toBeDefined();
      const stored = await prisma.document.findUniqueOrThrow({ where: { id: result.body.id } });
      expect(stored.storagePath).toMatch(/^[0-9a-f-]{36}$/);
      expect(stored.storagePath).not.toContain('client-name');
      expect(await readFile(`${process.env.DOCUMENTS_STORAGE_DIR}/${stored.storagePath}`)).toEqual(PNG);
    });

    it('refuse une signature non autorisée, une taille supérieure à 10 Mo et un département interdit', async () => {
      const executable = await upload(sessions.employeeCf, departments.get('CF')!.categoryId, Buffer.from('MZ\x90\x00'));
      expect(executable.status).toBe(400);
      expect(executable.body.message).toBe('Format de fichier non pris en charge.');

      const oversized = await upload(
        sessions.employeeCf,
        departments.get('CF')!.categoryId,
        Buffer.alloc(10 * 1024 * 1024 + 1),
      );
      expect([400, 413]).toContain(oversized.status);

      const forbidden = await upload(sessions.employeeCf, departments.get('IT')!.categoryId, PDF);
      expect(forbidden.status).toBe(403);
    });
  });

  describe('validation', () => {
    it('permet au manager du département de valider, interdit son document propre et audite la décision', async () => {
      // DEPARTMENT_MANAGER a.barry : département Audit et conformité (M5, étape 2.4)
      const rh = departments.get('AC')!;
      const document = await prisma.document.create({
        data: {
          title: `Validation AC ${randomUUID()}`,
          categoryId: rh.categoryId,
          ownerId: departments.get('CF')!.employeeId,
          storagePath: await writeDocumentFile(PDF),
          mimeType: 'application/pdf',
          fileSize: PDF.length,
          confidentialityLevel: ConfidentialityLevel.INTERNAL,
        },
      });
      const response = await request(app.getHttpServer())
        .patch(url(`/documents/${document.id}/validation`))
        .set('Cookie', sessions.manager)
        .send({ status: 'VALIDATED' });
      expect(response.status).toBe(200);
      expect(response.body.validationStatus).toBe('VALIDATED');
      expect(await prisma.auditLog.findFirst({ where: { resourceId: document.id, action: 'document.validate' } })).not.toBeNull();
      expect(
        (await request(app.getHttpServer())
          .patch(url(`/documents/${document.id}/validation`))
          .set('Cookie', sessions.manager)
          .send({ status: 'REJECTED' })).status,
      ).toBe(409);

      const own = await prisma.employee.findUniqueOrThrow({ where: { professionalEmail: 'a.barry@guineasf.com' } });
      const ownDocument = await prisma.document.create({
        data: {
          title: `Document propre ${randomUUID()}`,
          categoryId: rh.categoryId,
          ownerId: own.id,
          storagePath: await writeDocumentFile(PDF),
          mimeType: 'application/pdf',
          fileSize: PDF.length,
          confidentialityLevel: ConfidentialityLevel.INTERNAL,
        },
      });
      expect(
        (await request(app.getHttpServer())
          .patch(url(`/documents/${ownDocument.id}/validation`))
          .set('Cookie', sessions.manager)
          .send({ status: 'VALIDATED' })).status,
      ).toBe(403);
    });
  });

  describe('partage et audits', () => {
    it('limite les destinataires et le partage au propriétaire ou au SUPER_ADMIN', async () => {
      const document = await createRecord({ owner: 'CF', category: 'CF', confidentiality: ConfidentialityLevel.PUBLIC });
      const recipients = await get(`/documents/${document.id}/share-recipients`, sessions.employeeCf);
      expect(recipients.status).toBe(200);
      expect(recipients.body).toHaveLength(39);
      expect(Object.keys(recipients.body[0]).sort()).toEqual(['displayName', 'id', 'username']);
      expect((await get(`/documents/${document.id}/share-recipients`, sessions.employeeDg)).status).toBe(403);
      expect((await get(`/documents/${document.id}/permissions`, sessions.admin)).status).toBe(200);
      expect((await get(`/documents/${document.id}/permissions`, sessions.manager)).status).toBe(403);

      const granted = await request(app.getHttpServer())
        .post(url(`/documents/${document.id}/permissions`))
        .set('Cookie', sessions.employeeCf)
        .send({ userId: departments.get('DG')!.userId, permission: 'READ' });
      expect(granted.status).toBe(201);
      expect(granted.body.permission).toBe('READ');
      expect(await prisma.auditLog.findFirst({ where: { resourceId: document.id, action: 'document.share' } })).not.toBeNull();

      const deleteShared = await createRecord({ category: 'CF', owner: 'CF', confidentiality: ConfidentialityLevel.PUBLIC });
      await prisma.documentPermission.create({
        data: {
          documentId: deleteShared.id,
          userId: departments.get('DG')!.userId,
          grantedBy: departments.get('CF')!.userId,
          permission: DocumentPermissionType.DELETE,
        },
      });
      expect((await callRoute('DELETE', `/documents/${deleteShared.id}`, sessions.employeeDg)).status).toBe(204);

      const protectedPublic = await createRecord({ category: 'CF', owner: 'CF', confidentiality: ConfidentialityLevel.PUBLIC });
      expect((await callRoute('DELETE', `/documents/${protectedPublic.id}`, sessions.employeeDg)).status).toBe(403);
    });

    it('audite les consultations/téléchargements sensibles uniquement et supprime le fichier', async () => {
      const sensitive = await prisma.document.create({
        data: {
          title: `Document sensible ${randomUUID()}`,
          categoryId: departments.get('CF')!.categoryId,
          ownerId: departments.get('CF')!.employeeId,
          storagePath: await writeDocumentFile(PDF),
          mimeType: 'application/pdf',
          fileSize: PDF.length,
          confidentialityLevel: ConfidentialityLevel.CONFIDENTIAL,
        },
      });
      expect((await get(`/documents/${sensitive.id}`, sessions.employeeCf)).status).toBe(200);
      const download = await get(`/documents/${sensitive.id}/download`, sessions.employeeCf);
      expect(download.status).toBe(200);
      expect(download.headers['x-content-type-options']).toBe('nosniff');
      const actions = await prisma.auditLog.findMany({ where: { resourceId: sensitive.id }, select: { action: true } });
      expect(actions.map(({ action }) => action).sort()).toEqual(['document.download', 'document.view']);

      const internal = await createRecord({ category: 'CF', owner: 'CF' });
      await get(`/documents/${internal.id}`, sessions.employeeCf);
      expect(await prisma.auditLog.count({ where: { resourceId: internal.id } })).toBe(0);

      const deleteResponse = await request(app.getHttpServer())
        .delete(url(`/documents/${sensitive.id}`))
        .set('Cookie', sessions.employeeCf);
      expect(deleteResponse.status).toBe(204);
      expect(await prisma.document.findUnique({ where: { id: sensitive.id } })).toBeNull();
      expect(await prisma.auditLog.findFirst({ where: { resourceId: sensitive.id, action: 'document.delete' } })).not.toBeNull();
    });
  });
});
