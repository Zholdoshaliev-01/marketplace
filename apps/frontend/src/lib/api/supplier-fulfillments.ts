import { get, patch } from './client';
import type { OrderItem, OrderStatus, PaymentType } from './orders';

export type FulfillmentStatus = 'PENDING' | 'ACCEPTED' | 'COLLECTING' | 'READY' | 'CANCELLED';
export type FulfillmentItem = Omit<OrderItem, 'supplier_id'>;
export interface SupplierFulfillment {
  fulfillment_id: string;
  order_id: string;
  order_number: string;
  status: FulfillmentStatus;
  order_status: OrderStatus;
  payment_type: PaymentType;
  created_at: string;
  supplier_subtotal: string;
  items: FulfillmentItem[];
}
export interface AdminFulfillmentSummary {
  fulfillment_id: string;
  supplier_id: string;
  supplier_name: string;
  status: FulfillmentStatus;
  item_count: number;
  supplier_subtotal: string;
}

export const getSupplierFulfillments = () => get<SupplierFulfillment[]>('/supplier/fulfillments');
export const getSupplierFulfillment = (id: string) => get<SupplierFulfillment>(`/supplier/fulfillments/${encodeURIComponent(id)}`);
export const updateSupplierFulfillmentStatus = (id: string, status: FulfillmentStatus) => patch<SupplierFulfillment>(`/supplier/fulfillments/${encodeURIComponent(id)}/status`, { status });
