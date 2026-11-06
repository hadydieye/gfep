'use client';

import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/sonner';
import { apiFetch } from '@/lib/api/client';
import type { EffectiveConfiguration } from '@/lib/api/types';

const schema = z.object({
  sessionTtlHours: z
    .number()
    .int('Entier requis')
    .min(1, 'Minimum 1 heure')
    .max(12, 'Maximum 12 heures'),
});

type FormValues = z.infer<typeof schema>;

/** Formulaire de modification de la durée de session (T3.2.9, N16). */
export function SessionSettingsForm({ initialHours }: { initialHours: number }) {
  const [currentHours, setCurrentHours] = useState(initialHours);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { sessionTtlHours: initialHours },
  });

  const onSubmit = async (values: FormValues) => {
    const result = await apiFetch<EffectiveConfiguration>('/admin/settings', {
      method: 'PATCH',
      body: JSON.stringify({ sessionTtlHours: values.sessionTtlHours }),
    });
    if (result.ok) {
      setCurrentHours(result.data.sessionTtlHours);
      toast.success(`Durée de session mise à jour : ${result.data.sessionTtlHours} heure${result.data.sessionTtlHours > 1 ? 's' : ''}.`);
    } else {
      toast.error(result.message ?? 'Erreur lors de la mise à jour.');
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex items-end gap-3">
      <div className="flex-1">
        <label htmlFor="sessionTtlHours" className="mb-1 block text-sm font-medium text-foreground-primary">
          Durée (heures) — actuellement {currentHours}h
        </label>
        <input
          id="sessionTtlHours"
          type="number"
          min={1}
          max={12}
          step={1}
          className="w-full rounded-md border border-border bg-background-main px-3 py-2 text-sm text-foreground-primary focus:outline-none focus:ring-2 focus:ring-link"
          {...register('sessionTtlHours', { valueAsNumber: true })}
        />
        {errors.sessionTtlHours && (
          <p role="alert" className="mt-1 text-xs text-error">
            {errors.sessionTtlHours.message}
          </p>
        )}
      </div>
      <Button type="submit" variant="primary" disabled={isSubmitting}>
        {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
        Enregistrer
      </Button>
    </form>
  );
}
