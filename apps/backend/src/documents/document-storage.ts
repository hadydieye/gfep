import { constants } from 'fs';
import { mkdir, open, realpath, unlink } from 'fs/promises';
import { randomUUID } from 'crypto';
import { dirname, join, resolve, sep } from 'path';
import { fileURLToPath } from 'url';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const BACKEND_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../');

export function documentsStorageDir(): string {
  return resolve(process.env.DOCUMENTS_STORAGE_DIR || join(BACKEND_ROOT, 'storage', 'documents'));
}

async function storageRoot(): Promise<string> {
  const configuredRoot = documentsStorageDir();
  await mkdir(configuredRoot, { recursive: true });
  return realpath(configuredRoot);
}

async function safeFilePath(storagePath: string): Promise<string> {
  if (!UUID_PATTERN.test(storagePath)) {
    throw new Error('Chemin de document invalide.');
  }
  const root = await storageRoot();
  const filePath = resolve(root, storagePath);
  if (dirname(filePath) !== root || !filePath.startsWith(root + sep)) {
    throw new Error('Chemin de document hors du répertoire autorisé.');
  }
  return filePath;
}

export async function writeDocumentFile(buffer: Buffer): Promise<string> {
  const storagePath = randomUUID();
  const filePath = await safeFilePath(storagePath);
  const file = await open(
    filePath,
    constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
    0o600,
  );
  try {
    await file.writeFile(buffer);
  } catch (error) {
    await unlink(filePath).catch(() => undefined);
    throw error;
  } finally {
    await file.close();
  }
  return storagePath;
}

export async function readDocumentFile(storagePath: string): Promise<Buffer> {
  const filePath = await safeFilePath(storagePath);
  const file = await open(filePath, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const stat = await file.stat();
    if (!stat.isFile()) throw new Error('Le stockage du document est invalide.');
    return await file.readFile();
  } finally {
    await file.close();
  }
}

export async function deleteDocumentFile(storagePath: string): Promise<void> {
  await unlink(await safeFilePath(storagePath));
}