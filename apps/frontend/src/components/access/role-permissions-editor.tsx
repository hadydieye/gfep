'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from '@/components/ui/sonner';
import { Lock, Save } from 'lucide-react';
import { Breadcrumb } from '@/components/ui/breadcrumb';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ConfirmDialog } from '@/components/ui/dialog';
import { apiFetch } from '@/lib/api/client';
import type { PermissionItem, RoleDetail } from '@/lib/api/types';
import { RESOURCE_LABELS, roleLabel } from './access-labels';

/**
 * Permissions d'un rôle groupées par ressource (M18). Modifiable par le SUPER_ADMIN
 * (sauf le rôle SUPER_ADMIN) ; lecture seule pour l'IT_ADMINISTRATOR. Une permission
 * d'un rôle que l'on détient ne peut pas être retirée.
 */
export function RolePermissionsEditor({ role: initialRole }: { role: RoleDetail }) {
  const router = useRouter();
  const [role, setRole] = useState(initialRole);
  const [selected, setSelected] = useState<Set<string>>(new Set(initialRole.permissionIds));
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const locked = useMemo(() => new Set(role.lockedPermissionIds), [role.lockedPermissionIds]);
  const groups = useMemo(() => groupByResource(role.catalog), [role.catalog]);
  const original = useMemo(() => new Set(role.permissionIds), [role.permissionIds]);
  const changed = selected.size !== original.size || [...selected].some((id) => !original.has(id));

  const toggle = (id: string, checked: boolean) => {
    const next = new Set(selected);
    if (checked) next.add(id);
    else next.delete(id);
    setSelected(next);
  };

  const save = async () => {
    setSaving(true);
    const result = await apiFetch<RoleDetail>(`/access/roles/${role.id}/permissions`, {
      method: 'PUT',
      body: JSON.stringify({ permissionIds: [...selected] }),
    });
    setSaving(false);
    setConfirming(false);
    if (!result.ok) {
      if (result.status === 401) router.push('/login');
      else if (result.status === 403) toast.error('Cette modification n’est pas autorisée.');
      else toast.error(result.message ?? 'Les permissions n’ont pas pu être enregistrées.');
      return;
    }
    setRole(result.data);
    setSelected(new Set(result.data.permissionIds));
    toast.success(`Les permissions du rôle « ${roleLabel(result.data.name)} » sont enregistrées.`);
    router.refresh();
  };

  return (
    <div className="flex flex-col gap-5">
      <Breadcrumb items={[{ label: 'Rôles', href: '/access/roles' }, { label: roleLabel(role.name) }]} />
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground-primary">{roleLabel(role.name)}</h1>
          <p className="text-sm text-foreground-secondary">
            {role.description} · {role.userCount} compte{role.userCount === 1 ? '' : 's'}
          </p>
        </div>
        {role.editable && (
          <Button disabled={!changed || saving} onClick={() => setConfirming(true)}>
            <Save className="h-4 w-4" aria-hidden />
            Enregistrer
          </Button>
        )}
      </div>
      {!role.editable && (
        <p className="flex items-center gap-2 text-sm text-foreground-secondary">
          <Lock className="h-4 w-4" aria-hidden />
          {role.name === 'SUPER_ADMIN'
            ? 'Le rôle Super Admin détient toutes les permissions et n’est pas modifiable.'
            : 'Consultation seule : seul le Super Admin modifie les permissions des rôles.'}
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {groups.map(([resource, permissions]) => (
          <section key={resource} className="rounded-[8px] border border-border bg-background-surface p-5">
            <h2 className="mb-3 text-base font-semibold text-foreground-primary">{RESOURCE_LABELS[resource] ?? resource}</h2>
            <div className="flex flex-col gap-2">
              {permissions.map((permission) => {
                const checked = selected.has(permission.id);
                return (
                  <Checkbox
                    key={permission.id}
                    label={`${permission.resource}:${permission.action}`}
                    description={permission.description ?? undefined}
                    checked={checked}
                    disabled={!role.editable || (locked.has(permission.id) && checked)}
                    onChange={(event) => toggle(permission.id, event.target.checked)}
                  />
                );
              })}
            </div>
          </section>
        ))}
      </div>

      <ConfirmDialog
        open={confirming}
        title={`Modifier le rôle « ${roleLabel(role.name)} »`}
        description={`${selected.size} permission${selected.size === 1 ? '' : 's'} seront accordées. Les ${role.userCount} compte${role.userCount === 1 ? '' : 's'} titulaires de ce rôle sont concernés immédiatement.`}
        confirmLabel="Enregistrer"
        busy={saving}
        onOpenChange={setConfirming}
        onConfirm={save}
      />
    </div>
  );
}

function groupByResource(catalog: PermissionItem[]): Array<[string, PermissionItem[]]> {
  const groups = new Map<string, PermissionItem[]>();
  for (const permission of catalog) {
    groups.set(permission.resource, [...(groups.get(permission.resource) ?? []), permission]);
  }
  return [...groups.entries()];
}
