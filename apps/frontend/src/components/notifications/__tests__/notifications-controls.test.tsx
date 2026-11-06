import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Topbar } from '@/components/layout/topbar';
import type { AuthUser, NotificationItem } from '@/lib/api/types';
import { NOTIFICATIONS_CHANGED_EVENT, NotificationIcon } from '../notification-meta';
import { NotificationsList } from '../notifications-list';

// Routeur stable, comme celui de Next.js : un nouvel objet à chaque rendu relancerait les effets en boucle
const mocks = vi.hoisted(() => ({ apiFetch: vi.fn(), pathname: '/dashboard', router: { push: vi.fn(), refresh: vi.fn() } }));
vi.mock('@/lib/api/client', () => ({ apiFetch: mocks.apiFetch }));
vi.mock('next/navigation', () => ({
  useRouter: () => mocks.router,
  usePathname: () => mocks.pathname,
}));

const notification = (overrides: Partial<NotificationItem> = {}): NotificationItem => ({
  id: 'n1',
  type: 'DOCUMENT_SHARED',
  title: 'Document partagé avec vous',
  message: 't.balde vous a donné un accès en lecture au document « Budget ».',
  readAt: null,
  createdAt: '2026-11-06T10:00:00.000Z',
  ...overrides,
});

const user: AuthUser = {
  id: 'u',
  username: 'm.diallo',
  email: 'm.diallo@example.test',
  status: 'ACTIVE',
  roles: [{ id: 'r', name: 'EMPLOYEE' }],
  permissions: [{ resource: 'notifications', action: 'read' }],
  employee: { id: 'e', firstName: 'Mamadou', lastName: 'Diallo', departmentId: 'd' },
};

beforeEach(() => mocks.apiFetch.mockReset());

describe('icônes par type (design §7.3)', () => {
  it.each([
    ['SECURITY', 'lucide-shield-alert'],
    ['DOCUMENT_SHARED', 'lucide-file-text'],
    ['ROLE_CHANGED', 'lucide-key-round'],
    ['WARNING', 'lucide-triangle-alert'],
    ['INFO', 'lucide-info'],
  ] as const)('%s → %s', (type, className) => {
    const { container } = render(<NotificationIcon type={type} />);
    expect(container.querySelector('svg')?.getAttribute('class')).toContain(className);
  });
});

describe('écran /notifications', () => {
  it('liste, filtre « Non lues », « Marquer comme lu » puis rechargement du compteur', async () => {
    const changed = vi.fn();
    window.addEventListener(NOTIFICATIONS_CHANGED_EVENT, changed);
    mocks.apiFetch.mockImplementation(async (path: string, init?: RequestInit) => {
      if (init?.method === 'PATCH') return { ok: true, data: notification({ readAt: '2026-11-06T11:00:00.000Z' }) };
      return { ok: true, data: { data: [notification(), notification({ id: 'n2', type: 'SECURITY', title: 'Connexion depuis un nouvel appareil', readAt: '2026-11-05T09:00:00.000Z' })], total: 2, page: 1, limit: 20 } };
    });
    render(<NotificationsList />);
    expect(await screen.findByText('Document partagé avec vous')).toBeInTheDocument();
    expect(screen.getByText('Connexion depuis un nouvel appareil')).toBeInTheDocument();
    // Une seule action « Marquer comme lu » : pour la notification non lue
    const buttons = screen.getAllByRole('button', { name: 'Marquer comme lu' });
    expect(buttons).toHaveLength(1);

    await userEvent.click(screen.getByRole('button', { name: 'Non lues' }));
    await waitFor(() => expect(mocks.apiFetch).toHaveBeenCalledWith('/notifications?page=1&limit=20&status=unread'));
    expect(screen.getByRole('button', { name: 'Non lues' })).toHaveAttribute('aria-pressed', 'true');

    await userEvent.click((await screen.findAllByRole('button', { name: 'Marquer comme lu' }))[0]);
    await waitFor(() => expect(mocks.apiFetch).toHaveBeenCalledWith('/notifications/n1/read', { method: 'PATCH' }));
    expect(changed).toHaveBeenCalled();
    window.removeEventListener(NOTIFICATIONS_CHANGED_EVENT, changed);
  });

  it('état vide contextuel', async () => {
    mocks.apiFetch.mockResolvedValue({ ok: true, data: { data: [], total: 0, page: 1, limit: 20 } });
    render(<NotificationsList />);
    expect(await screen.findByText('Vous n’avez aucune notification.')).toBeInTheDocument();
  });

  it('« Tout marquer comme lu » appelle read-all', async () => {
    mocks.apiFetch.mockImplementation(async (path: string) =>
      path === '/notifications/read-all'
        ? { ok: true, data: { updated: 1 } }
        : { ok: true, data: { data: [notification()], total: 1, page: 1, limit: 20 } },
    );
    render(<NotificationsList />);
    await screen.findByText('Document partagé avec vous');
    await userEvent.click(screen.getByRole('button', { name: /Tout marquer comme lu/ }));
    await waitFor(() => expect(mocks.apiFetch).toHaveBeenCalledWith('/notifications/read-all', { method: 'POST' }));
  });
});

describe('cloche de la topbar', () => {
  it('affiche le vrai compteur de non lues et mène à /notifications', async () => {
    mocks.apiFetch.mockResolvedValue({ ok: true, data: { count: 3 } });
    render(<Topbar user={user} initialUnreadCount={0} />);
    const bell = await screen.findByRole('link', { name: 'Notifications (3 non lues)' });
    expect(bell).toHaveAttribute('href', '/notifications');
    expect(screen.getByTestId('unread-badge')).toHaveTextContent('3');
    expect(mocks.apiFetch).toHaveBeenCalledWith('/notifications/unread-count');
  });

  it('recharge le compteur après une action sur les notifications ; aucun badge à zéro', async () => {
    mocks.apiFetch.mockResolvedValueOnce({ ok: true, data: { count: 1 } }).mockResolvedValue({ ok: true, data: { count: 0 } });
    render(<Topbar user={user} initialUnreadCount={1} />);
    await screen.findByTestId('unread-badge');
    window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED_EVENT));
    await waitFor(() => expect(screen.queryByTestId('unread-badge')).not.toBeInTheDocument());
    expect(screen.getByRole('link', { name: 'Notifications (0 non lue)' })).toBeInTheDocument();
  });

  it('au-delà de 99 : « 99+ »', async () => {
    mocks.apiFetch.mockResolvedValue({ ok: true, data: { count: 250 } });
    render(<Topbar user={user} initialUnreadCount={250} />);
    expect(await screen.findByTestId('unread-badge')).toHaveTextContent('99+');
  });
});
