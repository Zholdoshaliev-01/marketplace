import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminRoute } from '@/features/admin/admin-route';
import { AdminOrdersList } from '@/features/admin/orders/orders-list';
import { AdminOrderDetail } from '@/features/admin/orders/order-detail';
import { CANCELLATION_WARNING } from '@/features/admin/orders/types';
import { ApiError, getAdminOrder, getAdminOrders, updateAdminOrderStatus } from '@/lib/api';
import { useAuth } from '@/lib/auth';

const push = vi.fn();
const replace = vi.fn();
let urlParams = new URLSearchParams();
const order = {
  id: 'order-1', order_number: 'ORD-001', status: 'NEW' as const, payment_type: 'BANK_TRANSFER' as const,
  subtotal: '600.00', delivery_price: '50.00', total: '650.00', city: 'Каракол', address: 'Улица 1', phone: '+996700000000', comment: 'Позвонить',
  created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z', items: [
    { id: 'item-1', product_id: 'product-1', supplier_id: 'supplier-1', product_name_snapshot: 'Исторический кофе', sku_snapshot: 'OLD-SKU', quantity: 5, unit_price: '110.00', total_price: '550.00' },
  ],
  fulfillments: [{ fulfillment_id: 'fulfillment-1', supplier_id: 'supplier-1', supplier_name: 'Поставщик А', status: 'PENDING' as const, item_count: 1, supplier_subtotal: '550.00' }],
};
const page = { items: [order], page: 1, page_size: 20, total_items: 1, total_pages: 1 };

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace, refresh: vi.fn() }),
  usePathname: () => '/admin/orders',
  useSearchParams: () => urlParams,
}));
vi.mock('@/lib/auth', () => ({ useAuth: vi.fn() }));
vi.mock('@/lib/api', () => ({
  ApiError: class ApiError extends Error { constructor(public code: string, public status: number, message: string) { super(message); } },
  getAdminOrders: vi.fn(),
  getAdminOrder: vi.fn(),
  updateAdminOrderStatus: vi.fn(),
}));

const mockedUseAuth = vi.mocked(useAuth);
const mockedGetOrders = vi.mocked(getAdminOrders);
const mockedGetOrder = vi.mocked(getAdminOrder);
const mockedUpdate = vi.mocked(updateAdminOrderStatus);

beforeEach(() => {
  vi.clearAllMocks();
  urlParams = new URLSearchParams();
  mockedUseAuth.mockReturnValue({ user: { id: 'admin', phone: '+1', role: 'ADMIN', is_active: true, created_at: '' }, shop: null, loading: false, login: vi.fn(), register: vi.fn(), logout: vi.fn() });
  mockedGetOrders.mockResolvedValue(page);
  mockedGetOrder.mockResolvedValue(order);
  mockedUpdate.mockResolvedValue(order);
});

describe('admin authorization', () => {
  it.each([['SHOP', '/catalog'], ['SUPPLIER', '/supplier']] as const)('redirects %s to its own workspace', async (role, destination) => {
    mockedUseAuth.mockReturnValue({ user: { id: 'user', phone: '+1', role, is_active: true, created_at: '' }, shop: null, loading: false, login: vi.fn(), register: vi.fn(), logout: vi.fn() });
    render(<AdminRoute><div>Секретные заказы</div></AdminRoute>);
    await waitFor(() => expect(replace).toHaveBeenCalledWith(destination));
    expect(screen.queryByText('Секретные заказы')).not.toBeInTheDocument();
  });

  it('redirects an unauthenticated visitor to login preserving admin path', async () => {
    mockedUseAuth.mockReturnValue({ user: null, shop: null, loading: false, login: vi.fn(), register: vi.fn(), logout: vi.fn() });
    render(<AdminRoute><div>Секретные заказы</div></AdminRoute>);
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/login?next=%2Fadmin%2Forders'));
  });
});

describe('admin orders list', () => {
  it('renders orders for admin with all operational fields', async () => {
    render(<AdminOrdersList />);
    expect(await screen.findByText('ORD-001')).toBeInTheDocument();
    expect(screen.getByText('+996700000000')).toBeInTheDocument();
    expect(screen.getByText('Каракол')).toBeInTheDocument();
    expect(screen.getAllByText('Банковский перевод')).toHaveLength(2);
    expect(screen.getByText('650 сом')).toBeInTheDocument();
  });

  it('renders loading state', () => {
    mockedGetOrders.mockReturnValue(new Promise(() => {}));
    render(<AdminOrdersList />);
    expect(screen.getByText('Загружаем заказы...')).toBeInTheDocument();
  });

  it('renders empty state', async () => {
    mockedGetOrders.mockResolvedValue({ ...page, items: [], total_items: 0, total_pages: 0 });
    render(<AdminOrdersList />);
    expect(await screen.findByText('Заказы не найдены')).toBeInTheDocument();
  });

  it('renders backend error state', async () => {
    mockedGetOrders.mockRejectedValue(new Error('offline'));
    render(<AdminOrdersList />);
    expect(await screen.findByText('Ошибка загрузки')).toBeInTheDocument();
    expect(screen.getByText('Не удалось загрузить заказы. Попробуйте ещё раз.')).toBeInTheDocument();
  });

  it('sends URL state to backend filters and writes submitted filters back to URL', async () => {
    urlParams = new URLSearchParams('status=CONFIRMED&date_from=2026-01-01&date_to=2026-01-31&payment_type=CASH&page=3');
    const user = userEvent.setup();
    render(<AdminOrdersList />);
    await waitFor(() => expect(mockedGetOrders).toHaveBeenCalledWith({ status: 'CONFIRMED', date_from: '2026-01-01', date_to: '2026-01-31', payment_type: 'CASH', page: 3, page_size: 20 }));
    await user.selectOptions(screen.getByLabelText('Статус'), 'DELIVERED');
    await user.click(screen.getByRole('button', { name: 'Применить' }));
    expect(push).toHaveBeenCalledWith('/admin/orders?status=DELIVERED&date_from=2026-01-01&date_to=2026-01-31&payment_type=CASH&page=1');
  });

  it('uses backend pagination and preserves filters', async () => {
    urlParams = new URLSearchParams('status=NEW&page=2');
    mockedGetOrders.mockResolvedValue({ ...page, page: 2, total_pages: 3 });
    const user = userEvent.setup();
    render(<AdminOrdersList />);
    await screen.findByText('Страница 2 из 3');
    await user.click(screen.getByRole('button', { name: 'Вперёд' }));
    expect(push).toHaveBeenCalledWith('/admin/orders?status=NEW&page=3');
  });
});

describe('admin order detail and workflow', () => {
  it('renders historical snapshots and never requests current products', async () => {
    render(<AdminOrderDetail id="order-1" />);
    expect(await screen.findByText('Исторический кофе')).toBeInTheDocument();
    expect(screen.getByText('SKU: OLD-SKU')).toBeInTheDocument();
    expect(screen.getByText(/5 шт\. × 110 сом/)).toBeInTheDocument();
    expect(mockedGetOrder).toHaveBeenCalledWith('order-1');
  });

  it('shows only allowed CTA and terminal orders have none', async () => {
    const { unmount } = render(<AdminOrderDetail id="order-1" />);
    expect(await screen.findByRole('button', { name: 'Подтвердить заказ' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Отменить заказ' })).toBeInTheDocument();
    unmount();
    mockedGetOrder.mockResolvedValue({ ...order, status: 'DELIVERED' });
    render(<AdminOrderDetail id="order-2" />);
    expect(await screen.findByText('Заказ в терминальном статусе. Доступных переходов нет.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /заказ|доставк|сборк/i })).not.toBeInTheDocument();
  });

  it('updates through the admin endpoint and refetches without optimistic status', async () => {
    const user = userEvent.setup();
    render(<AdminOrderDetail id="order-1" />);
    await user.click(await screen.findByRole('button', { name: 'Подтвердить заказ' }));
    await waitFor(() => expect(mockedUpdate).toHaveBeenCalledWith('order-1', 'CONFIRMED'));
    await waitFor(() => expect(mockedGetOrder).toHaveBeenCalledTimes(2));
  });

  it('blocks duplicate transition submissions while pending', async () => {
    let resolve!: (value: typeof order) => void;
    mockedUpdate.mockReturnValue(new Promise(value => { resolve = value; }));
    render(<AdminOrderDetail id="order-1" />);
    const button = await screen.findByRole('button', { name: 'Подтвердить заказ' });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(mockedUpdate).toHaveBeenCalledTimes(1);
    resolve(order);
    await waitFor(() => expect(mockedGetOrder).toHaveBeenCalledTimes(2));
  });

  it('shows an invalid transition message and refetches authoritative state', async () => {
    const user = userEvent.setup();
    mockedUpdate.mockRejectedValue(new ApiError('INVALID_ORDER_STATUS_TRANSITION', 409, 'invalid'));
    render(<AdminOrderDetail id="order-1" />);
    await user.click(await screen.findByRole('button', { name: 'Подтвердить заказ' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Статус заказа уже изменился или переход недоступен. Данные заказа обновлены.');
    expect(mockedGetOrder).toHaveBeenCalledTimes(2);
  });

  it('requires cancellation confirmation with the stock restoration warning', async () => {
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<AdminOrderDetail id="order-1" />);
    await user.click(await screen.findByRole('button', { name: 'Отменить заказ' }));
    expect(confirm).toHaveBeenCalledWith(CANCELLATION_WARNING);
    expect(CANCELLATION_WARNING).toContain('остаток товара автоматически не восстанавливается');
    expect(mockedUpdate).not.toHaveBeenCalled();
    confirm.mockReturnValue(true);
    await user.click(screen.getByRole('button', { name: 'Отменить заказ' }));
    expect(mockedUpdate).toHaveBeenCalledWith('order-1', 'CANCELLED');
    confirm.mockRestore();
  });

  it('renders supplier fulfillment summaries', async () => {
    render(<AdminOrderDetail id="order-1" />);
    expect(await screen.findByText('Поставщик А')).toBeInTheDocument();
    expect(screen.getByText('1 поз. · 550 сом')).toBeInTheDocument();
    expect(screen.getByText('Ожидает подтверждения')).toBeInTheDocument();
  });

  it('warns admin when a supplier cancelled fulfillment', async () => {
    mockedGetOrder.mockResolvedValue({ ...order, fulfillments: [{ ...order.fulfillments[0], status: 'CANCELLED' }] });
    render(<AdminOrderDetail id="order-1" />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Один из поставщиков отменил выполнение. Требуется решение администратора.');
  });
});
