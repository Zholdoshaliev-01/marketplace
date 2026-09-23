import { get, patch } from './client';
import type { Order, OrderListResponse, OrderStatus, PaymentType } from './orders';
import type { AdminFulfillmentSummary } from './supplier-fulfillments';

export interface AdminOrder extends Order { fulfillments: AdminFulfillmentSummary[] }

export interface AdminOrderFilters {
  status?: OrderStatus;
  date_from?: string;
  date_to?: string;
  payment_type?: PaymentType;
  page?: number;
  page_size?: number;
}

function apiDate(value: string, endOfDay = false) {
  if (!value) return undefined;
  return `${value}T${endOfDay ? '23:59:59.999' : '00:00:00'}`;
}

export function getAdminOrders(filters: AdminOrderFilters = {}) {
  const params = new URLSearchParams();
  if (filters.status) params.set('status', filters.status);
  const dateFrom = apiDate(filters.date_from ?? '');
  const dateTo = apiDate(filters.date_to ?? '', true);
  if (dateFrom) params.set('date_from', dateFrom);
  if (dateTo) params.set('date_to', dateTo);
  if (filters.payment_type) params.set('payment_type', filters.payment_type);
  params.set('page', String(filters.page ?? 1));
  params.set('page_size', String(filters.page_size ?? 20));
  return get<OrderListResponse>(`/admin/orders?${params.toString()}`);
}

export const getAdminOrder = (id: string) => get<AdminOrder>(`/admin/orders/${encodeURIComponent(id)}`);

export const updateAdminOrderStatus = (id: string, status: OrderStatus) =>
  patch<Order>(`/admin/orders/${encodeURIComponent(id)}/status`, { status });
