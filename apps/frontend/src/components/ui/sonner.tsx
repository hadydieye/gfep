'use client';

import { Toaster as Sonner } from 'sonner';

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      position="top-right"
      richColors
      toastOptions={{
        duration: 4000, // 4s pour success et info
        classNames: {
          error: 'toast-error', // La durée infinie est gérée par l'appelant
        },
      }}
      {...props}
    />
  );
};

// Utilitaire exposé pour les toast d'erreur persistants
// Usage : showErrorToast('Message d\'erreur')
export { Toaster };
