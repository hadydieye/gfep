'use client';

import { Toaster as Sonner, toast as sonnerToast } from 'sonner';

type ToasterProps = React.ComponentProps<typeof Sonner>;

/**
 * Toasts du design system (04 §4.6) : coin supérieur droit, 4 s pour succès et
 * information, au plus 2 visibles simultanément (les suivants s'empilent).
 */
const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      position="top-right"
      richColors
      closeButton
      visibleToasts={2}
      toastOptions={{
        duration: 4000,
        classNames: { error: 'toast-error' },
      }}
      {...props}
    />
  );
};

type ErrorOptions = Parameters<typeof sonnerToast.error>[1];

/**
 * `toast` de Sonner, avec des erreurs persistantes par défaut (fermeture
 * manuelle, 04 §4.6). Tout le code applicatif importe `toast` depuis ce module.
 */
const toast = Object.assign(
  (...args: Parameters<typeof sonnerToast>) => sonnerToast(...args),
  sonnerToast,
  {
    error: (message: Parameters<typeof sonnerToast.error>[0], options?: ErrorOptions) =>
      sonnerToast.error(message, { duration: Infinity, ...options }),
  },
);

export { Toaster, toast };
