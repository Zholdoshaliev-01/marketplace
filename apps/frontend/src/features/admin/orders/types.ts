import type { OrderStatus } from '@/lib/api';

export interface StatusAction { status: OrderStatus; label: string; destructive?: boolean }

export const statusActions: Partial<Record<OrderStatus, StatusAction[]>> = {
  NEW: [
    { status: 'CONFIRMED', label: 'Подтвердить заказ' },
    { status: 'CANCELLED', label: 'Отменить заказ', destructive: true },
  ],
  CONFIRMED: [
    { status: 'COLLECTING', label: 'Начать сборку' },
    { status: 'CANCELLED', label: 'Отменить заказ', destructive: true },
  ],
  COLLECTING: [{ status: 'READY_FOR_DELIVERY', label: 'Готов к доставке' }],
  READY_FOR_DELIVERY: [{ status: 'IN_DELIVERY', label: 'Передать в доставку' }],
  IN_DELIVERY: [{ status: 'DELIVERED', label: 'Отметить доставленным' }],
};

export const CANCELLATION_WARNING = 'После отмены заказ перейдёт в статус «Отменён». В текущем MVP остаток товара автоматически не восстанавливается.';
