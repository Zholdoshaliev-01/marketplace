import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CartPage from './cart/page';
import Checkout from './checkout/page';
import Orders from './orders/page';
import OrderDetail from './orders/[id]/page';
import { ApiError, get, patch, post, remove } from '@/lib/api';
import { useAuth } from '@/lib/auth';

const push = vi.fn();
const cart = {
  id: 'cart1', subtotal: '600.00', items: [{ id: 'item1', quantity: 5, line_total: '600.00', product: {
    id: 'p1', name: 'Кофе', sku: 'COF-1', price: '120.00', minimum_order_quantity: 2, stock_quantity: 10, unit: 'шт',
  } }],
};
const order = {
  id: 'order1', order_number: 'ORD-001', status: 'CONFIRMED' as const, payment_type: 'CASH' as const,
  subtotal: '600.00', delivery_price: '50.00', total: '650.00', city: 'Каракол', address: 'Улица 1', phone: '+996700000000',
  created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z', items: [{ id: 'oi1', product_id: 'p1', supplier_id: 's1', product_name_snapshot: 'Кофе старого названия', sku_snapshot: 'OLD-SKU', quantity: 5, unit_price: '110.00', total_price: '550.00' }],
};

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn() }),
  useParams: () => ({ id: 'order1' }),
  useSearchParams: () => new URLSearchParams('created=1'),
  usePathname: () => '/orders/order1',
}));
vi.mock('@/lib/api', () => ({
  ApiError: class ApiError extends Error { constructor(public code: string, public status: number, message: string) { super(message); } },
  get: vi.fn(), patch: vi.fn(), post: vi.fn(), remove: vi.fn(),
}));
vi.mock('@/lib/auth', () => ({ useAuth: vi.fn() }));

const mockedGet = vi.mocked(get);
const mockedPatch = vi.mocked(patch);
const mockedPost = vi.mocked(post);
const mockedRemove = vi.mocked(remove);
const mockedUseAuth = vi.mocked(useAuth);

beforeEach(() => {
  vi.clearAllMocks();
  mockedUseAuth.mockReturnValue({ user: { id: 'u1', phone: '+996700000000', role: 'SHOP', is_active: true, created_at: '' }, shop: null, loading: false, login: vi.fn(), register: vi.fn(), logout: vi.fn() });
  mockedGet.mockImplementation(async (path: string) => path === '/cart' ? cart : path === '/orders' ? { items: [order] } : order);
  mockedPatch.mockResolvedValue({ ...cart, items: [{ ...cart.items[0], quantity: 6, line_total: '720.00' }] });
  mockedRemove.mockResolvedValue(undefined);
  mockedPost.mockResolvedValue({ id: 'order1' });
});

describe('cart', () => {
  it('renders items, current price, subtotal, quantity update, remove, and checkout CTA', async () => {
    const user = userEvent.setup();
    render(<CartPage />);
    expect(await screen.findByText('Кофе')).toBeInTheDocument();
    expect(screen.getByText('120 сом / шт')).toBeInTheDocument();
    expect(screen.getAllByText('600 сом')).toHaveLength(2);
    expect(screen.getByRole('link', { name: 'Перейти к оформлению' })).toHaveAttribute('href', '/checkout');

    const buttons = screen.getAllByRole('button');
    await user.click(buttons[1]);
    expect(mockedPatch).toHaveBeenCalledWith('/cart/items/item1', { quantity: 6 });
    await user.click(screen.getByRole('button', { name: 'Удалить Кофе' }));
    expect(mockedRemove).toHaveBeenCalledWith('/cart/items/item1');
  });

  it('renders an empty cart state', async () => {
    mockedGet.mockResolvedValue({ id: 'cart1', items: [], subtotal: '0.00' });
    render(<CartPage />);
    expect(await screen.findByText('Корзина пуста')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Перейти в каталог' })).toHaveAttribute('href', '/catalog');
  });
});

describe('checkout', () => {
  async function fillRequired(user: ReturnType<typeof userEvent.setup>) {
    await user.type(screen.getByLabelText('Город'), 'Каракол');
    await user.type(screen.getByLabelText('Телефон'), '+996700000000');
    await user.type(screen.getByLabelText('Адрес доставки'), 'Улица 1');
  }

  it.each(['CASH', 'BANK_TRANSFER', 'INSTALLMENT_REQUEST'] as const)('maps payment type %s and sends only server-authoritative checkout fields', async (paymentType) => {
    const user = userEvent.setup();
    render(<Checkout />);
    await screen.findByText('Кофе × 5');
    await fillRequired(user);
    await user.click(screen.getByDisplayValue(paymentType));
    await user.click(screen.getByRole('button', { name: 'Оформить заказ' }));

    await waitFor(() => expect(mockedPost).toHaveBeenCalled());
    const [path, body, headers] = mockedPost.mock.calls[0];
    expect(path).toBe('/orders');
    expect(body).toEqual({ city: 'Каракол', address: 'Улица 1', phone: '+996700000000', comment: '', payment_type: paymentType });
    expect(body).not.toHaveProperty('items');
    expect(body).not.toHaveProperty('price');
    expect(body).not.toHaveProperty('subtotal');
    expect(body).not.toHaveProperty('total');
    expect(new Headers(headers).get('Idempotency-Key')).toBeTruthy();
    expect(push).toHaveBeenCalledWith('/orders/order1?created=1');
  });

  it('reuses one idempotency key after a lost response and prevents double click attempts', async () => {
    const user = userEvent.setup();
    const randomUUID = vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue('11111111-1111-4111-8111-111111111111');
    let resolveRequest!: (value: { id: string }) => void;
    mockedPost.mockRejectedValueOnce(new Error('network lost')).mockImplementationOnce(() => new Promise(resolve => { resolveRequest = resolve; }));
    render(<Checkout />);
    await screen.findByText('Кофе × 5');
    await fillRequired(user);
    const submit = screen.getByRole('button', { name: 'Оформить заказ' });
    fireEvent.click(submit);
    await screen.findByText('Не удалось оформить заказ. Повторите попытку с тем же ключом.');
    fireEvent.click(submit);
    await waitFor(() => expect(mockedPost).toHaveBeenCalledTimes(2));
    const firstKey = new Headers(mockedPost.mock.calls[0][2]).get('Idempotency-Key');
    const secondKey = new Headers(mockedPost.mock.calls[1][2]).get('Idempotency-Key');
    expect(firstKey).toBeTruthy();
    expect(secondKey).toBe(firstKey);
    expect(randomUUID).toHaveBeenCalledOnce();
    fireEvent.click(submit);
    expect(mockedPost).toHaveBeenCalledTimes(2);
    resolveRequest({ id: 'order1' });
    await waitFor(() => expect(push).toHaveBeenCalledWith('/orders/order1?created=1'));
  });

  it('turns an immediate double click into one checkout request', async () => {
    const user = userEvent.setup();
    let resolveRequest!: (value: { id: string }) => void;
    mockedPost.mockImplementation(() => new Promise(resolve => { resolveRequest = resolve; }));
    render(<Checkout />);
    await screen.findByText('Кофе × 5');
    await fillRequired(user);
    const submit = screen.getByRole('button', { name: 'Оформить заказ' });

    fireEvent.click(submit);
    fireEvent.click(submit);

    await waitFor(() => expect(mockedPost).toHaveBeenCalledTimes(1));
    resolveRequest({ id: 'order1' });
    await waitFor(() => expect(push).toHaveBeenCalledWith('/orders/order1?created=1'));
  });

  it.each([
    ['EMPTY_CART', 'Корзина пуста.'],
    ['INSUFFICIENT_STOCK', 'Количество товара изменилось. Проверьте корзину и попробуйте снова.'],
    ['MOQ_NOT_MET', 'Количество меньше минимального заказа.'],
    ['PRODUCT_UNAVAILABLE', 'Товар больше недоступен.'],
    ['SUPPLIER_INACTIVE', 'Поставщик временно недоступен.'],
    ['DELIVERY_ZONE_NOT_SUPPORTED', 'Доставка в этот город пока недоступна.'],
  ])('maps checkout backend error %s', async (code, message) => {
    const user = userEvent.setup();
    mockedPost.mockRejectedValue(new ApiError(code, 409, code));
    render(<Checkout />);
    await screen.findByText('Кофе × 5');
    await fillRequired(user);
    await user.click(screen.getByRole('button', { name: 'Оформить заказ' }));
    expect(await screen.findByText(message)).toBeInTheDocument();
  });
});

describe('orders', () => {
  it('renders order list with Russian status', async () => {
    render(<Orders />);
    expect(await screen.findByText('ORD-001')).toBeInTheDocument();
    expect(screen.getByText('Подтверждён')).toBeInTheDocument();
    expect(screen.getByText('650 сом')).toBeInTheDocument();
  });

  it('renders historical snapshots without requesting the product', async () => {
    render(<OrderDetail />);
    expect(await screen.findByText('Кофе старого названия')).toBeInTheDocument();
    expect(screen.getByText('SKU: OLD-SKU')).toBeInTheDocument();
    expect(screen.getByText(/5 шт\. × 110 сом/)).toBeInTheDocument();
    expect(mockedGet).toHaveBeenCalledWith('/orders/order1');
    expect(mockedGet).not.toHaveBeenCalledWith('/products/p1');
  });
});
