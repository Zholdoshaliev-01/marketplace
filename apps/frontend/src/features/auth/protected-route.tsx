'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuth } from '@/lib/auth';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [loading, pathname, router, user]);

  if (loading) return <div className="state-box">Загружаем профиль...</div>;
  if (!user) return <div className="state-box">Требуется вход в аккаунт.</div>;

  return <>{children}</>;
}
