'use client';
import { Suspense } from 'react';
import { LoginPageContent } from '@/features/auth/login-form';

export default function Login() {
  return (
    <Suspense fallback={<div className="state-box">Загружаем форму входа...</div>}>
      <LoginPageContent />
    </Suspense>
  );
}
