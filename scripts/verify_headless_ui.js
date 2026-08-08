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

async function verifyHeadlessUI() {
  console.log("=== Launching Headless Chromium Verification ===");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  const consoleLogs = [];
  const pageErrors = [];

  page.on("console", (msg) => {
    const text = msg.text();
    consoleLogs.push(`[Console ${msg.type()}] ${text}`);
    if (msg.type() === "error") {
      console.error(`[Browser Console Error] ${text}`);
    }
  });

  page.on("pageerror", (err) => {
    pageErrors.push(err.stack || err.message);
    console.error(`[Page Uncaught Error Stack]\n${err.stack || err.message}`);
  });



  console.log("Navigating to http://localhost:3000...");
  await page.goto("http://localhost:3000", { waitUntil: "networkidle" });

  console.log("Waiting 3000ms for application initialization...");
  await page.waitForTimeout(3000);

  const title = await page.title();
  console.log(`Page Title: "${title}"`);

  const artifactDir = "C:/Users/netma/.gemini/antigravity-ide/brain/9a6c7421-4968-4319-a2c7-7e43410a7445";
  fs.mkdirSync(artifactDir, { recursive: true });
  const screenshotPath = path.join(artifactDir, "media__smriti_ui_headless.png");

  await page.screenshot({ path: screenshotPath, fullPage: false });
  console.log(`Screenshot saved to: ${screenshotPath}`);

  await browser.close();

  console.log("\n=== Headless Verification Summary ===");
  console.log(`Page Title: ${title}`);
  console.log(`Console Logs Count: ${consoleLogs.length}`);
  console.log(`Page Uncaught Errors Count: ${pageErrors.length}`);

  if (pageErrors.length > 0) {
    console.log("Page Errors List:");
    pageErrors.forEach((e) => console.log(` - ${e}`));
    process.exit(1);
  } else {
    console.log("SUCCESS: 0 Uncaught Page Errors! UI initialized cleanly.");
  }
}

verifyHeadlessUI().catch((err) => {
  console.error("Headless verification script failed:", err);
  process.exit(1);
});
