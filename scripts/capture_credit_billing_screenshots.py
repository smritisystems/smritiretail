"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.16.0
Created      : 2026-09-27
Modified     : 2026-09-27
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Headless Screenshot Capture for Redesigned Credit Billing
"""

import asyncio
import json
import os
import sys
import urllib.request
from playwright.async_api import async_playwright

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")

BASE_URL = "http://localhost:3000"
API_URL = "http://localhost:1981"
ARTIFACT_DIR = r"C:\Users\netma\.gemini\antigravity-ide\brain\aeb1c556-2c4b-43e6-8852-17fa332a1c10"
os.makedirs(ARTIFACT_DIR, exist_ok=True)


def get_scoped_tokens():
    login_url = f"{API_URL}/api/v1/auth/login"
    payload = json.dumps({"username": "admin", "password": "Admin@123"}).encode()
    req = urllib.request.Request(
        login_url,
        data=payload,
        headers={"Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read().decode())
            init_token = data.get("access_token")

        switch_url = f"{API_URL}/api/v1/auth/switch-context"
        switch_payload = json.dumps({
            "target_company_id": "COMP-001",
            "target_branch_id": "MAIN"
        }).encode()
        req2 = urllib.request.Request(
            switch_url,
            data=switch_payload,
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {init_token}"
            }
        )
        with urllib.request.urlopen(req2) as resp2:
            data2 = json.loads(resp2.read().decode())
            scoped_token = data2.get("access_token")
            return scoped_token or init_token
    except Exception as e:
        print(f"[AUTH ERROR] Failed to get scoped token: {e}")
        return None


async def main():
    token = get_scoped_tokens()
    print(f"Obtained Tenant-Scoped JWT token: {'YES' if token else 'NO'}")

    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            args=[
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-dev-shm-usage",
                "--disable-gpu",
                "--window-size=1920,1080",
            ],
        )
        context = await browser.new_context(
            viewport={"width": 1920, "height": 1080},
            device_scale_factor=1,
        )
        page = await context.new_page()

        page.on("console", lambda msg: print(f"[CONSOLE {msg.type.upper()}] {msg.text}") if msg.type in ("error", "warning") else None)
        page.on("pageerror", lambda err: print(f"[PAGE ERROR] {err}"))

        # Step 1: Pre-seed LocalStorage with company & tenant context
        print("Pre-seeding authenticated local storage context...")
        await page.goto(BASE_URL, wait_until="commit")
        await page.evaluate(f"""() => {{
            localStorage.setItem('smriti_jwt_token', '{token or ""}');
            localStorage.setItem('smriti_company_id', 'COMP-001');
            localStorage.setItem('smriti_company_code', '001');
            localStorage.setItem('smriti_branch_id', 'MAIN');
            localStorage.setItem('smriti_branch_code', 'MAIN');
            localStorage.setItem('smriti_company_name', 'Tattly Threads');
            localStorage.setItem('smriti_branch_name', 'Main Branch');
            localStorage.setItem('smriti_active_tab', 'credit-billing');
        }}""")

        # Step 2: Navigate directly to app with credit-billing tab
        target_url = f"{BASE_URL}/?tab=credit-billing"
        print(f"Navigating to {target_url}...")
        await page.goto(target_url, wait_until="networkidle")
        await page.wait_for_timeout(3500)

        # Handle login if login screen is specifically active
        pw_input = page.locator('input[type="password"]')
        if await pw_input.count() > 0 and await pw_input.first.is_visible():
            print("Login screen detected, performing login...")
            await page.fill('input[type="text"]', "admin")
            await page.fill('input[type="password"]', "Admin@123")
            login_submit = page.locator('button[type="submit"], button:has-text("Sign In"), button:has-text("Login")')
            if await login_submit.count() > 0:
                await login_submit.first.click()
                await page.wait_for_timeout(3000)

        # Handle company selection if visible
        enter_ws = page.locator('button:has-text("Enter Workspace")')
        if await enter_ws.count() > 0 and await enter_ws.first.is_visible():
            print("Company selection visible, clicking Enter Workspace...")
            await enter_ws.first.click()
            await page.wait_for_timeout(3000)

        # Ensure any leftover dropdown menu or focus is dismissed
        await page.keyboard.press("Escape")
        await page.wait_for_timeout(500)

        # Check if Credit Billing Terminal is already rendered
        credit_sale_badge = page.locator('span:has-text("Credit Sale")')
        if await credit_sale_badge.count() == 0:
            print("Credit Billing Terminal not active yet, clicking Credit Billing toggle...")
            credit_terminal_toggle = page.locator('button[title="Credit Billing Terminal"]')
            if await credit_terminal_toggle.count() > 0 and await credit_terminal_toggle.first.is_visible():
                await credit_terminal_toggle.first.click()
                await page.wait_for_timeout(2000)

        # Wait for Credit Billing Terminal to mount and populate
        await page.wait_for_selector('h1:has-text("Credit Billing")', timeout=10000)
        await page.wait_for_timeout(1000)

        # Capture Screenshot 1: Full Main Workspace
        img1_path = os.path.join(ARTIFACT_DIR, "credit_billing_v3_workspace.png")
        if os.path.exists(img1_path):
            try:
                os.remove(img1_path)
            except Exception:
                pass
        await page.screenshot(path=img1_path, full_page=True)
        print(f"Captured Screenshot 1: {img1_path}")

        # Open Customer Master Modal & Product List Modal
        print("Opening Customer Master and Product List modals...")
        plus_cust_btn = page.locator('button[title*="Customer Master"]')
        if await plus_cust_btn.count() > 0:
            await plus_cust_btn.first.click()
            await page.wait_for_timeout(800)

        product_list_btn = page.locator('button:has-text("Product List")')
        if await product_list_btn.count() > 0:
            await product_list_btn.first.click()
            await page.wait_for_timeout(800)

        img2_path = os.path.join(ARTIFACT_DIR, "credit_billing_v3_modals.png")
        if os.path.exists(img2_path):
            try:
                os.remove(img2_path)
            except Exception:
                pass
        await page.screenshot(path=img2_path, full_page=True)
        print(f"Captured Screenshot 2: {img2_path}")

        # Close floating modals by pressing Escape
        print("Closing floating modals...")
        await page.keyboard.press("Escape")
        await page.wait_for_timeout(400)
        await page.keyboard.press("Escape")
        await page.wait_for_timeout(600)

        # Toggle Docked Product List view
        print("Toggling Docked Product List...")
        add_item_btn = page.locator('button:has-text("+ Add Item")')
        if await add_item_btn.count() > 0:
            await add_item_btn.first.click()
            await page.wait_for_timeout(1500)

        img3_path = os.path.join(ARTIFACT_DIR, "credit_billing_v3_catalog.png")
        if os.path.exists(img3_path):
            try:
                os.remove(img3_path)
            except Exception:
                pass
        await page.screenshot(path=img3_path, full_page=True)
        print(f"Captured Screenshot 3: {img3_path}")

        await browser.close()
        print("All screenshots captured successfully.")


if __name__ == "__main__":
    asyncio.run(main())
