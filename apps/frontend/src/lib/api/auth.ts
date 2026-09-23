export type UserRole = 'ADMIN' | 'SUPPLIER' | 'SHOP';
export interface User { id: string; phone: string; email?: string | null; role: UserRole; is_active: boolean; created_at: string }
export interface Shop { id: string; owner_user_id: string; name: string; phone: string; city: string; address: string }
