import { RoleRoute } from '@/features/auth/role-route';

export function AdminRoute({ children }: { children: React.ReactNode }) {
  return <RoleRoute role="ADMIN">{children}</RoleRoute>;
}
