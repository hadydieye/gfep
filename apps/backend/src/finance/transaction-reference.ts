import { Prisma } from '@prisma/client';

// Nouveaux essais si deux créations simultanées obtiennent la même référence (méthode I16)
export const MAX_TRANSACTION_REFERENCE_ATTEMPTS = 5;

export function transactionReferencePrefix(year = new Date().getFullYear()): string {
  return `TRX-${year}-`;
}

/**
 * Référence suivante au format TRX-{AAAA}-{NNNNN} (M14) : plus grand suffixe
 * numérique de l'année courante + 1. Les trous ne sont pas réutilisés.
 */
export async function nextTransactionReference(tx: Prisma.TransactionClient): Promise<string> {
  const prefix = transactionReferencePrefix();
  const existing = await tx.transaction.findMany({
    where: { reference: { startsWith: prefix } },
    select: { reference: true },
  });
  return referenceAfter(prefix, existing.map(({ reference }) => reference));
}

export function referenceAfter(prefix: string, references: readonly string[]): string {
  const max = references.reduce((highest, reference) => {
    const suffix = reference.slice(prefix.length);
    return /^\d+$/.test(suffix) ? Math.max(highest, Number(suffix)) : highest;
  }, 0);
  return `${prefix}${String(max + 1).padStart(5, '0')}`;
}

/** Vrai si l'erreur est une violation d'unicité Prisma (P2002) portant sur `field`. */
export function isUniqueViolationOn(error: unknown, field: string): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') {
    return false;
  }
  const target = error.meta?.target;
  const columns = Array.isArray(target) ? target.join(',') : typeof target === 'string' ? target : '';
  return columns.includes(field);
}
