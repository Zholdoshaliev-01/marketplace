'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { useAuth } from '@/lib/auth';

export function SupplierNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { logout } = useAuth();
  return <nav className="supplier-nav" aria-label="Рабочее пространство поставщика">
    <div><Link className={pathname.startsWith('/supplier/orders') ? 'active' : ''} href="/supplier/orders">Заказы</Link><Link className={pathname.startsWith('/supplier/products') ? 'active' : ''} href="/supplier/products">Товары</Link></div>
    <button onClick={() => { void logout().then(() => router.push('/login')); }}><LogOut size={16} /> Выйти</button>
  </nav>;
}
