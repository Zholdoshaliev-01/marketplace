import { expect, test, type Page } from '@playwright/test';

const PASSWORD = 'MarketKG2026!';
const accounts = {
  shop: 'shop.demo@market.kg',
  supplierA: 'supplier.demo@market.kg',
  supplierB: 'supplier-b.demo@market.kg',
  admin: 'admin.demo@market.kg',
};

async function login(page: Page, email: string, next: string) {
  await page.goto(`/login?next=${encodeURIComponent(next)}`);
  await page.waitForLoadState('networkidle');
  await page.getByLabel('Телефон или email').fill(email);
  await page.getByLabel('Пароль').fill(PASSWORD);
  await page.getByRole('button', { name: 'Войти' }).click();
  await expect(page).toHaveURL(new RegExp(`${next.replaceAll('/', '\\/')}$`));
}

async function logoutFromPublicHeader(page: Page) {
  await page.goto('/catalog');
  await page.getByRole('button', { name: 'Меню' }).click();
  await page.getByRole('button', { name: 'Выйти' }).click();
  await page.getByRole('button', { name: 'Меню' }).click();
  await expect(page.getByRole('link', { name: 'Войти' })).toBeVisible();
}

async function expectMobileUsable(page: Page) {
  const dimensions = await page.evaluate(() => ({ viewport: window.innerWidth, content: document.documentElement.scrollWidth }));
  expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport + 1);
}

async function addProduct(page: Page, name: string) {
  await page.goto('/catalog');
  await page.getByText(name, { exact: true }).click();
  await expect(page.getByRole('heading', { name, level: 1 })).toBeVisible();
  await page.getByRole('button', { name: 'Добавить в корзину' }).click();
  await expect(page.getByText('Товар добавлен в корзину')).toBeVisible();
}

async function checkout(page: Page, address: string, comment: string) {
  await page.goto('/checkout');
  await expect(page.getByRole('heading', { name: 'Оформление заказа' })).toBeVisible();
  await expectMobileUsable(page);
  await page.getByLabel('Город').fill('Бишкек');
  await page.getByLabel('Телефон').fill('+996555900000');
  await page.getByLabel('Адрес доставки').fill(address);
  await page.getByLabel(/Комментарий/).fill(comment);
  await page.getByLabel('Банковский перевод').check();
  const submit = page.getByRole('button', { name: 'Оформить заказ' });
  await submit.click();
  await submit.click({ timeout: 500 }).catch(() => { /* The first submit disables or replaces the button. */ });
  await expect(page.getByText('Заказ оформлен')).toBeVisible();
  return (await page.locator('.success-banner b').innerText()).trim();
}

test('pilot multi-supplier, cancellation, role isolation and mobile workflow', async ({ page }) => {
  test.setTimeout(240_000);
  const pilotApi = process.env.PILOT_API_URL;
  if (pilotApi) {
    await page.route('**/api/v1/**', route => {
      const requestUrl = new URL(route.request().url());
      const target = new URL(pilotApi);
      requestUrl.protocol = target.protocol;
      requestUrl.host = target.host;
      return route.continue({ url: requestUrl.toString() });
    });
  }
  await page.goto('/login');
  await page.waitForLoadState('networkidle');
  await page.getByLabel('Телефон или email').fill(accounts.shop);
  await page.getByLabel('Пароль').fill('wrong-password');
  await page.getByRole('button', { name: 'Войти' }).click();
  await expect(page.locator('.inline-error')).toBeVisible();

  await login(page, accounts.shop, '/catalog');
  await expect(page.getByText('Минеральная вода 1 л', { exact: true })).toBeVisible();
  await expect(page.getByText('Средство для мытья посуды 1 л', { exact: true })).toBeVisible();
  await expect(page.getByText('Напитки', { exact: true })).toBeAttached();
  await expectMobileUsable(page);

  await page.goto('/admin/orders');
  await expect(page).toHaveURL(/\/catalog$/);
  await page.goto('/supplier/orders');
  await expect(page).toHaveURL(/\/catalog$/);

  await addProduct(page, 'Минеральная вода 1 л');
  await addProduct(page, 'Средство для мытья посуды 1 л');
  await addProduct(page, 'Сахар 5 кг');
  await page.goto('/cart');
  await expect(page.getByText('DEMO-001')).toBeVisible();
  await expect(page.getByText('DEMO-005')).toBeVisible();
  await expect(page.getByText('DEMO-003')).toBeVisible();
  await page.getByRole('button', { name: 'Удалить Сахар 5 кг' }).click();
  await expect(page.getByText('DEMO-003')).toHaveCount(0);
  await page.getByRole('button', { name: 'Увеличить количество Минеральная вода 1 л' }).click();
  await expect(page.getByText('315 сом')).toBeVisible();
  await expectMobileUsable(page);

  const happyOrder = await checkout(page, 'ул. Пилотная, 9', 'Позвонить перед доставкой');
  await expect(page.getByRole('heading', { name: 'Новый' })).toBeVisible();
  await expect(page.getByText('Минеральная вода 1 л', { exact: true })).toBeVisible();
  await expect(page.getByText('Средство для мытья посуды 1 л', { exact: true })).toBeVisible();
  await expectMobileUsable(page);
  await page.goto('/cart');
  await expect(page.getByRole('heading', { name: 'Корзина пуста' })).toBeVisible();
  await page.goto('/orders');
  await expect(page.getByRole('link', { name: new RegExp(happyOrder) })).toBeVisible();
  await expect(page.getByRole('link', { name: /DEMO-ORDER-001/ })).toBeVisible();
  await expect(page.locator('.order-row')).toHaveCount(2);
  await page.goto('/orders/00000000-0000-0000-0000-000000000000');
  await expect(page.getByText('Заказ не найден.')).toBeVisible();
  await logoutFromPublicHeader(page);
  await page.goto('/orders/00000000-0000-0000-0000-000000000000');
  await expect(page).toHaveURL(/\/login\?next=/);

  await login(page, accounts.supplierA, '/supplier/orders');
  await page.goto('/admin/orders');
  await expect(page).toHaveURL(/\/supplier$/);
  await page.goto('/supplier/products');
  await expect(page.getByRole('heading', { name: 'Мои товары' })).toBeVisible();
  const waterCard = page.locator('article').filter({ hasText: 'Минеральная вода 1 л' });
  const waterStock = waterCard.getByLabel('Остаток Минеральная вода 1 л');
  await expect(waterStock).toBeVisible();
  const updatedStock = Number(await waterStock.inputValue()) - 1;
  await waterStock.fill(String(updatedStock));
  await waterCard.getByRole('button', { name: 'Сохранить' }).first().click();
  await expect(waterStock).toHaveValue(String(updatedStock));
  await expectMobileUsable(page);
  await page.goto('/supplier/orders');
  await page.getByRole('link', { name: happyOrder, exact: true }).first().click();
  await expect(page.getByText('Минеральная вода 1 л', { exact: true })).toBeVisible();
  await expect(page.getByText('Средство для мытья посуды 1 л', { exact: true })).toHaveCount(0);
  await expect(page.getByText('ул. Пилотная, 9')).toHaveCount(0);
  await expect(page.getByText('Позвонить перед доставкой')).toHaveCount(0);
  await page.getByRole('button', { name: 'Принять' }).click();
  await expect(page.getByRole('heading', { name: 'Принят', level: 1 })).toBeVisible();
  await page.getByRole('button', { name: 'Начать сборку' }).click();
  await expect(page.getByRole('heading', { name: 'Сборка', level: 1 })).toBeVisible();
  await page.getByRole('button', { name: 'Готов к передаче' }).click();
  await expect(page.getByRole('heading', { name: 'Готов', level: 1 })).toBeVisible();
  await expectMobileUsable(page);
  await logoutFromPublicHeader(page);

  await login(page, accounts.supplierB, '/supplier/orders');
  await page.getByRole('link', { name: happyOrder, exact: true }).first().click();
  await expect(page.getByText('Средство для мытья посуды 1 л', { exact: true })).toBeVisible();
  await expect(page.getByText('Минеральная вода 1 л', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Ожидает подтверждения', level: 1 })).toBeVisible();
  await page.getByRole('button', { name: 'Принять' }).click();
  await expect(page.getByRole('heading', { name: 'Принят', level: 1 })).toBeVisible();
  await logoutFromPublicHeader(page);

  await login(page, accounts.admin, '/admin/orders');
  await page.goto('/supplier/orders');
  await expect(page).toHaveURL(/\/admin$/);
  await page.goto('/admin/orders');
  await expectMobileUsable(page);
  await page.getByRole('link', { name: happyOrder, exact: true }).click();
  const fulfillmentSection = page.locator('.admin-fulfillments');
  await expect(fulfillmentSection).toContainText('Демо-поставщик Дордой');
  await expect(fulfillmentSection).toContainText('Готов');
  await expect(fulfillmentSection).toContainText('315 сом');
  await expect(fulfillmentSection).toContainText('Демо-поставщик Кара-Суу');
  await expect(fulfillmentSection).toContainText('Принят');
  await expect(fulfillmentSection).toContainText('570 сом');
  await expect(page.getByRole('heading', { name: 'Новый', level: 1 })).toBeVisible();
  for (const [button, heading] of [
    ['Подтвердить заказ', 'Подтверждён'],
    ['Начать сборку', 'Сборка'],
    ['Готов к доставке', 'Готов к доставке'],
    ['Передать в доставку', 'В доставке'],
    ['Отметить доставленным', 'Доставлен'],
  ]) {
    await page.getByRole('button', { name: button }).click();
    await expect(page.getByRole('heading', { name: heading, level: 1 })).toBeVisible();
  }
  await expect(page.getByText('Заказ в терминальном статусе. Доступных переходов нет.')).toBeVisible();
  await expectMobileUsable(page);
  await logoutFromPublicHeader(page);

  await login(page, accounts.shop, '/catalog');
  await addProduct(page, 'Чай чёрный 100 пакетиков');
  const cancelledOrder = await checkout(page, 'ул. Пилотная, 10', 'Заказ для отмены поставщиком');
  await logoutFromPublicHeader(page);

  await login(page, accounts.supplierA, '/supplier/orders');
  await page.getByRole('link', { name: cancelledOrder, exact: true }).first().click();
  page.once('dialog', async dialog => {
    expect(dialog.message()).toBe('Вы отменяете выполнение своей части заказа. Остаток товара автоматически не восстанавливается.');
    await dialog.accept();
  });
  await page.getByRole('button', { name: 'Отменить' }).click();
  await expect(page.getByRole('heading', { name: 'Отменён', level: 1 })).toBeVisible();
  await logoutFromPublicHeader(page);

  await login(page, accounts.admin, '/admin/orders');
  await page.getByRole('link', { name: cancelledOrder, exact: true }).click();
  await expect(page.locator('.admin-fulfillment-warning')).toContainText('Один из поставщиков отменил выполнение. Требуется решение администратора.');
  await expect(page.getByRole('heading', { name: 'Новый', level: 1 })).toBeVisible();
  await expectMobileUsable(page);
});
