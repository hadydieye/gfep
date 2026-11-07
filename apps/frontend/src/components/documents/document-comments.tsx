'use client';

import { useEffect, useState } from 'react';
import { toast } from '@/components/ui/sonner';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { apiFetch } from '@/lib/api/client';
import type { DocumentComment } from '@/lib/api/types';

/**
 * GFEP-670 : fil de commentaires sur un document (AppFlow §3.8).
 * Les validateurs peuvent commenter avant validation ; le contenu est rendu
 * en HTML pour permettre la mise en forme (gras, italique, liens).
 */
export function DocumentComments({ documentId }: { documentId: string }) {
  const [comments, setComments] = useState<DocumentComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    const result = await apiFetch<DocumentComment[]>(`/documents/${documentId}/comments`);
    setLoading(false);
    if (!result.ok) {
      setError(result.message ?? 'Impossible de charger les commentaires.');
      return;
    }
    setComments(result.data);
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentId]);

  const submit = async () => {
    const content = draft.trim();
    if (!content) return;
    setSubmitting(true);
    const result = await apiFetch<DocumentComment>(`/documents/${documentId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    });
    setSubmitting(false);
    if (!result.ok) {
      toast.error(result.message ?? "Le commentaire n'a pas pu être publié.");
      return;
    }
    setComments((current) => [...current, result.data]);
    setDraft('');
    toast.success('Commentaire publié.');
  };

  return (
    <section
      aria-labelledby="comments-title"
      className="flex flex-col gap-4 border-t border-border pt-5"
    >
      <h2 id="comments-title" className="text-lg font-semibold text-foreground-primary">
        Commentaires
      </h2>

      {loading ? (
        <div className="flex flex-col gap-2" aria-busy="true">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : error ? (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-foreground-secondary">{error}</p>
          <Button variant="secondary" size="sm" onClick={() => void load()}>
            Réessayer
          </Button>
        </div>
      ) : comments.length === 0 ? (
        <p className="text-sm text-foreground-secondary">Aucun commentaire pour l&apos;instant.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {comments.map((comment) => (
            <li
              key={comment.id}
              className="rounded-[8px] border border-border bg-background-surface p-3"
            >
              <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-sm font-medium text-foreground-primary">
                  {comment.author.displayName}
                </span>
                <time className="text-xs text-foreground-secondary" dateTime={comment.createdAt}>
                  {new Intl.DateTimeFormat('fr-FR', {
                    dateStyle: 'short',
                    timeStyle: 'short',
                  }).format(new Date(comment.createdAt))}
                </time>
              </div>
              <div
                className="text-sm text-foreground-primary"
                dangerouslySetInnerHTML={{ __html: comment.content }}
              />
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-col gap-2">
        <label htmlFor="comment-draft" className="text-sm font-medium text-foreground-primary">
          Ajouter un commentaire
        </label>
        <textarea
          id="comment-draft"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          rows={3}
          maxLength={5000}
          className="w-full rounded-[8px] border border-border bg-background-surface p-3 text-sm text-foreground-primary focus:outline-none focus:ring-2 focus:ring-accent"
          placeholder="Votre commentaire…"
        />
        <div className="flex justify-end">
          <Button onClick={() => void submit()} disabled={submitting || !draft.trim()}>
            {submitting ? 'Publication…' : 'Publier'}
          </Button>
        </div>
      </div>
    </section>
  );
}
