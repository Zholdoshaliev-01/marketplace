'use client';
import { createContext, useContext, useEffect, useState } from 'react';
import { api, AUTH_LOGOUT_EVENT, clearLocalSession, get, setAccessToken, Shop, User } from './api';
interface AuthValue { user: User | null; shop: Shop | null; loading: boolean; login: (phone_or_email: string, password: string) => Promise<User>; register: (payload: unknown) => Promise<User>; logout: () => Promise<void> }
const AuthContext = createContext<AuthValue | null>(null);
export function AuthProvider({ children }: { children: React.ReactNode }) { const [user, setUser] = useState<User | null>(null); const [shop, setShop] = useState<Shop | null>(null); const [loading, setLoading] = useState(true);
  useEffect(() => { get<{ user: User; shop: Shop | null }>('/auth/me').then(data => { setUser(data.user); setShop(data.shop) }).catch(() => {}).finally(() => setLoading(false)) }, []);
  useEffect(() => { const clearSession = () => { setUser(null); setShop(null) }; window.addEventListener(AUTH_LOGOUT_EVENT, clearSession); return () => window.removeEventListener(AUTH_LOGOUT_EVENT, clearSession) }, []);
  const apply = (data: { user: User; shop?: Shop | null; access_token: string }) => { setAccessToken(data.access_token); setUser(data.user); setShop(data.shop ?? null); return data.user };
  const login = async (phone_or_email: string, password: string) => apply(await api<{ user: User; shop?: Shop | null; access_token: string }>('/auth/login', { method: 'POST', body: JSON.stringify({ phone_or_email, password }) }));
  const register = async (payload: unknown) => apply(await api<{ user: User; shop?: Shop | null; access_token: string }>('/auth/register', { method: 'POST', body: JSON.stringify(payload) }));
  const logout = async () => {
    try { await api('/auth/logout', { method: 'POST' }); }
    finally { clearLocalSession(); setUser(null); setShop(null); }
  };
  return <AuthContext.Provider value={{ user, shop, loading, login, register, logout }}>{children}</AuthContext.Provider> }
export const useAuth = () => { const value = useContext(AuthContext); if (!value) throw new Error('AuthProvider is required'); return value };
