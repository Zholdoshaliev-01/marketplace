import { beforeEach, describe, expect, it, vi } from 'vitest';
import { get } from './client';
import { getAdminOrder, getAdminOrders, updateAdminOrderStatus } from './admin-orders';
import { patch } from './client';

vi.mock('./client', () => ({ get: vi.fn(), patch: vi.fn() }));

describe('admin order API', () => {
  beforeEach(() => vi.clearAllMocks());

  it('encodes backend filters, inclusive date bounds and pagination', () => {
    getAdminOrders({ status: 'CONFIRMED', date_from: '2026-01-01', date_to: '2026-01-31', payment_type: 'BANK_TRANSFER', page: 3, page_size: 20 });
    expect(get).toHaveBeenCalledWith('/admin/orders?status=CONFIRMED&date_from=2026-01-01T00%3A00%3A00&date_to=2026-01-31T23%3A59%3A59.999&payment_type=BANK_TRANSFER&page=3&page_size=20');
  });

  it('uses only the shared API client for detail and status update', () => {
    getAdminOrder('order/unsafe');
    updateAdminOrderStatus('order/unsafe', 'CONFIRMED');
    expect(get).toHaveBeenCalledWith('/admin/orders/order%2Funsafe');
    expect(patch).toHaveBeenCalledWith('/admin/orders/order%2Funsafe/status', { status: 'CONFIRMED' });
  });
});
