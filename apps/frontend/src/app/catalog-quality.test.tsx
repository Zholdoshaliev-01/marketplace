import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Catalog from './catalog/page';
import ProductPage from './catalog/[productId]/page';
import { ApiError, get, post } from '@/lib/api';

const push = vi.fn();
let query = new URLSearchParams();
let product = {
  id: 'p1', name: 'Кофе', slug: 'coffee', sku: 'COF-1', price: '100.00', minimum_order_quantity: 3,
  stock_quantity: 8, unit: 'шт', supplier: { id: 's1', name: 'Поставщик', market: 'DORDOI' as const },
  category: { id: 'c1', name: 'Напитки', slug: 'drinks' }, images: [], description: 'Описание',
  created_at: '', updated_at: '', primary_image_url: null,
};

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, refresh: vi.fn() }),
  usePathname: () => '/catalog',
  useSearchParams: () => query,
  useParams: () => ({ productId: 'p1' }),
}));
vi.mock('@/lib/api', () => ({
  ApiError: class ApiError extends Error { constructor(public code: string, public status: number, message: string) { super(message); } },
  get: vi.fn(),
  post: vi.fn(),
}));
vi.mock('@/lib/auth', () => ({
  useAuth: () => ({ user: { id: 'shop', phone: '+1', role: 'SHOP', is_active: true, created_at: '' }, loading: false }),
}));
vi.mock('@/components/ui', () => ({
  ProductCardView: ({ product }: { product: { name: string } }) => <div data-testid="product-card">{product.name}</div>,
  ProductHero: ({ product }: { product: { name: string } }) => <h1>{product.name}</h1>,
}));

const mockedGet = vi.mocked(get);
const mockedPost = vi.mocked(post);
const catalogData = { items: [{ ...product }], pagination: { page: 1, page_size: 20, total_items: 1, total_pages: 1 } };

beforeEach(() => {
  vi.clearAllMocks();
  query = new URLSearchParams();
  product = { ...product, stock_quantity: 8 };
  mockedGet.mockImplementation(async (path: string) => {
    if (path.startsWith('/products/')) return product;
    if (path.startsWith('/products?')) return catalogData;
    if (path === '/categories') return { items: [{ id: 'c1', name: 'Напитки', slug: 'drinks', children: [] }] };
    return { items: [{ id: 's1', name: 'Поставщик', market: 'DORDOI' }] };
  });
  mockedPost.mockResolvedValue({});
});

describe('catalog', () => {
  it('renders products, loading, empty, and error states', async () => {
    render(<Catalog />);
    expect(screen.getByText('Загружаем товары...')).toBeInTheDocument();
    expect(await screen.findByTestId('product-card')).toHaveTextContent('Кофе');
  });

  it('renders the empty state', async () => {
    mockedGet.mockImplementation(async (path: string) => path.startsWith('/products?') ? { items: [], pagination: { page: 1, page_size: 20, total_items: 0, total_pages: 0 } } : { items: [] });
    render(<Catalog />);
    expect(await screen.findByText('По вашему запросу товары не найдены.')).toBeInTheDocument();
  });

  it('renders the error state', async () => {
    mockedGet.mockRejectedValue(new Error('offline'));
    render(<Catalog />);
    expect(await screen.findByText('Не удалось загрузить каталог.')).toBeInTheDocument();
  });

  it('updates URL for search, market, sort, and keeps filters when paging', async () => {
    const user = userEvent.setup();
    query = new URLSearchParams('market=DORDOI&sort=price_asc&search=old&page=2');
    const view = render(<Catalog />);
    await screen.findByTestId('product-card');

    const search = screen.getByPlaceholderText('Название или SKU');
    fireEvent.change(search, { target: { value: 'чай' } });
    expect(push).toHaveBeenLastCalledWith('/catalog?market=DORDOI&sort=price_asc&search=%D1%87%D0%B0%D0%B9');

    query = new URLSearchParams('market=DORDOI&sort=price_asc&search=%D1%87%D0%B0%D0%B9');
    view.rerender(<Catalog />);
    await screen.findByTestId('product-card');
    await user.selectOptions(screen.getByLabelText('Рынок'), 'KARA_SUU');
    expect(push).toHaveBeenLastCalledWith('/catalog?market=KARA_SUU&sort=price_asc&search=%D1%87%D0%B0%D0%B9');
    query = new URLSearchParams('market=KARA_SUU&sort=price_asc&search=%D1%87%D0%B0%D0%B9');
    view.rerender(<Catalog />);
    await screen.findByTestId('product-card');
    await user.selectOptions(screen.getByDisplayValue('Сначала дешевле'), 'price_desc');
    expect(push).toHaveBeenLastCalledWith('/catalog?market=KARA_SUU&sort=price_desc&search=%D1%87%D0%B0%D0%B9');
  });

  it('keeps existing filters when moving to another page', async () => {
    const user = userEvent.setup();
    query = new URLSearchParams('market=DORDOI&search=чай&page=1');
    mockedGet.mockResolvedValue({ items: [{ ...product }], pagination: { page: 1, page_size: 20, total_items: 21, total_pages: 2 } });
    render(<Catalog />);
    await screen.findByTestId('product-card');
    await user.click(screen.getByRole('button', { name: 'Далее' }));
    expect(push).toHaveBeenCalledWith('/catalog?market=DORDOI&search=%D1%87%D0%B0%D0%B9&page=2');
  });
});

describe('product detail', () => {
  it('renders with MOQ quantity and clamps quantity between MOQ and stock', async () => {
    const user = userEvent.setup();
    render(<ProductPage />);
    expect(await screen.findByRole('heading', { name: 'Кофе' })).toBeInTheDocument();
    expect(document.querySelector('.buy-card-quantity .quantity b')).toHaveTextContent('3');

    await user.click(screen.getByRole('button', { name: 'Уменьшить' }));
    expect(document.querySelector('.buy-card-quantity .quantity b')).toHaveTextContent('3');
    for (let i = 0; i < 10; i += 1) await user.click(screen.getByRole('button', { name: 'Увеличить' }));
    expect(document.querySelector('.buy-card-quantity .quantity b')).toHaveTextContent('8');
  });

  it('disables add-to-cart when out of stock and adds successfully otherwise', async () => {
    const user = userEvent.setup();
    product = { ...product, stock_quantity: 0 };
    mockedGet.mockResolvedValue(product);
    const { unmount } = render(<ProductPage />);
    const disabledButton = await screen.findByRole('button', { name: 'Нет в наличии' });
    expect(disabledButton).toBeDisabled();
    unmount();

    product = { ...product, stock_quantity: 8 };
    mockedGet.mockResolvedValue(product);
    render(<ProductPage />);
    await user.click(await screen.findByRole('button', { name: /Добавить в корзину/ }));
    expect(mockedPost).toHaveBeenCalledWith('/cart/items', { product_id: 'p1', quantity: 3 });
    expect(await screen.findByText('Товар добавлен в корзину')).toBeInTheDocument();
  });

  it.each([
    ['MOQ_NOT_MET', 'Количество меньше минимального заказа.'],
    ['INSUFFICIENT_STOCK', 'Количество товара изменилось. Проверьте корзину и попробуйте снова.'],
  ])('maps backend %s errors for the user', async (code, message) => {
    const user = userEvent.setup();
    mockedPost.mockRejectedValue(new ApiError(code, 409, 'bad quantity'));
    render(<ProductPage />);
    await user.click(await screen.findByRole('button', { name: /Добавить в корзину/ }));
    expect(await screen.findByText(message)).toBeInTheDocument();
  });
});
