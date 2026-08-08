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

(async () => {
  console.log('=== LAUNCHING VISIBLE GOOGLE CHROME (HEADED MODE) ===');

  let browser;
  try {
    // Try launching installed Google Chrome
    browser = await chromium.launch({ 
      channel: 'chrome', 
      headless: false, 
      slowMo: 450,
      args: ['--start-maximized']
    });
    console.log('[OK] Google Chrome launched successfully!');
  } catch (err) {
    console.log('Google Chrome channel launch failed, falling back to default Chromium...', err.message);
    browser = await chromium.launch({ 
      headless: false, 
      slowMo: 450,
      args: ['--start-maximized']
    });
  }

  const context = await browser.newContext({ viewport: null });
  const page = await context.newPage();

  console.log('Navigating to http://localhost:3000 ...');
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // Perform login with visible typing delay
  const usernameInput = page.locator('input[type="text"], input[name="username"]').first();
  if (await usernameInput.isVisible().catch(() => false)) {
    console.log('Typing username: admin ...');
    await usernameInput.click();
    await usernameInput.fill('admin');
    await page.waitForTimeout(500);

    const passwordInput = page.locator('input[type="password"]').first();
    if (await passwordInput.isVisible().catch(() => false)) {
      console.log('Typing password: admin123 ...');
      await passwordInput.click();
      await passwordInput.fill('admin123');
      await page.waitForTimeout(500);
    }

    const submitBtn = page.locator('button[type="submit"], button:has-text("Sign In"), button:has-text("Login")').first();
    if (await submitBtn.isVisible().catch(() => false)) {
      console.log('Clicking Sign In button...');
      await submitBtn.click();
      await page.waitForTimeout(3000);
    }
  }

  // Open Setup Wizard
  console.log('Navigating to Setup Wizard (company-setup)...');
  await page.evaluate(() => localStorage.removeItem('smriti_setup_completed'));
  await page.goto('http://localhost:3000?tab=company-setup', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  console.log('===========================================================');
  console.log('>>> GOOGLE CHROME IS NOW LIVE & VISIBLE ON YOUR DESKTOP <<<');
  console.log('>>> CURRENT STEP: 1 (WELCOME & SETUP MODE SELECTION)    <<<');
  console.log('>>> BROWSER WILL REMAIN OPEN UNTIL YOU CLOSE IT OR EXIT <<<');
  console.log('===========================================================');

  // Prevent process exit so Google Chrome stays open permanently
  await new Promise(() => {});
})();
