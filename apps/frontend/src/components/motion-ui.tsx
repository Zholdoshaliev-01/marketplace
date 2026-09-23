'use client';

import { MotionConfig, motion, useReducedMotion } from 'motion/react';
import { PackageOpen } from 'lucide-react';
import { Children, type ReactNode } from 'react';
import { duration, easeOut, fadeUp, staggerContainer } from '@/lib/motion';

export function MotionProvider({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user" transition={{ duration: duration.normal, ease: easeOut }}>{children}</MotionConfig>;
}

export function PageEntrance({ children, className }: { children: ReactNode; className?: string }) {
  return <motion.div className={className} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: duration.normal }}>{children}</motion.div>;
}

export function Reveal({ children, className, delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  return <motion.div className={className} variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.12 }} transition={{ delay }}>{children}</motion.div>;
}

export function Stagger({ children, className }: { children: ReactNode; className?: string }) {
  return <motion.div className={className} variants={staggerContainer} initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.08 }}>{Children.map(children, child => <motion.div variants={fadeUp}>{child}</motion.div>)}</motion.div>;
}

export function ProductPlaceholder({ category, sku }: { category?: string; sku?: string }) {
  return <div className="product-placeholder" aria-hidden="true"><span className="placeholder-icon"><PackageOpen /></span>{category && <b>{category}</b>}{sku && <small>{sku}</small>}</div>;
}

export function HeroComposition() {
  const reduce = useReducedMotion();
  return <motion.div className="hero-composition" variants={staggerContainer} initial="hidden" animate="visible">
    <motion.div className="hero-card hero-card-product" variants={fadeUp} whileHover={reduce ? undefined : { y: -3 }}>
      <div className="hero-product-art"><PackageOpen /></div><span>Оптовый каталог</span><b>Товары для магазина</b><small>Цена и MOQ до заказа</small>
    </motion.div>
    <motion.div className="hero-card hero-card-supplier" variants={fadeUp}><span>Поставщик</span><b>Дордой · Кара-Суу</b><small>Напрямую с рынка</small></motion.div>
    <motion.div className="hero-card hero-card-delivery" variants={fadeUp}><span>Доставка</span><b>В ваш город</b></motion.div>
    <div className="hero-grid-mark" />
  </motion.div>;
}
