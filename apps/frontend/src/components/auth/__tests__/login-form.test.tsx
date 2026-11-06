import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LOGIN_ERRORS, LoginForm } from '../login-form';

const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, refresh: vi.fn() }),
}));

async function submit() {
  const user = userEvent.setup();
  render(<LoginForm />);
  await user.type(screen.getByLabelText('Identifiant'), 'm.keita');
  await user.type(screen.getByLabelText('Mot de passe'), 'secret');
  await user.click(screen.getByRole('button', { name: 'Se connecter' }));
}

const respond = (status: number) =>
  vi.fn(async () => new Response(JSON.stringify({ statusCode: status }), { status }));

describe('LoginForm : messages d’erreur', () => {
  beforeEach(() => push.mockReset());
  afterEach(() => vi.unstubAllGlobals());

  it.each([
    [401, LOGIN_ERRORS.invalid],
    [400, LOGIN_ERRORS.invalid],
    [429, LOGIN_ERRORS.throttled],
    [500, LOGIN_ERRORS.unavailable],
    [503, LOGIN_ERRORS.unavailable],
  ])('HTTP %i → "%s"', async (status, message) => {
    vi.stubGlobal('fetch', respond(status));
    await submit();
    expect(await screen.findByRole('alert')).toHaveTextContent(message);
    expect(push).not.toHaveBeenCalled();
  });

  it('backend injoignable (erreur réseau) → service indisponible', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('Failed to fetch'))));
    await submit();
    expect(await screen.findByRole('alert')).toHaveTextContent(LOGIN_ERRORS.unavailable);
  });

  it('succès → redirection vers /dashboard', async () => {
    vi.stubGlobal('fetch', respond(200));
    await submit();
    await vi.waitFor(() => expect(push).toHaveBeenCalledWith('/dashboard'));
  });
});

describe('Mot de passe oublié (étape 3.2, N13)', () => {
  it('affiche en place un message identique pour tous, sans appel réseau', async () => {
    const { ForgotPassword, FORGOT_PASSWORD_MESSAGE } = await import('../forgot-password');
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const user = userEvent.setup();
    render(<ForgotPassword />);
    const button = screen.getByRole('button', { name: 'Mot de passe oublié ?' });
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(screen.getByRole('status').textContent).toBe('');
    await user.click(button);
    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('status').textContent).toBe(FORGOT_PASSWORD_MESSAGE);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
