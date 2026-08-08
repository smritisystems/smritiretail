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

async function verifyLoginAndWorkspace() {
  console.log("=== Launching Playwright Login & Workspace Test ===");
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

  console.log("1. Navigating to http://localhost:3000...");
  await page.goto("http://localhost:3000", { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);

  console.log("2. Filling credentials (User: 'super', Password: '***')...");
  const userInput = page.locator('input[placeholder*="User ID"], input[placeholder*="username"], input[type="text"]').first();
  const passInput = page.locator('input[type="password"]').first();

  await userInput.fill("super");
  await passInput.fill("Smriti@1234");

  console.log("3. Clicking Sign In button...");
  const signInButton = page.locator('button:has-text("Sign In"), button[type="submit"]').first();
  await signInButton.click();

  console.log("4. Waiting for post-login navigation & rendering...");
  await page.waitForTimeout(4000);

  const currentUrl = page.url();
  console.log(`Post-Login URL: ${currentUrl}`);

  const artifactDir = "C:/Users/netma/.gemini/antigravity-ide/brain/9a6c7421-4968-4319-a2c7-7e43410a7445";
  fs.mkdirSync(artifactDir, { recursive: true });
  const screenshotPath = path.join(artifactDir, "media__smriti_post_login.png");

  await page.screenshot({ path: screenshotPath, fullPage: false });
  console.log(`Post-login screenshot saved to: ${screenshotPath}`);

  const bodyText = await page.innerText("body");
  console.log("\nPost-Login Visible Elements Snippet:");
  console.log(bodyText.split("\n").filter(Boolean).slice(0, 15).join(" | "));

  await browser.close();

  console.log("\n=== Test Results Summary ===");
  console.log(`Current URL: ${currentUrl}`);
  console.log(`Console Errors Count: ${consoleErrors.length}`);
  console.log(`Page Uncaught Errors Count: ${pageErrors.length}`);

  if (pageErrors.length > 0) {
    console.error("FAIL: Uncaught errors encountered post-login!");
    process.exit(1);
  } else {
    console.log("SUCCESS: User 'super' logged in cleanly! Post-login UI verified.");
  }
}

verifyLoginAndWorkspace().catch((err) => {
  console.error("Login verification script failed:", err);
  process.exit(1);
});
