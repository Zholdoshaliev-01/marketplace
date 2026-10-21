'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function AdminNav() {
  const pathname = usePathname();
  const items = [['/admin/orders', 'Заказы'], ['/admin/products', 'Товары'], ['/admin/suppliers', 'Поставщики'], ['/admin/categories', 'Категории']];
  return <nav className="admin-nav" aria-label="Администрирование">{items.map(([href, label]) => <Link key={href} className={pathname.startsWith(href) ? 'active' : ''} href={href}>{label}</Link>)}</nav>;
}
