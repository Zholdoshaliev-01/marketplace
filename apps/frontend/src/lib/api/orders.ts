export type PaymentType = 'CASH' | 'BANK_TRANSFER' | 'INSTALLMENT_REQUEST';
export type OrderStatus = 'NEW' | 'CONFIRMED' | 'COLLECTING' | 'READY_FOR_DELIVERY' | 'IN_DELIVERY' | 'DELIVERED' | 'CANCELLED';
export interface OrderItem { id: string; product_id: string; supplier_id: string; product_name_snapshot: string; sku_snapshot: string; quantity: number; unit_price: string; total_price: string }
export interface Order { id: string; order_number: string; status: OrderStatus; payment_type: PaymentType; subtotal: string; delivery_price: string; total: string; city: string; address: string; phone: string; comment?: string | null; created_at: string; updated_at: string; items: OrderItem[] }
export interface OrderListResponse { items: Order[]; page: number; page_size: number; total_items: number; total_pages: number }
