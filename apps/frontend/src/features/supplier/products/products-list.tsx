'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { getSupplierProducts, type SupplierProduct } from '@/lib/api';
import { supplierError } from '../errors';
import { SupplierProductCard } from './product-card';

export function SupplierProductsList() {
  const [request, setRequest] = useState<{ products: SupplierProduct[] | null; error: string }>({ products: null, error: '' });
  const [search, setSearch] = useState('');
  const load = useCallback(async () => {
    try { setRequest({ products: await getSupplierProducts(), error: '' }); }
    catch (reason) { setRequest({ products: null, error: supplierError(reason, 'Не удалось загрузить товары.') }); }
  }, []);
  useEffect(() => { getSupplierProducts().then(products => setRequest({ products, error: '' })).catch(reason => setRequest({ products: null, error: supplierError(reason, 'Не удалось загрузить товары.') })); }, []);
  const visible = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase('ru');
    return request.products?.filter(product => !needle || product.name.toLocaleLowerCase('ru').includes(needle) || product.sku.toLocaleLowerCase('ru').includes(needle)) ?? [];
  }, [request.products, search]);
  const updateOne = (updated: SupplierProduct) => setRequest(current => ({ ...current, products: current.products?.map(product => product.id === updated.id ? updated : product) ?? [] }));

  return <div><div className="page-heading"><div><p className="eyebrow">Управление ассортиментом</p><h1>Мои товары</h1></div><Link href="/supplier/products/new" className="primary-button">Добавить товар</Link></div>
    {request.products && request.products.length > 0 && <label className="supplier-search">Поиск по товарам<input value={search} onChange={event => setSearch(event.target.value)} placeholder="Название или SKU" /></label>}
    {!request.products && !request.error ? <div className="state-box">Загружаем товары...</div> : request.error ? <div className="state-box"><h2>Ошибка загрузки</h2><p>{request.error}</p></div> : request.products?.length === 0 ? <div className="empty-state"><h2>Товаров пока нет</h2><p>Создайте первый товар для своего каталога.</p><Link href="/supplier/products/new" className="primary-button">Создать товар</Link></div> : visible.length === 0 ? <div className="empty-state"><h2>Ничего не найдено</h2><p>Измените локальный поиск.</p></div> : <div className="supplier-products-list">{visible.map(product => <SupplierProductCard key={product.id} product={product} onUpdated={updateOne} onReload={load} />)}</div>}
  </div>;
}
