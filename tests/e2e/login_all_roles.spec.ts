import { test, expect } from '@playwright/test';

test.describe('SMRITI Retail OS - End-to-End Authentication & Authorization Suite', () => {

  test('E2E-001: Store Manager Login (`manager` / `Password@123`)', async ({ page }) => {
    await page.goto('http://localhost:3000');
    
    // Fill credentials
    await page.fill('input[type="text"], input[placeholder*="username" i], input[name="username"]', 'manager');
    await page.fill('input[type="password"]', 'Password@123');
    
    // Submit form
    await page.click('button[type="submit"]');

    // Assert successful login and entry into SMRITI Retail OS dashboard
    await expect(page).not.toHaveURL('/login');
    const bodyText = await page.textContent('body');
    expect(bodyText).toContain('SMRITI');
  });

  test('E2E-002: POS Cashier Login (`cashier` / `Cashier@1234`)', async ({ page }) => {
    await page.goto('http://localhost:3000');
    
    // Fill credentials
    await page.fill('input[type="text"], input[placeholder*="username" i], input[name="username"]', 'cashier');
    await page.fill('input[type="password"]', 'Cashier@1234');
    
    // Submit form
    await page.click('button[type="submit"]');

    // Assert successful login
    const bodyText = await page.textContent('body');
    expect(bodyText).toContain('SMRITI');
  });

  test('E2E-003: System Admin Login (`super` / `Smriti@1234`)', async ({ page }) => {
    await page.goto('http://localhost:3000');
    
    // Fill credentials
    await page.fill('input[type="text"], input[placeholder*="username" i], input[name="username"]', 'super');
    await page.fill('input[type="password"]', 'Smriti@1234');
    
    // Submit form
    await page.click('button[type="submit"]');

    // Assert successful login
    const bodyText = await page.textContent('body');
    expect(bodyText).toContain('SMRITI');
  });

  test('E2E-004: Invalid Password Rejection (`manager` / `WrongPass123`)', async ({ page }) => {
    await page.goto('http://localhost:3000');
    
    // Fill invalid credentials
    await page.fill('input[type="text"], input[placeholder*="username" i], input[name="username"]', 'manager');
    await page.fill('input[type="password"]', 'WrongPass123');
    
    // Submit form
    await page.click('button[type="submit"]');

    // Assert error message displayed on UI
    const bodyText = await page.textContent('body');
    expect(bodyText).toMatch(/Incorrect|failed|error|unable/i);
  });

});
