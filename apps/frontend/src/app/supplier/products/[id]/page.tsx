'use client';

import { useParams } from 'next/navigation';
import { SupplierProductForm } from '@/features/supplier/products/product-form';

export default function EditSupplierProductPage() {
  const { id } = useParams<{ id: string }>();
  return <SupplierProductForm productId={id} />;
}
