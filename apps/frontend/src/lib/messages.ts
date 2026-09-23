export const errorMessages: Record<string, string> = {
  INSUFFICIENT_STOCK: 'Количество товара изменилось. Проверьте корзину и попробуйте снова.',
  MOQ_NOT_MET: 'Количество меньше минимального заказа.',
  PRODUCT_UNAVAILABLE: 'Товар больше недоступен.',
  SUPPLIER_INACTIVE: 'Поставщик временно недоступен.',
  DELIVERY_ZONE_NOT_SUPPORTED: 'Доставка в этот город пока недоступна.',
  EMPTY_CART: 'Корзина пуста.',
  INVALID_ORDER_STATUS_TRANSITION: 'Этот переход статуса недоступен.',
  DUPLICATE_USER: 'Телефон или email уже зарегистрирован.',
};
export const friendlyError = (error: unknown) => error && typeof error === 'object' && 'code' in error ? errorMessages[String((error as { code: string }).code)] ?? 'Не удалось выполнить запрос.' : 'Не удалось выполнить запрос.';
