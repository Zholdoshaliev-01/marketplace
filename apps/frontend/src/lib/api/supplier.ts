import { get, patch, post, remove } from './client';
import type { Category, ProductDetail } from './catalog';
import type { OrderItem, OrderStatus, PaymentType } from './orders';

export interface SupplierProduct extends ProductDetail { is_active: boolean }
export interface SupplierOrder {
  order_id: string;
  order_number: string;
  status: OrderStatus;
  payment_type: PaymentType;
  created_at: string;
  items: OrderItem[];
}
export interface ProductImageInput { image_url: string; sort_order?: number }
export interface SupplierProductInput {
  category_id: string;
  name: string;
  slug: string;
  description?: string | null;
  sku: string;
  price: string;
  minimum_order_quantity: number;
  stock_quantity: number;
  unit: string;
  is_active?: boolean;
  images?: ProductImageInput[];
}
export type SupplierProductUpdate = Partial<Omit<SupplierProductInput, 'images'>>;

export const getSupplierProducts = () => get<SupplierProduct[]>('/supplier/products');
export const createSupplierProduct = (payload: SupplierProductInput) => post<SupplierProduct>('/supplier/products', payload);
export const updateSupplierProduct = (id: string, payload: SupplierProductUpdate) => patch<SupplierProduct>(`/supplier/products/${encodeURIComponent(id)}`, payload);
export const deactivateSupplierProduct = (id: string) => remove<void>(`/supplier/products/${encodeURIComponent(id)}`);
export const addSupplierProductImage = (productId: string, payload: ProductImageInput) => post<SupplierProduct['images'][number]>(`/supplier/products/${encodeURIComponent(productId)}/images`, payload);
export const updateSupplierProductImage = (productId: string, imageId: string, sort_order: number) => patch<SupplierProduct['images'][number]>(`/supplier/products/${encodeURIComponent(productId)}/images/${encodeURIComponent(imageId)}`, { sort_order });
export const deleteSupplierProductImage = (productId: string, imageId: string) => remove<void>(`/supplier/products/${encodeURIComponent(productId)}/images/${encodeURIComponent(imageId)}`);
export const getSupplierOrders = () => get<SupplierOrder[]>('/supplier/orders');
export const getSupplierCategories = () => get<{ items: Category[] }>('/categories');
