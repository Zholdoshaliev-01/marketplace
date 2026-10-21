export const errorMessages: Record<string, string> = {
  INSUFFICIENT_STOCK: 'Количество товара изменилось. Проверьте корзину и попробуйте снова.',
  MOQ_NOT_MET: 'Количество меньше минимального заказа.',
  PRODUCT_UNAVAILABLE: 'Товар больше недоступен.',
  SUPPLIER_INACTIVE: 'Поставщик временно недоступен.',
  DELIVERY_ZONE_NOT_SUPPORTED: 'Доставка в этот город пока недоступна.',
  EMPTY_CART: 'Корзина пуста.',
  INVALID_ORDER_STATUS_TRANSITION: 'Этот переход статуса недоступен.',
  DUPLICATE_USER: 'Телефон или email уже зарегистрирован.',
  NETWORK_ERROR: 'Не удалось связаться с сервером. Проверьте, что backend запущен, и повторите попытку.',
  REQUEST_TIMEOUT: 'Сервер не ответил вовремя. Повторите попытку.',
  DUPLICATE_CATEGORY_SLUG: 'Категория с таким slug уже существует.',
  CATEGORY_DELETE_CONFLICT: 'Нельзя удалить категорию, пока в ней есть товары или дочерние категории.',
  CATEGORY_CYCLE: 'Категории нельзя связывать в цикл.',
  PRODUCT_NOT_FOUND: 'Товар не найден или больше недоступен.',
  SUPPLIER_NOT_FOUND: 'Поставщик не найден или отключён.',
  IMAGE_LIMIT_REACHED: 'У товара может быть не более 10 изображений.',
};
export const friendlyError = (error: unknown) => error && typeof error === 'object' && 'code' in error ? errorMessages[String((error as { code: string }).code)] ?? 'Не удалось выполнить запрос.' : 'Не удалось выполнить запрос.';
