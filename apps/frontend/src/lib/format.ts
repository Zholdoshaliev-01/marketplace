export const money = (value: string | number) => `${Number(value).toLocaleString('ru-RU')} сом`;
export const statusLabels: Record<string, string> = { NEW: 'Новый', CONFIRMED: 'Подтверждён', COLLECTING: 'Сборка', READY_FOR_DELIVERY: 'Готов к доставке', IN_DELIVERY: 'В доставке', DELIVERED: 'Доставлен', CANCELLED: 'Отменён' };
export const paymentLabels: Record<string, string> = { CASH: 'Наличные', BANK_TRANSFER: 'Банковский перевод', INSTALLMENT_REQUEST: 'Запрос рассрочки' };
export const fulfillmentStatusLabels: Record<string, string> = { PENDING: 'Ожидает подтверждения', ACCEPTED: 'Принят', COLLECTING: 'Сборка', READY: 'Готов', CANCELLED: 'Отменён' };
export const marketLabels = { DORDOI: 'Дордой', KARA_SUU: 'Кара-Суу' };
