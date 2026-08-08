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
  console.log('=== VERIFYING SETUP WIZARD STEPS (WITH AUTH) ===');
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

    // Force setup incomplete to trigger wizard
    await page.evaluate(() => localStorage.removeItem('smriti_setup_completed'));
    await page.goto('http://localhost:3000?tab=company-setup', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2500);

    const shot1 = path.join(ARTIFACT_DIR, 'setup_wizard_01_welcome.png');
    await page.screenshot({ path: shot1, fullPage: true });
    console.log(`[OK] Captured Step 1 Welcome screenshot: ${shot1}`);

    // Click Next
    const nextBtn = page.locator('button:has-text("Next"), button:has-text("Continue")').first();
    if (await nextBtn.isVisible().catch(() => false)) {
      await nextBtn.click();
      await page.waitForTimeout(2000);
      const shot2 = path.join(ARTIFACT_DIR, 'setup_wizard_02_business_profile.png');
      await page.screenshot({ path: shot2, fullPage: true });
      console.log(`[OK] Captured Step 2 Business Profile screenshot: ${shot2}`);
    }

  } catch (err) {
    console.error('Error during setup wizard verification:', err);
  } finally {
    await browser.close();
  }
})();
