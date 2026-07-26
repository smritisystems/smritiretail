import { chromium } from 'playwright';

(async () => {
  console.log('=== CAPTURING EXACT ITEM MASTER RUNTIME ERROR STACK TRACE ===');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  page.on('pageerror', (err) => {
    console.error('[PAGE ERROR STACK]:', err.stack || err.message);
  });

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      console.error('[CONSOLE ERROR]:', msg.text());
    }
  });

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

    await page.evaluate(() => localStorage.setItem('smriti_setup_completed', 'true'));
    console.log('Navigating to http://localhost:3000?tab=item-master ...');
    await page.goto('http://localhost:3000?tab=item-master', { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);

  } catch (err) {
    console.error('Test error:', err);
  } finally {
    await browser.close();
  }
})();
