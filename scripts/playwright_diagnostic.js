import { chromium } from 'playwright';

(async () => {
  console.log('=== CATCHING RUNTIME ERRORS IN BROWSER ===');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  page.on('console', msg => console.log(`[BROWSER CONSOLE ${msg.type()}]: ${msg.text()}`));
  page.on('pageerror', err => console.log(`[BROWSER UNCAUGHT ERROR]: ${err.stack || err.message}`));

  try {
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    const usernameInput = page.locator('input[type="text"], input[name="username"]').first();
    if (await usernameInput.isVisible().catch(() => false)) {
      await usernameInput.fill('admin');
      const passwordInput = page.locator('input[type="password"]').first();
      if (await passwordInput.isVisible().catch(() => false)) {
        await passwordInput.fill('admin123');
      }
      const submitBtn = page.locator('button[type="submit"], button:has-text("Sign In"), button:has-text("Login")').first();
      if (await submitBtn.isVisible().catch(() => false)) {
        await submitBtn.click();
        await page.waitForTimeout(3000);
      }
    }

    console.log('Navigating directly to item-master tab...');
    await page.evaluate(() => {
      // Simulate selecting item-master tab
      const evt = new CustomEvent('navigate-tab', { detail: 'item-master' });
      window.dispatchEvent(evt);
    });
    await page.waitForTimeout(3000);

  } catch (err) {
    console.error('Script Error:', err);
  } finally {
    await browser.close();
  }
})();
