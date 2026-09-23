'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function AdminNav() {
  const pathname = usePathname();
  return <nav className="admin-nav" aria-label="Администрирование"><Link className={pathname.startsWith('/admin/orders') ? 'active' : ''} href="/admin/orders">Заказы</Link></nav>;
}
