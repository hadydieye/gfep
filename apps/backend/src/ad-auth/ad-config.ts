import { readFileSync } from 'fs';

/**
 * Configuration de l'authentification Active Directory (design §9.1, M23).
 * Tout vient des variables d'environnement ; une variable obligatoire absente ou
 * invalide rend l'AD indisponible (503, AD_UNREACHABLE). Jamais de repli local.
 */
export interface AdConfig {
  url: string;
  baseDn: string;
  userIdAttribute: string;
  mailAttribute: string;
  groupsAttribute: string;
  guidAttribute: string;
  /** Vide pour le LDAP de test (OpenLDAP n'a pas d'objectSid) */
  sidAttribute: string | null;
  // TODO(AD-REVISION) : compte de service svc-ldapreader en lecture seule ; droits minimaux, rotation du mot de
  // passe et second compte applicatif (TRD §8, non créé faute d'usage en MVP 2) à définir sur le vrai AD
  bindDn: string;
  bindPassword: string;
  // TODO(AD-REVISION) : CA de DC01 en production ; le nom d'hôte du certificat est vérifié (checkServerIdentity par défaut)
  caCert: Buffer;
  timeoutMs: number;
}

export type AdConfigResult = { ok: true; config: AdConfig } | { ok: false; problems: string[] };

const REQUIRED = [
  'AD_LDAP_URL',
  'AD_BASE_DN',
  'AD_USER_ID_ATTRIBUTE',
  'AD_MAIL_ATTRIBUTE',
  'AD_GROUPS_ATTRIBUTE',
  'AD_GUID_ATTRIBUTE',
  'AD_BIND_DN',
  'AD_BIND_PASSWORD',
  'AD_CA_CERT_PATH',
] as const;

const ATTRIBUTE_NAME = /^[A-Za-z][A-Za-z0-9-]{0,63}$/;
export const DEFAULT_AD_TIMEOUT_MS = 3000;

/** Lit et valide la configuration. Les messages ne contiennent jamais de valeur secrète. */
export function loadAdConfig(env: NodeJS.ProcessEnv = process.env): AdConfigResult {
  const problems: string[] = [];
  const value = (name: string) => env[name]?.trim() ?? '';
  for (const name of REQUIRED) {
    if (!value(name)) problems.push(`${name} manquante`);
  }
  // LDAPS uniquement : la vérification TLS n'est jamais désactivée (R31.6)
  if (value('AD_LDAP_URL') && !/^ldaps:\/\/[^\s/]+(:\d+)?\/?$/i.test(value('AD_LDAP_URL'))) {
    problems.push('AD_LDAP_URL doit être une URL ldaps://hôte[:port]');
  }
  for (const name of ['AD_USER_ID_ATTRIBUTE', 'AD_MAIL_ATTRIBUTE', 'AD_GROUPS_ATTRIBUTE', 'AD_GUID_ATTRIBUTE', 'AD_SID_ATTRIBUTE']) {
    if (value(name) && !ATTRIBUTE_NAME.test(value(name))) problems.push(`${name} invalide`);
  }
  const timeout = value('AD_TIMEOUT_MS') ? Number(value('AD_TIMEOUT_MS')) : DEFAULT_AD_TIMEOUT_MS;
  if (!Number.isInteger(timeout) || timeout < 500 || timeout > 30000) problems.push('AD_TIMEOUT_MS invalide');

  let caCert: Buffer | null = null;
  if (value('AD_CA_CERT_PATH')) {
    try {
      caCert = readFileSync(value('AD_CA_CERT_PATH'));
    } catch {
      problems.push('AD_CA_CERT_PATH illisible');
    }
  }
  if (problems.length > 0 || !caCert) return { ok: false, problems };

  return {
    ok: true,
    config: {
      url: value('AD_LDAP_URL'),
      baseDn: value('AD_BASE_DN'),
      userIdAttribute: value('AD_USER_ID_ATTRIBUTE'),
      mailAttribute: value('AD_MAIL_ATTRIBUTE'),
      groupsAttribute: value('AD_GROUPS_ATTRIBUTE'),
      guidAttribute: value('AD_GUID_ATTRIBUTE'),
      sidAttribute: value('AD_SID_ATTRIBUTE') || null,
      bindDn: value('AD_BIND_DN'),
      bindPassword: env.AD_BIND_PASSWORD ?? '',
      caCert,
      timeoutMs: timeout,
    },
  };
}
