# Архитектурные решения MVP

## ADR-020: Domain-oriented modular monolith

**Decision**  
Сохранить один deployable backend, разделив ownership кода по business domains. HTTP routers делегируют services; repositories ограничены сложными queries и locking. Cross-domain model/service dependencies явны, routers между domains не импортируются.

**Reason**  
Решение устраняет flat god-modules, сохраняя atomic checkout, REST contracts и database schema. Boundaries становятся тестируемыми без distributed-system failure modes.

**Alternative rejected**  
Microservices и механическое применение Clean Architecture: для MVP они добавляют deployment/indirection cost без бизнес-выгоды.

**Trade-off**  
Checkout намеренно использует cart, catalog, supplier, delivery, shop и order models в одной transaction. Это явный application workflow, а не повод вводить generic repositories или event bus.

---

**Статус:** proposal для review  
**Дата:** 2026-09-17

## ADR-001: Modular monolith

**Decision**  
Один FastAPI backend с внутренними модулями и одна PostgreSQL database. Frontend и backend разворачиваются как отдельные приложения, но business backend не дробится на микросервисы.

**Reason**  
MVP проверяет регулярность закупок. Главная сложность находится в корректном checkout, ownership и остатках, а не в независимом масштабировании сервисов. Единая транзакция проще и надёжнее.

**Alternative rejected**  
Микросервисы для auth/catalog/orders/logistics.

**Trade-off**  
Меньше инфраструктурной сложности и быстрее разработка, но модули требуют дисциплины границ и позже могут потребовать выделения.

## ADR-002: PostgreSQL как единственная business database

**Decision**  
PostgreSQL используется для пользователей, каталога, корзины, заказов, статусов и delivery configuration.

**Reason**  
Нужны ACID transaction, `SELECT FOR UPDATE`, foreign keys, unique/check constraints и Decimal numeric types.

**Alternative rejected**  
NoSQL database или отдельные хранилища для каталога и заказов.

**Trade-off**  
Простая целостность и checkout, но поисковые возможности на MVP ограничены `ILIKE`/обычными индексами.

## ADR-003: Backend source of truth

**Decision**  
Frontend передаёт IDs, quantities и checkout details. Backend заново читает цену, MOQ, stock, active flag и считает все суммы.

**Reason**  
Данные браузера можно изменить, а цена и остатки могут измениться после загрузки страницы.

**Alternative rejected**  
Доверять subtotal/total и `unit_price` из корзины frontend.

**Trade-off**  
Checkout чуть сложнее и может сообщить конфликт после нажатия кнопки, зато сумма и остаток корректны.

## ADR-004: Lock product rows during checkout

**Decision**  
Внутри одной транзакции checkout выбирает все товары через PostgreSQL `SELECT FOR UPDATE`, затем валидирует остатки и уменьшает их до commit.

**Reason**  
Это предотвращает overselling при двух одновременных заказах последних единиц. Deterministic lock order уменьшает риск deadlock.

**Alternative rejected**  
Проверка stock без блокировки или только optimistic check в application code.

**Trade-off**  
Конкурирующие заказы ждут друг друга на короткое время; нужен корректный transaction scope и обработка `409`.

## ADR-005: Snapshot fields in OrderItem

**Decision**  
В `order_items` сохраняются product name, SKU, supplier ID, quantity, unit price и total price.

**Reason**  
Изменение живого Product не должно менять историю заказа и расчёт оборота.

**Alternative rejected**  
Всегда отображать OrderItem через текущую Product row.

**Trade-off**  
Появляется дублирование исторических данных, но это необходимая денормализация для auditability.

## ADR-006: One global Order for multiple suppliers

**Decision**  
Заказ может содержать товары разных поставщиков, а каждый `OrderItem` содержит `supplier_id`. В первой версии отдельная `SupplierOrder` не создаётся.

**Reason**  
Единая корзина, одна доставка и один customer-facing status проще для проверки спроса. Supplier может получить только свои order items фильтром по supplier ID.

**Alternative rejected**  
Автоматически раскладывать checkout на `SupplierOrder`/fulfillment records.

**Trade-off**  
Нельзя точно показать разную готовность поставщиков в одном заказе. Если появятся частичная доставка, отдельное подтверждение или settlement, `SupplierOrder` станет необходим.

## ADR-007: Global order status state machine

**Decision**  
Статус хранится на `orders` и меняется только по разрешённым переходам. На MVP его меняет ADMIN.

**Reason**  
Небольшое число состояний понятно магазину и администратору; state map предотвращает произвольные переходы.

**Alternative rejected**  
Свободная запись любого enum status из admin UI.

**Trade-off**  
Операционная модель менее детальная для multi-supplier заказа.

## ADR-008: Installment request is a payment enum value

**Decision**  
`INSTALLMENT_REQUEST` хранится в `orders.payment_type`; отдельной кредитной модели нет.

**Reason**  
MVP измеряет интерес магазинов к рассрочке, но не выдаёт кредит и не проводит платежи. Для аналитики достаточно total, shop, created_at, status и payment_type.

**Alternative rejected**  
KYC, loan agreements, credit scoring, schedules, bank APIs.

**Trade-off**  
Нельзя считать это финансовым обязательством и нельзя поддержать реальную рассрочку без новой подсистемы.

## ADR-009: Soft deactivation instead of deleting business records

**Decision**  
Products and suppliers are deactivated with `is_active = false`; physical delete is restricted when there are dependent records. Categories with products/children are not deleted until reassignment.

**Reason**  
Order history and foreign-key integrity должны сохраняться. Inactive product не показывается в публичном каталоге и не проходит checkout.

**Alternative rejected**  
Cascade-delete products/order references.

**Trade-off**  
Database со временем сохраняет неактивные записи; потребуется отдельная maintenance policy.

## ADR-010: One cart per shop and unique cart item

**Decision**  
У SHOP одна активная корзина (`UNIQUE carts.shop_id`), а product может быть в ней только один раз (`UNIQUE(cart_id, product_id)`). Повторное добавление увеличивает quantity или возвращает явный конфликт по выбранному API contract.

**Reason**  
Убирает ambiguous duplicate lines и упрощает checkout.

**Alternative rejected**  
Разрешить несколько строк одного товара.

**Trade-off**  
Нельзя хранить разные пользовательские notes/цены для одного product в одной корзине, что не требуется MVP.

## ADR-011: Simple delivery zone pricing

**Decision**  
Стоимость доставки берётся backend из `delivery_zones` по city. Таблица может быть заполнена seed data до появления admin UI.

**Reason**  
Нужен детерминированный server-side total без сложной логистики.

**Alternative rejected**  
Расчёт цены в браузере или интеграция с real-time carrier.

**Trade-off**  
Тарифы грубые и требуют ручного обновления; неизвестный или неактивный город блокирует checkout с `DELIVERY_ZONE_NOT_SUPPORTED`, без fallback price.

## ADR-012: JWT access + stored refresh token hash

**Decision**  
Короткоживущий signed access JWT используется для API, opaque refresh token ротируется и хранится в БД только в виде hash. Web frontend получает refresh token через `HttpOnly` cookie с `Secure` в production и `SameSite`; localStorage не используется.

**Reason**  
Поддерживает stateless access validation и управляемое отзывание refresh sessions. Пароли хранятся через Argon2id (bcrypt как допустимый fallback).

**Alternative rejected**  
Долгоживущий access JWT без refresh rotation или хранение raw refresh tokens.

**Trade-off**  
Нужны token lifecycle, cleanup expired rows, CSRF-aware cookie policy и аккуратный transport policy.

## ADR-013: Ownership checks at query/service boundary

**Decision**  
Каждый SHOP/SUPPLIER query ограничивается текущим owner ID, а не только проверяется после загрузки объекта. ADMIN получает отдельную role dependency.

**Reason**  
Защищает от IDOR и уменьшает риск забыть проверку при добавлении нового endpoint.

**Alternative rejected**  
Единая generic CRUD-логика с проверкой только роли.

**Trade-off**  
Немного больше повторяющихся scoped queries, зато authorization явно виден рядом с доступом к данным.

## ADR-014: PostgreSQL enums for finite business states

**Decision**  
Role, market, order status и payment type моделируются как ограниченные enum values и дополнительно валидируются Pydantic.

**Reason**  
Нельзя случайно записать неизвестный статус или payment type; переходы контролируются service map.

**Alternative rejected**  
Свободные strings без DB constraint.

**Trade-off**  
Добавление нового enum value требует migration и coordinated deployment.

## ADR-015: Idempotency is mandatory in MVP checkout

**Decision**  
`POST /orders` требует client-generated header `Idempotency-Key` длиной до 64 символов. `orders.idempotency_key` хранится как `NOT NULL`, с `UNIQUE(shop_id, idempotency_key)`. Повторный запрос того же SHOP и ключа возвращает существующий Order и не повторяет списание stock.

**Reason**  
Мобильная сеть может повторить запрос после таймаута, создав два заказа и два списания stock.

**Alternative rejected**  
Надеяться на frontend disable button или считать повтор по совпадению корзины безопасным.

**Trade-off**  
Поле в orders проще отдельной технической таблицы, но повтор с тем же ключом и изменённым body должен возвращать исходный результат; клиенты обязаны генерировать новый ключ для нового заказа.

## ADR-016: Checkout reads the server-side cart

**Decision**  
`POST /orders` не принимает `items[]`. Backend определяет Shop, загружает его единственную Cart и CartItems, блокирует Products, создаёт snapshots, уменьшает stock, очищает CartItems и commits всё одной транзакцией. `cart_items` не содержит `unit_price`; `GET /cart` получает текущую цену через Product.

**Reason**  
Корзина является серверным намерением магазина, а не недоверенным набором цен и product IDs из браузера. Это уменьшает риск расхождения cart и checkout.

**Alternative rejected**  
Передавать items и цены в каждом checkout request.

**Trade-off**  
Нельзя оформить часть корзины в одном запросе; partial checkout потребует отдельного явного механизма позже.

## ADR-017: One SHOP user owns one Shop

**Decision**  
В MVP действует правило `1 SHOP User = 1 Shop`, enforced unique constraint на `shops.owner_user_id`.

**Reason**  
Упрощает ownership, cart, order history и профиль.

**Alternative rejected**  
Один пользователь с несколькими магазинами и selector текущего магазина.

**Trade-off**  
Для сетевых владельцев потребуется расширение модели.

## ADR-018: Supplier privacy projection

**Decision**  
Supplier получает order number, global status, created_at и только свои OrderItems: quantity, unit price, item total. Полный адрес и приватные данные Shop не возвращаются.

**Reason**  
Для сборки товара supplier достаточно item-level данных; адрес относится к delivery/admin.

**Alternative rejected**  
Возвращать supplier полный OrderDetail.

**Trade-off**  
Supplier не видит destination и не может самостоятельно организовать доставку в этой версии.

## ADR-019: Placeholder images only for initial seed

**Decision**  
Seed использует локальные или заранее определённые placeholder URLs без copyrighted product photos. Image upload/storage не входит в архитектурный этап.

**Reason**  
Позволяет проверить каталог без зависимости от внешних правообладательских assets или object storage.

**Alternative rejected**  
Скрапинг изображений маркетплейсов и ранняя интеграция CDN/object storage.

**Trade-off**  
Демо-каталог менее реалистичен визуально; production media workflow потребуется позже.

## ADR-021: Supplier fulfillment is separate from the global order

**Decision**
`Order` хранит buyer/global workflow под управлением ADMIN. `SupplierFulfillment` хранит operational lifecycle ровно одного supplier в заказе, а `OrderItem` остаётся неизменяемым коммерческим snapshot и определяет состав supplier-части.

**Reason**
Один Order может содержать товары нескольких suppliers, поэтому supplier не должен менять общий `Order.status`.

**Alternative rejected**
Автоматически переводить global order при переходе одного fulfillment в `READY` или `CANCELLED`.

**Trade-off**
Отмена fulfillment не восстанавливает stock, не отменяет Order и не затрагивает других suppliers в текущем MVP; ADMIN принимает решение вручную.
