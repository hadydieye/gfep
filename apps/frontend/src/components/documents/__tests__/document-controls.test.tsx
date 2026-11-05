import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ConfirmDialog } from '@/components/ui/dialog';
import { DocumentDetail } from '../document-detail';
import { ConfidentialityBadge, ValidationBadge } from '../document-badges';

const mocks = vi.hoisted(() => ({ apiFetch: vi.fn() }));

vi.mock('@/lib/api/client', () => ({ apiFetch: mocks.apiFetch }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));

describe('document controls', () => {
  it('maps confidentiality and validation states to labels', () => {
    render(
      <>
        <ConfidentialityBadge level="RESTRICTED" />
        <ValidationBadge status="PENDING" />
        <ValidationBadge status="VALIDATED" />
        <ValidationBadge status="REJECTED" />
      </>,
    );
    expect(screen.getByText('Restreint')).toBeInTheDocument();
    expect(screen.getByText('En attente')).toBeInTheDocument();
    expect(screen.getByText('Validé')).toBeInTheDocument();
    expect(screen.getByText('Rejeté')).toBeInTheDocument();
  });

  it('does not close a destructive confirmation by clicking outside', () => {
    const onOpenChange = vi.fn();
    render(
      <ConfirmDialog
        open
        title="Supprimer le document"
        description="Cette action est irréversible."
        confirmLabel="Supprimer"
        destructive
        onOpenChange={onOpenChange}
        onConfirm={vi.fn()}
      />,
    );
    fireEvent.mouseDown(screen.getByTestId('dialog-backdrop'));
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('keeps the share panel in a loading state until both recipient requests finish', async () => {
    let resolveRecipients!: (value: { ok: true; data: [] }) => void;
    let resolvePermissions!: (value: { ok: true; data: [] }) => void;
    mocks.apiFetch.mockImplementation((path: string) =>
      path.endsWith('share-recipients')
        ? new Promise((resolve) => { resolveRecipients = resolve; })
        : new Promise((resolve) => { resolvePermissions = resolve; }),
    );
    const user = userEvent.setup();

    render(
      <DocumentDetail
        initialDocument={{
          id: 'document-id',
          title: 'Document partagé',
          description: null,
          category: { id: 'category-id', name: 'Comptabilité' },
          department: { id: 'department-id', name: 'Comptabilité' },
          owner: { id: 'employee-id', firstName: 'Mamadou', lastName: 'Diallo' },
          mimeType: 'application/pdf',
          fileSize: 128,
          confidentialityLevel: 'INTERNAL',
          validationStatus: 'PENDING',
          createdAt: '2026-11-05T00:00:00.000Z',
          capabilities: {
            canDownload: true,
            canPreview: false,
            canValidate: false,
            canShare: true,
            canDelete: false,
          },
        }}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Partage' }));
    expect(screen.getByRole('region', { name: 'Partages du document' })).toHaveAttribute('aria-busy', 'true');
    expect(screen.queryByText('Aucun partage explicite.')).not.toBeInTheDocument();

    resolveRecipients({ ok: true, data: [] });
    resolvePermissions({ ok: true, data: [] });
    await waitFor(() => expect(screen.getByText('Aucun partage explicite.')).toBeInTheDocument());
  });
});