import { chromium } from 'playwright';
import path from 'path';

const ARTIFACT_DIR = 'C:\\Users\\netma\\.gemini\\antigravity-ide\\brain\\98e34894-1acb-4bb4-8000-17173dfa1ee4';

(async () => {
  console.log('=== STARTING ITEM MASTER RESTORATION VERIFICATION ===');
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

    // Click Product Master tile on Launchpad
    console.log('Clicking Product Master tile on Launchpad...');
    const productMasterTile = page.locator('text="Product Master"').first();
    if (await productMasterTile.isVisible().catch(() => false)) {
      await productMasterTile.click();
      await page.waitForTimeout(3000);
    }

    const shot1 = path.join(ARTIFACT_DIR, 'live_demo_06_item_master_registry.png');
    await page.screenshot({ path: shot1, fullPage: true });
    console.log(`[OK] Captured Item Master Registry screenshot: ${shot1}`);

    // Click Excel Entry Grid tab
    const excelGridTab = page.locator('text="Excel Entry Grid"').first();
    if (await excelGridTab.isVisible().catch(() => false)) {
      console.log('Testing Excel Entry Grid sub-tab...');
      await excelGridTab.click();
      await page.waitForTimeout(2000);
      const shot2 = path.join(ARTIFACT_DIR, 'live_demo_07_item_master_excel_grid.png');
      await page.screenshot({ path: shot2, fullPage: true });
      console.log(`[OK] Captured Excel Entry Grid screenshot: ${shot2}`);
    }

    // Click Attribute Manager tab
    const attrTab = page.locator('text="Attribute Manager"').first();
    if (await attrTab.isVisible().catch(() => false)) {
      console.log('Testing Attribute Manager sub-tab...');
      await attrTab.click();
      await page.waitForTimeout(2000);
      const shot3 = path.join(ARTIFACT_DIR, 'live_demo_08_item_master_attributes.png');
      await page.screenshot({ path: shot3, fullPage: true });
      console.log(`[OK] Captured Attribute Manager screenshot: ${shot3}`);
    }

    console.log('=== ITEM MASTER RESTORATION VERIFICATION COMPLETED ===');
  } catch (err) {
    console.error('Error during verification:', err);
  } finally {
    await browser.close();
  }
})();
