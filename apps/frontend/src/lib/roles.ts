import type { UserRole } from './api';

export const roleHome: Record<UserRole, string> = {
  SHOP: '/catalog',
  SUPPLIER: '/supplier',
  ADMIN: '/admin',
};

export function safeReturnPath(value: string | null): string | null {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return null;
  try {
    const parsed = new URL(value, 'http://market.kg');
    if (parsed.origin !== 'http://market.kg') return null;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return null;
  }
}

export function loginDestination(role: UserRole, requested: string | null): string {
  const safe = safeReturnPath(requested);
  if (!safe) return roleHome[role];
  if (role === 'SHOP' && (safe.startsWith('/admin') || safe.startsWith('/supplier'))) return roleHome.SHOP;
  if (role === 'SUPPLIER' && (safe.startsWith('/admin') || ['/cart', '/checkout', '/orders', '/profile'].some(path => safe === path || safe.startsWith(`${path}/`)))) return roleHome.SUPPLIER;
  if (role === 'ADMIN' && (safe.startsWith('/supplier') || ['/cart', '/checkout', '/orders', '/profile'].some(path => safe === path || safe.startsWith(`${path}/`)))) return roleHome.ADMIN;
  return safe;
}
