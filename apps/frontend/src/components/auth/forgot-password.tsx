'use client';

import { useId, useState } from 'react';

export const FORGOT_PASSWORD_MESSAGE =
  'Contactez le service informatique de GUINEA FINANCE pour réinitialiser votre mot de passe.';

/**
 * Lien « Mot de passe oublié ? » de /login (AppFlow §3.1, N13) : affiche en place
 * un message identique pour tous, sans appel réseau ni nouvelle route. Il ne
 * révèle rien sur l'existence d'un compte.
 */
export function ForgotPassword() {
  const [open, setOpen] = useState(false);
  const messageId = useId();
  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={messageId}
        onClick={() => setOpen((value) => !value)}
        className="rounded-sm text-sm font-medium text-link hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-link"
      >
        Mot de passe oublié ?
      </button>
      <p id={messageId} role="status" className="text-center text-sm text-foreground-secondary">
        {open ? FORGOT_PASSWORD_MESSAGE : ''}
      </p>
    </div>
  );
}
