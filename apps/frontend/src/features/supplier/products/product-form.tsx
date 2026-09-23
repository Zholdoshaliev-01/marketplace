'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { createSupplierProduct, getSupplierCategories, getSupplierProducts, updateSupplierProduct, type Category, type SupplierProduct, type SupplierProductInput } from '@/lib/api';
import { supplierError } from '../errors';
import { ProductImageManager } from './image-manager';

interface CategoryOption { id: string; label: string }
function flattenCategories(categories: Category[], prefix = ''): CategoryOption[] {
  return categories.flatMap(category => [{ id: category.id, label: `${prefix}${category.name}` }, ...flattenCategories(category.children, `${prefix}— `)]);
}

function validate(data: Record<string, string>) {
  if (!data.name || !data.slug || !data.sku || !data.category_id || !data.unit) return 'Заполните обязательные поля.';
  if (!/^\d+(?:[.,]\d{1,2})?$/.test(data.price)) return 'Цена должна быть неотрицательной и иметь максимум два знака после запятой.';
  if (!/^\d+$/.test(data.minimum_order_quantity) || Number(data.minimum_order_quantity) < 1) return 'Минимальный заказ должен быть не меньше 1.';
  if (!/^\d+$/.test(data.stock_quantity) || Number(data.stock_quantity) < 0) return 'Остаток должен быть не меньше 0.';
  return '';
}

export function SupplierProductForm({ productId }: { productId?: string }) {
  const router = useRouter();
  const [categories, setCategories] = useState<CategoryOption[] | null>(null);
  const [product, setProduct] = useState<SupplierProduct | null>(null);
  const [loadedProduct, setLoadedProduct] = useState(!productId);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const submitting = useRef(false);

  const reloadProduct = useCallback(async () => {
    if (!productId) return;
    const found = (await getSupplierProducts()).find(item => item.id === productId);
    if (!found) throw new Error('PRODUCT_NOT_FOUND');
    setProduct(found);
  }, [productId]);

  useEffect(() => {
    let active = true;
    getSupplierCategories().then(data => { if (active) setCategories(flattenCategories(data.items)); }).catch(reason => { if (active) setError(supplierError(reason, 'Не удалось загрузить категории.')); });
    if (productId) getSupplierProducts().then(products => {
      if (!active) return;
      setProduct(products.find(item => item.id === productId) ?? null);
    }).catch(reason => { if (active) setError(supplierError(reason, 'Не удалось загрузить товар.')); }).finally(() => { if (active) setLoadedProduct(true); });
    return () => { active = false; };
  }, [productId]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    const raw = Object.fromEntries([...new FormData(event.currentTarget).entries()].map(([key, value]) => [key, String(value).trim()])) as Record<string, string>;
    const validationError = validate(raw);
    if (validationError) { setError(validationError); return; }
    const imageUrls = raw.image_urls?.split('\n').map(value => value.trim()).filter(Boolean) ?? [];
    if (imageUrls.length > 10) { setError('Можно добавить не более 10 изображений.'); return; }
    const payload: SupplierProductInput = {
      category_id: raw.category_id, name: raw.name, slug: raw.slug, description: raw.description || null, sku: raw.sku,
      price: raw.price.replace(',', '.'), minimum_order_quantity: Number(raw.minimum_order_quantity), stock_quantity: Number(raw.stock_quantity), unit: raw.unit,
      ...(productId ? {} : { images: imageUrls.map((image_url, sort_order) => ({ image_url, sort_order })) }),
    };
    submitting.current = true;
    setPending(true);
    setError('');
    try {
      if (productId) setProduct(await updateSupplierProduct(productId, payload));
      else { const created = await createSupplierProduct(payload); router.push(`/supplier/products/${created.id}`); }
    } catch (reason) { setError(supplierError(reason, 'Не удалось сохранить товар.')); }
    finally { submitting.current = false; setPending(false); }
  }

  if (!categories || !loadedProduct) return error ? <div className="state-box"><h2>Ошибка загрузки</h2><p>{error}</p></div> : <div className="state-box">Загружаем форму товара...</div>;
  if (productId && !product) return <div className="state-box"><h2>Товар не найден</h2><p>Он не существует или принадлежит другому поставщику.</p><Link className="secondary-button" href="/supplier/products">К товарам</Link></div>;

  return <div><div className="page-heading"><div><p className="eyebrow">{productId ? 'Редактирование' : 'Новый товар'}</p><h1>{product?.name ?? 'Создать товар'}</h1></div><Link href="/supplier/products" className="secondary-button">К товарам</Link></div>
    <form key={product?.updated_at ?? 'new'} className="supplier-product-form" onSubmit={submit} noValidate>
      <div className="form-grid"><label>Название *<input name="name" defaultValue={product?.name ?? ''} /></label><label>SKU *<input name="sku" defaultValue={product?.sku ?? ''} /></label><label>Slug *<input name="slug" defaultValue={product?.slug ?? ''} /></label><label>Категория *<select name="category_id" defaultValue={product?.category.id ?? ''}><option value="">Выберите категорию</option>{categories.map(category => <option key={category.id} value={category.id}>{category.label}</option>)}</select></label><label>Цена, сом *<input name="price" inputMode="decimal" defaultValue={product?.price ?? ''} /></label><label>Единица *<input name="unit" defaultValue={product?.unit ?? 'шт'} /></label><label>Минимальный заказ *<input name="minimum_order_quantity" type="number" min="1" defaultValue={product?.minimum_order_quantity ?? 1} /></label><label>Остаток *<input name="stock_quantity" type="number" min="0" defaultValue={product?.stock_quantity ?? 0} /></label><label className="span-two">Описание<textarea name="description" rows={5} defaultValue={product?.description ?? ''} /></label>{!productId && <label className="span-two">URL изображений, по одному на строку<textarea name="image_urls" rows={4} placeholder="https://example.com/image.jpg" /></label>}</div>
      {error && <div className="inline-error" role="alert">{error}</div>}<button className="primary-button" disabled={pending}>{pending ? 'Сохраняем...' : productId ? 'Сохранить изменения' : 'Создать товар'}</button>
    </form>
    {product && <ProductImageManager product={product} reload={async () => { try { await reloadProduct(); } catch (reason) { setError(supplierError(reason, 'Не удалось обновить товар.')); } }} />}
  </div>;
}
