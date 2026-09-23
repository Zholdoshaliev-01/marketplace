'use client';

import Image from 'next/image';
import Link from 'next/link';
import { FormEvent, useRef, useState } from 'react';
import { deactivateSupplierProduct, updateSupplierProduct, type SupplierProduct } from '@/lib/api';
import { money } from '@/lib/format';
import { supplierError } from '../errors';
import { ProductPlaceholder } from '@/components/motion-ui';
import { isUsableProductImage } from '@/lib/images';

export const DEACTIVATE_WARNING = 'Товар будет скрыт из публичного каталога. Данные товара сохранятся.';

export function SupplierProductCard({ product, onUpdated, onReload }: { product: SupplierProduct; onUpdated: (product: SupplierProduct) => void; onReload: () => Promise<void> }) {
  const [pending, setPending] = useState('');
  const [error, setError] = useState('');
  const submitting = useRef(false);

  async function quickUpdate(event: FormEvent<HTMLFormElement>, field: 'stock_quantity' | 'price') {
    event.preventDefault();
    if (submitting.current) return;
    const raw = String(new FormData(event.currentTarget).get(field) ?? '').trim();
    if (field === 'stock_quantity' && (!/^\d+$/.test(raw) || Number(raw) < 0)) { setError('Остаток должен быть целым числом не меньше 0.'); return; }
    if (field === 'price' && !/^\d+(?:[.,]\d{1,2})?$/.test(raw)) { setError('Цена должна быть неотрицательным числом с максимум двумя знаками после запятой.'); return; }
    submitting.current = true;
    setPending(field);
    setError('');
    try {
      const payload = field === 'stock_quantity' ? { stock_quantity: Number(raw) } : { price: raw.replace(',', '.') };
      onUpdated(await updateSupplierProduct(product.id, payload));
    } catch (reason) { setError(supplierError(reason)); }
    finally { submitting.current = false; setPending(''); }
  }

  async function toggleAvailability() {
    if (submitting.current) return;
    if (product.is_active && !window.confirm(DEACTIVATE_WARNING)) return;
    submitting.current = true;
    setPending('active');
    setError('');
    try {
      if (product.is_active) { await deactivateSupplierProduct(product.id); await onReload(); }
      else onUpdated(await updateSupplierProduct(product.id, { is_active: true }));
    } catch (reason) { setError(supplierError(reason)); }
    finally { submitting.current = false; setPending(''); }
  }

  return <article className="supplier-product-card">
    <div className="supplier-product-image">{isUsableProductImage(product.primary_image_url) ? <Image src={product.primary_image_url} alt={product.name} width={160} height={160} unoptimized /> : <ProductPlaceholder />}</div>
    <div className="supplier-product-main"><div className="supplier-product-title"><div><span className={product.is_active ? 'availability active' : 'availability inactive'}>{product.is_active ? 'В продаже' : 'Неактивен'}</span><h2>{product.name}</h2><p>SKU: {product.sku} · {product.category.name}</p></div><Link className="secondary-button" href={`/supplier/products/${product.id}`}>Редактировать</Link></div>
      <div className="supplier-product-facts"><span>Цена <b>{money(product.price)}</b></span><span>Остаток <b>{product.stock_quantity} {product.unit}</b></span><span>Мин. заказ <b>{product.minimum_order_quantity} {product.unit}</b></span></div>
      <div className="supplier-quick-actions">
        <form key={`stock-${product.stock_quantity}`} onSubmit={event => void quickUpdate(event, 'stock_quantity')}><label>Быстрый остаток<input aria-label={`Остаток ${product.name}`} name="stock_quantity" type="number" min="0" defaultValue={product.stock_quantity} /></label><button className="primary-button" disabled={pending !== ''}>{pending === 'stock_quantity' ? 'Сохраняем...' : 'Сохранить'}</button></form>
        <form key={`price-${product.price}`} onSubmit={event => void quickUpdate(event, 'price')}><label>Цена, сом<input aria-label={`Цена ${product.name}`} name="price" inputMode="decimal" defaultValue={product.price} /></label><button className="primary-button" disabled={pending !== ''}>{pending === 'price' ? 'Сохраняем...' : 'Сохранить'}</button></form>
        <button className={product.is_active ? 'danger-button' : 'secondary-button'} disabled={pending !== ''} onClick={() => void toggleAvailability()}>{pending === 'active' ? 'Сохраняем...' : product.is_active ? 'Снять с продажи' : 'Вернуть в продажу'}</button>
      </div>
      {error && <div className="inline-error" role="alert">{error}</div>}
    </div>
  </article>;
}
