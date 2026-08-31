"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.17.0
Created      : 2026-08-30
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

import sys
import time
from playwright.sync_api import sync_playwright

sys.stdout.reconfigure(encoding='utf-8')

def launch_sales_browser():
    print("Launching visible Chromium window for Sales Studio...")
    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=False,
            args=[
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-dev-shm-usage",
                "--start-maximized"
            ]
        )
        context = browser.new_context(no_viewport=True)
        page = context.new_page()
        print("Navigating to http://localhost:3000/?standalone_tab=sales...")
        page.goto("http://localhost:3000/?standalone_tab=sales", wait_until="networkidle")
        print("✅ Sales Studio window loaded successfully.")
        
        # Keep the browser open for the user
        try:
            while len(context.pages) > 0 and not page.is_closed():
                time.sleep(1)
        except Exception:
            pass

if __name__ == "__main__":
    launch_sales_browser()
