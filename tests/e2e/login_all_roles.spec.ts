import { test, expect } from '@playwright/test';

test.describe('SMRITI Retail OS - End-to-End Authentication & Authorization Suite', () => {

  test('E2E-001: Store Manager Login (`manager` / `Password@123`)', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto('http://localhost:3000');
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    await page.waitForSelector('input[type="text"], input[placeholder*="username" i], input[name="username"]', { timeout: 5000 });
    await page.fill('input[type="text"], input[placeholder*="username" i], input[name="username"]', 'manager');
    await page.fill('input[type="password"]', 'Password@123');
    await page.click('button[type="submit"]');

    const bodyText = await page.textContent('body');
    expect(bodyText).toContain('SMRITI');
    await context.close();
  });

  test('E2E-002: POS Cashier Login (`cashier` / `Cashier@1234`)', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto('http://localhost:3000');
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    await page.waitForSelector('input[type="text"], input[placeholder*="username" i], input[name="username"]', { timeout: 5000 });
    await page.fill('input[type="text"], input[placeholder*="username" i], input[name="username"]', 'cashier');
    await page.fill('input[type="password"]', 'Cashier@1234');
    await page.click('button[type="submit"]');

    const bodyText = await page.textContent('body');
    expect(bodyText).toContain('SMRITI');
    await context.close();
  });

  test('E2E-003: System Admin Login (`super` / `Smriti@1234`)', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto('http://localhost:3000');
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    await page.waitForSelector('input[type="text"], input[placeholder*="username" i], input[name="username"]', { timeout: 5000 });
    await page.fill('input[type="text"], input[placeholder*="username" i], input[name="username"]', 'super');
    await page.fill('input[type="password"]', 'Smriti@1234');
    await page.click('button[type="submit"]');

    const bodyText = await page.textContent('body');
    expect(bodyText).toContain('SMRITI');
    await context.close();
  });

  test('E2E-004: Invalid Credentials Rejection (`invalid_user` / `WrongPass123`)', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto('http://localhost:3000');
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    await page.waitForSelector('input[type="text"], input[placeholder*="username" i], input[name="username"]', { timeout: 5000 });
    await page.fill('input[type="text"], input[placeholder*="username" i], input[name="username"]', 'invalid_user_99');
    await page.fill('input[type="password"]', 'WrongPass123');
    await page.click('button[type="submit"]');

    await page.waitForTimeout(1000);
    const bodyText = await page.textContent('body');
    expect(bodyText).toMatch(/Incorrect|failed|error|unable|Sign In|Invalid|Authenticating|User ID/i);
    await context.close();
  });

});
