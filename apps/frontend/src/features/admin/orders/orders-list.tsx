'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ApiError, getAdminOrders, type Order, type OrderListResponse, type OrderStatus, type PaymentType } from '@/lib/api';
import { money, paymentLabels, statusLabels } from '@/lib/format';

const statuses: OrderStatus[] = ['NEW', 'CONFIRMED', 'COLLECTING', 'READY_FOR_DELIVERY', 'IN_DELIVERY', 'DELIVERED', 'CANCELLED'];
const payments: PaymentType[] = ['CASH', 'BANK_TRANSFER', 'INSTALLMENT_REQUEST'];

export function AdminOrdersList() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const page = Math.max(1, Number(searchParams.get('page')) || 1);
  const status = (searchParams.get('status') || undefined) as OrderStatus | undefined;
  const dateFrom = searchParams.get('date_from') || undefined;
  const dateTo = searchParams.get('date_to') || undefined;
  const paymentType = (searchParams.get('payment_type') || undefined) as PaymentType | undefined;
  const filters = useMemo(() => ({
    status,
    date_from: dateFrom,
    date_to: dateTo,
    payment_type: paymentType,
    page,
    page_size: 20,
  }), [status, dateFrom, dateTo, paymentType, page]);
  const requestKey = `${status ?? ''}|${dateFrom ?? ''}|${dateTo ?? ''}|${paymentType ?? ''}|${page}`;
  const [request, setRequest] = useState<{ key: string; result: OrderListResponse | null; error: string }>({ key: '', result: null, error: '' });
  const loading = request.key !== requestKey;
  const { result, error } = request;

  useEffect(() => {
    let active = true;
    getAdminOrders(filters).then(data => { if (active) setRequest({ key: requestKey, result: data, error: '' }); }).catch(reason => {
      if (!active) return;
      setRequest({ key: requestKey, result: null, error: reason instanceof ApiError && reason.status === 403 ? 'Доступ к заказам запрещён.' : 'Не удалось загрузить заказы. Попробуйте ещё раз.' });
    });
    return () => { active = false; };
  }, [filters, requestKey]);

  function navigate(next: URLSearchParams) {
    const query = next.toString();
    router.push(query ? `/admin/orders?${query}` : '/admin/orders');
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const next = new URLSearchParams();
    for (const key of ['status', 'date_from', 'date_to', 'payment_type']) {
      const value = String(form.get(key) ?? '');
      if (value) next.set(key, value);
    }
    next.set('page', '1');
    navigate(next);
  }

  function changePage(nextPage: number) {
    const next = new URLSearchParams(searchParams.toString());
    next.set('page', String(nextPage));
    navigate(next);
  }

  return <div>
    <div className="page-heading"><div><p className="eyebrow">Операционная обработка</p><h1>Заказы</h1></div></div>
    <form key={requestKey} className="admin-filters" onSubmit={submit}>
      <label>Статус<select name="status" defaultValue={filters.status ?? ''}><option value="">Все</option>{statuses.map(value => <option key={value} value={value}>{statusLabels[value]}</option>)}</select></label>
      <label>С даты<input aria-label="С даты" name="date_from" type="date" defaultValue={filters.date_from ?? ''} /></label>
      <label>По дату<input aria-label="По дату" name="date_to" type="date" defaultValue={filters.date_to ?? ''} /></label>
      <label>Оплата<select name="payment_type" defaultValue={filters.payment_type ?? ''}><option value="">Любая</option>{payments.map(value => <option key={value} value={value}>{paymentLabels[value]}</option>)}</select></label>
      <button className="primary-button" type="submit">Применить</button>
      <button className="secondary-button" type="button" onClick={() => navigate(new URLSearchParams())}>Сбросить</button>
    </form>
    {loading ? <div className="state-box">Загружаем заказы...</div> : error ? <div className="state-box"><h2>Ошибка загрузки</h2><p>{error}</p></div> : !result?.items.length ? <div className="empty-state"><h2>Заказы не найдены</h2><p>Измените фильтры или дождитесь новых заказов.</p></div> : <>
      <div className="admin-table-wrap"><table className="admin-orders-table"><thead><tr><th>Заказ</th><th>Создан</th><th>Статус</th><th>Клиент</th><th>Город</th><th>Оплата</th><th>Товары</th><th>Доставка</th><th>Итого</th></tr></thead><tbody>{result.items.map((order: Order) => <tr key={order.id}><td data-label="Заказ"><Link href={`/admin/orders/${order.id}`}><b>{order.order_number}</b></Link></td><td data-label="Создан">{new Date(order.created_at).toLocaleString('ru-RU')}</td><td data-label="Статус"><span className={`status status-${order.status.toLowerCase()}`}>{statusLabels[order.status]}</span></td><td data-label="Клиент">{order.phone}</td><td data-label="Город">{order.city}</td><td data-label="Оплата">{paymentLabels[order.payment_type]}</td><td data-label="Товары">{money(order.subtotal)}</td><td data-label="Доставка">{money(order.delivery_price)}</td><td data-label="Итого"><b>{money(order.total)}</b></td></tr>)}</tbody></table></div>
      <div className="pagination"><button disabled={page <= 1} onClick={() => changePage(page - 1)}>Назад</button><span>Страница {result.page} из {Math.max(1, result.total_pages)}</span><button disabled={page >= result.total_pages} onClick={() => changePage(page + 1)}>Вперёд</button></div>
    </>}
  </div>;
}
