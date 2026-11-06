'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/sonner';

const FALLBACK_NAME = 'export.csv';

/** Nom de fichier annoncé par `Content-Disposition`, sinon un nom par défaut. */
function filenameFrom(header: string | null): string {
  return header?.match(/filename="([^"]+)"/)?.[1] ?? FALLBACK_NAME;
}

/**
 * Export CSV des filtres et du tri courants (N5). Le fichier est demandé par
 * `fetch` (cookie de session same-origin) pour pouvoir afficher le message
 * métier d'un refus (plafond de 10 000 lignes) au lieu d'un téléchargement vide.
 */
export function ExportButton({ path, query }: { path: '/transactions/export' | '/invoices/export'; query: URLSearchParams }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const download = async () => {
    setBusy(true);
    try {
      const suffix = query.toString();
      const response = await fetch(`/api/v1${path}${suffix ? `?${suffix}` : ''}`, { credentials: 'include' });
      if (response.status === 401) {
        router.push('/login');
        return;
      }
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        toast.error(
          response.status === 400 && typeof body?.message === 'string'
            ? body.message
            : 'L’export n’a pas pu être préparé. Réessayez.',
        );
        return;
      }
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement('a');
      link.href = url;
      link.download = filenameFrom(response.headers.get('Content-Disposition'));
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      toast.success('Export téléchargé.');
    } catch {
      toast.error('L’export n’a pas pu être préparé. Réessayez.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button variant="secondary" onClick={() => void download()} disabled={busy}>
      {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Download className="h-4 w-4" aria-hidden />}
      Exporter
    </Button>
  );
}
