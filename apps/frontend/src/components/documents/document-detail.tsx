'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Download, Share2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { ApiErrorState } from '@/components/states/states';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/dialog';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { apiFetch } from '@/lib/api/client';
import type {
  DocumentItem,
  DocumentSharePermission,
  DocumentShareRecipient,
  DocumentValidationStatus,
} from '@/lib/api/types';
import { ConfidentialityBadge, ValidationBadge } from './document-badges';

type PendingAction = 'validate' | 'reject' | 'delete' | null;

export function DocumentDetail({ initialDocument }: { initialDocument: DocumentItem }) {
  const router = useRouter();
  const [document, setDocument] = useState(initialDocument);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [busy, setBusy] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [recipients, setRecipients] = useState<DocumentShareRecipient[]>([]);
  const [permissions, setPermissions] = useState<DocumentSharePermission[]>([]);
  const [shareLoading, setShareLoading] = useState(false);
  const [recipientId, setRecipientId] = useState('');
  const [permission, setPermission] = useState<'READ' | 'WRITE' | 'DELETE'>('READ');
  const [shareError, setShareError] = useState<number | null>(null);

  const runAction = async () => {
    if (!pendingAction) return;
    setBusy(true);
    if (pendingAction === 'delete') {
      const result = await apiFetch<void>(`/documents/${document.id}`, { method: 'DELETE' });
      setBusy(false);
      if (!result.ok) {
        toast.error(result.message ?? 'Le document n’a pas pu être supprimé.');
        return;
      }
      toast.success('Le document a été supprimé.');
      router.push('/documents');
      router.refresh();
      return;
    }

    const status: DocumentValidationStatus = pendingAction === 'validate' ? 'VALIDATED' : 'REJECTED';
    const result = await apiFetch<DocumentItem>(`/documents/${document.id}/validation`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
    setBusy(false);
    if (!result.ok) {
      toast.error(result.message ?? 'La décision n’a pas pu être enregistrée.');
      return;
    }
    setDocument(result.data);
    setPendingAction(null);
    toast.success(status === 'VALIDATED' ? 'Le document a été validé.' : 'Le document a été rejeté.');
  };

  const openShare = async () => {
    setShareOpen(true);
    setShareLoading(true);
    setShareError(null);
    try {
      const [recipientResult, permissionResult] = await Promise.all([
        apiFetch<DocumentShareRecipient[]>(`/documents/${document.id}/share-recipients`),
        apiFetch<DocumentSharePermission[]>(`/documents/${document.id}/permissions`),
      ]);
      if (!recipientResult.ok) {
        setShareError(recipientResult.status);
        return;
      }
      if (!permissionResult.ok) {
        setShareError(permissionResult.status);
        return;
      }
      setRecipients(recipientResult.data);
      setPermissions(permissionResult.data);
    } finally {
      setShareLoading(false);
    }
  };

  const grantPermission = async () => {
    if (!recipientId) return;
    setBusy(true);
    const result = await apiFetch<DocumentSharePermission>(`/documents/${document.id}/permissions`, {
      method: 'POST',
      body: JSON.stringify({ userId: recipientId, permission }),
    });
    setBusy(false);
    if (!result.ok) {
      toast.error(result.message ?? 'Le partage n’a pas pu être enregistré.');
      return;
    }
    setPermissions((current) => [...current, result.data]);
    toast.success('Le document a été partagé.');
  };

  const revokePermission = async (permissionId: string) => {
    const result = await apiFetch<void>(`/documents/${document.id}/permissions/${permissionId}`, {
      method: 'DELETE',
    });
    if (!result.ok) {
      toast.error(result.message ?? 'Le partage n’a pas pu être retiré.');
      return;
    }
    setPermissions((current) => current.filter((entry) => entry.id !== permissionId));
    toast.success('Le partage a été retiré.');
  };

  const previewUrl = `/api/v1/documents/${document.id}/preview`;
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-5">
      <div className="flex items-center gap-3">
        <Button asChild variant="secondary" size="icon" aria-label="Retour aux documents"><Link href="/documents"><ArrowLeft className="h-4 w-4" aria-hidden /></Link></Button>
        <nav aria-label="Fil d’Ariane" className="text-sm text-foreground-secondary"><Link href="/documents" className="hover:underline">Documents</Link><span aria-hidden> / </span><span className="text-foreground-primary">{document.title}</span></nav>
      </div>

      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-5">
        <div className="flex flex-col gap-3">
          <h1 className="text-2xl font-semibold text-foreground-primary">{document.title}</h1>
          <p className="text-sm text-foreground-secondary">{document.category.name} · {document.department.name} · {document.owner.firstName} {document.owner.lastName}</p>
          <div className="flex flex-wrap gap-2"><ConfidentialityBadge level={document.confidentialityLevel} /><ValidationBadge status={document.validationStatus} /></div>
        </div>
        <div className="flex flex-wrap gap-2">
          {document.capabilities.canDownload && (
            <Button asChild variant="secondary"><a href={`/api/v1/documents/${document.id}/download`}><Download className="h-4 w-4" aria-hidden />Télécharger</a></Button>
          )}
          {document.capabilities.canValidate && (
            <>
              <Button onClick={() => setPendingAction('validate')}>Valider</Button>
              <Button variant="secondary" onClick={() => setPendingAction('reject')}>Rejeter</Button>
            </>
          )}
          {document.capabilities.canShare && (
            <Button variant="secondary" onClick={() => void openShare()}><Share2 className="h-4 w-4" aria-hidden />Partage</Button>
          )}
          {document.capabilities.canDelete && (
            <Button variant="destructive" aria-label="Supprimer le document" onClick={() => setPendingAction('delete')}><Trash2 className="h-4 w-4" aria-hidden /></Button>
          )}
        </div>
      </header>

      <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div><dt className="text-xs font-medium text-foreground-secondary">Ajouté le</dt><dd className="mt-1 text-sm text-foreground-primary">{new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long' }).format(new Date(document.createdAt))}</dd></div>
        <div><dt className="text-xs font-medium text-foreground-secondary">Taille</dt><dd className="mt-1 text-sm text-foreground-primary">{formatFileSize(document.fileSize)}</dd></div>
        <div><dt className="text-xs font-medium text-foreground-secondary">Format</dt><dd className="mt-1 text-sm text-foreground-primary">{document.mimeType}</dd></div>
      </dl>
      {document.description && <p className="text-sm text-foreground-secondary">{document.description}</p>}

      {document.capabilities.canPreview && (
        <section aria-label="Aperçu du document" className="overflow-hidden rounded-[8px] border border-border bg-background-surface">
          {document.mimeType === 'application/pdf' ? (
            <iframe title={`Aperçu : ${document.title}`} src={previewUrl} sandbox="" className="h-[70vh] min-h-96 w-full" />
          ) : (
            <div className="relative mx-auto aspect-[4/3] w-full max-w-4xl">
              <Image src={previewUrl} alt={document.title} fill unoptimized className="object-contain p-4" />
            </div>
          )}
        </section>
      )}

      {shareOpen && document.capabilities.canShare && (
        <section
          className="flex flex-col gap-4 border-t border-border pt-5"
          aria-labelledby="sharing-title"
          aria-busy={shareLoading}
        >
          <h2 id="sharing-title" className="text-lg font-semibold text-foreground-primary">Partages du document</h2>
          {shareLoading ? (
            <div className="flex flex-col gap-3" aria-busy="true">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : shareError !== null ? (
            <ApiErrorState status={shareError} message="Impossible de charger les partages." onRetry={() => void openShare()} />
          ) : (
            <>
              <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-[2fr_1fr_auto]">
                <Select label="Destinataire" value={recipientId} onChange={(event) => setRecipientId(event.target.value)}>
                  <option value="">Sélectionnez un compte</option>
                  {recipients.map((recipient) => <option key={recipient.id} value={recipient.id}>{recipient.displayName} · {recipient.username}</option>)}
                </Select>
                <Select label="Droit" value={permission} onChange={(event) => setPermission(event.target.value as typeof permission)}>
                  <option value="READ">Lecture</option><option value="WRITE">Modification</option><option value="DELETE">Suppression</option>
                </Select>
                <Button onClick={() => void grantPermission()} disabled={!recipientId || busy}>Partager</Button>
              </div>
              {permissions.length === 0 ? <p className="text-sm text-foreground-secondary">Aucun partage explicite.</p> : (
                <ul className="divide-y divide-border rounded-[8px] border border-border">
                  {permissions.map((entry) => <li key={entry.id} className="flex items-center justify-between gap-3 p-3 text-sm">
                    <span className="text-foreground-primary">{entry.employee ? `${entry.employee.firstName} ${entry.employee.lastName}` : entry.username} · {permissionLabel(entry.permission)}</span>
                    <Button variant="secondary" size="sm" onClick={() => void revokePermission(entry.id)}>Retirer</Button>
                  </li>)}
                </ul>
              )}
            </>
          )}
        </section>
      )}

      <ConfirmDialog
        open={pendingAction !== null}
        title={pendingAction === 'delete' ? 'Supprimer le document' : pendingAction === 'validate' ? 'Valider le document' : 'Rejeter le document'}
        description={pendingAction === 'delete' ? 'Le fichier et ses partages seront supprimés. Cette action est irréversible.' : 'Votre décision sera enregistrée dans le journal d’audit.'}
        confirmLabel={pendingAction === 'delete' ? 'Supprimer' : pendingAction === 'validate' ? 'Valider' : 'Rejeter'}
        destructive={pendingAction === 'delete' || pendingAction === 'reject'}
        busy={busy}
        onOpenChange={(open) => !open && setPendingAction(null)}
        onConfirm={() => void runAction()}
      />
    </div>
  );
}

function formatFileSize(bytes: number) {
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(bytes / 1024) + ' Ko';
}

function permissionLabel(permission: DocumentSharePermission['permission']) {
  return { READ: 'Lecture', WRITE: 'Modification', DELETE: 'Suppression' }[permission];
}