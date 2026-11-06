import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';
import { describe, expect, it } from 'vitest';

/**
 * Garde-fou du design system (04 §2.1, §9 ; N9) : toute couleur passe par les
 * tokens de globals.css. Aucune couleur en dur ni classe de palette Tailwind
 * par défaut dans le code applicatif.
 *
 * Exclus : la page de référence /design-system (elle affiche les valeurs
 * hexadécimales de la palette) et les tests.
 */
const SRC = join(__dirname, '..');
const EXCLUDED = [/^app\/design-system\//, /__tests__\//, /^test\//];

const FORBIDDEN: Array<{ label: string; pattern: RegExp }> = [
  { label: 'rgb()/rgba() en dur', pattern: /\brgba?\(/ },
  { label: 'couleur hexadécimale en dur', pattern: /#[0-9a-fA-F]{3,8}\b/ },
  {
    label: 'classe de palette Tailwind par défaut',
    pattern:
      /\b(?:bg|text|border|ring|fill|stroke|from|to|via|outline|divide|shadow|placeholder|accent|caret|decoration)-(?:black|(?:red|green|blue|yellow|amber|orange|emerald|teal|sky|indigo|violet|purple|pink|rose|lime|cyan|fuchsia|gray|slate|zinc|neutral|stone)-\d+)\b/,
  },
  // `text-white` reste autorisé : 04 §4.1 impose un texte blanc sur le bouton primaire
  { label: 'blanc hors texte du bouton primaire', pattern: /\b(?:bg|border|ring|fill|stroke)-white\b/ },
];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}

describe('Design system : aucune couleur en dur (N9)', () => {
  it('le code applicatif n’utilise que les tokens', () => {
    const violations: string[] = [];
    for (const file of sourceFiles(SRC)) {
      const rel = relative(SRC, file).split('\\').join('/');
      if (EXCLUDED.some((rule) => rule.test(rel))) continue;
      readFileSync(file, 'utf8')
        .split('\n')
        .forEach((line, index) => {
          for (const { label, pattern } of FORBIDDEN) {
            if (pattern.test(line)) violations.push(`${rel}:${index + 1} — ${label} : ${line.trim()}`);
          }
        });
    }
    expect(violations).toEqual([]);
  });

  it('le token d’ombre de carte est défini en clair et en sombre', () => {
    const css = readFileSync(join(SRC, 'app/globals.css'), 'utf8');
    const declarations = css.match(/--shadow-card:\s*[^;]+;/g) ?? [];
    expect(declarations).toHaveLength(2);
    expect(css).toMatch(/@utility shadow-card\s*{\s*box-shadow:\s*var\(--shadow-card\);/);
  });
});
