import { StreamableFile } from '@nestjs/common';
import type { Response } from 'express';

/**
 * Export CSV finance (N5) : séparateur `;`, UTF-8 avec BOM, fins de ligne CRLF,
 * guillemets RFC 4180, neutralisation de l'injection de formules (OWASP :
 * « CSV injection »). Format pensé pour un tableur configuré en français.
 */
export const CSV_BOM = '﻿';
const SEPARATOR = ';';
const EOL = '\r\n';

/** Plafond d'un export (N5) ; au-delà, l'utilisateur doit affiner ses filtres. */
export const MAX_EXPORT_ROWS = 10_000;
export const EXPORT_TOO_LARGE_MESSAGE = "L'export dépasse 10 000 lignes. Affinez les filtres.";

/** Une cellule qui commence par l'un de ces caractères serait interprétée comme une formule. */
const FORMULA_TRIGGER = /^[=+\-@\t\r]/;

export function neutralizeFormula(value: string): string {
  return FORMULA_TRIGGER.test(value) ? `'${value}` : value;
}

/** Échappement RFC 4180 : guillemets doublés, champ entouré si nécessaire. */
function quote(value: string): string {
  return /[";\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

export function toCsvCell(value: string | null | undefined): string {
  return quote(neutralizeFormula(value ?? ''));
}

export function toCsv(headers: readonly string[], rows: ReadonlyArray<ReadonlyArray<string | null | undefined>>): string {
  const lines = [headers.map(toCsvCell).join(SEPARATOR), ...rows.map((row) => row.map(toCsvCell).join(SEPARATOR))];
  return `${CSV_BOM}${lines.join(EOL)}${EOL}`;
}

/**
 * Montant décimal (chaîne « 1500000.50 » de Prisma) au format français
 * « 1500000,50 », sans passer par un nombre flottant ni séparateur de milliers.
 */
export function formatDecimalFr(value: string): string {
  return value.replace('.', ',');
}

/** Date au format AAAA-MM-JJ (UTC). */
export function formatDateIso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Horodatage de nom de fichier : AAAAMMJJ (UTC). */
export function fileStamp(date = new Date()): string {
  return formatDateIso(date).replaceAll('-', '');
}

export const TRANSACTION_TYPE_LABELS: Record<string, string> = { INCOME: 'Recette', EXPENSE: 'Dépense' };
export const TRANSACTION_STATUS_LABELS: Record<string, string> = {
  PENDING: 'En attente',
  VALIDATED: 'Validée',
  REJECTED: 'Rejetée',
};
export const INVOICE_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Brouillon',
  SENT: 'En attente',
  PAID: 'Payée',
  OVERDUE: 'En retard',
  CANCELLED: 'Annulée',
};

/** Réponse CSV d'un export (N5) : téléchargement, jamais mis en cache ni interprété. */
export function sendCsv(response: Response, file: { filename: string; content: string }): StreamableFile {
  response.setHeader('Content-Type', 'text/csv; charset=utf-8');
  response.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('Cache-Control', 'no-store');
  return new StreamableFile(Buffer.from(file.content, 'utf8'));
}
