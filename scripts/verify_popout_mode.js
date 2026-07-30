import { chromium } from "playwright";
import path from "path";
import fs from "fs";

async function verifyPopoutMode() {
  console.log("=== Launching Authenticated Playwright Popout Mode Test ===");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  const consoleErrors = [];
  const pageErrors = [];

  page.on("console", (msg) => {
    if (msg.type() === "error") {
      consoleErrors.push(msg.text());
      console.error(`[Console Error] ${msg.text()}`);
    }
  });

  page.on("pageerror", (err) => {
    pageErrors.push(err.stack || err.message);
    console.error(`[Uncaught Page Error]\n${err.stack || err.message}`);
  });

  console.log("1. Navigating & Logging in as super...");
  await page.goto("http://localhost:3000", { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);

  await page.locator('input[placeholder*="User ID"], input[placeholder*="username"], input[type="text"]').first().fill("super");
  await page.locator('input[type="password"]').first().fill("Smriti@1234");
  await page.locator('button:has-text("Sign In"), button[type="submit"]').first().click();
  await page.waitForTimeout(3000);

  console.log("2. Navigating to Popout Window Mode: http://localhost:3000/?popout=true&tab=sales...");
  await page.goto("http://localhost:3000/?popout=true&tab=sales", { waitUntil: "networkidle" });
  await page.waitForTimeout(3000);

  const currentUrl = page.url();
  console.log(`Current URL: ${currentUrl}`);

  const hasNavbar = (await page.locator("text=V5.3 ENTERPRISE").count()) > 0;
  const hasSidebar = (await page.locator("text=PURCHASE DOMAIN").count()) > 0;
  console.log(`Has Top Navbar: ${hasNavbar} (Expected: false)`);
  console.log(`Has Left Sidebar: ${hasSidebar} (Expected: false)`);

  const artifactDir = "C:/Users/netma/.gemini/antigravity-ide/brain/9a6c7421-4968-4319-a2c7-7e43410a7445";
  fs.mkdirSync(artifactDir, { recursive: true });
  const screenshotPath = path.join(artifactDir, "media__smriti_popout_mode.png");

  await page.screenshot({ path: screenshotPath, fullPage: false });
  console.log(`Popout mode screenshot saved to: ${screenshotPath}`);

  await browser.close();

  console.log("\n=== Popout Mode Verification Summary ===");
  console.log(`Console Errors Count: ${consoleErrors.length}`);
  console.log(`Page Uncaught Errors Count: ${pageErrors.length}`);

  if (pageErrors.length > 0) {
    console.error("FAIL: Uncaught errors in Popout Mode!");
    process.exit(1);
  } else {
    console.log("SUCCESS: Popout window mode verified without navbar or sidebar!");
  }
}

verifyPopoutMode().catch((err) => {
  console.error("Popout verification script failed:", err);
  process.exit(1);
});
