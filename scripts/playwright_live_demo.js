/*
Author & Creator:
Jawahar Ramkripal Mallah

Founder:
SmritiSys
AITDL Networks

Role:
Chief Systems Architect

Web:
smritisys.com | smritibooks.com | aitdl.com

Email:
jawahar.mallah@gmail.com

Copyright © 2026 SmritiSys.
All Rights Reserved.
*/

import { chromium } from 'playwright';
import path from 'path';

const ARTIFACT_DIR = 'C:\\Users\\netma\\.gemini\\antigravity-ide\\brain\\98e34894-1acb-4bb4-8000-17173dfa1ee4';

(async () => {
  console.log('=== LAUNCHING PRODUCT MASTER LIVE DEMO ===');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

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

    // Set setup completed to open Product Master
    await page.evaluate(() => localStorage.setItem('smriti_setup_completed', 'true'));
    await page.goto('http://localhost:3000?tab=item-master', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2500);

    const shot = path.join(ARTIFACT_DIR, 'live_demo_13_item_master_restored.png');
    await page.screenshot({ path: shot, fullPage: true });
    console.log(`[OK] Captured Restored Product Master screenshot: ${shot}`);

  } catch (err) {
    console.error('Error during live demo:', err);
  } fontally: {
    await browser.close();
  }
})();
