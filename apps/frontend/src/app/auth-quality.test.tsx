'use client';

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LoginPageContent } from '@/features/auth/login-form';
import Register from './register/page';
import { ProtectedRoute } from '@/features/auth/protected-route';
import { useAuth } from '@/lib/auth';

const push = vi.fn();
const replace = vi.fn();
const login = vi.fn();
const registerUser = vi.fn();
let authState = { user: null as unknown, loading: false };

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace, refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams('next=%2Fcheckout'),
  usePathname: () => '/checkout',
}));

vi.mock('@/lib/auth', () => ({ useAuth: vi.fn() }));
vi.mock('@/lib/api', () => ({
  ApiError: class ApiError extends Error { constructor(public code: string, public status: number, message: string) { super(message); } },
}));

const mockedUseAuth = vi.mocked(useAuth);

beforeEach(() => {
  vi.clearAllMocks();
  authState = { user: null, loading: false };
  mockedUseAuth.mockImplementation(() => ({
    ...authState,
    shop: null,
    login,
    register: registerUser,
    logout: vi.fn(),
  }) as never);
});

describe('authentication validation and guards', () => {
  it('shows login validation errors and does not call login', async () => {
    const user = userEvent.setup();
    render(<LoginPageContent />);

    await user.click(screen.getByRole('button', { name: 'Войти' }));

    expect(await screen.findByText('Введите телефон или email')).toBeInTheDocument();
    expect(screen.getByText('Введите пароль')).toBeInTheDocument();
    expect(login).not.toHaveBeenCalled();
  });

  it('shows registration validation errors and does not call register', async () => {
    const user = userEvent.setup();
    render(<Register />);

    await user.click(screen.getByRole('button', { name: 'Создать аккаунт' }));

    expect(await screen.findByText('Введите название магазина')).toBeInTheDocument();
    expect(screen.getByText('Минимум 8 символов')).toBeInTheDocument();
    expect(registerUser).not.toHaveBeenCalled();
  });

  it('redirects an unauthenticated user with the current path', async () => {
    render(<ProtectedRoute><div>private content</div></ProtectedRoute>);

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/login?next=%2Fcheckout'));
    expect(screen.queryByText('private content')).not.toBeInTheDocument();
  });

  it('renders protected content for an authenticated user', () => {
    authState = { user: { id: 'u1' }, loading: false };

    render(<ProtectedRoute><div>private content</div></ProtectedRoute>);

    expect(screen.getByText('private content')).toBeInTheDocument();
  });
});
