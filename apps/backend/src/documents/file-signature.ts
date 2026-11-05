import { fileTypeFromBuffer } from 'file-type';

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/png',
  'image/jpeg',
]);

export interface DetectedFileType {
  mimeType: string;
  extension: string;
}

export async function detectAllowedFileType(buffer: Buffer): Promise<DetectedFileType | null> {
  const detected = await fileTypeFromBuffer(buffer);
  if (!detected || !ALLOWED_MIME_TYPES.has(detected.mime)) return null;
  return { mimeType: detected.mime, extension: detected.ext };
}

export function previewableMimeType(mimeType: string): boolean {
  return mimeType === 'application/pdf' || mimeType === 'image/png' || mimeType === 'image/jpeg';
}