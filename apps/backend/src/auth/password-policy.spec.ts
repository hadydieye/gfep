import { PASSWORD_POLICY_MESSAGES as M, checkPasswordPolicy } from './password-policy.js';

const context = { current: 'Ancien-Mot-2026', username: 'm.diallo', firstName: 'Mamadou', lastName: 'Diallo' };

describe('politique de mot de passe (N14)', () => {
  it('accepte une phrase de passe longue et personnelle', () => {
    expect(checkPasswordPolicy('Kankan rivière 7 bleu', context)).toBeNull();
    expect(checkPasswordPolicy('tH9#vq2!Lmz8', context)).toBeNull();
  });

  it.each([
    ['Court-11car', M.tooShort],
    ['a'.repeat(129), M.tooLong],
    ['Ancien-Mot-2026', M.sameAsCurrent],
    ['Bienvenue-Diallo-7', M.personal],
    ['mamadou-2026-xyz', M.personal],
    ['xx-m.diallo-2026', M.personal],
    ['MDIALLO-secret-2026', M.personal],
    ['DIÁLLO-forteresse', M.personal],
    ['Password2026!!', M.common],
    ['Azerty123456', M.common],
    ['motdepasse123', M.common],
    ['GuineaFinance2026', M.common],
    ['123456789012', M.common],
    ['zzzzzzzzzzzz', M.common],
  ])('refuse %j', (password, message) => {
    expect(checkPasswordPolicy(password, context)).toBe(message);
  });

  it('compte les caractères, pas les unités UTF-16', () => {
    // 12 caractères dont des emojis (2 unités UTF-16 chacun) : accepté
    expect(checkPasswordPolicy('😀😀😀😀😀😀Kx7#qz', context)).toBeNull();
    // 11 caractères : refusé même si .length vaut plus
    expect(checkPasswordPolicy('😀😀😀😀😀😀Kx7#q', context)).toBe(M.tooShort);
  });
});
