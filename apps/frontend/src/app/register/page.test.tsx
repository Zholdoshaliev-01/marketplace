import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import Register from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('@/lib/auth', () => ({
  useAuth: () => ({
    register: vi.fn(async () => undefined),
  }),
}));

describe('Register page', () => {
  it('links existing users to login', () => {
    render(<Register />);
    expect(screen.getByRole('link', { name: 'Войти' })).toHaveAttribute('href', '/login');
  });

  it('shows validation errors for required shop fields', async () => {
    const user = userEvent.setup();
    render(<Register />);

    await user.click(screen.getByRole('button', { name: /создать аккаунт/i }));
    expect(screen.getAllByText(/введите телефон/i)).toHaveLength(2);
    expect(screen.getByText(/введите название магазина/i)).toBeTruthy();
  });
});
