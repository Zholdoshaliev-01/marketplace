'use client';

import Image from 'next/image';
import { FormEvent, useRef, useState } from 'react';
import { addSupplierProductImage, deleteSupplierProductImage, updateSupplierProductImage, type SupplierProduct } from '@/lib/api';
import { supplierError } from '../errors';

export function ProductImageManager({ product, reload }: { product: SupplierProduct; reload: () => Promise<void> }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const submitting = useRef(false);

  async function run(operation: () => Promise<unknown>) {
    if (submitting.current) return;
    submitting.current = true;
    setPending(true);
    setError('');
    try { await operation(); await reload(); }
    catch (reason) { setError(supplierError(reason, 'Не удалось обновить изображения.')); }
    finally { submitting.current = false; setPending(false); }
  }

  function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const imageUrl = String(new FormData(form).get('image_url') ?? '').trim();
    if (!imageUrl) { setError('Укажите URL изображения.'); return; }
    void run(async () => { await addSupplierProductImage(product.id, { image_url: imageUrl, sort_order: product.images.length }); form.reset(); });
  }

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= product.images.length) return;
    const reordered = [...product.images];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    void run(() => Promise.all(reordered.map((image, sortOrder) => updateSupplierProductImage(product.id, image.id, sortOrder))));
  }

  return <section className="supplier-images"><div className="section-heading"><div><p className="eyebrow">URL-based workflow</p><h2>Изображения</h2></div><span className="muted">{product.images.length}/10</span></div>
    <form className="supplier-image-add" onSubmit={add}><label>URL изображения<input name="image_url" type="url" placeholder="https://…" /></label><button className="primary-button" disabled={pending || product.images.length >= 10}>Добавить URL</button></form>
    {product.images.length === 0 ? <p className="muted">Изображений пока нет.</p> : <div className="supplier-image-list">{product.images.map((image, index) => <div key={image.id}><Image src={image.image_url} alt="" width={110} height={110} unoptimized /><span>{index === 0 ? 'Главное' : `№ ${index + 1}`}</span><div><button aria-label={`Выше ${index + 1}`} disabled={pending || index === 0} onClick={() => move(index, -1)}>↑</button><button aria-label={`Ниже ${index + 1}`} disabled={pending || index === product.images.length - 1} onClick={() => move(index, 1)}>↓</button><button aria-label={`Удалить изображение ${index + 1}`} disabled={pending} onClick={() => void run(() => deleteSupplierProductImage(product.id, image.id))}>Удалить</button></div></div>)}</div>}
    {error && <div className="inline-error" role="alert">{error}</div>}
  </section>;
}
