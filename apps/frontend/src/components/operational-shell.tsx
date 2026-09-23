'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ExternalLink, LayoutDashboard, LogOut, Menu, PackageCheck, ShoppingBasket, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/lib/auth';

type Workspace = 'ADMIN' | 'SUPPLIER';

const config = {
  ADMIN: {
    label: 'Администратор',
    title: 'Администрирование',
    items: [
      { href: '/admin', label: 'Обзор', icon: LayoutDashboard, exact: true },
      { href: '/admin/orders', label: 'Заказы', icon: ShoppingBasket },
    ],
  },
  SUPPLIER: {
    label: 'Поставщик',
    title: 'Рабочее пространство',
    items: [
      { href: '/supplier', label: 'Обзор', icon: LayoutDashboard, exact: true },
      { href: '/supplier/products', label: 'Мои товары', icon: ShoppingBasket },
      { href: '/supplier/orders', label: 'Выполнение заказов', icon: PackageCheck },
    ],
  },
} as const;

export function OperationalShell({ workspace, children }: { workspace: Workspace; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const closeButton = useRef<HTMLButtonElement>(null);
  const current = config[workspace];

  useEffect(() => {
    if (open) closeButton.current?.focus();
  }, [open]);

  const signOut = () => void logout().then(() => router.replace('/login'));
  const nav = <>
    <div className="workspace-brand"><Link href={`/${workspace.toLowerCase()}`}><span>M</span><b>MARKET KG</b></Link><small>{current.title}</small><strong>{current.label}</strong></div>
    <nav className="workspace-nav" aria-label={current.title}>{current.items.map(item => {
      const active = 'exact' in item && item.exact ? pathname === item.href : pathname.startsWith(item.href);
      const Icon = item.icon;
      return <Link key={item.href} href={item.href} onClick={() => setOpen(false)} className={active ? 'active' : ''} aria-current={active ? 'page' : undefined}><Icon size={18}/>{item.label}</Link>;
    })}</nav>
    <div className="workspace-account">
      <div><span>{user?.phone.slice(-2) ?? 'KG'}</span><p><b>{user?.phone}</b><small>{current.label}</small></p></div>
      <Link href="/catalog"><ExternalLink size={16}/> Открыть сайт</Link>
      <button onClick={signOut}><LogOut size={16}/> Выйти</button>
    </div>
  </>;

  return <div className="workspace-layout">
    <aside className="workspace-sidebar">{nav}</aside>
    {open && <div className="workspace-drawer-layer" role="presentation" onMouseDown={() => setOpen(false)}>
      <aside className="workspace-drawer" role="dialog" aria-modal="true" aria-label={`Меню: ${current.title}`} onMouseDown={event => event.stopPropagation()}>
        <button ref={closeButton} className="workspace-close" aria-label="Закрыть меню" onClick={() => setOpen(false)}><X/></button>{nav}
      </aside>
    </div>}
    <section className="workspace-main">
      <header className="workspace-topbar"><button aria-label="Открыть меню" aria-expanded={open} onClick={() => setOpen(true)}><Menu/></button><div><b>{current.title}</b><span>{current.label}</span></div><Link href="/catalog" aria-label="Открыть публичный каталог"><ExternalLink size={18}/></Link></header>
      <main className="workspace-content">{children}</main>
    </section>
  </div>;
}
