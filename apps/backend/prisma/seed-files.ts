/**
 * Fichiers réels des documents du seed (gfep-mvp2/DECISIONS.md M10).
 * PDF et PNG sont générés par programme ; JPG, DOCX et XLSX sont copiés
 * depuis des gabarits minimaux versionnés dans `prisma/seed-fixtures/`.
 * Les fichiers sont nommés par UUID sous DOCUMENTS_STORAGE_DIR.
 */
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'fs';
import { dirname, join, resolve, sep } from 'path';
import { fileURLToPath } from 'url';
import { crc32, deflateSync } from 'zlib';
import type { SeedFileFormat } from './seed-data/documents.js';

const PRISMA_DIR = dirname(fileURLToPath(import.meta.url));

export const MIME_TYPES: Record<SeedFileFormat, string> = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

/** Répertoire de stockage : DOCUMENTS_STORAGE_DIR, sinon apps/backend/storage/documents. */
export function documentsStorageDir(): string {
  // Une valeur vide (ligne recopiée de .env.example) vaut « non définie »
  return resolve(process.env.DOCUMENTS_STORAGE_DIR || join(PRISMA_DIR, '..', 'storage', 'documents'));
}

/** Chemin absolu d'un fichier stocké ; refuse tout nom qui sortirait du répertoire. */
export function storedFilePath(storagePath: string): string {
  const root = documentsStorageDir();
  const path = resolve(root, storagePath);
  if (!path.startsWith(root + sep)) {
    throw new Error(`Chemin de stockage hors du répertoire autorisé : ${storagePath}`);
  }
  return path;
}

/**
 * Écrit le fichier s'il n'existe pas encore (idempotence : un fichier présent
 * n'est jamais réécrit) et renvoie sa taille en octets.
 */
export function ensureSeedFile(storagePath: string, format: SeedFileFormat, title: string): number {
  const path = storedFilePath(storagePath);
  if (!existsSync(path)) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, buildFile(format, title));
  }
  return statSync(path).size;
}

function buildFile(format: SeedFileFormat, title: string): Buffer {
  switch (format) {
    case 'pdf':
      return buildPdf(title);
    case 'png':
      return buildPng(title);
    default:
      return readFileSync(join(PRISMA_DIR, 'seed-fixtures', `template.${format}`));
  }
}

/** PDF 1.4 d'une page, police standard Helvetica, table xref aux offsets exacts. */
function buildPdf(title: string): Buffer {
  const text = `GUINEA FINANCE SARL - ${title} (document fictif)`
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\x20-\x7e]/g, '-')
    .replace(/[\\()]/g, (c) => `\\${c}`);
  const content = `BT /F1 12 Tf 56 780 Td (${text}) Tj ET`;
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`,
  ];
  let body = '%PDF-1.4\n';
  const offsets: number[] = [];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(body));
    body += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = Buffer.byteLength(body);
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  body += offsets.map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`).join('');
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(body, 'latin1');
}

/** PNG 32×32 RVB d'une couleur unie dérivée du titre (aux couleurs de la palette GFEP). */
function buildPng(title: string): Buffer {
  const palette = [
    [15, 76, 58],
    [201, 162, 39],
    [27, 138, 90],
    [92, 97, 104],
  ];
  let hash = 0;
  for (let i = 0; i < title.length; i += 1) hash += title.charCodeAt(i);
  const [r, g, b] = palette[hash % palette.length];
  const size = 32;
  const row = Buffer.alloc(1 + size * 3);
  for (let x = 0; x < size; x += 1) row.set([r, g, b], 1 + x * 3);
  const pixels = Buffer.concat(Array.from({ length: size }, () => row));

  const chunk = (type: string, data: Buffer) => {
    const typed = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(typed));
    return Buffer.concat([length, typed, crc]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header.set([8, 2, 0, 0, 0], 8); // 8 bits, RVB, compression/filtre/entrelacement standards

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(pixels)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
