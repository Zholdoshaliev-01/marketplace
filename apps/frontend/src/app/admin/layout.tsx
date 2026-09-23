import { AdminRoute } from '@/features/admin/admin-route';
import { OperationalShell } from '@/components/operational-shell';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminRoute><OperationalShell workspace="ADMIN">{children}</OperationalShell></AdminRoute>;
}
