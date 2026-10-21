import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { addAdminProductImage, createAdminCategory, createAdminProduct, getAdminProducts, getAdminSuppliers, setAccessToken, updateAdminSupplier } from '@/lib/api';

const response = (body: unknown, status = 200) => ({ ok: status >= 200 && status < 300, status, json: vi.fn().mockResolvedValue(body) }) as unknown as Response;

beforeEach(() => { vi.stubGlobal('fetch', vi.fn()); setAccessToken('admin-token'); });
afterEach(() => { vi.unstubAllGlobals(); setAccessToken(null); });

describe('admin catalog API', () => {
  it('uses admin-scoped management endpoints', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce(response([]))
      .mockResolvedValueOnce(response([]))
      .mockResolvedValueOnce(response({ id: 'category-1' }, 201));

    await getAdminProducts();
    await getAdminSuppliers();
    await createAdminCategory({ name: 'Тест', slug: 'test' });

    expect(fetchMock.mock.calls[0][0]).toBe('/api/v1/admin/products?page_size=100');
    expect(fetchMock.mock.calls[1][0]).toBe('/api/v1/admin/suppliers');
    expect(fetchMock.mock.calls[2][0]).toBe('/api/v1/admin/categories');
    expect(new Headers((fetchMock.mock.calls[0][1] as RequestInit).headers).get('Authorization')).toBe('Bearer admin-token');
  });

  it('sends product, supplier and image mutations', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(response({ id: 'created' }, 201));

    await createAdminProduct({ supplier_id: 's1', category_id: 'c1', name: 'Товар', slug: 'product', sku: 'SKU', price: '10.00', minimum_order_quantity: 1, stock_quantity: 2, unit: 'шт.' });
    await updateAdminSupplier('s1', { is_active: true });
    await addAdminProductImage('p1', '/image.svg', 0);

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      '/api/v1/admin/products', '/api/v1/admin/suppliers/s1', '/api/v1/admin/products/p1/images',
    ]);
  });
});
