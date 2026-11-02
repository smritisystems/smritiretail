"""
Project      : SMRITI Retail OS
Repository   : SMRITIRetailNX
Organization : AITDL NETWORKS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.99.19
Created      : 2026-11-02
Modified     : 2026-11-02
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Visual Verification & Automated UI Evidence Capture
"""

import os
import sys
import json
import time
from playwright.sync_api import sync_playwright

ARTIFACT_DIR = r"C:\Users\netma\.gemini\antigravity\brain\671f7b38-6920-4865-aa83-f2841726f917"
EVIDENCE_DIR = r"F:\SMRITRretailNX\docs\walkthrough\reports\evidence"

def main():
    os.makedirs(EVIDENCE_DIR, exist_ok=True)
    os.makedirs(ARTIFACT_DIR, exist_ok=True)

    with sync_playwright() as p:
        print("1. Launching headless Chromium...", flush=True)
        browser = p.chromium.launch(headless=True)
        
        # 1920x1080 Viewport (Desktop)
        context = browser.new_context(
            viewport={"width": 1920, "height": 1080},
            device_scale_factor=1.0,
        )
        page = context.new_page()

        print("2. Navigating to SMRITI Retail OS login page...", flush=True)
        page.goto("http://localhost:3000/", timeout=20000)
        time.sleep(2)

        # Check if Login screen is visible
        login_btn = page.locator("button:has-text('Login')").first
        if login_btn.is_visible():
            print("3. Logging in via 1-click Admin button...", flush=True)
            admin_btn = page.locator("button:has-text('Admin')").first
            if admin_btn.is_visible():
                admin_btn.click()
                time.sleep(0.5)
            login_btn.click()
            time.sleep(3)

        print("4. Clicking Reports card on Dashboard...", flush=True)
        # Target the exact button in RegularUxDashboard
        reports_btn = page.locator("button").filter(has_text="View Reports").first
        if reports_btn.is_visible():
            reports_btn.click()
            print("   Clicked 'View Reports' button!", flush=True)
        else:
            print("   View Reports button not found directly, clicking Reports in sidebar/nav...", flush=True)
            page.locator("text=Reports").first.click()

        print("5. Waiting for Reporting Center to load...", flush=True)
        time.sleep(5)

        # Capture Desktop Full Viewport
        desktop_evidence = os.path.join(EVIDENCE_DIR, "reporting_center_workspace_hub_desktop.png")
        desktop_artifact = os.path.join(ARTIFACT_DIR, "reporting_center_workspace_hub_desktop.png")
        
        page.screenshot(path=desktop_evidence, full_page=False)
        page.screenshot(path=desktop_artifact, full_page=False)
        print(f"6. Captured desktop screenshot: {desktop_evidence}", flush=True)

        browser.close()
        print("Verification complete!")

if __name__ == "__main__":
    main()
