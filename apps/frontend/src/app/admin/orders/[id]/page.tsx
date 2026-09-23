'use client';

import { useParams } from 'next/navigation';
import { AdminOrderDetail } from '@/features/admin/orders/order-detail';

export default function AdminOrderPage() {
  const { id } = useParams<{ id: string }>();
  return <AdminOrderDetail id={id} />;
}
