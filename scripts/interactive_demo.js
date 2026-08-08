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

let browser = null;
let page = null;

(async () => {
  console.log('=== STARTING INTERACTIVE HEADED PLAYWRIGHT DEMO ===');
  browser = await chromium.launch({ 
    headless: false, 
    slowMo: 500,
    args: ['--start-maximized']
  });
  
  const context = await browser.newContext({ viewport: null });
  page = await context.newPage();

  console.log('Navigating to http://localhost:3000 ...');
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // Authenticate
  const usernameInput = page.locator('input[type="text"], input[name="username"]').first();
  if (await usernameInput.isVisible().catch(() => false)) {
    console.log('Logging in as admin / admin123 ...');
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

  // Navigate to Setup Wizard
  console.log('Navigating to Setup Wizard (company-setup)...');
  await page.evaluate(() => localStorage.removeItem('smriti_setup_completed'));
  await page.goto('http://localhost:3000?tab=company-setup', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  console.log('[STEP 1 READY] The visible Chromium browser is now open on your desktop showing Step 1: Welcome & Setup Mode.');
  console.log('Keeping browser open and waiting for user review...');

  // Keep process alive so browser window stays open
  await new Promise(() => {});
})();
