import { chromium } from 'playwright';
import path from 'path';

const ARTIFACT_DIR = 'C:\\Users\\netma\\.gemini\\antigravity-ide\\brain\\98e34894-1acb-4bb4-8000-17173dfa1ee4';

(async () => {
  console.log('=== STARTING ENHANCED PLAYWRIGHT 1.62.0 DEMO ===');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  try {
    console.log('Navigating to http://localhost:3000 ...');
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);

    // Login as admin
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
        await page.waitForTimeout(2500);
      }
    }

    // Click Barcode Label Hub tile on Launchpad
    console.log('Clicking Barcode Label Hub tile on Launchpad...');
    const barcodeTile = page.locator('text="Barcode Label Hub"').first();
    if (await barcodeTile.isVisible().catch(() => false)) {
      await barcodeTile.click();
      await page.waitForTimeout(3000);
    }

    const shot1 = path.join(ARTIFACT_DIR, 'live_demo_04_barcode_hub.png');
    await page.screenshot({ path: shot1, fullPage: true });
    console.log(`[OK] Captured Barcode Hub workspace screenshot: ${shot1}`);

    // If there is a "Show Barcode Demo" or "Print Document" or template selector, click it
    const showDemoBtn = page.locator('button:has-text("Show Barcode Demo"), button:has-text("Print")').first();
    if (await showDemoBtn.isVisible().catch(() => false)) {
      console.log('Clicking demo action button...');
      await showDemoBtn.click();
      await page.waitForTimeout(2500);
    }

    // Select 50x25 Product Barcode Label template if button available
    const labelTemplateBtn = page.locator('text="Product Barcode Label"').first();
    if (await labelTemplateBtn.isVisible().catch(() => false)) {
      console.log('Selecting 50x25mm Product Barcode Label template...');
      await labelTemplateBtn.click();
      await page.waitForTimeout(2000);
    }

    const shot2 = path.join(ARTIFACT_DIR, 'live_demo_05_label_preview.png');
    await page.screenshot({ path: shot2, fullPage: true });
    console.log(`[OK] Captured Label Preview screenshot: ${shot2}`);

    console.log('=== ENHANCED DEMO COMPLETED SUCCESSFULLY ===');
  } catch (err) {
    console.error('Error during enhanced demo:', err);
  } finally {
    await browser.close();
  }
})();
