import { mkdtemp, readFile, rm, symlink, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { deleteDocumentFile, readDocumentFile, writeDocumentFile } from './document-storage.js';

describe('document storage', () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'gfep-documents-'));
    vi.stubEnv('DOCUMENTS_STORAGE_DIR', root);
  });

  afterEach(async () => {
    vi.unstubAllEnvs();
    await rm(root, { recursive: true, force: true });
  });

  it('creates UUID-only names under the configured root and supports read/delete', async () => {
    const contents = Buffer.from('document bytes');
    const storagePath = await writeDocumentFile(contents);
    expect(storagePath).toMatch(/^[0-9a-f-]{36}$/);
    expect(await readFile(join(root, storagePath))).toEqual(contents);
    await expect(readDocumentFile(storagePath)).resolves.toEqual(contents);

    await deleteDocumentFile(storagePath);
    await expect(readDocumentFile(storagePath)).rejects.toThrow();
  });

  it('rejects paths outside the root and refuses to follow symlinks', async () => {
    await expect(readDocumentFile('../outside')).rejects.toThrow();
    const outside = join(root, '..', 'gfep-outside-document');
    await writeFile(outside, 'outside');
    await symlink(outside, join(root, '00000000-0000-4000-8000-000000000000'));
    await expect(readDocumentFile('00000000-0000-4000-8000-000000000000')).rejects.toThrow();
    await rm(outside, { force: true });
  });
});