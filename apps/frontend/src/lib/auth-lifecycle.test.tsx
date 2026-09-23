import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProtectedRoute } from '@/features/auth/protected-route';
import { api, setAccessToken } from './api';
import { AuthProvider, useAuth } from './auth';

const replace = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
  usePathname: () => '/orders',
}));

const response = (status: number, body: unknown = {}) => ({
  ok: status >= 200 && status < 300,
  status,
  json: vi.fn().mockResolvedValue(body),
}) as unknown as Response;

function PrivateContent() {
  return (
    <ProtectedRoute>
      <button onClick={() => void api('/private').catch(() => undefined)}>Load private data</button>
    </ProtectedRoute>
  );
}

function LogoutProbe() {
  const { user, logout } = useAuth();
  if (!user) return <span>Logged out locally</span>;
  return <button onClick={() => void logout().catch(() => undefined)}>Logout now</button>;
}

describe('authentication lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setAccessToken('expired-token');
  });

  it('logs out and redirects to login when refresh fails', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response(200, {
        user: { id: 'u1', phone: '+996700000000', role: 'SHOP', is_active: true, created_at: '' },
        shop: null,
      }))
      .mockResolvedValueOnce(response(401))
      .mockResolvedValueOnce(response(401));
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();

    render(<AuthProvider><PrivateContent /></AuthProvider>);
    await user.click(await screen.findByRole('button', { name: 'Load private data' }));

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/login?next=%2Forders'));
    expect(screen.queryByRole('button', { name: 'Load private data' })).not.toBeInTheDocument();
  });

  it('clears local authentication state when the logout request fails', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response(200, {
        user: { id: 'u1', phone: '+996700000000', role: 'SHOP', is_active: true, created_at: '' },
        shop: null,
      }))
      .mockRejectedValueOnce(new TypeError('network unavailable'))
      .mockResolvedValueOnce(response(401));
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();

    render(<AuthProvider><LogoutProbe /></AuthProvider>);
    await user.click(await screen.findByRole('button', { name: 'Logout now' }));

    expect(await screen.findByText('Logged out locally')).toBeInTheDocument();
    expect(sessionStorage.getItem('access_token')).toBeNull();
    await expect(api('/private')).rejects.toMatchObject({ status: 401 });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls.map(call => String(call[0]))).not.toContain('http://localhost:8001/api/v1/auth/refresh');
  });
});
