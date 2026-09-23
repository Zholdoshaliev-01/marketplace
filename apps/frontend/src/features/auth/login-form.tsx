'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '@/lib/auth';
import { ApiError } from '@/lib/api';
import { friendlyError } from '@/lib/messages';
import { CheckCircle2, PackageCheck, ShieldCheck } from 'lucide-react';
import { loginDestination } from '@/lib/roles';

export const loginSchema = z.object({
  phone_or_email: z.string().min(3, 'Введите телефон или email'),
  password: z.string().min(1, 'Введите пароль'),
});

type Form = z.infer<typeof loginSchema>;

export function LoginPageContent() {
  const { login } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = React.useState('');
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Form>({ resolver: zodResolver(loginSchema) });

  const submit = async (data: Form) => {
    try {
      const user = await login(data.phone_or_email, data.password);
      router.replace(loginDestination(user.role, params.get('next')));
    } catch (e) {
      setError(e instanceof ApiError ? friendlyError(e) : 'Проверьте данные и попробуйте снова.');
    }
  };

  return (
    <div className="auth-page">
      <aside className="auth-showcase" aria-label="Преимущества Market KG">
        <div className="auth-showcase-logo"><span>M</span> MARKET KG</div>
        <div className="auth-showcase-copy">
          <p>ОПТОВЫЕ ЗАКУПКИ ПРОЩЕ</p>
          <h2>Всё для магазина<br/>в одном месте</h2>
          <ul><li><PackageCheck/> Актуальные цены и остатки</li><li><ShieldCheck/> Проверенные поставщики</li><li><CheckCircle2/> История заказов в аккаунте</li></ul>
        </div>
        <small>Дордой · Кара-Суу · Кыргызстан</small>
      </aside>
      <div className="auth-card">
        <p className="eyebrow">Добро пожаловать</p>
        <h1>Войти в Market KG</h1>
        <p className="muted">Каталог оптовых товаров всегда под рукой.</p>
        <form onSubmit={handleSubmit(submit)}>
          <label>
            Телефон или email
            <input {...register('phone_or_email')} autoComplete="username" placeholder="example@mail.com или +996..." />
          </label>
          {errors.phone_or_email && <small className="field-error">{errors.phone_or_email.message}</small>}
          <label>
            Пароль
            <input type="password" {...register('password')} autoComplete="current-password" placeholder="Введите пароль" />
          </label>
          {errors.password && <small className="field-error">{errors.password.message}</small>}
          {error && <div className="inline-error">{error}</div>}
          <button className="primary-button full" disabled={isSubmitting}>{isSubmitting ? 'Входим...' : 'Войти'}</button>
        </form>
        <p className="auth-switch">Нет аккаунта? <Link href="/register">Зарегистрироваться</Link></p>
      </div>
    </div>
  );
}
