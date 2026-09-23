'use client';
import Link from 'next/link';
import { Suspense, useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { Order, get } from '@/lib/api';
import { money, statusLabels } from '@/lib/format';
import { ProtectedRoute } from '@/features/auth/protected-route';
import { Check } from 'lucide-react';
import { motion } from 'motion/react';

const orderSteps = ['NEW', 'CONFIRMED', 'COLLECTING', 'READY_FOR_DELIVERY', 'IN_DELIVERY', 'DELIVERED'];

function OrderDetailContent() {
  const { id } = useParams<{ id: string }>();
  const created = useSearchParams().get('created');
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    get<Order>(`/orders/${id}`).then(setOrder).catch(() => setError('Заказ не найден.'));
  }, [id]);

  if (error) return <div className="state-box">{error}</div>;
  if (!order) return <div className="state-box">Загружаем заказ...</div>;

  return (
    <div>
      {created && (
        <motion.div className="success-banner" initial={{opacity:0,y:8}} animate={{opacity:1,y:0}}>
          <motion.i initial={{scale:.5,opacity:0}} animate={{scale:1,opacity:1}}><Check/></motion.i><div><span>Заказ оформлен</span><b>{order.order_number}</b><small>Сохраните номер для связи с магазином</small></div>
        </motion.div>
      )}
      <div className="page-heading">
        <div>
          <p className="eyebrow">Заказ {order.order_number}</p>
          <h1>{statusLabels[order.status]}</h1>
          <p className="muted">{new Date(order.created_at).toLocaleString('ru-RU')}</p>
        </div>
        <Link href="/orders" className="secondary-button">Все заказы</Link>
      </div>
      {order.status !== 'CANCELLED' && <div className="order-timeline" aria-label="Статус заказа">{orderSteps.map((step,index)=>{const current=orderSteps.indexOf(order.status);return <div className={index<current?'complete':index===current?'current':''} key={step}><i>{index<current?<Check/>:index+1}</i><span>{statusLabels[step]}</span></div>})}</div>}
      <div className="detail-layout">
        <section className="order-items">
          <h2>Товары</h2>
          {order.items.map((item) => (
            <div className="order-item" key={item.id}>
              <div>
                <b>{item.product_name_snapshot}</b>
                <span>SKU: {item.sku_snapshot}</span>
                <span>{item.quantity} шт. × {money(item.unit_price)}</span>
              </div>
              <strong>{money(item.total_price)}</strong>
            </div>
          ))}
        </section>
        <aside className="summary">
          <p className="eyebrow">Детали</p>
          <div><span>Оплата</span><b>{order.payment_type === 'CASH' ? 'Наличными' : order.payment_type === 'BANK_TRANSFER' ? 'Перевод' : 'Запрос рассрочки'}</b></div>
          <div><span>Доставка</span><b>{order.city}, {order.address}</b></div>
          <div><span>Товары</span><b>{money(order.subtotal)}</b></div>
          <div><span>Доставка</span><b>{money(order.delivery_price)}</b></div>
          <div className="summary-total"><span>Итого</span><b>{money(order.total)}</b></div>
        </aside>
      </div>
    </div>
  );
}

export default function OrderDetail() {
  return (
    <ProtectedRoute>
      <Suspense fallback={<div className="state-box">Загружаем заказ...</div>}>
        <OrderDetailContent />
      </Suspense>
    </ProtectedRoute>
  );
}
