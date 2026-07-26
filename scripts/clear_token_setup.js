import { chromium } from 'playwright';

(async () => {
  console.log('=== CLEARING STALE LOCALSTORAGE TOKEN & OPENING SETUP WIZARD ===');
  const browser = await chromium.launch({ 
    channel: 'chrome',
    headless: false,
    slowMo: 300,
    args: ['--start-maximized']
  });

  const context = await browser.newContext({ viewport: null });
  const page = await context.newPage();

  await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
  // Clear any expired tokens
  await page.evaluate(() => {
    localStorage.removeItem('smriti_jwt_token');
    localStorage.removeItem('smriti_session_token');
    localStorage.removeItem('smriti_setup_completed');
  });

  console.log('[OK] Cleared stale token in Chrome!');
  await page.goto('http://localhost:3000?tab=company-setup', { waitUntil: 'networkidle' });
  console.log('[OK] Setup Wizard loaded cleanly in Google Chrome!');

  await new Promise(() => {});
})();
