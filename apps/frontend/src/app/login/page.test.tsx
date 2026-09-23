import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import Login from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams('next=%2Fcatalog'),
}));

vi.mock('@/lib/auth', () => ({
  useAuth: () => ({
    login: vi.fn(async () => undefined),
  }),
}));

describe('Login page', () => {
  it('links guests to registration', () => {
    render(<Login />);
    expect(screen.getByRole('link', { name: 'Зарегистрироваться' })).toHaveAttribute('href', '/register');
  });

  it('validates required fields and submits', async () => {
    const user = userEvent.setup();
    render(<Login />);

    await user.click(screen.getByRole('button', { name: /войти/i }));
    expect(screen.getByText(/введите телефон или email/i)).toBeTruthy();
    expect(screen.getByText(/введите пароль/i)).toBeTruthy();
  });
});
