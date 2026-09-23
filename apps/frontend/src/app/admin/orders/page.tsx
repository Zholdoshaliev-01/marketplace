'use client';

import { Suspense } from 'react';
import { AdminOrdersList } from '@/features/admin/orders/orders-list';

export default function AdminOrdersPage() {
  return <Suspense fallback={<div className="state-box">Загружаем заказы...</div>}><AdminOrdersList /></Suspense>;
}
