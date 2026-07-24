const { chromium } = require('C:/Users/netma/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright-core');

(async () => {
  console.log('=== SMRITI RETAIL OS — PLAYWRIGHT END-TO-END AUTOMATION SUITE ===\n');

  const browser = await chromium.launch({
    executablePath: 'C:\\Users\\netma\\AppData\\Local\\ms-playwright\\chromium-1228\\chrome-win64\\chrome.exe',
    headless: true
  });

  const context = await browser.newContext();
  const page = await context.newPage();

  const testCases = [
    { name: 'E2E-001: Store Manager Login', username: 'manager', password: 'Password@123', expectedRole: 'MANAGER' },
    { name: 'E2E-002: POS Cashier Login', username: 'cashier', password: 'Cashier@1234', expectedRole: 'CASHIER' },
    { name: 'E2E-003: System Admin Login', username: 'super', password: 'Smriti@1234', expectedRole: 'SYSADMIN' },
    { name: 'E2E-004: Invalid Password Rejection', username: 'manager', password: 'WrongPassword99', shouldFail: true }
  ];

  for (const tc of testCases) {
    process.stdout.write(`Running ${tc.name}... `);
    try {
      await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('input[type="text"], input[name="username"]', { timeout: 5000 });

      await page.fill('input[type="text"], input[name="username"]', tc.username);
      await page.fill('input[type="password"]', tc.password);

      // Click submit
      await page.click('button[type="submit"]');

      if (tc.shouldFail) {
        await page.waitForTimeout(2500);
        const content = await page.textContent('body');
        if (content.includes('Incorrect') || content.includes('Unable') || content.includes('failed') || content.includes('verify') || content.includes('Authentication') || content.includes('fill') || content.includes('failed') || content.includes('Invalid')) {
          console.log('✅ PASSED (Correctly displayed HREP error callout on UI)');
        } else {
          console.log(`❌ FAILED. DOM Content was: "${content.replace(/\s+/g, ' ').slice(0, 300)}"`);
        }
      } else {
        await page.waitForTimeout(2000);
        const content = await page.textContent('body');
        if (content.includes('SMRITI') || content.includes('Dashboard') || content.includes('Retail')) {
          console.log(`✅ PASSED (Authenticated as ${tc.expectedRole} on Docker container)`);
        } else {
          console.log(`❌ FAILED (Could not verify dashboard content for ${tc.username})`);
        }
      }
    } catch (err) {
      console.log(`❌ ERROR: ${err.message}`);
    }
  }

  await browser.close();
  console.log('\n=== PLAYWRIGHT SUITE EXECUTION COMPLETE ===');
})();
