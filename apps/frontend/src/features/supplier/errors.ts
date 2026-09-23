import { ApiError } from '@/lib/api';

const messages: Record<string, string> = {
  IMAGE_LIMIT_REACHED: 'Можно добавить не более 10 изображений.',
  DUPLICATE_PRODUCT_SKU: 'Товар с таким SKU уже существует.',
  PRODUCT_NOT_FOUND: 'Товар не найден или принадлежит другому поставщику.',
  CATEGORY_NOT_FOUND: 'Выбранная категория не найдена.',
};

export function supplierError(reason: unknown, fallback = 'Не удалось выполнить запрос.') {
  if (!(reason instanceof ApiError)) return fallback;
  if (messages[reason.code]) return messages[reason.code];
  if (reason.status === 401) return 'Сессия завершена. Войдите снова.';
  if (reason.status === 403) return 'Операция недоступна для этого аккаунта.';
  if (reason.status === 404) return 'Данные не найдены.';
  if (reason.status === 409) return 'Изменение конфликтует с текущим состоянием данных.';
  if (reason.status === 422) return 'Проверьте заполненные поля.';
  return fallback;
}
