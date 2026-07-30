import { chromium } from "playwright";
import path from "path";
import fs from "fs";

async function verifyInvoiceWorkspace() {
  console.log("=== Launching Playwright Sales Invoice Workspace Wireframe Test ===");
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

  console.log("2. Opening Sales Invoices Studio Sub-View...");
  await page.goto("http://localhost:3000/?popout=true&tab=sales", { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);

  console.log("3. Clicking 'SALES INVOICES' tab...");
  await page.locator('button:has-text("SALES INVOICES")').first().click();
  await page.waitForTimeout(1500);

  console.log("4. Clicking 'Generate Sales Invoice' button...");
  await page.locator('button:has-text("Generate Sales Invoice")').first().click();
  await page.waitForTimeout(3000);

  const artifactDir = "C:/Users/netma/.gemini/antigravity-ide/brain/9a6c7421-4968-4319-a2c7-7e43410a7445";
  fs.mkdirSync(artifactDir, { recursive: true });
  const screenshotPath = path.join(artifactDir, "media__smriti_invoice_workspace.png");

  await page.screenshot({ path: screenshotPath, fullPage: false });
  console.log(`Invoice workspace screenshot saved to: ${screenshotPath}`);

  await browser.close();

  console.log("\n=== Sales Invoice Workspace Verification Summary ===");
  console.log(`Console Errors Count: ${consoleErrors.length}`);
  console.log(`Page Uncaught Errors Count: ${pageErrors.length}`);

  if (pageErrors.length > 0) {
    console.error("FAIL: Uncaught errors in Sales Invoice Workspace!");
    process.exit(1);
  } else {
    console.log("SUCCESS: Sales Invoice workspace wireframe component rendered cleanly!");
  }
}

verifyInvoiceWorkspace().catch((err) => {
  console.error("Invoice workspace verification script failed:", err);
  process.exit(1);
});
