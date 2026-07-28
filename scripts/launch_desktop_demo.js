/**
 * Project      : SMRITI Retail OS
 * Module       : Desktop Interactive Demo Launcher (SLP-001 v1.0)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * Version      : 5.4.0
 */

import { chromium } from 'playwright';

(async () => {
  console.log('=== LAUNCHING SMRITI RETAIL OS — DESKTOP LIVE DEMO ===');
  
  const browser = await chromium.launch({
    headless: false,
    args: ['--start-maximized']
  });

  const context = await browser.newContext({ viewport: null });
  const page = await context.newPage();

  try {
    console.log('Navigating to http://localhost:3000...');
    await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);

    // Auto login if on login screen
    const usernameInput = page.locator('input[type="text"], input[name="username"]').first();
    if (await usernameInput.isVisible().catch(() => false)) {
      console.log('Logging in as Store Manager (manager)...');
      await usernameInput.fill('manager');
      const passwordInput = page.locator('input[type="password"]').first();
      if (await passwordInput.isVisible().catch(() => false)) {
        await passwordInput.fill('Password@123');
      }
      const submitBtn = page.locator('button[type="submit"]').first();
      if (await submitBtn.isVisible().catch(() => false)) {
        await submitBtn.click();
        await page.waitForTimeout(2000);
      }
    }

    console.log('[READY] SMRITI Digital Business Desktop (SLP-001) is now open on your screen!');
    console.log('Browser window will remain open for interactive demonstration.');

    // Keep process alive so browser remains open for user
    await new Promise((resolve) => setTimeout(resolve, 60000));
  } catch (err) {
    console.error('Demo error:', err);
  } finally {
    await browser.close();
  }
})();
