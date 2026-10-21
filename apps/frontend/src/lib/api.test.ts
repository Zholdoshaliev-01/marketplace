import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api, AUTH_LOGOUT_EVENT, getAccessToken, getAdminOrders, getSupplierFulfillments, getSupplierProducts, setAccessToken } from './api';

const response = (status: number, body: unknown = {}) => ({
  ok: status >= 200 && status < 300,
  status,
  json: vi.fn().mockResolvedValue(body),
}) as unknown as Response;

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
  setAccessToken('expired-token');
});

afterEach(() => {
  vi.unstubAllGlobals();
  setAccessToken(null);
});

describe('API auth retry lifecycle', () => {
  it('uses the same-origin API proxy by default', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(response(200, { ok: true }));

    await expect(api('/health-check')).resolves.toEqual({ ok: true });

    expect(fetchMock.mock.calls[0][0]).toBe('/api/v1/health-check');
  });

  it('turns a failed browser request into a useful API error', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));

    await expect(api('/auth/login')).rejects.toMatchObject({
      code: 'NETWORK_ERROR',
      status: 0,
      message: 'Не удалось связаться с сервером',
    });
  });

  it('keeps fulfillment operations on the single shared 401 refresh path', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce(response(401))
      .mockResolvedValueOnce(response(200, { access_token: 'fulfillment-token' }))
      .mockResolvedValueOnce(response(200, []));
    await expect(getSupplierFulfillments()).resolves.toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[0][0]).toContain('/supplier/fulfillments');
    expect(fetchMock.mock.calls[1][0]).toContain('/auth/refresh');
  });

  it('keeps supplier operations on the existing shared 401 refresh path', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce(response(401))
      .mockResolvedValueOnce(response(200, { access_token: 'supplier-token' }))
      .mockResolvedValueOnce(response(200, []));
    await expect(getSupplierProducts()).resolves.toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[0][0]).toContain('/supplier/products');
    expect(fetchMock.mock.calls[1][0]).toContain('/auth/refresh');
    expect(new Headers((fetchMock.mock.calls[2][1] as RequestInit).headers).get('Authorization')).toBe('Bearer supplier-token');
  });

  it('keeps admin orders on the shared 401 refresh and retry path', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce(response(401))
      .mockResolvedValueOnce(response(200, { access_token: 'admin-token' }))
      .mockResolvedValueOnce(response(200, { items: [], page: 1, page_size: 20, total_items: 0, total_pages: 0 }));

    await expect(getAdminOrders()).resolves.toMatchObject({ items: [] });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[0][0]).toContain('/admin/orders?page=1&page_size=20');
    expect(fetchMock.mock.calls[1][0]).toContain('/auth/refresh');
    expect(new Headers((fetchMock.mock.calls[2][1] as RequestInit).headers).get('Authorization')).toBe('Bearer admin-token');
  });

  it('shares one successful refresh across concurrent unauthorized requests', async () => {
    const fetchMock = vi.mocked(fetch);
    let resolveRefresh!: (value: Response) => void;
    const refreshResponse = new Promise<Response>(resolve => { resolveRefresh = resolve; });
    fetchMock.mockImplementation((url) => {
      if (String(url).includes('/auth/refresh')) return refreshResponse;
      return Promise.resolve(response(401));
    });

    const requests = [api('/a'), api('/b'), api('/c')];
    await vi.waitFor(() => expect(fetchMock.mock.calls.filter(([url]) => String(url).includes('/auth/refresh'))).toHaveLength(1));
    resolveRefresh(response(200, { access_token: 'fresh-token' }));
    fetchMock.mockImplementation((url, init) => {
      if (String(url).includes('/auth/refresh')) return Promise.resolve(response(200, { access_token: 'unexpected' }));
      expect(new Headers((init as RequestInit).headers).get('Authorization')).toBe('Bearer fresh-token');
      return Promise.resolve(response(200, { ok: true }));
    });

    await expect(Promise.all(requests)).resolves.toEqual([{ ok: true }, { ok: true }, { ok: true }]);
    expect(fetchMock.mock.calls.filter(([url]) => String(url).includes('/auth/refresh'))).toHaveLength(1);
  });

  it('shares one failed refresh and publishes logout once for concurrent requests', async () => {
    const fetchMock = vi.mocked(fetch);
    const logout = vi.fn();
    window.addEventListener(AUTH_LOGOUT_EVENT, logout);
    let resolveRefresh!: (value: Response) => void;
    const refreshResponse = new Promise<Response>(resolve => { resolveRefresh = resolve; });
    fetchMock.mockImplementation((url) => String(url).includes('/auth/refresh') ? refreshResponse : Promise.resolve(response(401)));

    const requests = [api('/a'), api('/b'), api('/c')];
    await vi.waitFor(() => expect(fetchMock.mock.calls.filter(([url]) => String(url).includes('/auth/refresh'))).toHaveLength(1));
    resolveRefresh(response(401));
    const results = await Promise.allSettled(requests);
    expect(results.every(result => result.status === 'rejected')).toBe(true);

    expect(fetchMock.mock.calls.filter(([url]) => String(url).includes('/auth/refresh'))).toHaveLength(1);
    expect(getAccessToken()).toBeNull();
    expect(logout).toHaveBeenCalledOnce();
    window.removeEventListener(AUTH_LOGOUT_EVENT, logout);
  });

  it('allows a new refresh after the previous shared promise has settled', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce(response(401))
      .mockResolvedValueOnce(response(401))
      .mockResolvedValueOnce(response(401))
      .mockResolvedValueOnce(response(200, { access_token: 'fresh-token' }))
      .mockResolvedValueOnce(response(200, { ok: true }));

    await expect(api('/first')).rejects.toMatchObject({ status: 401 });
    setAccessToken('next-expired-token');
    await expect(api('/second')).resolves.toEqual({ ok: true });
    expect(fetchMock.mock.calls.filter(([url]) => String(url).includes('/auth/refresh'))).toHaveLength(2);
  });

  it('refreshes once and retries the original request once', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce(response(401))
      .mockResolvedValueOnce(response(200, { access_token: 'fresh-token' }))
      .mockResolvedValueOnce(response(200, { ok: true }));

    await expect(api('/private')).resolves.toEqual({ ok: true });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[0][0]).toContain('/private');
    expect(fetchMock.mock.calls[1][0]).toContain('/auth/refresh');
    expect(fetchMock.mock.calls[2][0]).toContain('/private');
    expect(fetchMock.mock.calls[2][1]).toMatchObject({ headers: expect.any(Headers) });
    expect((fetchMock.mock.calls[2][1] as RequestInit).headers).toEqual(expect.any(Headers));
    expect(getAccessToken()).toBe('fresh-token');
  });

  it('clears the token when refresh fails and never retries twice', async () => {
    const fetchMock = vi.mocked(fetch);
    const logout = vi.fn();
    window.addEventListener(AUTH_LOGOUT_EVENT, logout, { once: true });
    fetchMock
      .mockResolvedValueOnce(response(401))
      .mockResolvedValueOnce(response(401));

    await expect(api('/private')).rejects.toMatchObject({ status: 401 });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(getAccessToken()).toBeNull();
    expect(logout).toHaveBeenCalledOnce();
  });

  it('does not refresh or retry more than once when the retried request is also unauthorized', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce(response(401))
      .mockResolvedValueOnce(response(200, { access_token: 'still-invalid' }))
      .mockResolvedValueOnce(response(401));

    await expect(api('/private')).rejects.toMatchObject({ status: 401 });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls.filter(([url]) => String(url).includes('/auth/refresh'))).toHaveLength(1);
    expect(getAccessToken()).toBeNull();
  });
});
