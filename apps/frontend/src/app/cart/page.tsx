'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Minus, Plus, ShoppingBag, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ApiError, Cart, get, patch, remove } from '@/lib/api';
import { friendlyError } from '@/lib/messages';
import { money } from '@/lib/format';
import { ProductPlaceholder } from '@/components/motion-ui';
import { isUsableProductImage } from '@/lib/images';

export default function CartPage() {
  const [cart, setCart] = useState<Cart | null>(null);
  const [error, setError] = useState('');
  const [updating, setUpdating] = useState('');
  const load = () => get<Cart>('/cart').then(setCart).catch(() => setError('Войдите, чтобы открыть корзину.'));
  useEffect(() => { void load(); }, []);

  const update = async (id: string, quantity: number) => {
    setUpdating(id);
    try { setCart(await patch<Cart>(`/cart/items/${id}`, { quantity })); }
    catch (reason) { setError(friendlyError(reason as ApiError)); void load(); }
    finally { setUpdating(''); }
  };

  const del = async (id: string) => {
    setUpdating(id);
    try {
      await remove(`/cart/items/${id}`);
      setCart((current) => current ? { ...current, items: current.items.filter((item) => item.id !== id) } : current);
      await load();
    } catch (reason) { setError(friendlyError(reason as ApiError)); }
    finally { setUpdating(''); }
  };

  if (!cart) return <div className="state-box">{error || 'Загружаем корзину...'}</div>;

  return <div>
    <div className="page-heading"><div><p className="eyebrow">Закупка</p><h1>Корзина</h1></div></div>
    {cart.items.length === 0 ? <div className="empty-state"><ShoppingBag /><h2>Корзина пуста</h2><p>Добавьте товары из каталога, чтобы собрать заказ.</p><Link href="/catalog" className="primary-button">Перейти в каталог</Link></div> : <div className="cart-layout">
      <div className="cart-items"><AnimatePresence initial={false}>{cart.items.map((item) => <motion.div className={`cart-row ${updating === item.id ? 'is-updating' : ''}`} key={item.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -12 }}>
        {isUsableProductImage(item.product.primary_image_url) ? <Image src={item.product.primary_image_url} alt={item.product.name} width={160} height={160} unoptimized /> : <div className="cart-placeholder"><ProductPlaceholder /></div>}
        <div className="cart-row-copy"><p className="eyebrow">{item.product.sku}</p><h3>{item.product.name}</h3><p>{money(item.product.price)} / {item.product.unit}</p><div className="quantity compact"><button disabled={updating === item.id} aria-label={`Уменьшить количество ${item.product.name}`} onClick={() => update(item.id, Math.max(item.product.minimum_order_quantity, item.quantity - 1))}><Minus size={15} /></button><motion.b key={item.quantity} initial={{ opacity: .4, y: 3 }} animate={{ opacity: 1, y: 0 }}>{item.quantity}</motion.b><button disabled={updating === item.id} aria-label={`Увеличить количество ${item.product.name}`} onClick={() => update(item.id, Math.min(item.product.stock_quantity, item.quantity + 1))}><Plus size={15} /></button></div></div>
        <div className="cart-row-total"><motion.b key={item.line_total} initial={{ opacity: .4 }} animate={{ opacity: 1 }}>{money(item.line_total)}</motion.b><button disabled={updating === item.id} aria-label={`Удалить ${item.product.name}`} onClick={() => void del(item.id)}><Trash2 size={17} /></button></div>
      </motion.div>)}</AnimatePresence></div>
      <aside className="summary"><p className="eyebrow">Итого сейчас</p><div><span>Товары</span><motion.b key={cart.subtotal} initial={{ opacity: .45, y: 2 }} animate={{ opacity: 1, y: 0 }}>{money(cart.subtotal)}</motion.b></div><p className="summary-note">Итоговая цена и наличие будут повторно проверены при оформлении.</p><Link href="/checkout" className="primary-button full">Перейти к оформлению</Link></aside>
    </div>}
    {error && <div className="inline-error" role="alert">{error}</div>}
  </div>;
}
