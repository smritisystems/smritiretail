import { chromium } from 'playwright';
import path from 'path';

const ARTIFACT_DIR = 'C:\\Users\\netma\\.gemini\\antigravity-ide\\brain\\98e34894-1acb-4bb4-8000-17173dfa1ee4';

(async () => {
  console.log('=== LAUNCHING VISIBLE BROWSER LIVE DEMO (HEADLESS: FALSE) ===');
  // Launch visible browser window on desktop screen
  const browser = await chromium.launch({ 
    headless: false, 
    slowMo: 800,
    args: ['--start-maximized']
  });
  const context = await browser.newContext({ viewport: null });
  const page = await context.newPage();

  try {
    console.log('Navigating to http://localhost:3000 ...');
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);

    // Login as admin
    const usernameInput = page.locator('input[type="text"], input[name="username"]').first();
    if (await usernameInput.isVisible().catch(() => false)) {
      console.log('Logging in as admin...');
      await usernameInput.fill('admin');
      const passwordInput = page.locator('input[type="password"]').first();
      if (await passwordInput.isVisible().catch(() => false)) {
        await passwordInput.fill('admin123');
      }
      const submitBtn = page.locator('button[type="submit"], button:has-text("Sign In"), button:has-text("Login")').first();
      if (await submitBtn.isVisible().catch(() => false)) {
        await submitBtn.click();
        console.log('Waiting for authentication to complete...');
        await page.waitForTimeout(4000);
      }
    }

    // Capture Launchpad screenshot
    const shotLaunchpad = path.join(ARTIFACT_DIR, 'live_demo_11_launchpad.png');
    await page.screenshot({ path: shotLaunchpad, fullPage: true });
    console.log(`[OK] Captured Launchpad screenshot: ${shotLaunchpad}`);

    // Click Product Master tile
    console.log('Clicking Product Master tile...');
    const pmTile = page.locator('text="Product Master"').first();
    if (await pmTile.isVisible().catch(() => false)) {
      await pmTile.click();
      await page.waitForTimeout(4000);
    }

    const shotItemMaster = path.join(ARTIFACT_DIR, 'live_demo_12_item_master.png');
    await page.screenshot({ path: shotItemMaster, fullPage: true });
    console.log(`[OK] Captured Item Master Studio screenshot: ${shotItemMaster}`);

    // Click Excel Entry Grid tab
    const excelTab = page.locator('text="Excel Entry Grid"').first();
    if (await excelTab.isVisible().catch(() => false)) {
      console.log('Clicking Excel Entry Grid tab...');
      await excelTab.click();
      await page.waitForTimeout(3000);
    }

    // Click Attribute Manager tab
    const attrTab = page.locator('text="Attribute Manager"').first();
    if (await attrTab.isVisible().catch(() => false)) {
      console.log('Clicking Attribute Manager tab...');
      await attrTab.click();
      await page.waitForTimeout(3000);
    }

    console.log('=== VISIBLE BROWSER LIVE DEMO COMPLETED SUCCESSFULLY ===');
    console.log('Leaving browser window open for 15 seconds so you can interact with it...');
    await page.waitForTimeout(15000);
  } catch (err) {
    console.error('Error during visible browser live demo:', err);
  } finally {
    await browser.close();
  }
})();
