import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Header } from './ui';

const mockLogout = vi.fn(async () => undefined);
let mockUser: { role: string } | null = null;

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('@/lib/auth', () => ({
  useAuth: () => ({ user: mockUser, shop: null, loading: false, logout: mockLogout }),
}));

describe('Header authentication discoverability', () => {
  beforeEach(() => { mockUser = null; mockLogout.mockClear(); });

  it('shows login and stronger registration CTA for guests', () => {
    render(<Header />);
    expect(screen.getAllByRole('link', { name: 'Войти' })[0]).toHaveAttribute('href', '/login');
    expect(screen.getAllByRole('link', { name: 'Регистрация' })[0]).toHaveAttribute('href', '/register');
  });

  it('replaces guest auth CTAs for an authenticated SHOP', async () => {
    mockUser = { role: 'SHOP' };
    const user = userEvent.setup();
    render(<Header />);
    expect(screen.queryByRole('link', { name: 'Войти' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Регистрация' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Профиль' }));
    expect(screen.getByRole('menuitem', { name: 'Выйти' })).toBeTruthy();
  });

  it('keeps guest auth actions accessible from the mobile menu', async () => {
    const user = userEvent.setup();
    render(<Header />);
    await user.click(screen.getByRole('button', { name: 'Меню' }));
    expect(screen.getAllByRole('link', { name: 'Войти' }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('link', { name: 'Регистрация' }).length).toBeGreaterThan(0);
  });
});
