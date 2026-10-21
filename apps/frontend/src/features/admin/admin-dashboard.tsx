'use client';

import Link from 'next/link';
import { AlertTriangle, ArrowRight, Boxes, ClipboardList, PackageCheck, Store, Tags } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { getAdminOrders, type Order, type OrderListResponse } from '@/lib/api';

type DashboardData = { all: OrderListResponse; fresh: OrderListResponse; processing: OrderListResponse };

export function AdminDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState('');
  const load = useCallback(() => {
    setError('');
    Promise.all([
      getAdminOrders({ page: 1, page_size: 5 }),
      getAdminOrders({ status: 'NEW', page: 1, page_size: 1 }),
      getAdminOrders({ status: 'COLLECTING', page: 1, page_size: 1 }),
    ]).then(([all, fresh, processing]) => setData({ all, fresh, processing })).catch(() => setError('Не удалось загрузить операционную сводку.'));
  }, []);
  useEffect(() => {
    Promise.all([
      getAdminOrders({ page: 1, page_size: 5 }),
      getAdminOrders({ status: 'NEW', page: 1, page_size: 1 }),
      getAdminOrders({ status: 'COLLECTING', page: 1, page_size: 1 }),
    ]).then(([all, fresh, processing]) => setData({ all, fresh, processing })).catch(() => setError('Не удалось загрузить операционную сводку.'));
  }, []);

  if (error) return <div className="state-box"><AlertTriangle/><h2>Ошибка загрузки</h2><p>{error}</p><button className="secondary-button" onClick={load}>Повторить</button></div>;
  if (!data) return <div className="dashboard-skeleton" role="status">Загружаем сводку...</div>;

  return <div className="workspace-dashboard">
    <div className="workspace-page-heading"><div><p className="eyebrow">Администрирование</p><h1>Обзор</h1><p>Операционное состояние заказов маркетплейса.</p></div><Link className="primary-button" href="/admin/orders">Все заказы</Link></div>
    <div className="metric-grid">
      <article><ClipboardList/><span>Все заказы</span><b>{data.all.total_items}</b><small>в системе</small></article>
      <article><AlertTriangle/><span>Новые</span><b>{data.fresh.total_items}</b><small>требуют решения</small></article>
      <article><PackageCheck/><span>На сборке</span><b>{data.processing.total_items}</b><small>глобальный статус</small></article>
    </div>
    <div className="workspace-shortcuts admin-dashboard-shortcuts">
      <Link href="/admin/products"><span><Boxes/><b>Товары</b><small>Карточки, цены, остатки и изображения</small></span><ArrowRight/></Link>
      <Link href="/admin/suppliers"><span><Store/><b>Поставщики</b><small>Профили, рынки и активность</small></span><ArrowRight/></Link>
      <Link href="/admin/categories"><span><Tags/><b>Категории</b><small>Структура публичного каталога</small></span><ArrowRight/></Link>
    </div>
    <section className="dashboard-recent"><div><h2>Последние заказы</h2><Link href="/admin/orders">Открыть список <ArrowRight size={16}/></Link></div>{data.all.items.length ? data.all.items.map((order: Order) => <Link key={order.id} href={`/admin/orders/${order.id}`}><b>{order.order_number}</b><span>{new Date(order.created_at).toLocaleString('ru-RU')}</span><strong>{order.status}</strong></Link>) : <p>Заказов пока нет.</p>}</section>
  </div>;
}
