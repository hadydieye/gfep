import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { describe, expect, it } from 'vitest';
import { detectAllowedFileType } from './file-signature.js';

const fixtures = join(dirname(fileURLToPath(import.meta.url)), '../../prisma/seed-fixtures');

describe('detectAllowedFileType', () => {
  it.each([
    [Buffer.from('%PDF-1.7\n'), 'application/pdf'],
    [
      Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jzMsAAAAASUVORK5CYII=',
        'base64',
      ),
      'image/png',
    ],
    [Buffer.from([0xff, 0xd8, 0xff, 0xdb, 0x00, 0x43]), 'image/jpeg'],
    [readFileSync(join(fixtures, 'template.docx')), 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    [readFileSync(join(fixtures, 'template.xlsx')), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  ])('detects an allowed signature regardless of client filename (%s)', async (buffer, mimeType) => {
    await expect(detectAllowedFileType(buffer)).resolves.toMatchObject({ mimeType });
  });

  it('rejects a non-OOXML ZIP and an executable renamed as PDF', async () => {
    await expect(detectAllowedFileType(Buffer.from('PK\x03\x04'))).resolves.toBeNull();
    await expect(detectAllowedFileType(Buffer.from('MZ\x90\x00'))).resolves.toBeNull();
  });
});