'use client';

import { useParams } from 'next/navigation';
import { SupplierOrdersView } from '@/features/supplier/orders/orders-view';

export default function SupplierOrderPage() {
  const { id } = useParams<{ id: string }>();
  return <SupplierOrdersView fulfillmentId={id} />;
}
