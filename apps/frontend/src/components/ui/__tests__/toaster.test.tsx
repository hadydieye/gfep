import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

/** Étape 3.1 — Toasts du design system (R5.2, 04 §4.6, N12). */
const sonner = vi.hoisted(() => {
  const base = Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn(), info: vi.fn() });
  return { toast: base, Toaster: vi.fn((_props: Record<string, unknown>) => null) };
});
vi.mock('sonner', () => sonner);

import { Toaster, toast } from '../sonner';

describe('Toaster et toast', () => {
  it('au plus 2 toasts visibles, 4 s par défaut, bouton de fermeture', () => {
    render(<Toaster />);
    expect(sonner.Toaster.mock.calls[0][0]).toMatchObject({
      position: 'top-right',
      visibleToasts: 2,
      closeButton: true,
      toastOptions: { duration: 4000 },
    });
  });

  it('une erreur est persistante par défaut (fermeture manuelle)', () => {
    toast.error('Le document n’a pas pu être envoyé.');
    expect(sonner.toast.error).toHaveBeenCalledWith('Le document n’a pas pu être envoyé.', { duration: Infinity });
    toast.success('Votre document a été envoyé.');
    expect(sonner.toast.success).toHaveBeenCalledWith('Votre document a été envoyé.');
  });
});
