'use client';

import Image from 'next/image';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import {
  ApiError, addAdminProductImage, createAdminProduct, deactivateAdminProduct, deleteAdminProductImage,
  getAdminCategories, getAdminProducts, getAdminSuppliers, updateAdminProduct,
  type AdminProduct, type AdminSupplier, type Category,
} from '@/lib/api';
import { friendlyError } from '@/lib/messages';
import { money } from '@/lib/format';
import { isUsableProductImage } from '@/lib/images';
import { ProductPlaceholder } from '@/components/motion-ui';

type CategoryOption = { id: string; label: string };
function flattenCategories(categories: Category[], prefix = ''): CategoryOption[] {
  return categories.flatMap(category => [{ id: category.id, label: `${prefix}${category.name}` }, ...flattenCategories(category.children, `${prefix}— `)]);
}
function errorText(reason: unknown, fallback: string) { return reason instanceof ApiError ? friendlyError(reason) : fallback; }

export function AdminProductsView() {
  const [products, setProducts] = useState<AdminProduct[] | null>(null);
  const [suppliers, setSuppliers] = useState<AdminSupplier[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState('');
  const visible = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('ru');
    return (products ?? []).filter(item => !query || item.name.toLocaleLowerCase('ru').includes(query) || item.sku.toLocaleLowerCase('ru').includes(query) || item.supplier.name.toLocaleLowerCase('ru').includes(query));
  }, [products, search]);

  const load = useCallback(async () => {
    try {
      const [productData, supplierData, categoryData] = await Promise.all([getAdminProducts(), getAdminSuppliers(), getAdminCategories()]);
      setProducts(productData); setSuppliers(supplierData); setCategories(flattenCategories(categoryData.items)); setError('');
    } catch (reason) { setError(errorText(reason, 'Не удалось загрузить управление каталогом.')); }
  }, []);
  useEffect(() => {
    Promise.all([getAdminProducts(), getAdminSuppliers(), getAdminCategories()]).then(([productData, supplierData, categoryData]) => {
      setProducts(productData); setSuppliers(supplierData); setCategories(flattenCategories(categoryData.items)); setError('');
    }).catch(reason => setError(errorText(reason, 'Не удалось загрузить управление каталогом.')));
  }, []);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const read = (name: string) => String(data.get(name) ?? '').trim();
    if (!read('supplier_id') || !read('category_id') || !read('name') || !read('slug') || !read('sku') || !read('price') || !read('unit')) { setError('Заполните обязательные поля нового товара.'); return; }
    const imageUrl = read('image_url');
    setPending('create'); setError('');
    try {
      await createAdminProduct({
        supplier_id: read('supplier_id'), category_id: read('category_id'), name: read('name'), slug: read('slug'), sku: read('sku'),
        description: read('description') || null, price: read('price').replace(',', '.'), minimum_order_quantity: Number(read('minimum_order_quantity')), stock_quantity: Number(read('stock_quantity')), unit: read('unit'),
        images: imageUrl ? [{ image_url: imageUrl, sort_order: 0 }] : [],
      });
      form.reset(); await load();
    } catch (reason) { setError(errorText(reason, 'Не удалось создать товар.')); }
    finally { setPending(''); }
  }

  async function save(product: AdminProduct, form: HTMLFormElement) {
    const data = new FormData(form); const read = (name: string) => String(data.get(name) ?? '').trim();
    setPending(product.id); setError('');
    try {
      const updated = await updateAdminProduct(product.id, {
        category_id: read('category_id'), name: read('name'), slug: read('slug'), sku: read('sku'), description: read('description') || null,
        price: read('price').replace(',', '.'), minimum_order_quantity: Number(read('minimum_order_quantity')), stock_quantity: Number(read('stock_quantity')), unit: read('unit'),
      });
      setProducts(current => current?.map(item => item.id === updated.id ? updated : item) ?? []);
    } catch (reason) { setError(errorText(reason, 'Не удалось сохранить товар.')); }
    finally { setPending(''); }
  }

  async function toggle(product: AdminProduct) {
    if (product.is_active && !window.confirm(`Снять «${product.name}» с продажи?`)) return;
    setPending(product.id); setError('');
    try {
      if (product.is_active) await deactivateAdminProduct(product.id); else await updateAdminProduct(product.id, { is_active: true });
      await load();
    } catch (reason) { setError(errorText(reason, 'Не удалось изменить доступность товара.')); }
    finally { setPending(''); }
  }

  async function addImage(product: AdminProduct, form: HTMLFormElement) {
    const imageUrl = String(new FormData(form).get('image_url') ?? '').trim();
    if (!imageUrl) { setError('Укажите URL изображения.'); return; }
    setPending(`image-${product.id}`); setError('');
    try { await addAdminProductImage(product.id, imageUrl, product.images.length); form.reset(); await load(); }
    catch (reason) { setError(errorText(reason, 'Не удалось добавить изображение.')); }
    finally { setPending(''); }
  }

  async function removeImage(product: AdminProduct, imageId: string) {
    setPending(`image-${product.id}`); setError('');
    try { await deleteAdminProductImage(product.id, imageId); await load(); }
    catch (reason) { setError(errorText(reason, 'Не удалось удалить изображение.')); }
    finally { setPending(''); }
  }

  return <div>
    <div className="workspace-page-heading"><div><p className="eyebrow">Общий ассортимент</p><h1>Товары</h1><p>Создание, цены, остатки, категории и изображения всех поставщиков.</p></div></div>
    <form className="admin-create-panel admin-product-create" onSubmit={create}>
      <div><h2>Новый товар</h2><p>Администратор выбирает поставщика и создаёт карточку от его имени.</p></div>
      <label>Поставщик *<select name="supplier_id"><option value="">Выберите</option>{suppliers.filter(item => item.is_active).map(item => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label>
      <label>Категория *<select name="category_id"><option value="">Выберите</option>{categories.map(item => <option value={item.id} key={item.id}>{item.label}</option>)}</select></label>
      <label>Название *<input name="name" /></label><label>SKU *<input name="sku" /></label><label>Slug *<input name="slug" /></label>
      <label>Цена, сом *<input name="price" inputMode="decimal" /></label><label>MOQ *<input name="minimum_order_quantity" type="number" min="1" defaultValue="1" /></label><label>Остаток *<input name="stock_quantity" type="number" min="0" defaultValue="0" /></label><label>Единица *<input name="unit" defaultValue="шт." /></label>
      <label className="span-two">URL главного изображения<input name="image_url" type="url" placeholder="/images/products/... или https://..." /></label><label className="span-two">Описание<textarea name="description" rows={2} /></label>
      <button className="primary-button" disabled={pending === 'create'}>{pending === 'create' ? 'Создаём...' : 'Создать товар'}</button>
    </form>
    <div className="admin-toolbar"><label>Поиск<input value={search} onChange={event => setSearch(event.target.value)} placeholder="Название, SKU или поставщик" /></label><span>{visible.length} товаров</span></div>
    {error && <div className="inline-error" role="alert">{error}</div>}
    {!products ? <div className="state-box">Загружаем товары...</div> : <div className="admin-management-list">
      {visible.map(product => <article className="admin-management-card admin-product-admin-card" key={product.id}>
        <div className="admin-card-heading"><div className="admin-product-summary"><div className="admin-product-thumb">{isUsableProductImage(product.primary_image_url) ? <Image src={product.primary_image_url} alt={product.name} width={96} height={96} unoptimized /> : <ProductPlaceholder />}</div><div><span className={product.is_active ? 'availability active' : 'availability inactive'}>{product.is_active ? 'В продаже' : 'Неактивен'}</span><h2>{product.name}</h2><p>{product.supplier.name} · {product.sku} · {money(product.price)}</p></div></div><button className={product.is_active ? 'danger-button' : 'secondary-button'} disabled={pending === product.id} onClick={() => void toggle(product)}>{product.is_active ? 'Снять с продажи' : 'Вернуть в продажу'}</button></div>
        <form className="admin-edit-grid" onSubmit={event => { event.preventDefault(); void save(product, event.currentTarget); }}>
          <label>Название<input name="name" defaultValue={product.name} /></label><label>SKU<input name="sku" defaultValue={product.sku} /></label><label>Slug<input name="slug" defaultValue={product.slug} /></label>
          <label>Категория<select name="category_id" defaultValue={product.category.id}>{categories.map(item => <option value={item.id} key={item.id}>{item.label}</option>)}</select></label><label>Цена<input name="price" defaultValue={product.price} /></label><label>MOQ<input name="minimum_order_quantity" type="number" min="1" defaultValue={product.minimum_order_quantity} /></label><label>Остаток<input name="stock_quantity" type="number" min="0" defaultValue={product.stock_quantity} /></label><label>Единица<input name="unit" defaultValue={product.unit} /></label>
          <label className="span-two">Описание<textarea name="description" rows={2} defaultValue={product.description ?? ''} /></label><button className="primary-button" disabled={pending === product.id}>Сохранить изменения</button>
        </form>
        <section className="admin-images"><div><b>Изображения</b><span>{product.images.length}/10</span></div><div className="admin-image-strip">{product.images.map(image => <div key={image.id}><Image src={image.image_url} alt="" width={80} height={80} unoptimized/><button disabled={pending === `image-${product.id}`} onClick={() => void removeImage(product, image.id)}>Удалить</button></div>)}</div>
          <form onSubmit={event => { event.preventDefault(); void addImage(product, event.currentTarget); }}><input name="image_url" type="url" placeholder="URL нового изображения" /><button className="secondary-button" disabled={pending === `image-${product.id}` || product.images.length >= 10}>Добавить изображение</button></form>
        </section>
      </article>)}
    </div>}
  </div>;
}
