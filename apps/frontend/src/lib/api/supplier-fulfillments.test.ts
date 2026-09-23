import { beforeEach, describe, expect, it, vi } from 'vitest';
import { get, patch } from './client';
import { getSupplierFulfillment, getSupplierFulfillments, updateSupplierFulfillmentStatus } from './supplier-fulfillments';

vi.mock('./client', () => ({ get: vi.fn(), patch: vi.fn() }));

describe('supplier fulfillment API', () => {
  beforeEach(() => vi.clearAllMocks());
  it('uses supplier-scoped list and detail endpoints', () => {
    getSupplierFulfillments(); getSupplierFulfillment('fulfillment/1');
    expect(get).toHaveBeenCalledWith('/supplier/fulfillments');
    expect(get).toHaveBeenCalledWith('/supplier/fulfillments/fulfillment%2F1');
  });
  it('updates only status through the shared client', () => {
    updateSupplierFulfillmentStatus('fulfillment/1', 'ACCEPTED');
    expect(patch).toHaveBeenCalledWith('/supplier/fulfillments/fulfillment%2F1/status', { status: 'ACCEPTED' });
  });
});
