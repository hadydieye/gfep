import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ExportButton } from '../export-button';

/** Étape 3.1 — Bouton « Exporter » (R4.5, N5). */
const mocks = vi.hoisted(() => ({ toast: { success: vi.fn(), error: vi.fn() }, router: { push: vi.fn() } }));
vi.mock('@/components/ui/sonner', () => ({ toast: mocks.toast }));
vi.mock('next/navigation', () => ({ useRouter: () => mocks.router }));

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  URL.createObjectURL = vi.fn(() => 'blob:export');
  URL.revokeObjectURL = vi.fn();
  mocks.toast.success.mockReset();
  mocks.toast.error.mockReset();
});
afterEach(() => vi.unstubAllGlobals());

describe('ExportButton', () => {
  it('demande l’export avec les filtres courants et télécharge le fichier annoncé', async () => {
    const actor = userEvent.setup();
    fetchMock.mockResolvedValue(
      new Response('﻿Référence\r\n', {
        status: 200,
        headers: { 'Content-Disposition': 'attachment; filename="transactions-20261106.csv"' },
      }),
    );
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    render(<ExportButton path="/transactions/export" query={new URLSearchParams({ type: 'INCOME', sort: 'amount', order: 'desc' })} />);
    await actor.click(screen.getByRole('button', { name: 'Exporter' }));
    await waitFor(() => expect(mocks.toast.success).toHaveBeenCalledWith('Export téléchargé.'));
    expect(fetchMock.mock.calls[0][0]).toBe('/api/v1/transactions/export?type=INCOME&sort=amount&order=desc');
    expect(click).toHaveBeenCalled();
    expect((click.mock.contexts[0] as HTMLAnchorElement).download).toBe('transactions-20261106.csv');
  });

  it('affiche le message métier d’un refus (plafond), sans télécharger', async () => {
    const actor = userEvent.setup();
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ statusCode: 400, message: "L'export dépasse 10 000 lignes. Affinez les filtres." }), { status: 400 }),
    );
    render(<ExportButton path="/invoices/export" query={new URLSearchParams()} />);
    await actor.click(screen.getByRole('button', { name: 'Exporter' }));
    await waitFor(() => expect(mocks.toast.error).toHaveBeenCalledWith("L'export dépasse 10 000 lignes. Affinez les filtres."));
    expect(fetchMock.mock.calls[0][0]).toBe('/api/v1/invoices/export');
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });

  it('redirige vers /login sur une session expirée', async () => {
    const actor = userEvent.setup();
    fetchMock.mockResolvedValue(new Response('', { status: 401 }));
    render(<ExportButton path="/invoices/export" query={new URLSearchParams()} />);
    await actor.click(screen.getByRole('button', { name: 'Exporter' }));
    await waitFor(() => expect(mocks.router.push).toHaveBeenCalledWith('/login'));
  });
});
