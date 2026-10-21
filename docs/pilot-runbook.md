# Local pilot runbook

Пошаговая проверка всех ролей и актуальная матрица demo-аккаунтов также описаны в `docs/stage-1-demo.md`.

Этот runbook предназначен только для локальной Windows development-среды. Не используйте pilot database или demo credentials в production.

## 1. Prerequisites

- Docker Desktop с работающим Linux engine
- Python 3.10+ и backend dependencies
- Node.js/npm и frontend dependencies
- свободные порты `55432`, `8001`, `3000`

Все команды ниже выполняются из корня репозитория в PowerShell.

Если dependencies ещё не установлены:

```powershell
python -m pip install -r apps/backend/requirements.txt
Set-Location apps/frontend
npm ci
npx playwright install chromium
Set-Location ../..
```

## 2. PostgreSQL и отдельная pilot database

```powershell
docker compose up -d postgres
docker compose ps
docker exec marketplace-postgres-1 createdb -U marketplace -O marketplace marketplace_pilot
```

Если `marketplace_pilot` уже существует, `createdb` завершится ошибкой — это безопасно и не удаляет данные.

## 3. Migrations и demo data

```powershell
Set-Location apps/backend
$env:DATABASE_URL='postgresql+psycopg://marketplace:marketplace@localhost:55432/marketplace_pilot'
$env:ENVIRONMENT='development'
$env:JWT_SECRET_KEY='local-pilot-only-change-me'
alembic upgrade head
python -m scripts.seed
```

Seed idempotent: он создаёт или обновляет только локальные demo-записи и ничего не удаляет. Seed откажется работать, если `ENVIRONMENT` не равен `development` или `test`.

Pilot catalog содержит шесть категорий, двенадцать активных товаров трёх поставщиков, три магазина и delivery zone «Бишкек».

## 4. Backend

В том же backend terminal:

```powershell
uvicorn app.main:app --host 127.0.0.1 --port 8001
```

Health check: `http://127.0.0.1:8001/health`.

## 5. Frontend

В новом PowerShell terminal:

```powershell
Set-Location apps/frontend
$env:BACKEND_URL='http://127.0.0.1:8001'
npm run dev
```

Откройте `http://127.0.0.1:3000`.

## 6. Local demo accounts

Общий development password: `MarketKG2026!`. Его можно заменить до seed через `$env:SEED_DEMO_PASSWORD`.

| Роль | Login |
| --- | --- |
| SHOP | `shop.demo@market.kg` |
| SHOP B | `shop-b.demo@market.kg` |
| SHOP C | `shop-c.demo@market.kg` |
| SUPPLIER A — Алтын Дистрибьюшн | `supplier.demo@market.kg` |
| SUPPLIER B — Береке Хозтовары | `supplier-b.demo@market.kg` |
| SUPPLIER C — Нур Опт | `supplier-c.demo@market.kg` |
| ADMIN | `admin.demo@market.kg` |

Это только воспроизводимые local demo credentials, не production secrets.

## 7. SHOP flow

1. Войти как SHOP.
2. В каталоге добавить товары обоих поставщиков с учётом MOQ.
3. Открыть корзину, проверить количества и subtotal.
4. Оформить доставку в городе `Бишкек` с CASH или BANK_TRANSFER.
5. Проверить success banner, номер заказа и очищенную корзину.
6. Открыть «Заказы» и проверить snapshots, суммы и глобальный статус.

## 8. SUPPLIER flow

1. Выйти из SHOP и войти как Supplier A.
2. Открыть «Заказы» и убедиться, что видны только позиции Supplier A.
3. Выполнить `Ожидает подтверждения → Принят → Сборка → Готов`.
4. Войти как Supplier B: его fulfillment остаётся отдельным и содержит только его позиции.
5. Для cancellation pilot создать второй SHOP order и подтвердить отмену Supplier A.

## 9. ADMIN flow

1. Войти как ADMIN и открыть `/admin/orders`.
2. Найти заказ по номеру.
3. Проверить отдельные statuses, item counts и subtotals поставщиков.
4. Выполнить глобальный workflow до `Доставлен`.
5. Для отменённого fulfillment проверить warning; глобальный Order остаётся `Новый`, пока ADMIN не примет решение.

## 10. Browser automation

После запуска stack:

```powershell
Set-Location apps/frontend
npm run test:e2e
```

Playwright использует настоящий frontend, backend и PostgreSQL; API mocks и auth bypass отсутствуют.
Сценарий рассчитан на свежую `marketplace_pilot`: перед повторным полным прогоном выполните безопасную очистку из раздела 12, затем шаги 2–3.

## 11. Текущие ограничения MVP

- supplier cancellation не восстанавливает stock;
- ADMIN вручную решает последствия supplier cancellation;
- payment gateway отсутствует;
- `INSTALLMENT_REQUEST` — только сигнал интереса к рассрочке;
- delivery integration отсутствует;
- notifications отсутствуют;
- один fulfillment на supplier/order;
- split shipment отсутствует;
- partial item quantities отсутствуют.

## 12. Безопасная очистка local pilot data

Остановите backend, использующий pilot DB, затем удалите только явно названную базу:

```powershell
docker exec marketplace-postgres-1 dropdb -U marketplace --force marketplace_pilot
```

Команда не затрагивает `marketplace`, `marketplace_test` или другие базы. Для нового pilot run повторите шаги 2–3.
