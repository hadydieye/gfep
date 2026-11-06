'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { toast } from '@/components/ui/sonner';
import { z } from 'zod';
import { ArrowLeft, Save } from 'lucide-react';
import { ApiErrorState } from '@/components/states/states';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { apiFetch } from '@/lib/api/client';
import type { Department, Transaction } from '@/lib/api/types';

// Même règle que le backend : chaîne décimale > 0, 2 décimales et 12 chiffres entiers au plus
const AMOUNT_PATTERN = /^(?!0+(?:\.0{1,2})?$)(?:0|[1-9]\d{0,11})(?:\.\d{1,2})?$/;

/** « 1 500 000,50 » → « 1500000.50 » : le montant reste une chaîne, jamais un nombre flottant. */
export function normalizeAmount(value: string): string {
  return value.replace(/[\s  ]/g, '').replace(',', '.');
}

export const transactionSchema = z.object({
  transactionType: z.enum(['INCOME', 'EXPENSE'], { message: 'Sélectionnez un type.' }),
  amount: z
    .string()
    .transform(normalizeAmount)
    .refine((value) => AMOUNT_PATTERN.test(value), 'Saisissez un montant positif, avec 2 décimales au plus.'),
  departmentId: z.string().uuid('Sélectionnez un département.'),
  description: z.string().trim().max(500, 'La description ne peut dépasser 500 caractères.').optional(),
});

type TransactionInput = z.input<typeof transactionSchema>;
type TransactionValues = z.output<typeof transactionSchema>;

export function TransactionForm() {
  const router = useRouter();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [departmentError, setDepartmentError] = useState<number | null>(null);
  const [departmentReload, setDepartmentReload] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const form = useForm<TransactionInput, unknown, TransactionValues>({
    resolver: zodResolver(transactionSchema),
    defaultValues: { transactionType: 'EXPENSE', amount: '', departmentId: '', description: '' },
  });

  useEffect(() => {
    void apiFetch<Department[]>('/departments').then((result) => {
      if (result.ok) setDepartments(result.data);
      else if (result.status === 401) router.push('/login');
      else setDepartmentError(result.status);
    });
  }, [router, departmentReload]);

  const submit = form.handleSubmit(async (values) => {
    setSubmitting(true);
    const result = await apiFetch<Transaction>('/transactions', {
      method: 'POST',
      body: JSON.stringify({
        transactionType: values.transactionType,
        amount: values.amount,
        departmentId: values.departmentId,
        ...(values.description ? { description: values.description } : {}),
      }),
    });
    setSubmitting(false);
    if (!result.ok) {
      if (result.status === 401) router.push('/login');
      else toast.error(result.message ?? 'La transaction n’a pas pu être enregistrée.');
      return;
    }
    toast.success(`La transaction ${result.data.reference} a été enregistrée.`);
    router.push('/finance/transactions');
  });

  if (departmentError !== null) {
    return (
      <ApiErrorState
        status={departmentError}
        message="Impossible de charger les départements."
        onRetry={() => {
          setDepartmentError(null);
          setDepartmentReload((value) => value + 1);
        }}
      />
    );
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5">
      <div className="flex items-center gap-3">
        <Button asChild variant="secondary" size="icon" aria-label="Retour aux transactions">
          <Link href="/finance/transactions"><ArrowLeft className="h-4 w-4" aria-hidden /></Link>
        </Button>
        <h1 className="text-2xl font-semibold text-foreground-primary">Nouvelle transaction</h1>
      </div>
      <form className="flex flex-col gap-4 rounded-[8px] border border-border bg-background-surface p-5" onSubmit={submit} noValidate>
        <Select label="Type" {...form.register('transactionType')} error={form.formState.errors.transactionType?.message}>
          <option value="EXPENSE">Dépense</option>
          <option value="INCOME">Recette</option>
        </Select>
        <Input
          label="Montant (GNF)"
          inputMode="decimal"
          autoComplete="off"
          className="tabular-nums"
          {...form.register('amount')}
          error={form.formState.errors.amount?.message}
        />
        <Select label="Département" {...form.register('departmentId')} error={form.formState.errors.departmentId?.message}>
          <option value="">Sélectionnez un département</option>
          {departments.map((department) => (
            <option key={department.id} value={department.id}>{department.name}</option>
          ))}
        </Select>
        <Input label="Description" {...form.register('description')} error={form.formState.errors.description?.message} />
        <p className="text-xs text-foreground-secondary">La transaction est créée au statut « En attente » ; sa validation revient au Super Admin.</p>
        <div className="flex justify-end gap-2">
          <Button asChild variant="secondary"><Link href="/finance/transactions">Annuler</Link></Button>
          <Button type="submit" disabled={submitting}>
            <Save className="h-4 w-4" aria-hidden />
            {submitting ? 'Enregistrement…' : 'Enregistrer'}
          </Button>
        </div>
      </form>
    </div>
  );
}
