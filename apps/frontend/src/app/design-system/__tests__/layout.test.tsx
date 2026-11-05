import { afterEach, describe, expect, it, vi } from 'vitest';
import DesignSystemLayout from '../layout';

describe('/design-system : page interne', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('renvoie 404 (notFound) quand NODE_ENV=production', () => {
    vi.stubEnv('NODE_ENV', 'production');
    expect(() => DesignSystemLayout({ children: 'contenu' })).toThrow(/NEXT_HTTP_ERROR_FALLBACK;404/);
  });

  it('est servie hors production', () => {
    vi.stubEnv('NODE_ENV', 'development');
    expect(DesignSystemLayout({ children: 'contenu' })).toBe('contenu');
  });
});
