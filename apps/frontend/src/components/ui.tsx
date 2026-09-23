'use client';
/* LegacyHeader is retained only for backwards-compatible source history. */
/* eslint-disable @typescript-eslint/no-unused-vars */
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { ArrowRight, ExternalLink, Home, LogOut, Menu, Package, Search, ShoppingBag, UserRound, X } from 'lucide-react';
import { useState } from 'react';
import { useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { marketLabels, money, statusLabels } from '@/lib/format';
import { ProductCard, ProductDetail } from '@/lib/api';
import { motion, AnimatePresence } from 'motion/react';
import { ProductPlaceholder } from '@/components/motion-ui';
import { fadeUp } from '@/lib/motion';
import { isUsableProductImage } from '@/lib/images';
import { ShopRoute } from '@/features/auth/role-route';

function LegacyHeader() { const { user, logout } = useAuth(); const [open, setOpen] = useState(false); const [scrolled,setScrolled]=useState(false); const pathname = usePathname(); const router = useRouter(); useEffect(()=>{const onScroll=()=>setScrolled(window.scrollY>18);onScroll();window.addEventListener('scroll',onScroll,{passive:true});return()=>window.removeEventListener('scroll',onScroll)},[]); return <>
  <header className={`topbar ${scrolled?'is-scrolled':''}`}><Link href="/" className="brand"><span className="brand-mark">M</span><span>MARKET<br/><b>КГ</b></span></Link><form className="header-search" onSubmit={e => { e.preventDefault(); const value = new FormData(e.currentTarget).get('search'); router.push(`/catalog?search=${encodeURIComponent(String(value ?? ''))}`) }}><Search size={18}/><input name="search" placeholder="Найти товар или SKU" aria-label="Поиск товаров"/><button aria-label="Искать"><ArrowRight size={17}/></button></form><nav className="desktop-nav"><Link className={pathname === '/' ? 'active' : ''} href="/">Главная</Link><Link className={pathname.startsWith('/catalog') ? 'active' : ''} href="/catalog">Каталог</Link><Link className={pathname.startsWith('/orders') ? 'active' : ''} href="/orders">Заказы</Link></nav><Link href="/cart" className="cart-link"><ShoppingBag size={19}/><span>Корзина</span></Link><button className="menu-button" onClick={() => setOpen(!open)} aria-expanded={open} aria-label="Меню">{open ? <X/> : <Menu/>}</button></header>
  <AnimatePresence>{open && <motion.div className="mobile-menu" initial={{opacity:0,y:-8}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-6}}><Link href="/">Главная</Link><Link href="/catalog">Каталог</Link><Link href="/cart">Корзина</Link><Link href="/orders">Заказы</Link><Link href="/profile">Профиль</Link>{user ? <button onClick={() => { void logout().finally(() => setOpen(false)); }}><LogOut size={17}/> Выйти</button> : <Link href="/login">Войти</Link>}</motion.div>}</AnimatePresence>
</> }
/* eslint-enable @typescript-eslint/no-unused-vars */
export function Header() {
  const { user, loading, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  useEffect(() => { const onScroll = () => setScrolled(window.scrollY > 18); onScroll(); window.addEventListener('scroll', onScroll, { passive: true }); return () => window.removeEventListener('scroll', onScroll); }, []);
  return <>
    <header className={`topbar ${scrolled ? 'is-scrolled' : ''}`}>
      <Link href="/" className="brand"><span className="brand-mark">M</span><span>MARKET<br/><b>KG</b></span></Link>
      <form className="header-search" onSubmit={e => { e.preventDefault(); const value = new FormData(e.currentTarget).get('search'); router.push(`/catalog?search=${encodeURIComponent(String(value ?? ''))}`); }}><Search size={18}/><input name="search" placeholder="Найти товар или SKU" aria-label="Поиск товаров"/><button aria-label="Искать"><ArrowRight size={17}/></button></form>
      <nav className="desktop-nav"><Link className={pathname === '/' ? 'active' : ''} href="/">Главная</Link><Link className={pathname.startsWith('/catalog') ? 'active' : ''} href="/catalog">Каталог</Link><Link className={pathname.startsWith('/orders') ? 'active' : ''} href="/orders">Заказы</Link></nav>
      <Link href="/cart" className="cart-link"><ShoppingBag size={19}/><span>Корзина</span></Link>
      {!loading && !user && <div className="header-auth-actions"><Link href="/login" className="header-login-link">Войти</Link><Link href="/register" className="primary-button header-register-link">Регистрация</Link></div>}
      {user && <div className="header-account"><button className="header-account-button" aria-haspopup="menu" aria-expanded={accountOpen} onClick={() => setAccountOpen(value => !value)}><UserRound size={18}/><span>Профиль</span></button><AnimatePresence>{accountOpen && <motion.div className="account-menu" role="menu" initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }}><Link role="menuitem" href="/profile">Профиль</Link><button role="menuitem" onClick={() => { void logout().finally(() => setAccountOpen(false)); }}><LogOut size={16}/> Выйти</button></motion.div>}</AnimatePresence></div>}
      <button className="menu-button" onClick={() => setOpen(!open)} aria-expanded={open} aria-label="Меню">{open ? <X/> : <Menu/>}</button>
    </header>
    <AnimatePresence>{open && <motion.div className="mobile-menu" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}><Link href="/">Главная</Link><Link href="/catalog">Каталог</Link><Link href="/cart">Корзина</Link><Link href="/orders">Заказы</Link>{user ? <><Link href="/profile">Профиль</Link><button onClick={() => { void logout().finally(() => setOpen(false)); }}><LogOut size={17}/> Выйти</button></> : <><Link href="/login">Войти</Link><Link href="/register" className="primary-button mobile-register-link">Регистрация</Link></>}</motion.div>}</AnimatePresence>
  </>;
}
export function BottomNav() { const pathname = usePathname(); const { user } = useAuth(); if (user?.role !== 'SHOP') return null; return <nav className="bottom-nav" aria-label="Навигация магазина"><Link className={pathname === '/' ? 'selected' : ''} href="/"><Home/><span>Главная</span></Link><Link className={pathname.startsWith('/catalog') ? 'selected' : ''} href="/catalog"><Search/><span>Каталог</span></Link><Link className={pathname.startsWith('/cart') ? 'selected' : ''} href="/cart"><ShoppingBag/><span>Корзина</span></Link><Link className={pathname.startsWith('/orders') ? 'selected' : ''} href="/orders"><Package/><span>Заказы</span></Link><Link className={pathname.startsWith('/profile') ? 'selected' : ''} href="/profile"><UserRound/><span>Профиль</span></Link></nav> }
export function ModernHeader() {
  const { user, loading, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const isShop = user?.role === 'SHOP';
  const workspace = user?.role === 'ADMIN' ? '/admin' : user?.role === 'SUPPLIER' ? '/supplier' : null;
  const roleLabel = user?.role === 'ADMIN' ? 'Администратор' : user?.role === 'SUPPLIER' ? 'Поставщик' : 'Профиль';

  useEffect(() => {
    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        setScrolled((current) => {
          const next = window.scrollY > 12;
          return current === next ? current : next;
        });
        frame = 0;
      });
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => { window.removeEventListener('scroll', onScroll); window.cancelAnimationFrame(frame); };
  }, []);

  const search = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = String(new FormData(event.currentTarget).get('search') ?? '').trim();
    router.push(value ? `/catalog?search=${encodeURIComponent(value)}` : '/catalog');
  };

  return <>
    <header className={`topbar ${scrolled ? 'is-scrolled' : ''}`}>
      <Link href="/" className="brand" aria-label="Market KG — главная">
        <span className="brand-mark">M</span>
        <span className="brand-copy"><strong>MARKET KG</strong><small>оптовый маркетплейс</small></span>
      </Link>
      <form className="header-search" onSubmit={search}>
        <Search size={18}/><input name="search" placeholder="Найти товар, SKU или поставщика" aria-label="Поиск товаров"/><button aria-label="Искать"><ArrowRight size={17}/></button>
      </form>
      <nav className="desktop-nav" aria-label="Основная навигация">
        <Link className={pathname.startsWith('/catalog') ? 'active' : ''} href="/catalog">Каталог</Link>
        <Link href="/#suppliers">Поставщики</Link>
        <Link href="/#how-it-works">Как это работает</Link>
        {isShop && <Link className={pathname.startsWith('/orders') ? 'active' : ''} href="/orders">Заказы</Link>}
      </nav>
      {isShop && <Link href="/cart" className={`cart-link ${pathname.startsWith('/cart') ? 'active' : ''}`}><span className="header-icon"><ShoppingBag size={18}/></span><span>Корзина</span></Link>}
      {workspace && <Link href={workspace} className="workspace-return"><ExternalLink size={16}/> Рабочее пространство</Link>}
      {!loading && !user && <div className="header-auth-actions"><Link href="/login" className="header-login-link">Войти</Link><Link href="/register" className="primary-button header-register-link">Создать аккаунт</Link></div>}
      {user && <div className="header-account">
        <button className="header-account-button" aria-haspopup="menu" aria-expanded={accountOpen} onClick={() => setAccountOpen(value => !value)}><span className="header-avatar"><UserRound size={17}/></span><span>{roleLabel}</span></button>
        <AnimatePresence>{accountOpen && <motion.div className="account-menu" role="menu" initial={{ opacity: 0, y: -6, scale: .98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -4, scale: .98 }}>
          <div className="account-menu-heading"><span className="header-avatar"><UserRound size={17}/></span><span><b>{roleLabel}</b><small>{user.phone}</small></span></div>
          {isShop ? <><Link role="menuitem" href="/profile"><UserRound size={16}/> Профиль</Link><Link role="menuitem" href="/orders"><Package size={16}/> Мои заказы</Link></> : workspace && <Link role="menuitem" href={workspace}><ExternalLink size={16}/> Рабочее пространство</Link>}<button role="menuitem" onClick={() => { void logout().finally(() => setAccountOpen(false)); }}><LogOut size={16}/> Выйти</button>
        </motion.div>}</AnimatePresence>
      </div>}
      <button className="menu-button" onClick={() => setOpen(!open)} aria-expanded={open} aria-label="Меню">{open ? <X/> : <Menu/>}</button>
    </header>
    <AnimatePresence>{open && <motion.div className="mobile-menu" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}><Link href="/catalog">Каталог</Link><Link href="/#suppliers">Поставщики</Link><Link href="/#how-it-works">Как это работает</Link>{isShop && <><Link href="/cart">Корзина</Link><Link href="/orders">Мои заказы</Link><Link href="/profile">Профиль</Link></>}{workspace && <Link href={workspace}>Рабочее пространство</Link>}{user ? <button onClick={() => { void logout().finally(() => setOpen(false)); }}><LogOut size={17}/> Выйти</button> : <><Link href="/login">Войти</Link><Link href="/register" className="primary-button mobile-register-link">Создать аккаунт</Link></>}</motion.div>}</AnimatePresence>
  </>;
}
export function Footer() { return <footer className="market-footer"><div><Link href="/" className="footer-brand">MARKET <b>KG</b></Link><p>Оптовые закупки из Дордоя и Кара-Суу для вашего бизнеса.</p></div><div><b>Покупателям</b><Link href="/catalog">Каталог</Link><Link href="/orders">Заказы</Link></div><div><b>Информация</b><Link href="/#how-it-works">Как это работает</Link><Link href="/#suppliers">Поставщики</Link></div><div><b>Аккаунт</b><Link href="/login">Войти</Link><Link href="/register">Регистрация</Link></div></footer> }
export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname.startsWith('/admin') || pathname.startsWith('/supplier')) return <>{children}</>;
  const content = <><ModernHeader/><main className="page-shell">{children}</main><Footer/><BottomNav/></>;
  const shopOnly = ['/cart', '/checkout', '/orders', '/profile'].some(path => pathname === path || pathname.startsWith(`${path}/`));
  return shopOnly ? <ShopRoute>{content}</ShopRoute> : content;
}
export function ProductCardView({ product }: { product: ProductCard }) { return <div className="product-card-wrap"><Link href={`/catalog/${product.id}`} className="product-card"><div className="product-image">{isUsableProductImage(product.primary_image_url)?<Image src={product.primary_image_url} alt={product.name} width={600} height={600} unoptimized/>:<ProductPlaceholder category="Оптовый товар" sku={product.sku}/>}<span className="market-tag">{marketLabels[product.supplier.market]}</span></div><div className="product-info"><p className="eyebrow">{product.supplier.name}</p><h3>{product.name}</h3><p className="product-price">{money(product.price)} <small>/ {product.unit}</small></p><div className="product-facts"><p className="product-meta">Мин. заказ: <b>{product.minimum_order_quantity} {product.unit}</b></p><p className={product.stock_quantity > 0 ? 'stock in' : 'stock out'}>{product.stock_quantity > 0 ? `В наличии: ${product.stock_quantity}` : 'Нет в наличии'}</p></div></div></Link></div> }
export function ProductHero({ product }: { product: ProductDetail }) { const candidate=product.images[0]?.image_url ?? product.primary_image_url; const image=isUsableProductImage(candidate)?candidate:null; return <motion.div className="product-detail-grid" initial="hidden" animate="visible" variants={{visible:{transition:{staggerChildren:.07}}}}><motion.div className="detail-image" variants={fadeUp}>{image?<Image src={image} alt={product.name} width={800} height={800} unoptimized/>:<ProductPlaceholder category="Оптовый товар" sku={product.sku}/>}</motion.div><motion.div className="detail-copy" variants={fadeUp}><p className="eyebrow">{product.supplier.name} · {marketLabels[product.supplier.market]}</p><h1>{product.name}</h1><p className="sku">Артикул: {product.sku}</p><p className="detail-price">{money(product.price)} <small>/ {product.unit}</small></p><p className="detail-description">{product.description || 'Оптовый товар от поставщика Market KG.'}</p><div className="detail-rules"><div><span>Минимальный заказ</span><b>{product.minimum_order_quantity} {product.unit}</b></div><div><span>На складе</span><b>{product.stock_quantity} {product.unit}</b></div></div></motion.div></motion.div> }
export const statusLabel = (status: string) => statusLabels[status] ?? status;
