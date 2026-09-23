import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SupplierRoute } from '@/features/supplier/supplier-route';
import { SupplierProductsList } from '@/features/supplier/products/products-list';
import { SupplierProductCard, DEACTIVATE_WARNING } from '@/features/supplier/products/product-card';
import { SupplierProductForm } from '@/features/supplier/products/product-form';
import { ProductImageManager } from '@/features/supplier/products/image-manager';
import { FULFILLMENT_CANCEL_WARNING, SupplierOrdersView } from '@/features/supplier/orders/orders-view';
import {
  ApiError, addSupplierProductImage, createSupplierProduct, deactivateSupplierProduct, deleteSupplierProductImage,
  getSupplierCategories, getSupplierFulfillment, getSupplierFulfillments, getSupplierProducts, updateSupplierFulfillmentStatus, updateSupplierProduct, updateSupplierProductImage,
} from '@/lib/api';
import { useAuth } from '@/lib/auth';

const push = vi.fn();
const replace = vi.fn();
const product = {
  id: 'product-1', name: 'Кофе', slug: 'coffee', sku: 'COF-1', price: '120.00', minimum_order_quantity: 2, stock_quantity: 10, unit: 'шт',
  description: 'Описание', supplier: { id: 'supplier-1', name: 'Supplier', market: 'DORDOI' as const }, category: { id: 'category-1', name: 'Напитки', slug: 'drinks' },
  primary_image_url: 'https://placehold.co/400', images: [{ id: 'image-1', image_url: 'https://placehold.co/1', sort_order: 0 }],
  created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z', is_active: true,
};
const fulfillment = {
  fulfillment_id: 'fulfillment-1', order_id: 'order-1', order_number: 'ORD-001', status: 'PENDING' as const, order_status: 'CONFIRMED' as const, payment_type: 'CASH' as const, created_at: '2026-01-02T00:00:00Z', supplier_subtotal: '550.00',
  items: [{ id: 'item-1', product_id: 'product-1', product_name_snapshot: 'Кофе snapshot', sku_snapshot: 'OLD-SKU', quantity: 5, unit_price: '110.00', total_price: '550.00' }],
};

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace, refresh: vi.fn() }),
  usePathname: () => '/supplier/products',
}));
vi.mock('@/lib/auth', () => ({ useAuth: vi.fn() }));
vi.mock('@/lib/api', () => ({
  ApiError: class ApiError extends Error { constructor(public code: string, public status: number, message: string) { super(message); } },
  getSupplierProducts: vi.fn(), createSupplierProduct: vi.fn(), updateSupplierProduct: vi.fn(), deactivateSupplierProduct: vi.fn(),
  getSupplierCategories: vi.fn(), addSupplierProductImage: vi.fn(), updateSupplierProductImage: vi.fn(), deleteSupplierProductImage: vi.fn(),
  getSupplierFulfillments: vi.fn(), getSupplierFulfillment: vi.fn(), updateSupplierFulfillmentStatus: vi.fn(),
}));

const mockedAuth = vi.mocked(useAuth);
const mockedProducts = vi.mocked(getSupplierProducts);
const mockedCreate = vi.mocked(createSupplierProduct);
const mockedUpdate = vi.mocked(updateSupplierProduct);
const mockedDeactivate = vi.mocked(deactivateSupplierProduct);
const mockedCategories = vi.mocked(getSupplierCategories);
const mockedAddImage = vi.mocked(addSupplierProductImage);
const mockedUpdateImage = vi.mocked(updateSupplierProductImage);
const mockedDeleteImage = vi.mocked(deleteSupplierProductImage);
const mockedFulfillments = vi.mocked(getSupplierFulfillments);
const mockedFulfillment = vi.mocked(getSupplierFulfillment);
const mockedFulfillmentUpdate = vi.mocked(updateSupplierFulfillmentStatus);

beforeEach(() => {
  vi.clearAllMocks();
  mockedAuth.mockReturnValue({ user: { id: 'u1', phone: '+1', role: 'SUPPLIER', is_active: true, created_at: '' }, shop: null, loading: false, login: vi.fn(), register: vi.fn(), logout: vi.fn() });
  mockedProducts.mockResolvedValue([product]);
  mockedCreate.mockResolvedValue(product);
  mockedUpdate.mockImplementation(async (_id, payload) => ({ ...product, ...payload }));
  mockedDeactivate.mockResolvedValue(undefined);
  mockedCategories.mockResolvedValue({ items: [{ id: 'category-1', name: 'Напитки', slug: 'drinks', children: [] }] });
  mockedAddImage.mockResolvedValue({ id: 'image-2', image_url: 'https://placehold.co/2', sort_order: 1 });
  mockedUpdateImage.mockResolvedValue(product.images[0]);
  mockedDeleteImage.mockResolvedValue(undefined);
  mockedFulfillments.mockResolvedValue([fulfillment]);
  mockedFulfillment.mockResolvedValue(fulfillment);
  mockedFulfillmentUpdate.mockResolvedValue({ ...fulfillment, status: 'ACCEPTED' });
});

describe('supplier authorization', () => {
  it('redirects unauthenticated user preserving next URL', async () => {
    mockedAuth.mockReturnValue({ user: null, shop: null, loading: false, login: vi.fn(), register: vi.fn(), logout: vi.fn() });
    render(<SupplierRoute><div>Supplier workspace</div></SupplierRoute>);
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/login?next=%2Fsupplier%2Fproducts'));
  });
  it.each([['SHOP', '/catalog'], ['ADMIN', '/admin']] as const)('redirects %s to its own workspace', async (role, destination) => {
    mockedAuth.mockReturnValue({ user: { id: 'u1', phone: '+1', role, is_active: true, created_at: '' }, shop: null, loading: false, login: vi.fn(), register: vi.fn(), logout: vi.fn() });
    render(<SupplierRoute><div>Supplier workspace</div></SupplierRoute>);
    await waitFor(() => expect(replace).toHaveBeenCalledWith(destination));
    expect(screen.queryByText('Supplier workspace')).not.toBeInTheDocument();
  });
  it('grants SUPPLIER access', () => {
    render(<SupplierRoute><div>Supplier workspace</div></SupplierRoute>);
    expect(screen.getByText('Supplier workspace')).toBeInTheDocument();
  });
});

describe('supplier products', () => {
  it('renders loading state', () => {
    mockedProducts.mockReturnValue(new Promise(() => {}));
    render(<SupplierProductsList />);
    expect(screen.getByText('Загружаем товары...')).toBeInTheDocument();
  });
  it('renders empty state', async () => {
    mockedProducts.mockResolvedValue([]);
    render(<SupplierProductsList />);
    expect(await screen.findByText('Товаров пока нет')).toBeInTheDocument();
  });
  it('renders error state', async () => {
    mockedProducts.mockRejectedValue(new Error('offline'));
    render(<SupplierProductsList />);
    expect(await screen.findByText('Ошибка загрузки')).toBeInTheDocument();
  });
  it('renders own product operational data', async () => {
    render(<SupplierProductsList />);
    expect(await screen.findByText('Кофе')).toBeInTheDocument();
    expect(screen.getByText(/SKU: COF-1/)).toBeInTheDocument();
    expect(screen.getByText('120 сом')).toBeInTheDocument();
    expect(screen.getByText('10 шт')).toBeInTheDocument();
    expect(screen.getByText(/SKU: COF-1 · Напитки/)).toBeInTheDocument();
  });
  it('updates stock with backend-confirmed response', async () => {
    const user = userEvent.setup();
    render(<SupplierProductCard product={product} onUpdated={vi.fn()} onReload={vi.fn()} />);
    const input = screen.getByLabelText('Остаток Кофе');
    await user.clear(input); await user.type(input, '25');
    await user.click(within(input.closest('form')!).getByRole('button', { name: 'Сохранить' }));
    expect(mockedUpdate).toHaveBeenCalledWith('product-1', { stock_quantity: 25 });
  });
  it('blocks duplicate stock submit while pending', async () => {
    let resolve!: (value: typeof product) => void;
    mockedUpdate.mockReturnValue(new Promise(value => { resolve = value; }));
    render(<SupplierProductCard product={product} onUpdated={vi.fn()} onReload={vi.fn()} />);
    const form = screen.getByLabelText('Остаток Кофе').closest('form')!;
    fireEvent.submit(form); fireEvent.submit(form);
    expect(mockedUpdate).toHaveBeenCalledTimes(1);
    resolve(product);
    await waitFor(() => expect(within(form).getByRole('button')).not.toBeDisabled());
  });
  it('updates price as a decimal-compatible string', async () => {
    const user = userEvent.setup();
    render(<SupplierProductCard product={product} onUpdated={vi.fn()} onReload={vi.fn()} />);
    const input = screen.getByLabelText('Цена Кофе');
    await user.clear(input); await user.type(input, '125,50');
    await user.click(within(input.closest('form')!).getByRole('button', { name: 'Сохранить' }));
    expect(mockedUpdate).toHaveBeenCalledWith('product-1', { price: '125.50' });
  });
  it('requires confirmation before soft deactivation', async () => {
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<SupplierProductCard product={product} onUpdated={vi.fn()} onReload={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'Снять с продажи' }));
    expect(confirm).toHaveBeenCalledWith(DEACTIVATE_WARNING);
    expect(mockedDeactivate).not.toHaveBeenCalled();
    confirm.mockRestore();
  });
  it('describes deactivation as hiding while preserving data', () => {
    expect(DEACTIVATE_WARNING).toBe('Товар будет скрыт из публичного каталога. Данные товара сохранятся.');
    expect(DEACTIVATE_WARNING).not.toContain('навсегда');
  });
});

describe('create and edit product', () => {
  async function fillProductForm(user: ReturnType<typeof userEvent.setup>) {
    await screen.findByRole('option', { name: 'Напитки' });
    await user.type(screen.getByLabelText('Название *'), 'Чай');
    await user.type(screen.getByLabelText('SKU *'), 'TEA-1');
    await user.type(screen.getByLabelText('Slug *'), 'tea');
    await user.selectOptions(screen.getByLabelText('Категория *'), 'category-1');
    await user.type(screen.getByLabelText('Цена, сом *'), '99.90');
  }
  it('creates product without supplier_id', async () => {
    const user = userEvent.setup();
    render(<SupplierProductForm />); await fillProductForm(user);
    await user.click(screen.getByRole('button', { name: 'Создать товар' }));
    await waitFor(() => expect(mockedCreate).toHaveBeenCalled());
    const payload = mockedCreate.mock.calls[0][0];
    expect(payload).not.toHaveProperty('supplier_id');
    expect(payload).toMatchObject({ name: 'Чай', price: '99.90', stock_quantity: 0, minimum_order_quantity: 1 });
  });
  it('validates required fields before create', async () => {
    const user = userEvent.setup(); render(<SupplierProductForm />);
    await screen.findByRole('option', { name: 'Напитки' });
    await user.click(screen.getByRole('button', { name: 'Создать товар' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Заполните обязательные поля.');
    expect(mockedCreate).not.toHaveBeenCalled();
  });
  it('loads category options from public categories endpoint', async () => {
    render(<SupplierProductForm />);
    expect(await screen.findByRole('option', { name: 'Напитки' })).toBeInTheDocument();
    expect(mockedCategories).toHaveBeenCalledOnce();
  });
  it('edits only a product returned by the supplier endpoint', async () => {
    const user = userEvent.setup(); render(<SupplierProductForm productId="product-1" />);
    const name = await screen.findByLabelText('Название *');
    await user.clear(name); await user.type(name, 'Кофе новый');
    await user.click(screen.getByRole('button', { name: 'Сохранить изменения' }));
    await waitFor(() => expect(mockedUpdate).toHaveBeenCalledWith('product-1', expect.objectContaining({ name: 'Кофе новый', sku: 'COF-1' })));
  });
  it('shows not found for a product absent from the owned list', async () => {
    render(<SupplierProductForm productId="foreign-product" />);
    expect(await screen.findByText('Товар не найден')).toBeInTheDocument();
    expect(mockedUpdate).not.toHaveBeenCalled();
  });
});

describe('URL image workflow', () => {
  it('adds an image URL', async () => {
    const user = userEvent.setup(); render(<ProductImageManager product={product} reload={vi.fn()} />);
    await user.type(screen.getByLabelText('URL изображения'), 'https://placehold.co/2');
    await user.click(screen.getByRole('button', { name: 'Добавить URL' }));
    expect(mockedAddImage).toHaveBeenCalledWith('product-1', { image_url: 'https://placehold.co/2', sort_order: 1 });
  });
  it('deletes an owned image', async () => {
    const user = userEvent.setup(); render(<ProductImageManager product={product} reload={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'Удалить изображение 1' }));
    expect(mockedDeleteImage).toHaveBeenCalledWith('product-1', 'image-1');
  });
  it('reorders images through existing sort_order endpoint', async () => {
    const user = userEvent.setup(); const two = { ...product, images: [...product.images, { id: 'image-2', image_url: 'https://placehold.co/2', sort_order: 1 }] };
    render(<ProductImageManager product={two} reload={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'Выше 2' }));
    expect(mockedUpdateImage).toHaveBeenCalledWith('product-1', 'image-2', 0);
    expect(mockedUpdateImage).toHaveBeenCalledWith('product-1', 'image-1', 1);
  });
  it('maps backend maximum-image validation', async () => {
    const user = userEvent.setup(); mockedAddImage.mockRejectedValue(new ApiError('IMAGE_LIMIT_REACHED', 409, 'limit'));
    render(<ProductImageManager product={product} reload={vi.fn()} />);
    await user.type(screen.getByLabelText('URL изображения'), 'https://placehold.co/overflow');
    await user.click(screen.getByRole('button', { name: 'Добавить URL' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Можно добавить не более 10 изображений.');
  });
});

describe('supplier fulfillment orders', () => {
  it('renders list loading state', () => {
    mockedFulfillments.mockReturnValue(new Promise(() => {}));
    render(<SupplierOrdersView />);
    expect(screen.getByText('Загружаем заказы...')).toBeInTheDocument();
  });
  it('renders empty state', async () => {
    mockedFulfillments.mockResolvedValue([]);
    render(<SupplierOrdersView />);
    expect(await screen.findByText('Заказов пока нет')).toBeInTheDocument();
  });
  it('renders API error state', async () => {
    mockedFulfillments.mockRejectedValue(new Error('offline'));
    render(<SupplierOrdersView />);
    expect(await screen.findByText('Ошибка загрузки')).toBeInTheDocument();
  });
  it('renders own snapshots, subtotal and read-only global status', async () => {
    render(<SupplierOrdersView />);
    expect(await screen.findByText('ORD-001')).toBeInTheDocument();
    expect(screen.getByText('Кофе snapshot')).toBeInTheDocument();
    expect(screen.getByText('Мои товары: 550 сом')).toBeInTheDocument();
    expect(screen.getByText('Заказ: Подтверждён')).toBeInTheDocument();
    expect(mockedProducts).not.toHaveBeenCalled();
  });
  it.each([
    ['PENDING', ['Принять', 'Отменить']],
    ['ACCEPTED', ['Начать сборку', 'Отменить']],
    ['COLLECTING', ['Готов к передаче']],
  ] as const)('%s renders only its allowed fulfillment actions', async (status, labels) => {
    mockedFulfillment.mockResolvedValue({ ...fulfillment, status });
    render(<SupplierOrdersView fulfillmentId="fulfillment-1" />);
    await screen.findByText('Ваши позиции');
    for (const label of labels) expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
  });
  it.each(['READY', 'CANCELLED'] as const)('%s is terminal and has no fulfillment actions', async status => {
    mockedFulfillment.mockResolvedValue({ ...fulfillment, status });
    render(<SupplierOrdersView fulfillmentId="fulfillment-1" />);
    await screen.findByText('Ваши позиции');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
  it('calls the correct transition endpoint and refetches backend-confirmed state', async () => {
    const user = userEvent.setup();
    mockedFulfillment.mockResolvedValueOnce(fulfillment).mockResolvedValueOnce({ ...fulfillment, status: 'ACCEPTED' });
    render(<SupplierOrdersView fulfillmentId="fulfillment-1" />);
    await user.click(await screen.findByRole('button', { name: 'Принять' }));
    expect(mockedFulfillmentUpdate).toHaveBeenCalledWith('fulfillment-1', 'ACCEPTED');
    expect(await screen.findByRole('button', { name: 'Начать сборку' })).toBeInTheDocument();
  });
  it('blocks duplicate transition clicks while pending', async () => {
    let resolve!: (value: typeof fulfillment) => void;
    mockedFulfillmentUpdate.mockReturnValue(new Promise(value => { resolve = value; }));
    render(<SupplierOrdersView fulfillmentId="fulfillment-1" />);
    const button = await screen.findByRole('button', { name: 'Принять' });
    fireEvent.click(button); fireEvent.click(button);
    expect(mockedFulfillmentUpdate).toHaveBeenCalledTimes(1);
    resolve(fulfillment);
    await waitFor(() => expect(mockedFulfillment).toHaveBeenCalledTimes(2));
  });
  it('shows invalid transition and refetches authoritative state', async () => {
    const user = userEvent.setup();
    mockedFulfillmentUpdate.mockRejectedValue(new ApiError('INVALID_FULFILLMENT_STATUS_TRANSITION', 409, 'invalid'));
    render(<SupplierOrdersView fulfillmentId="fulfillment-1" />);
    await user.click(await screen.findByRole('button', { name: 'Принять' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Статус уже изменился или переход недоступен. Данные обновлены.');
    expect(mockedFulfillment).toHaveBeenCalledTimes(2);
  });
  it('requires cancellation confirmation and warns that stock is not restored', async () => {
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<SupplierOrdersView fulfillmentId="fulfillment-1" />);
    await user.click(await screen.findByRole('button', { name: 'Отменить' }));
    expect(confirm).toHaveBeenCalledWith(FULFILLMENT_CANCEL_WARNING);
    expect(FULFILLMENT_CANCEL_WARNING).toContain('Остаток товара автоматически не восстанавливается');
    expect(mockedFulfillmentUpdate).not.toHaveBeenCalled();
    confirm.mockRestore();
  });
  it('does not expose private customer data, foreign items or global controls', async () => {
    render(<SupplierOrdersView fulfillmentId="fulfillment-1" />); await screen.findByText('Ваши позиции');
    expect(screen.getByText('SKU: OLD-SKU')).toBeInTheDocument();
    expect(screen.queryByText('Улица покупателя')).not.toBeInTheDocument();
    expect(screen.queryByText('+996700999999')).not.toBeInTheDocument();
    expect(screen.queryByText('Секретный комментарий')).not.toBeInTheDocument();
    expect(screen.queryByText('Чужой товар')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /глобальн|статус заказа/i })).not.toBeInTheDocument();
  });
});
