'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, getSupplierFulfillment, getSupplierFulfillments, updateSupplierFulfillmentStatus, type FulfillmentStatus, type SupplierFulfillment } from '@/lib/api';
import { fulfillmentStatusLabels, money, paymentLabels, statusLabels } from '@/lib/format';
import { supplierError } from '../errors';

export const FULFILLMENT_CANCEL_WARNING = 'Вы отменяете выполнение своей части заказа. Остаток товара автоматически не восстанавливается.';
const actions: Partial<Record<FulfillmentStatus, { status: FulfillmentStatus; label: string; destructive?: boolean }[]>> = {
  PENDING: [{ status: 'ACCEPTED', label: 'Принять' }, { status: 'CANCELLED', label: 'Отменить', destructive: true }],
  ACCEPTED: [{ status: 'COLLECTING', label: 'Начать сборку' }, { status: 'CANCELLED', label: 'Отменить', destructive: true }],
  COLLECTING: [{ status: 'READY', label: 'Готов к передаче' }],
};

function SupplierItems({ fulfillment }: { fulfillment: SupplierFulfillment }) {
  return <div className="supplier-order-items">{fulfillment.items.map(item => <div key={item.id}><span><b>{item.product_name_snapshot}</b><small>SKU: {item.sku_snapshot}</small><small>{item.quantity} шт. × {money(item.unit_price)}</small></span><strong>{money(item.total_price)}</strong></div>)}</div>;
}

export function SupplierOrdersView({ fulfillmentId }: { fulfillmentId?: string }) {
  const [fulfillments, setFulfillments] = useState<SupplierFulfillment[] | null>(null);
  const [detail, setDetail] = useState<SupplierFulfillment | null>(null);
  const [error, setError] = useState('');
  const [pending, setPending] = useState<FulfillmentStatus | null>(null);
  const submitting = useRef(false);
  const loadDetail = useCallback(async () => {
    if (!fulfillmentId) return;
    setDetail(await getSupplierFulfillment(fulfillmentId));
  }, [fulfillmentId]);

  useEffect(() => {
    let active = true;
    const request = fulfillmentId ? getSupplierFulfillment(fulfillmentId).then(value => { if (active) setDetail(value); }) : getSupplierFulfillments().then(value => { if (active) setFulfillments(value); });
    request.catch(reason => { if (active) setError(reason instanceof ApiError && reason.status === 404 ? 'Выполнение заказа не найдено.' : supplierError(reason, 'Не удалось загрузить заказы.')); });
    return () => { active = false; };
  }, [fulfillmentId]);

  async function transition(target: FulfillmentStatus) {
    if (!detail || submitting.current) return;
    if (target === 'CANCELLED' && !window.confirm(FULFILLMENT_CANCEL_WARNING)) return;
    submitting.current = true;
    setPending(target);
    setError('');
    try { await updateSupplierFulfillmentStatus(detail.fulfillment_id, target); await loadDetail(); }
    catch (reason) {
      setError(reason instanceof ApiError && reason.code === 'INVALID_FULFILLMENT_STATUS_TRANSITION' ? 'Статус уже изменился или переход недоступен. Данные обновлены.' : supplierError(reason, 'Не удалось изменить статус.'));
      try { await loadDetail(); } catch { /* Preserve the actionable transition error. */ }
    } finally { submitting.current = false; setPending(null); }
  }

  if (error && !detail && !fulfillments) return <div className="state-box"><h2>Ошибка загрузки</h2><p>{error}</p></div>;
  if (fulfillmentId && !detail) return <div className="state-box">Загружаем выполнение заказа...</div>;
  if (!fulfillmentId && !fulfillments) return <div className="state-box">Загружаем заказы...</div>;

  if (detail) {
    const available = actions[detail.status] ?? [];
    return <div><div className="page-heading"><div><p className="eyebrow">Заказ {detail.order_number}</p><h1>{fulfillmentStatusLabels[detail.status]}</h1><p className="muted">{new Date(detail.created_at).toLocaleString('ru-RU')}</p></div><Link href="/supplier/orders" className="secondary-button">Все заказы</Link></div>
      {error && <div className="inline-error" role="alert">{error}</div>}
      <section className="supplier-order-detail"><div className="supplier-order-meta"><span>Моё выполнение <b>{fulfillmentStatusLabels[detail.status]}</b></span><span>Статус заказа <b>{statusLabels[detail.order_status]}</b></span><span>Оплата <b>{paymentLabels[detail.payment_type]}</b></span><span>Мои товары <b>{money(detail.supplier_subtotal)}</b></span></div>
        {available.length > 0 && <div className="supplier-fulfillment-actions">{available.map(action => <button key={action.status} className={action.destructive ? 'danger-button' : 'primary-button'} disabled={pending !== null} onClick={() => void transition(action.status)}>{pending === action.status ? 'Сохраняем...' : action.label}</button>)}</div>}
        <h2>Ваши позиции</h2><SupplierItems fulfillment={detail} /><p className="summary-note">Глобальный статус заказа изменяет администратор. Отмена вашей части не восстанавливает остаток и не отменяет другие выполнения.</p></section></div>;
  }

  return <div><div className="page-heading"><div><p className="eyebrow">Выполнение заказов</p><h1>Заказы с моими товарами</h1></div></div>{fulfillments?.length === 0 ? <div className="empty-state"><h2>Заказов пока нет</h2><p>Заказы появятся здесь, когда магазин купит ваши товары.</p></div> : <div className="supplier-orders-list">{fulfillments?.map(fulfillment => <article key={fulfillment.fulfillment_id}><div className="supplier-order-head"><div><Link href={`/supplier/orders/${fulfillment.fulfillment_id}`}><b>{fulfillment.order_number}</b></Link><span>{new Date(fulfillment.created_at).toLocaleString('ru-RU')}</span></div><div><span className={`status status-${fulfillment.status.toLowerCase()}`}>{fulfillmentStatusLabels[fulfillment.status]}</span><small>Заказ: {statusLabels[fulfillment.order_status]}</small><small>{paymentLabels[fulfillment.payment_type]}</small></div></div><SupplierItems fulfillment={fulfillment} /><div className="supplier-order-footer"><b>Мои товары: {money(fulfillment.supplier_subtotal)}</b><Link className="secondary-button" href={`/supplier/orders/${fulfillment.fulfillment_id}`}>Открыть заказ</Link></div></article>)}</div>}</div>;
}
