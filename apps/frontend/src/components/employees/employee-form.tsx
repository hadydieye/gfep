'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { toast } from '@/components/ui/sonner';
import { apiFetch } from '@/lib/api/client';
import type { Department, Employee, PaginatedEmployees } from '@/lib/api/types';

const employeeSchema = z.object({
  firstName: z.string().trim().min(1, 'Le prénom est requis.').max(100, '100 caractères maximum.'),
  lastName: z.string().trim().min(1, 'Le nom est requis.').max(100, '100 caractères maximum.'),
  professionalEmail: z.string().trim().pipe(z.email('Adresse email invalide.')),
  phone: z
    .string()
    .trim()
    .regex(/^(\+?[0-9][0-9 ]{7,19})?$/, 'Numéro de téléphone invalide.'),
  departmentId: z.string().min(1, 'Le département est requis.'),
  positionId: z.string().min(1, 'Le poste est requis.'),
  managerId: z.string(),
  hireDate: z.string().min(1, "La date d'embauche est requise."),
});

type EmployeeValues = z.infer<typeof employeeSchema>;

export interface EmployeeFormProps {
  employee?: Employee;
  /** Département imposé pour un DEPARTMENT_MANAGER (Department Manager Scope) */
  scopeDepartmentId: string | null;
}

export function EmployeeForm({ employee, scopeDepartmentId }: EmployeeFormProps) {
  const router = useRouter();
  const isEdit = employee !== undefined;
  const [departments, setDepartments] = useState<Department[]>([]);
  const [managers, setManagers] = useState<PaginatedEmployees['data']>([]);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<EmployeeValues>({
    resolver: zodResolver(employeeSchema),
    // Validation à la soumission, puis en temps réel après la première tentative
    mode: 'onSubmit',
    reValidateMode: 'onChange',
    defaultValues: {
      firstName: employee?.firstName ?? '',
      lastName: employee?.lastName ?? '',
      professionalEmail: employee?.professionalEmail ?? '',
      phone: employee?.phone ?? '',
      departmentId: employee?.departmentId ?? scopeDepartmentId ?? '',
      positionId: employee?.positionId ?? '',
      managerId: employee?.managerId ?? '',
      hireDate: employee?.hireDate.slice(0, 10) ?? '',
    },
  });

  useEffect(() => {
    void apiFetch<Department[]>('/departments').then((r) => r.ok && setDepartments(r.data));
    void apiFetch<PaginatedEmployees>('/employees?limit=100').then(
      (r) => r.ok && setManagers(r.data.data.filter((m) => m.id !== employee?.id)),
    );
  }, [employee?.id]);

  const departmentId = watch('departmentId');
  const positions = departments.find((d) => d.id === departmentId)?.positions ?? [];

  // Le poste doit appartenir au département choisi
  useEffect(() => {
    if (departments.length === 0) return;
    const valid = departments.find((d) => d.id === departmentId)?.positions ?? [];
    const positionId = getValues('positionId');
    if (positionId && !valid.some((p) => p.id === positionId)) {
      setValue('positionId', '');
    }
  }, [departmentId, departments, getValues, setValue]);

  const selectableDepartments = scopeDepartmentId
    ? departments.filter((d) => d.id === scopeDepartmentId)
    : departments;

  const onSubmit = async (values: EmployeeValues) => {
    setFormError(null);
    const payload = {
      ...values,
      // Champs optionnels vides : omis à la création, effacés (null) en édition
      phone: values.phone || (isEdit ? null : undefined),
      managerId: values.managerId || (isEdit ? null : undefined),
    };
    const result = await apiFetch<Employee>(isEdit ? `/employees/${employee.id}` : '/employees', {
      method: isEdit ? 'PATCH' : 'POST',
      body: JSON.stringify(payload),
    });

    if (result.ok) {
      const name = `${result.data.firstName} ${result.data.lastName}`;
      // Le Toaster du layout racine survit à la navigation : le toast s'affiche sur la fiche
      toast.success(isEdit ? `La fiche de ${name} a été mise à jour.` : `L’employé ${name} a été créé.`);
      router.push(`/employees/${result.data.id}`);
      router.refresh();
      return;
    }
    if (result.status === 401) {
      router.push('/login');
    } else if (result.status === 403) {
      setFormError("Vous n'avez pas les droits pour enregistrer cet employé.");
    } else {
      setFormError(result.message ?? "Impossible d'enregistrer l'employé. Réessayez.");
    }
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      className="flex flex-col gap-6 rounded-[8px] border border-border bg-background-surface p-6 shadow-card"
    >
      <fieldset className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <legend className="mb-2 text-sm font-semibold text-foreground-primary">
          Informations personnelles
        </legend>
        <Input label="Prénom" autoComplete="off" error={errors.firstName?.message} {...register('firstName')} />
        <Input label="Nom" autoComplete="off" error={errors.lastName?.message} {...register('lastName')} />
        <Input
          label="Email professionnel"
          type="email"
          error={errors.professionalEmail?.message}
          {...register('professionalEmail')}
        />
        <Input
          label="Téléphone (optionnel)"
          type="tel"
          placeholder="+224 620 00 00 00"
          error={errors.phone?.message}
          {...register('phone')}
        />
      </fieldset>

      <fieldset className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <legend className="mb-2 text-sm font-semibold text-foreground-primary">
          Informations professionnelles
        </legend>
        <Select label="Département" error={errors.departmentId?.message} {...register('departmentId')}>
          <option value="">Sélectionner un département</option>
          {selectableDepartments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </Select>
        <Select
          label="Poste"
          disabled={!departmentId}
          error={errors.positionId?.message}
          {...register('positionId')}
        >
          <option value="">Sélectionner un poste</option>
          {positions.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title}
            </option>
          ))}
        </Select>
        <Select label="Responsable (optionnel)" {...register('managerId')}>
          <option value="">Aucun responsable</option>
          {managers.map((m) => (
            <option key={m.id} value={m.id}>
              {m.firstName} {m.lastName}
            </option>
          ))}
        </Select>
        <Input
          label="Date d'embauche"
          type="date"
          error={errors.hireDate?.message}
          {...register('hireDate')}
        />
      </fieldset>

      {formError && (
        <p role="alert" className="text-sm text-error">
          {formError}
        </p>
      )}

      <div className="flex justify-end gap-3">
        <Button type="button" variant="secondary" onClick={() => router.back()}>
          Annuler
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
          Enregistrer
        </Button>
      </div>
    </form>
  );
}
