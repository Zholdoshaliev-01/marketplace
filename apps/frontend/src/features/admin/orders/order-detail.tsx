'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, getAdminOrder, updateAdminOrderStatus, type AdminOrder, type OrderStatus } from '@/lib/api';
import { fulfillmentStatusLabels, money, paymentLabels, statusLabels } from '@/lib/format';
import { CANCELLATION_WARNING, statusActions } from './types';

export function AdminOrderDetail({ id }: { id: string }) {
  const [order, setOrder] = useState<AdminOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState('');
  const [pending, setPending] = useState<OrderStatus | null>(null);
  const submitting = useRef(false);

  const load = useCallback(async () => {
    try {
      const data = await getAdminOrder(id);
      setOrder(data);
      setNotFound(false);
    } catch (reason) {
      if (reason instanceof ApiError && reason.status === 404) setNotFound(true);
      else setError(reason instanceof ApiError && reason.status === 403 ? 'Доступ к заказу запрещён.' : 'Не удалось загрузить заказ.');
    } finally { setLoading(false); }
  }, [id]);

  useEffect(() => {
    let active = true;
    getAdminOrder(id).then(data => {
      if (!active) return;
      setOrder(data);
      setNotFound(false);
    }).catch(reason => {
      if (!active) return;
      if (reason instanceof ApiError && reason.status === 404) setNotFound(true);
      else setError(reason instanceof ApiError && reason.status === 403 ? 'Доступ к заказу запрещён.' : 'Не удалось загрузить заказ.');
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id]);

  async function transition(target: OrderStatus) {
    if (submitting.current) return;
    if (target === 'CANCELLED' && !window.confirm(CANCELLATION_WARNING)) return;
    submitting.current = true;
    setPending(target);
    setError('');
    try {
      await updateAdminOrderStatus(id, target);
      await load();
    } catch (reason) {
      setError(reason instanceof ApiError && reason.code === 'INVALID_ORDER_STATUS_TRANSITION'
        ? 'Статус заказа уже изменился или переход недоступен. Данные заказа обновлены.'
        : 'Не удалось изменить статус заказа.');
      await load();
    } finally {
      submitting.current = false;
      setPending(null);
    }
  }

  if (loading) return <div className="state-box">Загружаем заказ...</div>;
  if (notFound) return <div className="state-box"><h2>Заказ не найден</h2><Link className="secondary-button" href="/admin/orders">К списку заказов</Link></div>;
  if (!order) return <div className="state-box"><h2>Ошибка загрузки</h2><p>{error}</p></div>;
  const actions = statusActions[order.status] ?? [];
  const fulfillments = order.fulfillments ?? [];

  return <div>
    <div className="page-heading"><div><p className="eyebrow">Заказ {order.order_number}</p><h1>{statusLabels[order.status]}</h1><p className="muted">{new Date(order.created_at).toLocaleString('ru-RU')}</p></div><Link href="/admin/orders" className="secondary-button">Все заказы</Link></div>
    {error && <div className="inline-error" role="alert">{error}</div>}
    {fulfillments.some(item => item.status === 'CANCELLED') && <div className="admin-fulfillment-warning" role="alert">Один из поставщиков отменил выполнение. Требуется решение администратора.</div>}
    <div className="admin-order-actions">
      <div><span>Текущий статус</span><b>{statusLabels[order.status]}</b></div>
      {actions.length ? <div className="admin-action-buttons">{actions.map(action => <button key={action.status} disabled={pending !== null} className={action.destructive ? 'danger-button' : 'primary-button'} onClick={() => void transition(action.status)}>{pending === action.status ? 'Сохраняем...' : action.label}</button>)}</div> : <p className="muted">Заказ в терминальном статусе. Доступных переходов нет.</p>}
    </div>
    <div className="detail-layout admin-detail-layout">
      <section className="order-items"><h2>Товары</h2>{order.items.map(item => <div className="order-item" key={item.id}><div><b>{item.product_name_snapshot}</b><span>SKU: {item.sku_snapshot}</span><span>{item.quantity} шт. × {money(item.unit_price)}</span></div><strong>{money(item.total_price)}</strong></div>)}</section>
      <aside className="summary"><p className="eyebrow">Заказ и доставка</p><div><span>Оплата</span><b>{paymentLabels[order.payment_type]}</b></div><div><span>Город</span><b>{order.city}</b></div><div><span>Адрес</span><b>{order.address}</b></div><div><span>Телефон</span><b>{order.phone}</b></div>{order.comment && <div><span>Комментарий</span><b>{order.comment}</b></div>}<div><span>Товары</span><b>{money(order.subtotal)}</b></div><div><span>Доставка</span><b>{money(order.delivery_price)}</b></div><div className="summary-total"><span>Итого</span><b>{money(order.total)}</b></div></aside>
    </div>
    <section className="admin-fulfillments"><div className="section-heading"><div><p className="eyebrow">Операционное выполнение</p><h2>Поставщики</h2></div></div>{fulfillments.length === 0 ? <p className="muted">Выполнения поставщиков отсутствуют.</p> : <div>{fulfillments.map(fulfillment => <article key={fulfillment.fulfillment_id}><div><b>{fulfillment.supplier_name}</b><span>{fulfillment.item_count} поз. · {money(fulfillment.supplier_subtotal)}</span></div><span className={`status status-${fulfillment.status.toLowerCase()}`}>{fulfillmentStatusLabels[fulfillment.status]}</span></article>)}</div>}</section>
  </div>;
}
