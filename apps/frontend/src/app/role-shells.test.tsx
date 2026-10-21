'use client';

import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ModernHeader } from '@/components/ui';
import { OperationalShell } from '@/components/operational-shell';
import { useAuth } from '@/lib/auth';

let pathname = '/catalog';
vi.mock('next/navigation', () => ({
  usePathname: () => pathname,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));
vi.mock('@/lib/auth', () => ({ useAuth: vi.fn() }));
vi.mock('next/image', () => ({ default: (props: Record<string, unknown>) => <div data-testid="image" {...props} /> }));

const mockedAuth = vi.mocked(useAuth);
const account = (role: 'SHOP' | 'SUPPLIER' | 'ADMIN' | null) => ({
  user: role ? { id: role, phone: '+996700000000', role, is_active: true, created_at: '' } : null,
  shop: null, loading: false, login: vi.fn(), register: vi.fn(), logout: vi.fn(),
});

beforeEach(() => { pathname = '/catalog'; vi.clearAllMocks(); });

describe('role navigation shells', () => {
  it('shows guest public navigation without operational or cart actions', () => {
    mockedAuth.mockReturnValue(account(null));
    render(<ModernHeader/>);
    expect(screen.getByRole('link', { name: 'Каталог' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Войти' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Корзина' })).not.toBeInTheDocument();
  });

  it('shows SHOP purchase navigation only', () => {
    mockedAuth.mockReturnValue(account('SHOP'));
    render(<ModernHeader/>);
    expect(screen.getByRole('link', { name: 'Корзина' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Заказы' })).toBeInTheDocument();
    expect(screen.queryByText('Рабочее пространство')).not.toBeInTheDocument();
  });

  it.each([['SUPPLIER', '/supplier', 'Поставщик'], ['ADMIN', '/admin', 'Администратор']] as const)('shows %s workspace action without cart', (role, href, label) => {
    mockedAuth.mockReturnValue(account(role));
    render(<ModernHeader/>);
    expect(screen.getByRole('link', { name: /Рабочее пространство/ })).toHaveAttribute('href', href);
    expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Корзина' })).not.toBeInTheDocument();
  });

  it('supplier operational shell contains only real supplier routes', () => {
    mockedAuth.mockReturnValue(account('SUPPLIER')); pathname = '/supplier';
    render(<OperationalShell workspace="SUPPLIER"><div>content</div></OperationalShell>);
    expect(screen.getByRole('link', { name: /Мои товары/ })).toHaveAttribute('href', '/supplier/products');
    expect(screen.getByRole('link', { name: /Выполнение заказов/ })).toHaveAttribute('href', '/supplier/orders');
    expect(screen.queryByText('Корзина')).not.toBeInTheDocument();
  });

  it('admin operational shell contains global orders and no SHOP actions', () => {
    mockedAuth.mockReturnValue(account('ADMIN')); pathname = '/admin';
    render(<OperationalShell workspace="ADMIN"><div>content</div></OperationalShell>);
    expect(screen.getByRole('link', { name: /Заказы/ })).toHaveAttribute('href', '/admin/orders');
    expect(screen.getByRole('link', { name: /Товары/ })).toHaveAttribute('href', '/admin/products');
    expect(screen.getByRole('link', { name: /Поставщики/ })).toHaveAttribute('href', '/admin/suppliers');
    expect(screen.getByRole('link', { name: /Категории/ })).toHaveAttribute('href', '/admin/categories');
    expect(screen.queryByText('Корзина')).not.toBeInTheDocument();
    expect(screen.queryByText('Мои товары')).not.toBeInTheDocument();
  });
});
