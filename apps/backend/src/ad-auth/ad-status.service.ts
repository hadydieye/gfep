import { Injectable } from '@nestjs/common';
import { loadAdConfig } from './ad-config.js';
import { LdapClientFactory } from './ldap-client.js';

export type LdapStatus = 'UP' | 'DOWN' | 'NOT_CONFIGURED';

const CACHE_MS = 30_000;

/**
 * État de l'annuaire pour « État des services » (M20) : bind du compte de service,
 * délai de 3 s, résultat mis en cache 30 s. Sans configuration : NOT_CONFIGURED.
 */
@Injectable()
export class AdStatusService {
  private cache: { status: LdapStatus; at: number } | null = null;

  constructor(private readonly ldap: LdapClientFactory) {}

  async status(now = Date.now()): Promise<LdapStatus> {
    if (this.cache && now - this.cache.at < CACHE_MS) return this.cache.status;
    const result = loadAdConfig();
    let status: LdapStatus = 'NOT_CONFIGURED';
    if (result.ok) {
      const connection = this.ldap.connect(result.config);
      try {
        await connection.bind(result.config.bindDn, result.config.bindPassword);
        status = 'UP';
      } catch {
        status = 'DOWN';
      } finally {
        await connection.close().catch(() => undefined);
      }
    }
    this.cache = { status, at: now };
    return status;
  }
}
