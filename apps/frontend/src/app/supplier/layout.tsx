import { SupplierRoute } from '@/features/supplier/supplier-route';
import { OperationalShell } from '@/components/operational-shell';

export default function SupplierLayout({ children }: { children: React.ReactNode }) {
  return <SupplierRoute><OperationalShell workspace="SUPPLIER">{children}</OperationalShell></SupplierRoute>;
}
