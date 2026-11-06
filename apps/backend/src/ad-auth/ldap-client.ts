import { Injectable } from '@nestjs/common';
// Seul fichier du module qui importe ldapjs (M26) : un remplacement (ex. ldapts) ne touche que lui.
// TODO(AD-REVISION) : ldapjs est abandonné par ses mainteneurs (essai T2.7.0, M26) ; remplacement par ldapts à trancher.
// ldapjs est un module CommonJS : sous Node natif (ESM), seul l'export par défaut est disponible.
import ldap, { type Client, type SearchEntry } from 'ldapjs';

const { InvalidCredentialsError } = ldap;
import type { AdConfig } from './ad-config.js';

/** Annuaire injoignable : réseau, délai dépassé ou TLS refusé. Jamais de repli local. */
export class LdapUnavailableError extends Error {
  constructor(public readonly reason: string) {
    super('Annuaire injoignable');
  }
}

/** Identifiants refusés par l'annuaire (bind). */
export class LdapInvalidCredentialsError extends Error {
  constructor() {
    super('Identifiants refusés par l’annuaire');
  }
}

export interface LdapEntry {
  dn: string;
  /** Valeurs textuelles par attribut (noms en minuscules) */
  values: Record<string, string[]>;
  /** Valeurs binaires brutes par attribut (noms en minuscules), pour objectGUID et objectSid */
  buffers: Record<string, Buffer[]>;
}

/** Connexion LDAPS ouverte pour un seul flux, fermée systématiquement par l'appelant. */
export interface LdapConnection {
  bind(dn: string, password: string): Promise<void>;
  search(baseDn: string, filter: string, attributes: string[]): Promise<LdapEntry[]>;
  close(): Promise<void>;
}

/** Interface remplaçable (M26) : le service ne dépend que d'elle. */
export abstract class LdapClientFactory {
  abstract connect(config: AdConfig): LdapConnection;
}

/**
 * Échappement d'une valeur de filtre LDAP (RFC 4515 §3) : `\`, `*`, `(`, `)` et NUL,
 * pour qu'un identifiant saisi ne puisse jamais modifier le filtre de recherche.
 */
export function escapeFilterValue(value: string): string {
  return value.replace(/[\\*()\0]/g, (char) => `\\${char.charCodeAt(0).toString(16).padStart(2, '0')}`);
}

/**
 * GUID lisible : `entryUUID` (texte, LDAP de test) ou `objectGUID` (16 octets, AD,
 * trois premiers blocs en petit-boutiste). TODO(AD-REVISION) : à valider sur le vrai AD.
 */
export function readGuid(entry: LdapEntry, attribute: string): string | null {
  const key = attribute.toLowerCase();
  const text = entry.values[key]?.[0];
  if (text && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(text)) return text.toLowerCase();
  const raw = entry.buffers[key]?.[0];
  if (!raw || raw.length !== 16) return null;
  const hex = (start: number, end: number, reverse: boolean) => {
    const bytes = [...raw.subarray(start, end)];
    return (reverse ? bytes.reverse() : bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
  };
  return `${hex(0, 4, true)}-${hex(4, 6, true)}-${hex(6, 8, true)}-${hex(8, 10, false)}-${hex(10, 16, false)}`;
}

/**
 * SID lisible (`S-1-5-21-…`) depuis `objectSid` binaire. Absent du LDAP de test.
 * TODO(AD-REVISION) : à valider sur le vrai AD.
 */
export function readSid(entry: LdapEntry, attribute: string | null): string | null {
  if (!attribute) return null;
  const raw = entry.buffers[attribute.toLowerCase()]?.[0];
  if (!raw || raw.length < 8) return null;
  const count = raw.readUInt8(1);
  if (raw.length < 8 + 4 * count) return null;
  const authority = raw.readUIntBE(2, 6);
  const parts = Array.from({ length: count }, (_, i) => raw.readUInt32LE(8 + 4 * i));
  return `S-${raw.readUInt8(0)}-${authority}${parts.map((p) => `-${p}`).join('')}`;
}

function classify(error: unknown): Error {
  if (error instanceof InvalidCredentialsError) return new LdapInvalidCredentialsError();
  const code = (error as { code?: string } | null)?.code;
  // Code réseau (ECONNREFUSED…) ou nom et message de l'erreur, tronqués : jamais de mot de passe
  const detail = error instanceof Error ? `${error.name}: ${error.message}`.slice(0, 200) : 'Error';
  return new LdapUnavailableError(code ?? detail);
}

class LdapjsConnection implements LdapConnection {
  private readonly client: Client;
  private failure: Error | null = null;

  constructor(config: AdConfig) {
    this.client = ldap.createClient({
      url: [config.url],
      // Vérification TLS jamais désactivée (R31.6) : CA fournie par AD_CA_CERT_PATH
      tlsOptions: { ca: [config.caCert], rejectUnauthorized: true },
      timeout: config.timeoutMs,
      connectTimeout: config.timeoutMs,
      reconnect: false,
    });
    // Les erreurs de socket sont transmises à l'opération en cours, jamais levées hors flux
    this.client.on('error', (error: unknown) => {
      this.failure = classify(error);
    });
  }

  bind(dn: string, password: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.client.bind(dn, password, (error) => (error ? reject(classify(error)) : resolve()));
    });
  }

  search(baseDn: string, filter: string, attributes: string[]): Promise<LdapEntry[]> {
    return new Promise((resolve, reject) => {
      this.client.search(baseDn, { scope: 'sub', filter, attributes, sizeLimit: 2 }, (error, response) => {
        if (error) return reject(classify(error));
        const entries: LdapEntry[] = [];
        response.on('searchEntry', (entry: SearchEntry) => {
          const values: Record<string, string[]> = {};
          const buffers: Record<string, Buffer[]> = {};
          for (const attribute of entry.attributes) {
            const key = attribute.type.toLowerCase();
            const raw = attribute.values as string | string[];
            values[key] = (Array.isArray(raw) ? raw : [raw]).map(String);
            buffers[key] = attribute.buffers;
          }
          // objectName est un objet DN dans ldapjs v3 : sa forme texte est celle de pojo
          entries.push({ dn: String(entry.pojo.objectName ?? ''), values, buffers });
        });
        response.on('error', (searchError: unknown) => {
          // Plus d'une entrée : sizeLimit atteint, l'identifiant n'est pas unique
          if ((searchError as { name?: string }).name === 'SizeLimitExceededError') return resolve(entries);
          reject(this.failure ?? classify(searchError));
        });
        response.on('end', () => resolve(entries));
      });
    });
  }

  close(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.client.connected) {
        this.client.destroy();
        return resolve();
      }
      this.client.unbind(() => {
        this.client.destroy();
        resolve();
      });
    });
  }
}

@Injectable()
export class LdapjsClientFactory extends LdapClientFactory {
  connect(config: AdConfig): LdapConnection {
    return new LdapjsConnection(config);
  }
}
