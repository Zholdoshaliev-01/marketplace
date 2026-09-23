import { RoleRoute } from '@/features/auth/role-route';

export function SupplierRoute({ children }: { children: React.ReactNode }) {
  return <RoleRoute role="SUPPLIER">{children}</RoleRoute>;
}
