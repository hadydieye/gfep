import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Button } from '../button';
import { Input } from '../input';
import { Select } from '../select';

// Garde-fous contre la régression « champs noirs / labels invisibles en thème clair »
// (variant dark: résolu sur prefers-color-scheme au lieu de la classe .dark).

const SRC = join(process.cwd(), 'src');
const css = readFileSync(join(SRC, 'app/globals.css'), 'utf8');

// ── Tokens GFEP (valeurs par thème) lus depuis globals.css ──────────────────
function block(selector: RegExp): string {
  const match = css.match(selector);
  if (!match) throw new Error(`Bloc introuvable : ${selector}`);
  return match[1];
}
function vars(source: string): Record<string, string> {
  return Object.fromEntries(
    [...source.matchAll(/--color-([a-z-]+):\s*(#[0-9a-fA-F]{6})/g)].map(([, n, v]) => [n, v]),
  );
}
const LIGHT = vars(block(/@theme\s*\{([\s\S]*?)\n\}/));
const DARK = { ...LIGHT, ...vars(block(/\.dark\s*\{([\s\S]*?)\}/)) };
const TOKENS = new Set(Object.keys(LIGHT));
type Theme = 'light' | 'dark';
const color = (theme: Theme, token: string) => {
  const value = (theme === 'dark' ? DARK : LIGHT)[token];
  if (!value) throw new Error(`Token inconnu : ${token}`);
  return value;
};

// ── WCAG 2.x ────────────────────────────────────────────────────────────────
const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const luminance = (hex: string) => {
  const [r, g, b] = rgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
/** Couleur `top` à l'opacité `alpha` composée sur `bottom`. */
const mix = (top: string, alpha: number, bottom: string) =>
  '#' +
  rgb(top)
    .map((v, i) => Math.round(v * alpha + rgb(bottom)[i] * (1 - alpha)))
    .map((v) => v.toString(16).padStart(2, '0'))
    .join('');

describe('Cause racine : thème sombre piloté par la classe .dark', () => {
  it('le variant dark: est lié à la classe .dark, pas à prefers-color-scheme', () => {
    expect(css).toMatch(/@custom-variant\s+dark\s+\(&:where\(\.dark,\s*\.dark \*\)\);/);
    const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, '');
    expect(withoutComments).not.toMatch(/prefers-color-scheme/);
  });

  it('color-scheme suit le thème applicatif (contrôles natifs) et le body utilise les tokens', () => {
    expect(block(/:root\s*\{([\s\S]*?)\}/)).toMatch(/color-scheme:\s*light/);
    expect(block(/\.dark\s*\{([\s\S]*?)\}/)).toMatch(/color-scheme:\s*dark/);
    expect(block(/body\s*\{([\s\S]*?)\}/)).toMatch(/color:\s*var\(--color-foreground-primary\)/);
  });
});

// ── Toutes les classes de couleur de src/ référencent un token GFEP ─────────
const NON_COLOR = new Set([
  'xs', 'sm', 'base', 'lg', 'xl', '2xl', '3xl', 'left', 'center', 'right', 'transparent',
  'b', 't', 'l', 'r', 'x', 'y', '0', '1', '2', '4', 'inherit', 'current', 'none',
]);
const ALLOWED_LITERALS = new Set(['white']); // texte sur fond primaire/erreur uniquement

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === '__tests__' ? [] : sourceFiles(path);
    return /\.tsx?$/.test(name) ? [path] : [];
  });
}

describe('Classes de couleur : uniquement les tokens GFEP', () => {
  const files = sourceFiles(SRC);

  it.each(files.map((f) => [relative(SRC, f), f]))('%s', (_, file) => {
    const source = readFileSync(file, 'utf8');
    const offenders: string[] = [];
    const pattern =
      /(?<![\w-])(?:[a-z-]+:)*(?:bg|text|border|ring|outline|fill|stroke|divide|decoration|from|to|via)-([a-z0-9-]+|\[[^\]]+\])(?:\/\d+)?(?![\w-])/g;
    for (const [full, value] of source.matchAll(pattern)) {
      if (/^\[\d+px\]$/.test(value)) continue; // tailles arbitraires (text-[32px])
      if (NON_COLOR.has(value) || TOKENS.has(value) || ALLOWED_LITERALS.has(value)) continue;
      offenders.push(full);
    }
    expect(offenders, 'classes de couleur hors tokens GFEP').toEqual([]);
  });
});

// ── Rendu : classes de fond / texte par thème sur les composants de formulaire ─
describe('Rendu des composants ui/ : classes de chaque thème', () => {
  const classes = (el: Element | null) => (el?.getAttribute('class') ?? '').split(/\s+/);

  it('Input : label et champ en tokens clairs, variantes dark: en tokens -dark', () => {
    const { container } = render(<Input label="Identifiant" />);
    const label = classes(container.querySelector('label'));
    const input = classes(container.querySelector('input'));

    expect(label).toEqual(expect.arrayContaining(['text-foreground-primary', 'dark:text-foreground-primary-dark']));
    expect(input).toEqual(
      expect.arrayContaining([
        'bg-background-surface',
        'dark:bg-background-surface-dark',
        'text-foreground-primary',
        'dark:text-foreground-primary-dark',
        'border-foreground-secondary',
      ]),
    );
    // Aucune couleur sombre appliquée sans le préfixe dark:
    expect(input.filter((c) => /-dark$/.test(c) && !c.startsWith('dark:'))).toEqual([]);
    expect(label.filter((c) => /-dark$/.test(c) && !c.startsWith('dark:'))).toEqual([]);
  });

  it('Select : mêmes rôles de couleur que Input', () => {
    const { container } = render(<Select label="Statut"><option>Actif</option></Select>);
    expect(classes(container.querySelector('label'))).toContain('text-foreground-primary');
    expect(classes(container.querySelector('select'))).toEqual(
      expect.arrayContaining(['bg-background-surface', 'text-foreground-primary', 'dark:text-foreground-primary-dark']),
    );
  });

  it.each([
    ['primary', ['bg-primary', 'text-white']],
    ['secondary', ['text-foreground-primary', 'dark:text-foreground-primary-dark', 'bg-transparent']],
    ['destructive', ['bg-error', 'text-white', 'dark:text-background-main-dark']],
  ] as const)('Button %s', (variant, expected) => {
    const { container } = render(<Button variant={variant}>Déconnexion</Button>);
    const button = classes(container.querySelector('button'));
    expect(button).toEqual(expect.arrayContaining([...expected]));
    expect(button).toContain('focus-visible:ring-link');
    expect(button.filter((c) => /-dark$/.test(c) && !/^(dark|hover):|^dark:hover:/.test(c))).toEqual([]);
  });
});

// ── Contraste WCAG AA calculé sur les valeurs réelles des tokens, par thème ──
describe.each(['light', 'dark'] as const)('Contraste WCAG AA — thème %s', (theme) => {
  const c = (token: string) => color(theme, token);
  const surface = c('background-surface');
  const main = c('background-main');

  it.each([
    ['texte primaire / surface', 'foreground-primary', 'background-surface'],
    ['texte primaire / fond principal', 'foreground-primary', 'background-main'],
    ['texte secondaire (labels, placeholders) / surface', 'foreground-secondary', 'background-surface'],
    ['texte secondaire / fond principal', 'foreground-secondary', 'background-main'],
    ['liens et navigation active / surface', 'link', 'background-surface'],
    ['liens / fond principal', 'link', 'background-main'],
    ['message d’erreur / surface', 'error', 'background-surface'],
  ])('%s ≥ 4.5:1', (_, fg, bg) => {
    expect(ratio(c(fg), c(bg))).toBeGreaterThanOrEqual(4.5);
  });

  it('bouton primaire : blanc sur primaire ≥ 4.5:1', () => {
    expect(ratio('#ffffff', c('primary'))).toBeGreaterThanOrEqual(4.5);
  });

  it('bouton destructif : texte sur erreur ≥ 4.5:1', () => {
    const text = theme === 'dark' ? LIGHT['background-main-dark'] : '#ffffff';
    expect(ratio(text, c('error'))).toBeGreaterThanOrEqual(4.5);
  });

  it('bouton secondaire, repos et survol ≥ 4.5:1', () => {
    expect(ratio(c('foreground-primary'), surface)).toBeGreaterThanOrEqual(4.5);
    expect(ratio(c('foreground-primary'), main)).toBeGreaterThanOrEqual(4.5); // hover:bg-background-main
  });

  it('navigation active : lien sur teinte primaire 10 % ≥ 4.5:1', () => {
    expect(ratio(c('link'), mix(c('primary'), 0.1, surface))).toBeGreaterThanOrEqual(4.5);
  });

  it.each(['success', 'warning', 'error', 'border'])(
    'badge %s : texte primaire sur fond teinté ≥ 4.5:1',
    (semantic) => {
      const alpha = semantic === 'border' ? 0.6 : semantic === 'warning' ? 0.2 : theme === 'dark' ? 0.2 : 0.15;
      expect(ratio(c('foreground-primary'), mix(c(semantic), alpha, surface))).toBeGreaterThanOrEqual(4.5);
    },
  );

  it('bordure de champ / surface ≥ 3:1 (WCAG 1.4.11)', () => {
    expect(ratio(c('foreground-secondary'), surface)).toBeGreaterThanOrEqual(3);
  });

  it('pastille de notification : texte sombre sur secondaire ≥ 4.5:1', () => {
    expect(ratio(LIGHT['background-main-dark'], c('secondary'))).toBeGreaterThanOrEqual(4.5);
  });
});
