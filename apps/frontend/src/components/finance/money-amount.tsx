import { cn } from '@/lib/utils';

const INTEGER_FORMAT = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });

/**
 * Formate un montant décimal reçu en chaîne (ex. "1500000.50") au format fr-FR,
 * sans jamais passer par un nombre flottant : la partie entière est formatée en
 * BigInt, la partie décimale est conservée telle quelle (affichée si non nulle).
 */
export function formatMoney(amount: string, currency = 'GNF'): string {
  const match = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(amount.trim());
  if (!match) return `${amount} ${currency}`;
  const [, sign, integer, fraction = ''] = match;
  const grouped = INTEGER_FORMAT.format(BigInt(integer));
  const decimals = fraction.padEnd(2, '0');
  const decimalPart = decimals === '00' ? '' : `,${decimals}`;
  return `${sign ? '−' : ''}${grouped}${decimalPart} ${currency}`;
}

/** Montant en chiffres tabulaires (à aligner à droite dans les tableaux). */
export function MoneyAmount({
  amount,
  currency = 'GNF',
  className,
}: {
  amount: string;
  currency?: string;
  className?: string;
}) {
  return <span className={cn('whitespace-nowrap tabular-nums', className)}>{formatMoney(amount, currency)}</span>;
}
