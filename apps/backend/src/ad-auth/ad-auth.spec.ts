import { mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { loadAdConfig } from './ad-config.js';
import { type LdapEntry, escapeFilterValue, readGuid, readSid } from './ldap-client.js';

const entry = (values: Record<string, string[]>, buffers: Record<string, Buffer[]> = {}): LdapEntry => ({ dn: 'uid=x', values, buffers });

describe('échappement des filtres LDAP (RFC 4515)', () => {
  it('neutralise les caractères spéciaux d’un identifiant saisi', () => {
    expect(escapeFilterValue('a*)(uid=*')).toBe('a\\2a\\29\\28uid=\\2a');
    expect(escapeFilterValue('ad\\fofana')).toBe('ad\\5cfofana');
    expect(escapeFilterValue('nul\0')).toBe('nul\\00');
    expect(escapeFilterValue('ad.fofana')).toBe('ad.fofana');
  });
});

describe('GUID et SID', () => {
  it('entryUUID textuel (LDAP de test), en minuscules', () => {
    expect(readGuid(entry({ entryuuid: ['CEBAFE00-6E22-1041-8975-CB1380B13812'] }), 'entryUUID')).toBe(
      'cebafe00-6e22-1041-8975-cb1380b13812',
    );
  });

  it('objectGUID binaire (AD) : trois premiers blocs en petit-boutiste', () => {
    const raw = Buffer.from('00112233445566778899aabbccddeeff', 'hex');
    expect(readGuid(entry({}, { objectguid: [raw] }), 'objectGUID')).toBe('33221100-5544-7766-8899-aabbccddeeff');
    expect(readGuid(entry({}, { objectguid: [Buffer.alloc(3)] }), 'objectGUID')).toBeNull();
  });

  it('objectSid binaire → S-1-5-21-…', () => {
    const raw = Buffer.from('010500000000000515000000a065cf7e784b9b5fe77c8770091c0100', 'hex');
    expect(readSid(entry({}, { objectsid: [raw] }), 'objectSid')).toBe('S-1-5-21-2127521184-1604012920-1887927527-72713');
    expect(readSid(entry({}), null)).toBeNull();
  });
});

describe('configuration AD (variables d’environnement)', () => {
  const ca = join(mkdtempSync(join(tmpdir(), 'gfep-ad-')), 'ca.crt');
  writeFileSync(ca, 'CA de test');
  const complete = {
    AD_LDAP_URL: 'ldaps://127.0.0.1:636',
    AD_BASE_DN: 'dc=gnpaytrust,dc=local',
    AD_USER_ID_ATTRIBUTE: 'uid',
    AD_MAIL_ATTRIBUTE: 'mail',
    AD_GROUPS_ATTRIBUTE: 'memberOf',
    AD_GUID_ATTRIBUTE: 'entryUUID',
    AD_BIND_DN: 'cn=svc-ldapreader,ou=ServiceAccounts,dc=gnpaytrust,dc=local',
    AD_BIND_PASSWORD: 'secret-de-test',
    AD_CA_CERT_PATH: ca,
  };

  it('configuration complète : timeout 3 s par défaut, SID facultatif', () => {
    const result = loadAdConfig(complete);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.config.timeoutMs).toBe(3000);
      expect(result.config.sidAttribute).toBeNull();
    }
  });

  it('variable manquante, ldap:// en clair ou CA illisible : AD indisponible, sans divulguer de secret', () => {
    const missing = loadAdConfig({ ...complete, AD_BIND_DN: '' });
    expect(missing).toEqual({ ok: false, problems: ['AD_BIND_DN manquante'] });
    const cleartext = loadAdConfig({ ...complete, AD_LDAP_URL: 'ldap://127.0.0.1:389' });
    expect(cleartext.ok).toBe(false);
    const badCa = loadAdConfig({ ...complete, AD_CA_CERT_PATH: '/inexistant/ca.crt' });
    expect(badCa.ok).toBe(false);
    expect(JSON.stringify([missing, cleartext, badCa])).not.toContain('secret-de-test');
  });
});
