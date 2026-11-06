/**
 * Thème clair / sombre (04 §5, N8). Le choix est enregistré dans le cookie
 * `gfep-theme`, lu côté serveur par le layout racine qui pose la classe `dark`
 * sur <html> : aucun flash au chargement, aucun script en ligne.
 */
export type Theme = 'light' | 'dark';

export const THEME_COOKIE = 'gfep-theme';
const ONE_YEAR_SECONDS = 365 * 24 * 60 * 60;

/** Valeur du cookie (serveur) : seul `dark` active le thème sombre, le clair est le défaut. */
export function parseTheme(value: string | undefined): Theme {
  return value === 'dark' ? 'dark' : 'light';
}

/** Thème courant côté navigateur, d'après la classe posée sur <html>. */
export function currentTheme(): Theme {
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

/** Applique et enregistre le thème (navigateur). */
export function applyTheme(theme: Theme): void {
  document.documentElement.classList.toggle('dark', theme === 'dark');
  document.cookie = `${THEME_COOKIE}=${theme}; Path=/; Max-Age=${ONE_YEAR_SECONDS}; SameSite=Strict`;
}
