export interface CartItem { id: string; product: { id: string; name: string; sku: string; price: string; minimum_order_quantity: number; stock_quantity: number; unit: string; primary_image_url?: string | null }; quantity: number; line_total: string }
export interface Cart { id: string; items: CartItem[]; subtotal: string }
