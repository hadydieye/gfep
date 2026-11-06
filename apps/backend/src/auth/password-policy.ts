import { COMMON_BASES, COMMON_PASSWORDS } from './common-passwords.js';

/**
 * Politique du nouveau mot de passe (N14, approche NIST : longueur et listes de
 * refus, sans règle de composition). Renvoie le message actionnable de la
 * première règle non respectée, ou null.
 */
export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 128;

export const PASSWORD_POLICY_MESSAGES = {
  tooShort: `Le nouveau mot de passe doit contenir au moins ${PASSWORD_MIN_LENGTH} caractères.`,
  tooLong: `Le nouveau mot de passe doit contenir au plus ${PASSWORD_MAX_LENGTH} caractères.`,
  sameAsCurrent: 'Le nouveau mot de passe doit être différent du mot de passe actuel.',
  personal: 'Le nouveau mot de passe ne doit contenir ni votre identifiant, ni votre prénom, ni votre nom.',
  common: 'Ce mot de passe est trop courant ou trop prévisible. Choisissez-en un autre.',
} as const;

export interface PasswordContext {
  current: string;
  username: string;
  firstName?: string | null;
  lastName?: string | null;
}

/** Minuscules, sans accents (NFD sans diacritiques). */
export function normalize(value: string): string {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/** Segments d'au moins 3 caractères (identifiant découpé sur la ponctuation, noms composés). */
function personalTokens(context: PasswordContext): string[] {
  return [context.username, context.firstName ?? '', context.lastName ?? '']
    .flatMap((value) => normalize(value).split(/[^a-z0-9]+/))
    .filter((token) => token.length >= 3);
}

export function checkPasswordPolicy(password: string, context: PasswordContext): string | null {
  // Longueur en caractères (points de code), pas en unités UTF-16
  const length = [...password].length;
  if (length < PASSWORD_MIN_LENGTH) return PASSWORD_POLICY_MESSAGES.tooShort;
  if (length > PASSWORD_MAX_LENGTH) return PASSWORD_POLICY_MESSAGES.tooLong;
  if (password === context.current) return PASSWORD_POLICY_MESSAGES.sameAsCurrent;

  const normalized = normalize(password);
  const compact = normalized.replace(/[^a-z0-9]/g, '');
  const usernameCompact = normalize(context.username).replace(/[^a-z0-9]/g, '');
  if (
    (usernameCompact.length >= 3 && compact.includes(usernameCompact)) ||
    personalTokens(context).some((token) => normalized.includes(token))
  ) {
    return PASSWORD_POLICY_MESSAGES.personal;
  }

  const letters = normalized.replace(/[^a-z]/g, '');
  if (COMMON_PASSWORDS.has(normalized) || COMMON_PASSWORDS.has(compact) || COMMON_BASES.has(letters)) {
    return PASSWORD_POLICY_MESSAGES.common;
  }
  // Un seul caractère répété (« aaaaaaaaaaaa », « 111111111111 »)
  if (new Set(compact).size <= 1) return PASSWORD_POLICY_MESSAGES.common;
  return null;
}
