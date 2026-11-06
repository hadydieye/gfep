'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/sonner';
import { apiFetch } from '@/lib/api/client';

const schema = z
  .object({
    currentPassword: z.string().min(1, 'Requis'),
    newPassword: z.string().min(12, 'Au moins 12 caractères').max(128, 'Au plus 128 caractères'),
    confirmPassword: z.string().min(1, 'Requis'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Les mots de passe ne correspondent pas.',
    path: ['confirmPassword'],
  });

type FormValues = z.infer<typeof schema>;

const PASSWORD_RULES = [
  'Au moins 12 caractères',
  'Différent du mot de passe actuel',
  "Ne contient pas l'identifiant, le prénom ou le nom",
  'Pas un mot de passe courant',
];

/**
 * Formulaire de changement de mot de passe (T3.2.8, N14) :
 * - validation en temps réel seulement après la première soumission ;
 * - toast de succès ; erreurs affichées sous le champ ;
 * - règles affichées sous le champ « Nouveau mot de passe ».
 */
export function ChangePasswordForm() {
  const [submitted, setSubmitted] = useState(false);
  const rulesId = useId();

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: 'onTouched',
    reValidateMode: submitted ? 'onChange' : 'onSubmit',
  });

  const onSubmit = async (values: FormValues) => {
    setSubmitted(true);
    const result = await apiFetch<void>('/profile/password', {
      method: 'PATCH',
      body: JSON.stringify({ currentPassword: values.currentPassword, newPassword: values.newPassword }),
    });
    if (result.ok) {
      reset();
      setSubmitted(false);
      toast.success('Mot de passe modifié avec succès.');
    } else if (result.status === 429) {
      toast.error('Trop de tentatives. Réessayez dans quelques minutes.');
    } else {
      const message = result.message ?? 'Une erreur est survenue.';
      if (message.includes('actuel')) {
        setError('currentPassword', { message });
      } else {
        setError('newPassword', { message });
      }
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      {/* Mot de passe actuel */}
      <div>
        <label htmlFor="currentPassword" className="mb-1 block text-sm font-medium text-foreground-primary">
          Mot de passe actuel
        </label>
        <input
          id="currentPassword"
          type="password"
          autoComplete="current-password"
          className="w-full rounded-md border border-border bg-background-main px-3 py-2 text-sm text-foreground-primary placeholder:text-foreground-secondary focus:outline-none focus:ring-2 focus:ring-link"
          {...register('currentPassword')}
        />
        {errors.currentPassword && (
          <p role="alert" className="mt-1 text-xs text-error">
            {errors.currentPassword.message}
          </p>
        )}
      </div>

      {/* Nouveau mot de passe */}
      <div>
        <label htmlFor="newPassword" className="mb-1 block text-sm font-medium text-foreground-primary">
          Nouveau mot de passe
        </label>
        <input
          id="newPassword"
          type="password"
          autoComplete="new-password"
          aria-describedby={rulesId}
          className="w-full rounded-md border border-border bg-background-main px-3 py-2 text-sm text-foreground-primary placeholder:text-foreground-secondary focus:outline-none focus:ring-2 focus:ring-link"
          {...register('newPassword')}
        />
        {errors.newPassword && (
          <p role="alert" className="mt-1 text-xs text-error">
            {errors.newPassword.message}
          </p>
        )}
        <ul id={rulesId} className="mt-2 space-y-1">
          {PASSWORD_RULES.map((rule) => (
            <li key={rule} className="text-xs text-foreground-secondary">
              &bull; {rule}
            </li>
          ))}
        </ul>
      </div>

      {/* Confirmation */}
      <div>
        <label htmlFor="confirmPassword" className="mb-1 block text-sm font-medium text-foreground-primary">
          Confirmer le nouveau mot de passe
        </label>
        <input
          id="confirmPassword"
          type="password"
          autoComplete="new-password"
          className="w-full rounded-md border border-border bg-background-main px-3 py-2 text-sm text-foreground-primary placeholder:text-foreground-secondary focus:outline-none focus:ring-2 focus:ring-link"
          {...register('confirmPassword')}
        />
        {errors.confirmPassword && (
          <p role="alert" className="mt-1 text-xs text-error">
            {errors.confirmPassword.message}
          </p>
        )}
      </div>

      <Button type="submit" variant="primary" disabled={isSubmitting}>
        {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
        Changer le mot de passe
      </Button>
    </form>
  );
}
