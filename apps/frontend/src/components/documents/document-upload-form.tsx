'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { toast } from 'sonner';
import { ArrowLeft, Upload } from 'lucide-react';
import Link from 'next/link';
import { ApiErrorState } from '@/components/states/states';
import { Button } from '@/components/ui/button';
import { FileInput } from '@/components/ui/file-input';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { apiFetch } from '@/lib/api/client';
import type { DocumentCategory, DocumentItem } from '@/lib/api/types';

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_EXTENSIONS = ['pdf', 'docx', 'xlsx', 'png', 'jpg', 'jpeg'];

const uploadSchema = z.object({
  title: z.string().trim().min(1, 'Le titre est obligatoire.').max(200, 'Le titre ne peut dépasser 200 caractères.'),
  description: z.string().max(1000, 'La description ne peut dépasser 1 000 caractères.').optional(),
  categoryId: z.string().uuid('Sélectionnez une catégorie.'),
  confidentialityLevel: z.enum(['PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'RESTRICTED']),
  file: z.custom<File>((value) => typeof File !== 'undefined' && value instanceof File, 'Sélectionnez un fichier.')
    .refine((file) => file.size <= MAX_FILE_SIZE, 'Le fichier ne peut dépasser 10 Mo.')
    .refine((file) => ALLOWED_EXTENSIONS.includes(file.name.split('.').pop()?.toLowerCase() ?? ''), 'Format de fichier non pris en charge.'),
});

type UploadValues = z.infer<typeof uploadSchema>;

export function DocumentUploadForm() {
  const router = useRouter();
  const [categories, setCategories] = useState<DocumentCategory[]>([]);
  const [categoryError, setCategoryError] = useState<number | null>(null);
  const [categoryReload, setCategoryReload] = useState(0);
  const [selectedName, setSelectedName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const form = useForm<UploadValues>({
    resolver: zodResolver(uploadSchema),
    defaultValues: { title: '', description: '', categoryId: '', confidentialityLevel: 'INTERNAL' },
  });
  const fileRegistration = form.register('file', {
    setValueAs: (value: FileList | undefined) => value?.item(0) ?? undefined,
  });

  useEffect(() => {
    void apiFetch<DocumentCategory[]>('/documents/categories').then((result) => {
      if (result.ok) setCategories(result.data.filter((category) => category.canUpload));
      else if (result.status === 401) router.push('/login');
      else setCategoryError(result.status);
    });
  }, [router, categoryReload]);

  const submit = form.handleSubmit(async (values) => {
    setSubmitting(true);
    const body = new FormData();
    body.append('title', values.title);
    if (values.description) body.append('description', values.description);
    body.append('categoryId', values.categoryId);
    body.append('confidentialityLevel', values.confidentialityLevel);
    body.append('file', values.file);
    const result = await apiFetch<DocumentItem>('/documents', { method: 'POST', body });
    setSubmitting(false);
    if (!result.ok) {
      if (result.status === 401) router.push('/login');
      else toast.error(result.message ?? 'Le document n’a pas pu être envoyé.');
      return;
    }
    toast.success('Votre document a été envoyé.');
    router.push(`/documents/${result.data.id}`);
  });

  if (categoryError !== null) {
    return <ApiErrorState status={categoryError} message="Impossible de charger les catégories." onRetry={() => setCategoryReload((value) => value + 1)} />;
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5">
      <div className="flex items-center gap-3">
        <Button asChild variant="secondary" size="icon" aria-label="Retour aux documents"><Link href="/documents"><ArrowLeft className="h-4 w-4" aria-hidden /></Link></Button>
        <h1 className="text-2xl font-semibold text-foreground-primary">Déposer un document</h1>
      </div>
      <form className="flex flex-col gap-4 rounded-[8px] border border-border bg-background-surface p-5" onSubmit={submit}>
        <Input label="Titre" {...form.register('title')} error={form.formState.errors.title?.message} />
        <Input label="Description" {...form.register('description')} error={form.formState.errors.description?.message} />
        <Select label="Catégorie" {...form.register('categoryId')} error={form.formState.errors.categoryId?.message}>
          <option value="">Sélectionnez une catégorie</option>
          {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
        </Select>
        <Select label="Confidentialité" {...form.register('confidentialityLevel')}>
          <option value="PUBLIC">Public</option>
          <option value="INTERNAL">Interne</option>
          <option value="CONFIDENTIAL">Confidentiel</option>
          <option value="RESTRICTED">Restreint</option>
        </Select>
        <FileInput
          label="Fichier"
          accept=".pdf,.docx,.xlsx,.png,.jpg,.jpeg"
          error={form.formState.errors.file?.message}
          selectedName={selectedName}
          {...fileRegistration}
          onChange={(event) => {
            void fileRegistration.onChange(event);
            setSelectedName(event.currentTarget.files?.[0]?.name ?? '');
          }}
        />
        <p className="text-xs text-foreground-secondary">PDF, DOCX, XLSX, PNG ou JPG · 10 Mo maximum</p>
        <div className="flex justify-end">
          <Button type="submit" disabled={submitting}>
            <Upload className="h-4 w-4" aria-hidden />
            {submitting ? 'Envoi en cours…' : 'Déposer'}
          </Button>
        </div>
      </form>
    </div>
  );
}