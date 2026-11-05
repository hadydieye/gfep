import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiFetch } from './client';

describe('apiFetch', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('does not set JSON Content-Type for multipart FormData', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 201, json: async () => ({ id: 'doc' }) });
    vi.stubGlobal('fetch', fetchMock);
    const body = new FormData();
    body.append('title', 'Document');

    await apiFetch('/documents', { method: 'POST', body });

    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(new Headers(init.headers).has('Content-Type')).toBe(false);
    expect(init.body).toBe(body);
  });

  it('defaults JSON requests to application/json', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });
    vi.stubGlobal('fetch', fetchMock);

    await apiFetch('/documents');

    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(new Headers(init.headers).get('Content-Type')).toBe('application/json');
  });
});