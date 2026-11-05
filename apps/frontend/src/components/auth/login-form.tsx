'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { apiFetch } from '@/lib/api/client';

const loginSchema = z.object({
  username: z.string().trim().min(1, "L'identifiant est requis."),
  password: z.string().min(1, 'Le mot de passe est requis.'),
});

type LoginValues = z.infer<typeof loginSchema>;

export function LoginForm() {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({ resolver: zodResolver(loginSchema) });

  const onSubmit = async (values: LoginValues) => {
    setFormError(null);
    const result = await apiFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify(values),
    });
    if (result.ok) {
      router.push('/dashboard');
      router.refresh();
      return;
    }
    // Message générique : ne révèle jamais l'existence du compte
    setFormError(
      result.status === 429
        ? 'Trop de tentatives. Réessayez dans quelques minutes.'
        : 'Identifiants invalides.',
    );
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
      <Input
        label="Identifiant"
        autoComplete="username"
        autoFocus
        error={errors.username?.message}
        {...register('username')}
      />
      <Input
        label="Mot de passe"
        type="password"
        autoComplete="current-password"
        error={errors.password?.message}
        {...register('password')}
      />
      <Button type="submit" className="mt-2 w-full" disabled={isSubmitting}>
        {isSubmitting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Connexion en cours...
          </>
        ) : (
          'Se connecter'
        )}
      </Button>
      {formError && (
        <p role="alert" className="text-center text-sm text-error">
          {formError}
        </p>
      )}
    </form>
  );
}
