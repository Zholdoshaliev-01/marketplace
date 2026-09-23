'use client';

import Link from 'next/link';
import { AlertCircle, ArrowRight, Boxes, PackageCheck } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { getSupplierFulfillments, getSupplierProducts, type SupplierFulfillment, type SupplierProduct } from '@/lib/api';

export function SupplierDashboard() {
  const [data, setData] = useState<{ products: SupplierProduct[]; fulfillments: SupplierFulfillment[] } | null>(null);
  const [error, setError] = useState('');
  const load = useCallback(() => {
    setError('');
    Promise.all([getSupplierProducts(), getSupplierFulfillments()])
      .then(([products, fulfillments]) => setData({ products, fulfillments }))
      .catch(() => setError('Не удалось загрузить рабочую сводку.'));
  }, []);
  useEffect(() => {
    Promise.all([getSupplierProducts(), getSupplierFulfillments()])
      .then(([products, fulfillments]) => setData({ products, fulfillments }))
      .catch(() => setError('Не удалось загрузить рабочую сводку.'));
  }, []);

  if (error) return <div className="state-box"><AlertCircle/><h2>Ошибка загрузки</h2><p>{error}</p><button className="secondary-button" onClick={load}>Повторить</button></div>;
  if (!data) return <div className="dashboard-skeleton" role="status">Загружаем сводку...</div>;
  const pending = data.fulfillments.filter(item => item.status === 'PENDING').length;
  const inWork = data.fulfillments.filter(item => item.status === 'ACCEPTED' || item.status === 'COLLECTING').length;

  return <div className="workspace-dashboard">
    <div className="workspace-page-heading"><div><p className="eyebrow">Поставщик</p><h1>Обзор</h1><p>Товары и выполнение ваших частей заказов.</p></div><Link className="primary-button" href="/supplier/products/new">Добавить товар</Link></div>
    <div className="metric-grid">
      <article><Boxes/><span>Мои товары</span><b>{data.products.length}</b><small>{data.products.filter(item => item.is_active).length} активных</small></article>
      <article><PackageCheck/><span>Требуют обработки</span><b>{pending}</b><small>ожидают подтверждения</small></article>
      <article><PackageCheck/><span>В работе</span><b>{inWork}</b><small>приняты или собираются</small></article>
    </div>
    <div className="workspace-shortcuts"><Link href="/supplier/products"><span><Boxes/><b>Мои товары</b><small>Цена, MOQ, остаток и изображения</small></span><ArrowRight/></Link><Link href="/supplier/orders"><span><PackageCheck/><b>Выполнение заказов</b><small>Только ваши позиции и статусы</small></span><ArrowRight/></Link></div>
  </div>;
}
