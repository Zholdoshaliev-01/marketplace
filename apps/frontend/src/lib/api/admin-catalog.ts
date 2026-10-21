import { get, patch, post, remove } from './client';
import type { Category, Market, ProductDetail, Supplier } from './catalog';

export interface AdminSupplier extends Supplier {
  phone: string;
  owner_user_id: string | null;
  is_active: boolean;
  created_at: string;
}

export interface AdminProduct extends ProductDetail { is_active: boolean }

export interface AdminSupplierInput {
  name: string;
  phone: string;
  market: Market;
  pavilion?: string | null;
  description?: string | null;
  is_active?: boolean;
}

export interface AdminProductInput {
  supplier_id: string;
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
  images?: { image_url: string; sort_order?: number }[];
}

export const getAdminSuppliers = () => get<AdminSupplier[]>('/admin/suppliers');
export const createAdminSupplier = (payload: AdminSupplierInput) => post<AdminSupplier>('/admin/suppliers', payload);
export const updateAdminSupplier = (id: string, payload: Partial<AdminSupplierInput>) => patch<AdminSupplier>(`/admin/suppliers/${encodeURIComponent(id)}`, payload);
export const deactivateAdminSupplier = (id: string) => remove<void>(`/admin/suppliers/${encodeURIComponent(id)}`);

export const getAdminCategories = () => get<{ items: Category[] }>('/admin/categories');
export const createAdminCategory = (payload: { name: string; slug: string; parent_id?: string | null }) => post<Category>('/admin/categories', payload);
export const updateAdminCategory = (id: string, payload: { name?: string; slug?: string; parent_id?: string | null }) => patch<Category>(`/admin/categories/${encodeURIComponent(id)}`, payload);
export const deleteAdminCategory = (id: string) => remove<void>(`/admin/categories/${encodeURIComponent(id)}`);

export const getAdminProducts = () => get<AdminProduct[]>('/admin/products?page_size=100');
export const createAdminProduct = (payload: AdminProductInput) => post<AdminProduct>('/admin/products', payload);
export const updateAdminProduct = (id: string, payload: Partial<Omit<AdminProductInput, 'supplier_id' | 'images'>>) => patch<AdminProduct>(`/admin/products/${encodeURIComponent(id)}`, payload);
export const deactivateAdminProduct = (id: string) => remove<void>(`/admin/products/${encodeURIComponent(id)}`);
export const addAdminProductImage = (productId: string, image_url: string, sort_order: number) => post<AdminProduct['images'][number]>(`/admin/products/${encodeURIComponent(productId)}/images`, { image_url, sort_order });
export const updateAdminProductImage = (productId: string, imageId: string, sort_order: number) => patch<AdminProduct['images'][number]>(`/admin/products/${encodeURIComponent(productId)}/images/${encodeURIComponent(imageId)}`, { sort_order });
export const deleteAdminProductImage = (productId: string, imageId: string) => remove<void>(`/admin/products/${encodeURIComponent(productId)}/images/${encodeURIComponent(imageId)}`);
