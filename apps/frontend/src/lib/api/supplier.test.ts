import { beforeEach, describe, expect, it, vi } from 'vitest';
import { get, patch, post, remove } from './client';
import { createSupplierProduct, deactivateSupplierProduct, getSupplierOrders, getSupplierProducts, updateSupplierProduct } from './supplier';

vi.mock('./client', () => ({ get: vi.fn(), patch: vi.fn(), post: vi.fn(), remove: vi.fn() }));

describe('supplier domain API', () => {
  beforeEach(() => vi.clearAllMocks());
  it('uses ownership-scoped product endpoints without supplier identity input', () => {
    getSupplierProducts(); updateSupplierProduct('product/1', { stock_quantity: 5 }); deactivateSupplierProduct('product/1');
    expect(get).toHaveBeenCalledWith('/supplier/products');
    expect(patch).toHaveBeenCalledWith('/supplier/products/product%2F1', { stock_quantity: 5 });
    expect(remove).toHaveBeenCalledWith('/supplier/products/product%2F1');
  });
  it('creates products and reads privacy-safe orders through shared client', () => {
    const payload = { category_id: 'c1', name: 'Tea', slug: 'tea', sku: 'T1', price: '10.00', minimum_order_quantity: 1, stock_quantity: 0, unit: 'шт' };
    createSupplierProduct(payload); getSupplierOrders();
    expect(post).toHaveBeenCalledWith('/supplier/products', payload);
    expect(get).toHaveBeenCalledWith('/supplier/orders');
  });
});
