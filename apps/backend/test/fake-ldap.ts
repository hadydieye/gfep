import type { AdConfig } from '../src/ad-auth/ad-config.js';
import {
  LdapClientFactory,
  type LdapConnection,
  type LdapEntry,
  LdapInvalidCredentialsError,
  LdapUnavailableError,
} from '../src/ad-auth/ldap-client.js';

export interface FakeDirectoryUser {
  uid: string;
  dn: string;
  password: string;
  mail: string;
  guid: string;
  groups: string[];
}

/**
 * Annuaire simulé (tests sans Docker) : implémente la même interface que ldapjs.
 * Enregistre les filtres de recherche et les fermetures de connexion.
 */
export class FakeLdapFactory extends LdapClientFactory {
  users = new Map<string, FakeDirectoryUser>();
  mode: 'ok' | 'unreachable' | 'service-refused' = 'ok';
  serviceDn = 'cn=svc-ldapreader,ou=ServiceAccounts,dc=gnpaytrust,dc=local';
  servicePassword = 'Svc-Test';
  filters: string[] = [];
  opened = 0;
  closed = 0;

  add(user: FakeDirectoryUser) {
    this.users.set(user.uid, user);
    return user;
  }

  connect(_config: AdConfig): LdapConnection {
    this.opened += 1;
    const bind = async (dn: string, password: string) => {
      if (this.mode === 'unreachable') throw new LdapUnavailableError('ECONNREFUSED');
      if (dn === this.serviceDn) {
        if (this.mode === 'service-refused' || password !== this.servicePassword) throw new LdapInvalidCredentialsError();
        return;
      }
      const user = [...this.users.values()].find((u) => u.dn === dn);
      if (!user || user.password !== password) throw new LdapInvalidCredentialsError();
    };
    const search = async (_base: string, filter: string): Promise<LdapEntry[]> => {
      this.filters.push(filter);
      const match = /\(uid=([^)]*)\)\)$/.exec(filter);
      const user = match ? this.users.get(match[1]) : undefined;
      if (!user) return [];
      return [
        {
          dn: user.dn,
          values: { uid: [user.uid], mail: [user.mail], entryuuid: [user.guid], memberof: user.groups },
          buffers: {},
        },
      ];
    };
    return {
      bind,
      search,
      close: async () => {
        this.closed += 1;
      },
    };
  }
}

/** Variables AD de test (CA factice : le client simulé n'ouvre aucune connexion). */
export function adTestEnv(caPath: string): Record<string, string> {
  return {
    AD_LDAP_URL: 'ldaps://ldap.test:636',
    AD_BASE_DN: 'dc=gnpaytrust,dc=local',
    AD_USER_ID_ATTRIBUTE: 'uid',
    AD_MAIL_ATTRIBUTE: 'mail',
    AD_GROUPS_ATTRIBUTE: 'memberOf',
    AD_GUID_ATTRIBUTE: 'entryUUID',
    AD_SID_ATTRIBUTE: '',
    AD_BIND_DN: 'cn=svc-ldapreader,ou=ServiceAccounts,dc=gnpaytrust,dc=local',
    AD_BIND_PASSWORD: 'Svc-Test',
    AD_CA_CERT_PATH: caPath,
    AD_TIMEOUT_MS: '3000',
  };
}
