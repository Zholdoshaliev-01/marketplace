import type { Metadata } from 'next';
import './globals.css';
import './modern.css';
import { AuthProvider } from '@/lib/auth';
import { Shell } from '@/components/ui';
import { MotionProvider } from '@/components/motion-ui';

export const metadata: Metadata = {
  title: 'Market KG — оптовые товары для магазина',
  description: 'Дордой и Кара-Суу для вашего магазина',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="ru" data-scroll-behavior="smooth"><body><AuthProvider><MotionProvider><Shell>{children}</Shell></MotionProvider></AuthProvider></body></html> }
