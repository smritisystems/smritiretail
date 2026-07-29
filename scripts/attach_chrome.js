import { chromium } from 'playwright';

(async () => {
  console.log('=== ATTACHING TO LOCAL PHYSICAL GOOGLE CHROME ON PORT 9222 ===');
  try {
    const browser = await chromium.connectOverCDP('http://localhost:9222');
    const defaultContext = browser.contexts()[0];
    const page = defaultContext.pages()[0] || await defaultContext.newPage();

    console.log('[OK] Successfully attached to physical desktop Chrome window!');
    await page.goto('http://localhost:3000?tab=company-setup', { waitUntil: 'networkidle' });

    console.log('Attached to physical Chrome. Keeping session active...');
    await new Promise(() => {});
  } catch (err) {
    console.log('CDP attach status:', err.message);
  }
})();
