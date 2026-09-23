export type Market = 'DORDOI' | 'KARA_SUU';
export interface Category { id: string; name: string; slug: string; children: Category[] }
export interface Supplier { id: string; name: string; market: Market; pavilion?: string | null; description?: string | null }
export interface ProductCard { id: string; name: string; slug: string; sku: string; price: string; minimum_order_quantity: number; stock_quantity: number; unit: string; supplier: Supplier; category: { id: string; name: string; slug: string }; primary_image_url?: string | null }
export interface ProductDetail extends ProductCard { description?: string | null; images: { id: string; image_url: string; sort_order: number }[]; created_at: string; updated_at: string }
export interface Pagination { page: number; page_size: number; total_items: number; total_pages: number }
