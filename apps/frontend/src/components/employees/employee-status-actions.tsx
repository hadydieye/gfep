'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { UserCheck, UserX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ConfirmDialog } from '@/components/ui/dialog';
import { apiFetch } from '@/lib/api/client';
import type { Employee, EmploymentStatus } from '@/lib/api/types';

/**
 * « Suspendre » (ou sortie définitive) pour un employé actif, « Réactiver » sinon (M16).
 * La suspension suspend aussi le compte et révoque ses sessions ; la réactivation ne
 * concerne que la fiche, le compte se réactive dans Accès › Comptes.
 */
export function EmployeeStatusActions({ employee }: { employee: Pick<Employee, 'id' | 'firstName' | 'lastName' | 'employmentStatus'> }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [terminate, setTerminate] = useState(false);
  const [busy, setBusy] = useState(false);
  const fullName = `${employee.firstName} ${employee.lastName}`;
  const active = employee.employmentStatus === 'ACTIVE';
  const target: EmploymentStatus = active ? (terminate ? 'TERMINATED' : 'SUSPENDED') : 'ACTIVE';

  const confirm = async () => {
    setBusy(true);
    const result = await apiFetch<Employee>(`/employees/${employee.id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status: target }),
    });
    setBusy(false);
    setOpen(false);
    if (!result.ok) {
      if (result.status === 401) router.push('/login');
      else if (result.status === 403) toast.error('Vous n’êtes pas autorisé à changer le statut de cet employé.');
      else toast.error(result.message ?? 'Le statut n’a pas pu être modifié.');
      return;
    }
    toast.success(
      target === 'ACTIVE'
        ? `La fiche de ${fullName} est réactivée.`
        : target === 'TERMINATED'
          ? `La sortie de ${fullName} est enregistrée.`
          : `${fullName} est suspendu(e).`,
    );
    setTerminate(false);
    router.refresh();
  };

  return (
    <>
      {active ? (
        <Button variant="destructive" onClick={() => setOpen(true)}>
          <UserX className="h-4 w-4" aria-hidden />
          Suspendre
        </Button>
      ) : (
        <Button variant="secondary" onClick={() => setOpen(true)}>
          <UserCheck className="h-4 w-4" aria-hidden />
          Réactiver
        </Button>
      )}
      <ConfirmDialog
        open={open}
        title={active ? `Suspendre ${fullName}` : `Réactiver ${fullName}`}
        description={
          active
            ? 'Le compte applicatif de cet employé sera suspendu et toutes ses sessions seront fermées immédiatement.'
            : 'Seule la fiche employé redevient active. Le compte applicatif reste suspendu jusqu’à sa réactivation dans Accès › Comptes.'
        }
        confirmLabel={active ? (terminate ? 'Enregistrer la sortie' : 'Suspendre') : 'Réactiver'}
        destructive={active}
        busy={busy}
        onOpenChange={(value) => {
          setOpen(value);
          if (!value) setTerminate(false);
        }}
        onConfirm={confirm}
      >
        {active && (
          <Checkbox
            label="Sortie définitive"
            description="L’employé quitte l’entreprise (statut « Sorti »)."
            checked={terminate}
            onChange={(event) => setTerminate(event.target.checked)}
          />
        )}
      </ConfirmDialog>
    </>
  );
}
