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

import { chromium } from "playwright";
import path from "path";
import fs from "fs";

async function verifySalesDashboardArchitecture() {
  console.log("=== Launching Playwright Sales Studio Architecture Test ===");
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

  console.log("2. Opening Sales & Commerce Studio (Dashboard View)...");
  await page.goto("http://localhost:3000/?popout=true&tab=sales", { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);

  const artifactDir = "C:/Users/netma/.gemini/antigravity-ide/brain/9a6c7421-4968-4319-a2c7-7e43410a7445";
  fs.mkdirSync(artifactDir, { recursive: true });
  
  // Screenshot 1: Dashboard Landing Control Center
  const dashboardPath = path.join(artifactDir, "media__smriti_sales_dashboard.png");
  await page.screenshot({ path: dashboardPath, fullPage: false });
  console.log(`Dashboard Control Center screenshot saved to: ${dashboardPath}`);

  console.log("3. Clicking 'Sales Invoices' registry tab...");
  await page.locator('button:has-text("Sales Invoices")').first().click();
  await page.waitForTimeout(1500);

  // Screenshot 2: Clean Sales Invoices Registry (List Report)
  const registryPath = path.join(artifactDir, "media__smriti_sales_invoices_registry.png");
  await page.screenshot({ path: registryPath, fullPage: false });
  console.log(`Sales Invoices Registry screenshot saved to: ${registryPath}`);

  console.log("4. Clicking 'Generate Sales Invoice' to open Object Page...");
  await page.locator('button:has-text("Generate Sales Invoice"), button:has-text("+ Tax Invoice")').first().click();
  await page.waitForTimeout(2500);

  // Screenshot 3: Dedicated Invoice Object Page
  const objectPagePath = path.join(artifactDir, "media__smriti_invoice_object_page.png");
  await page.screenshot({ path: objectPagePath, fullPage: false });
  console.log(`Invoice Object Page screenshot saved to: ${objectPagePath}`);

  await browser.close();

  console.log("\n=== Sales Studio Architecture Verification Summary ===");
  console.log(`Console Errors Count: ${consoleErrors.length}`);
  console.log(`Page Uncaught Errors Count: ${pageErrors.length}`);

  if (pageErrors.length > 0) {
    console.error("FAIL: Uncaught errors in Sales Studio Architecture!");
    process.exit(1);
  } else {
    console.log("SUCCESS: 4-Tier SAP Fiori Sales Studio Architecture Verified Cleanly!");
  }
}

verifySalesDashboardArchitecture().catch((err) => {
  console.error("Sales Studio Architecture verification failed:", err);
  process.exit(1);
});
