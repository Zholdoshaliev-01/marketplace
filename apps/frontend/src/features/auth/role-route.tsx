'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import type { UserRole } from '@/lib/api';
import { roleHome } from '@/lib/roles';

export function RoleRoute({ role, children }: { role: UserRole; children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const destination = user && user.role !== role ? roleHome[user.role] : null;

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    else if (destination) router.replace(destination);
  }, [destination, loading, pathname, router, user]);

  if (loading) return <div className="route-loading" role="status"><span className="button-loader" /> Проверяем доступ...</div>;
  if (!user || destination) return <div className="route-loading" role="status">Перенаправляем...</div>;
  return <>{children}</>;
}

export const ShopRoute = ({ children }: { children: React.ReactNode }) => <RoleRoute role="SHOP">{children}</RoleRoute>;
