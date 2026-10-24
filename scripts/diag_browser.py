"""
Diagnostic script to check browser console and render BarcodeStudioTab
"""
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    page.on("console", lambda msg: print(f"[CONSOLE {msg.type}] {msg.text}"))
    page.on("pageerror", lambda err: print(f"[PAGE ERROR] {err}"))
    
    page.goto("http://localhost:3000/?standalone_tab=barcode")
    page.wait_for_timeout(2000)
    
    if page.locator("button:has-text('Admin')").count() > 0:
        page.locator("button:has-text('Admin')").click()
        page.wait_for_timeout(500)
        page.locator("button:has-text('Login')").click()
        page.wait_for_timeout(3000)

    page.wait_for_timeout(4000)
    print("Final URL:", page.url)
    browser.close()
