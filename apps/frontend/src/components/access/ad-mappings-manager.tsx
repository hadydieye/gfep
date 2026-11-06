'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from '@/components/ui/sonner';
import { Plus, Trash2 } from 'lucide-react';
import { ApiErrorState, EmptyState } from '@/components/states/states';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { apiFetch } from '@/lib/api/client';
import type { AdMapping, RoleSummary } from '@/lib/api/types';
import { RoleBadge, roleLabel } from './access-labels';

// Même règle que le backend : composants `attribut=valeur` séparés par des virgules, 500 caractères au plus
const DN_PATTERN = /^[A-Za-z][A-Za-z0-9-]*=[^,=+<>#;"\\]+(?:,\s*[A-Za-z][A-Za-z0-9-]*=[^,=+<>#;"\\]+)*$/;

type ListState = { kind: 'loading' } | { kind: 'error'; status: number } | { kind: 'ready'; mappings: AdMapping[] };

/**
 * Mappings groupe AD → rôle (M22, design §9.5). Seul un SUPER_ADMIN cible le rôle
 * SUPER_ADMIN : l'option est désactivée et la suppression masquée pour les autres.
 */
export function AdMappingsManager({ isSuperAdmin }: { isSuperAdmin: boolean }) {
  const router = useRouter();
  const [state, setState] = useState<ListState>({ kind: 'loading' });
  const [roles, setRoles] = useState<RoleSummary[]>([]);
  const [reload, setReload] = useState(0);
  const [adGroupDn, setAdGroupDn] = useState('');
  const [roleId, setRoleId] = useState('');
  const [dnError, setDnError] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState<AdMapping | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    void apiFetch<RoleSummary[]>('/access/roles').then((result) => {
      if (result.ok) setRoles(result.data);
    });
  }, []);

  useEffect(() => {
    let active = true;
    void apiFetch<AdMapping[]>('/access/ad-mappings').then((result) => {
      if (!active) return;
      if (!result.ok && result.status === 401) {
        router.push('/login');
        return;
      }
      setState(result.ok ? { kind: 'ready', mappings: result.data } : { kind: 'error', status: result.status });
    });
    return () => {
      active = false;
    };
  }, [reload, router]);

  const refresh = () => setReload((value) => value + 1);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const dn = adGroupDn.trim();
    if (!DN_PATTERN.test(dn) || dn.length > 500) {
      setDnError('Saisissez un DN de groupe valide, ex. cn=GFEP-Employes,ou=Informatique,dc=gnpaytrust,dc=local.');
      return;
    }
    if (!roleId) return;
    setDnError(undefined);
    setSaving(true);
    const result = await apiFetch<AdMapping>('/access/ad-mappings', {
      method: 'POST',
      body: JSON.stringify({ adGroupDn: dn, roleId }),
    });
    setSaving(false);
    if (!result.ok) {
      if (result.status === 401) router.push('/login');
      else if (result.status === 403) toast.error('Seul un Super Admin peut associer un groupe au rôle Super Admin.');
      else toast.error(result.message ?? 'Le mapping n’a pas pu être enregistré.');
      return;
    }
    toast.success(`Le groupe est associé au rôle « ${roleLabel(result.data.role.name)} ».`);
    setAdGroupDn('');
    setRoleId('');
    refresh();
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    const result = await apiFetch(`/access/ad-mappings/${toDelete.id}`, { method: 'DELETE' });
    setDeleting(false);
    setToDelete(null);
    if (!result.ok) {
      if (result.status === 401) router.push('/login');
      else toast.error(result.message ?? 'Le mapping n’a pas pu être supprimé.');
      return;
    }
    toast.success('Le mapping est supprimé.');
    refresh();
  };

  const canManage = (mapping: AdMapping) => isSuperAdmin || mapping.role.name !== 'SUPER_ADMIN';

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold text-foreground-primary">Mappings AD</h1>
        <p className="text-sm text-foreground-secondary">
          Les rôles d’un compte d’entreprise sont recalculés à chaque connexion depuis ses groupes d’annuaire.
        </p>
      </div>

      <form onSubmit={submit} noValidate className="grid grid-cols-1 gap-3 rounded-[8px] border border-border bg-background-surface p-5 md:grid-cols-[1fr_240px_auto] md:items-end">
        <Input
          label="DN du groupe"
          value={adGroupDn}
          maxLength={500}
          autoComplete="off"
          error={dnError}
          onChange={(event) => setAdGroupDn(event.target.value)}
        />
        <Select label="Rôle" value={roleId} onChange={(event) => setRoleId(event.target.value)}>
          <option value="">Sélectionnez un rôle</option>
          {roles.map((role) => (
            <option key={role.id} value={role.id} disabled={role.name === 'SUPER_ADMIN' && !isSuperAdmin}>
              {roleLabel(role.name)}
            </option>
          ))}
        </Select>
        <Button type="submit" disabled={saving || !roleId || !adGroupDn.trim()}>
          <Plus className="h-4 w-4" aria-hidden />
          Ajouter
        </Button>
      </form>

      {state.kind === 'error' ? (
        <ApiErrorState status={state.status} message="Impossible de charger les mappings." onRetry={refresh} />
      ) : state.kind === 'ready' && state.mappings.length === 0 ? (
        <EmptyState message="Aucun groupe d’annuaire n’est associé à un rôle." />
      ) : (
        <>
        <div className="hidden overflow-auto rounded-[8px] border border-border bg-background-surface md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Groupe (DN)</TableHead>
                <TableHead>Rôle</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {state.kind === 'loading'
                ? Array.from({ length: 3 }, (_, index) => (
                  <TableRow key={index}><TableCell colSpan={3}><Skeleton className="h-4 w-full" /></TableCell></TableRow>
                ))
                : state.mappings.map((mapping) => (
                  <TableRow key={mapping.id}>
                    <TableCell className="break-all font-mono text-xs">{mapping.adGroupDn}</TableCell>
                    <TableCell><RoleBadge name={mapping.role.name} /></TableCell>
                    <TableCell className="text-right">
                      {canManage(mapping) && (
                        <Button size="sm" variant="secondary" onClick={() => setToDelete(mapping)}>
                          <Trash2 className="h-4 w-4" aria-hidden />
                          Supprimer
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </div>
        {/* Mobile : cartes empilées (04 §6) */}
        <div className="flex flex-col gap-2 md:hidden">
          {state.kind === 'loading'
            ? Array.from({ length: 3 }, (_, index) => <Skeleton key={index} className="h-24 w-full" />)
            : state.mappings.map((mapping) => (
                <div key={mapping.id} className="flex flex-col gap-2 rounded-[8px] border border-border bg-background-surface p-4">
                  <span className="break-all font-mono text-xs text-foreground-primary">{mapping.adGroupDn}</span>
                  <span className="flex items-center justify-between gap-2">
                    <RoleBadge name={mapping.role.name} />
                    {canManage(mapping) && (
                      <Button size="sm" variant="secondary" onClick={() => setToDelete(mapping)}>
                        <Trash2 className="h-4 w-4" aria-hidden />
                        Supprimer
                      </Button>
                    )}
                  </span>
                </div>
              ))}
        </div>
        </>
      )}

      <ConfirmDialog
        open={toDelete !== null}
        title="Supprimer le mapping"
        description={
          toDelete
            ? `Les membres de ${toDelete.adGroupDn} perdront le rôle « ${roleLabel(toDelete.role.name)} » à leur prochaine connexion.`
            : ''
        }
        confirmLabel="Supprimer"
        destructive
        busy={deleting}
        onOpenChange={(open) => {
          if (!open) setToDelete(null);
        }}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
