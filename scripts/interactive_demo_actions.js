/**
 * Project      : SMRITI Retail OS
 * Module       : Desktop Interactive Guided Actions Tour (SLP-001 v1.0)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * Version      : 5.4.0
 */

import { chromium } from 'playwright';

(async () => {
  console.log('=== LAUNCHING SMRITI LAUNCHPAD GUIDED DEMO ACTIONS TOUR ===');

  const browser = await chromium.launch({
    headless: false,
    args: ['--start-maximized']
  });

  const context = await browser.newContext({ viewport: null });
  const page = await context.newPage();

  try {
    console.log('[STEP 1] Navigating to http://localhost:3000...');
    await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);

    // Auto Login
    const usernameInput = page.locator('input[type="text"], input[name="username"]').first();
    if (await usernameInput.isVisible().catch(() => false)) {
      console.log('[STEP 2] Authenticating as Store Manager (manager / Password@123)...');
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

    console.log('[STEP 3] Digital Business Desktop (SLP-001) Loaded. Inspecting Zone B KPIs...');
    await page.waitForTimeout(2500);

    console.log('[STEP 4] Opening Universal Search Modal (Ctrl+K)...');
    await page.keyboard.press('Control+k');
    await page.waitForTimeout(1500);

    const searchInput = page.locator('input[placeholder*="Search across SKUs"]').first();
    if (await searchInput.isVisible().catch(() => false)) {
      console.log('Typing search query: "POS"...');
      await searchInput.fill('POS');
      await page.waitForTimeout(2000);

      console.log('Typing search query: "Basmati"...');
      await searchInput.fill('Basmati');
      await page.waitForTimeout(2000);

      console.log('Dismissing search modal (ESC)...');
      await page.keyboard.press('Escape');
      await page.waitForTimeout(1500);
    }

    console.log('[STEP 5] Navigating to Launchpad Configuration Panel...');
    const configBtn = page.locator('button:has-text("Launchpad Config"), a:has-text("Launchpad Config"), text="Launchpad Config"').first();
    if (await configBtn.isVisible().catch(() => false)) {
      await configBtn.click();
    } else {
      // Fallback click via sidebar or tab switch
      await page.evaluate(() => {
        const evt = new CustomEvent('smriti_switch_tab', { detail: 'launchpad-config' });
        window.dispatchEvent(evt);
      });
    }
    await page.waitForTimeout(2500);

    console.log('[STEP 6] Guided Demo Tour Completed. Browser window will remain open for user inspection.');
    await new Promise((resolve) => setTimeout(resolve, 120000));
  } catch (err) {
    console.error('Guided demo error:', err);
  } finally {
    await browser.close();
  }
})();
