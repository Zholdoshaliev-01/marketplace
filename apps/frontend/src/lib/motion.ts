import type { Variants } from 'motion/react';

export const easeOut = [0.16, 1, 0.3, 1] as const;
export const easeStandard = [0.22, 1, 0.36, 1] as const;

export const duration = {
  micro: 0.16,
  normal: 0.24,
  reveal: 0.48,
} as const;

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 14 },
  visible: { opacity: 1, y: 0, transition: { duration: duration.reveal, ease: easeOut } },
};

export const staggerContainer: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.065, delayChildren: 0.04 } },
};

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.97 },
  visible: { opacity: 1, scale: 1, transition: { duration: duration.normal, ease: easeOut } },
};
