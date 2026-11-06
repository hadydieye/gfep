import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RelatedDocuments } from '@/components/documents/related-documents';
import { EmployeeHistory } from '@/components/employees/employee-history';
import type { DocumentItem } from '@/lib/api/types';

/** Étape 3.1 — Sections de la fiche employé et du détail de département (R9, N11). */
const redirect = vi.hoisted(() => vi.fn());
vi.mock('next/navigation', () => ({ redirect, useRouter: () => ({ push: vi.fn() }) }));

const doc = (id: string, title: string): DocumentItem =>
  ({ id, title, confidentialityLevel: 'INTERNAL', createdAt: '2026-10-01T00:00:00.000Z' }) as DocumentItem;

describe('RelatedDocuments', () => {
  it('liste les documents et propose la liste complète au-delà', () => {
    render(
      <RelatedDocuments
        title="Documents liés"
        result={{ ok: true, data: { data: [doc('d1', 'Contrat')], total: 7, page: 1, limit: 5 } }}
        moreHref="/documents?ownerId=e1"
        emptyMessage="Aucun document."
      />,
    );
    expect(screen.getByRole('link', { name: 'Contrat' }).getAttribute('href')).toBe('/documents/d1');
    expect(screen.getByRole('link', { name: 'Voir les 7 documents' }).getAttribute('href')).toBe('/documents?ownerId=e1');
  });

  it('état vide et état d’erreur', () => {
    const { rerender } = render(
      <RelatedDocuments
        title="Ressources documentaires"
        result={{ ok: true, data: { data: [], total: 0, page: 1, limit: 10 } }}
        moreHref="/documents"
        emptyMessage="Aucun document visible pour ce département."
      />,
    );
    expect(screen.getByText('Aucun document visible pour ce département.')).toBeTruthy();
    rerender(
      <RelatedDocuments title="Ressources documentaires" result={{ ok: false, status: 500 }} moreHref="/documents" emptyMessage="—" />,
    );
    expect(screen.getByText('Impossible de charger les documents.')).toBeTruthy();
  });
});

describe('EmployeeHistory', () => {
  it('affiche les actions journalisées avec leur auteur', () => {
    render(
      <EmployeeHistory
        result={{
          ok: true,
          data: {
            data: [
              {
                id: 'a1',
                actor: { id: 'u', username: 'f.camara' },
                action: 'employee.update',
                resourceType: 'Employee',
                resourceId: 'e1',
                oldValues: null,
                newValues: null,
                sourceIp: '127.0.0.1',
                timestamp: '2026-11-06T10:00:00.000Z',
              },
            ],
            total: 1,
            page: 1,
            limit: 10,
          },
        }}
      />,
    );
    expect(screen.getByText(/f\.camara/)).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Historique' })).toBeTruthy();
  });
});

describe('/finance', () => {
  it('redirige vers /finance/transactions', async () => {
    const { default: FinancePage } = await import('@/app/(auth)/finance/page');
    FinancePage();
    expect(redirect).toHaveBeenCalledWith('/finance/transactions');
  });
});
