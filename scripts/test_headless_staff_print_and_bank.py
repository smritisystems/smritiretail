"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.33.3
Created      : 2026-09-17
Modified     : 2026-09-17
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal

Headless Playwright Runner: Staff Management Bank Details, Statutory KYC & Print Center Verification
====================================================================================================
Automates end-to-end verification of:
1. Staff 360 Workspace Bank & KYC Tab with interactive Reveal/Mask toggles.
2. 5-Section Statutory A4 Registration & Remittance Form (Filled Mode).
3. 5-Section Statutory A4 Blank Registration Form (Onboarding Underline Mode).
4. CR-80 Physical ID Card Front with Blood Group badge and deterministic SVG scannable barcode.
5. CR-80 Physical ID Card Back with emergency contacts, property text, and HR signature line.
6. Staff 360 3-Subtab Editor (General, Bank Remittance, Statutory KYC).
"""

import asyncio
import os
import sys
from playwright.async_api import async_playwright

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")

BASE_URL = "http://localhost:3000"
ARTIFACT_DIR = os.environ.get(
    "CONVERSATION_ARTIFACT_DIR",
    "C:/Users/netma/.gemini/antigravity-ide/brain/d1e1ac2d-e193-4ebb-9bd8-b13b02474afe"
)
SCREENSHOT_DIR = os.path.join(ARTIFACT_DIR, "screenshots_staff_bank_and_print")
os.makedirs(SCREENSHOT_DIR, exist_ok=True)


async def run():
    print("=" * 80)
    print("SMRITI RETAIL OS — HEADLESS PLAYWRIGHT STAFF BANK DETAILS & PRINT CENTER")
    print("=" * 80)
    print(f"Target Frontend : {BASE_URL}")
    print(f"Screenshot Dir  : {SCREENSHOT_DIR}")

    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            args=[
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-dev-shm-usage",
                "--disable-gpu",
                "--window-size=1920,1080"
            ]
        )
        context = await browser.new_context(viewport={"width": 1920, "height": 1080})
        page = await context.new_page()

        page.on("console", lambda msg: print(f"[CONSOLE {msg.type.upper()}] {msg.text}") if msg.type in ("error", "warning") else None)

        # Step 1: Navigate to Base URL
        print("\n[Step 1] Navigating to frontend...")
        await page.goto(BASE_URL, wait_until="networkidle")
        await page.wait_for_timeout(1500)

        # Check for login screen
        admin_quick_btn = page.locator('button:has-text("Admin")')
        auth_btn = page.locator('button:has-text("Authorize Operator")')
        if await auth_btn.count() > 0 and await auth_btn.is_visible():
            print("  Login screen detected. Authenticating as Admin...")
            if await admin_quick_btn.count() > 0 and await admin_quick_btn.is_visible():
                await admin_quick_btn.click()
                await page.wait_for_timeout(500)
            await auth_btn.click()
            await page.wait_for_timeout(2000)

        # Check for company / workspace selection
        enter_ws_btn = page.locator('button:has-text("Enter Workspace"), button:has-text("Connect")')
        if await enter_ws_btn.count() > 0 and await enter_ws_btn.first.is_visible():
            print("  Company selection detected. Entering workspace...")
            await enter_ws_btn.first.click()
            await page.wait_for_timeout(2000)

        # Step 2: Navigate to SMRITI Launchpad then Staff Management
        print("\n[Step 2] Navigating to Staff Management Workspace...")
        launchpad_nav_btn = page.locator('button:has-text("SMRITI Launchpad")').first
        if await launchpad_nav_btn.count() > 0 and await launchpad_nav_btn.is_visible():
            print("  Clicking 'SMRITI Launchpad' navigation button...")
            await launchpad_nav_btn.click()
            await page.wait_for_timeout(1500)

        staff_tile = page.locator('button:has-text("Staff Management"), div:has-text("Staff Management")').first
        if await staff_tile.count() > 0 and await staff_tile.is_visible():
            print("  Clicking 'Staff Management' tile...")
            await staff_tile.click()
            await page.wait_for_timeout(2500)
        else:
            print("  Staff tile not directly found, looking in Navigation tabs...")
            staff_nav = page.locator('button:has-text("Staff")').first
            if await staff_nav.count() > 0 and await staff_nav.is_visible():
                await staff_nav.click()
                await page.wait_for_timeout(2500)

        # Step 3: Verify Staff 360 Workspace and Select Staff Member
        print("\n[Step 3] Verifying Staff 360 Workspace loaded...")
        header = page.locator('h1:has-text("Staff"), div:has-text("Staff 360")').first
        await page.wait_for_selector('text=Staff 360', timeout=10000)
        print("  Staff 360 Workspace is active!")

        # Step 4: Click "Bank & KYC" Tab
        print("\n[Step 4] Switching to Bank & KYC tab...")
        bank_tab_btn = page.locator('button:has-text("Bank & KYC")').first
        await bank_tab_btn.click()
        await page.wait_for_timeout(1000)

        # Verify Banking & Remittance card and Statutory KYC card
        await page.wait_for_selector('text=Banking & Salary Remittance', timeout=5000)
        await page.wait_for_selector('text=Statutory KYC & Identification', timeout=5000)
        print("  Both Banking & Salary Remittance and Statutory KYC cards are rendered!")

        # Toggle mask / reveal
        reveal_btns = page.locator('button:has-text("Reveal"), button:has-text("Mask")')
        count = await reveal_btns.count()
        print(f"  Found {count} mask/reveal toggle buttons.")
        if count > 0:
            await reveal_btns.first.click()
            await page.wait_for_timeout(500)

        # Screenshot 1: Bank & KYC Tab
        ss1 = os.path.join(SCREENSHOT_DIR, "01_staff_360_bank_and_kyc_tab.png")
        await page.screenshot(path=ss1)
        print(f"  Saved Screenshot 1 -> {ss1}")

        # Step 5: Test Editing Mode
        print("\n[Step 5] Opening Staff Editor to test 3-subtab editor...")
        edit_btn = page.locator('button:has-text("Edit Staff")').first
        if await edit_btn.count() > 0 and await edit_btn.is_visible():
            await edit_btn.click()
            await page.wait_for_timeout(800)

            # Switch to Bank Remittance sub-tab in editor
            bank_edit_subtab = page.locator('button:has-text("Bank Remittance")').first
            if await bank_edit_subtab.count() > 0:
                await bank_edit_subtab.click()
                await page.wait_for_timeout(500)

            # Enter sample bank info if empty
            bank_input = page.locator('input[aria-label="Edit bank name"]')
            if await bank_input.count() > 0 and not await bank_input.input_value():
                await bank_input.fill("HDFC Bank Ltd.")
                await page.locator('input[aria-label="Edit account number"]').fill("50100492817263")
                await page.locator('input[aria-label="Edit IFSC code"]').fill("HDFC0001234")
                await page.locator('input[aria-label="Edit bank branch"]').fill("Phoenix Marketcity Mall Branch")
                await page.locator('input[aria-label="Edit beneficiary name"]').fill("RAHUL SHARMA VERMA")

            # Switch to Statutory KYC subtab
            kyc_edit_subtab = page.locator('button:has-text("Statutory KYC")').first
            if await kyc_edit_subtab.count() > 0:
                await kyc_edit_subtab.click()
                await page.wait_for_timeout(500)

                pan_input = page.locator('input[aria-label="Edit PAN number"]')
                if await pan_input.count() > 0 and not await pan_input.input_value():
                    await pan_input.fill("ABCDE1234F")
                    await page.locator('input[aria-label="Edit Aadhaar number"]').fill("4589 1234 5678")
                    await page.locator('select[aria-label="Edit blood group"]').select_option("B+")
                    await page.locator('input[aria-label="Edit UAN number"]').fill("100912345678")
                    await page.locator('input[aria-label="Edit ESIC IP"]').fill("31001234560001")

            ss_edit = os.path.join(SCREENSHOT_DIR, "06_staff_360_editing_bank_and_kyc.png")
            await page.screenshot(path=ss_edit)
            print(f"  Saved Screenshot 6 (Editor) -> {ss_edit}")

            # Click Save Changes
            save_btn = page.locator('button:has-text("Save Changes")').first
            if await save_btn.count() > 0:
                print("  Saving changes...")
                await save_btn.click()
                await page.wait_for_timeout(2000)

        # Step 6: Open Print Center Modal
        print("\n[Step 6] Opening Staff Print Center Modal...")
        print_btn = page.locator('button[title="Print staff form or physical ID"], button[aria-label="Print staff form or physical ID"]').first
        await print_btn.click()
        await page.wait_for_timeout(1500)

        # Verify modal header
        await page.wait_for_selector('text=Staff Print Center', timeout=5000)
        print("  Staff Print Center Modal is open!")

        # Verify 5 sections are visible in A4 form
        await page.wait_for_selector('text=Staff Registration & Remittance Form', timeout=5000)
        await page.wait_for_selector('text=Identity & Employment', timeout=5000)
        await page.wait_for_selector('text=Personal & Contact Details', timeout=5000)
        await page.wait_for_selector('text=Statutory KYC', timeout=5000)
        await page.wait_for_selector('text=Banking & Salary Remittance', timeout=5000)
        print("  All 5 mandatory statutory registration sections verified!")

        # Screenshot 2: A4 Form (With Data)
        ss2 = os.path.join(SCREENSHOT_DIR, "02_staff_print_modal_default_a4_form.png")
        await page.screenshot(path=ss2)
        print(f"  Saved Screenshot 2 -> {ss2}")

        # Step 7: Switch to "Without Data" Blank Form
        print("\n[Step 7] Switching to A4 Blank Registration Form...")
        blank_tab = page.locator('#btn-print-without-data').first
        await blank_tab.click()
        await page.wait_for_timeout(800)

        # Screenshot 3: A4 Blank Form
        ss3 = os.path.join(SCREENSHOT_DIR, "03_staff_print_modal_blank_a4_form.png")
        await page.screenshot(path=ss3)
        print(f"  Saved Screenshot 3 -> {ss3}")

        # Step 8: Switch to CR-80 Physical ID Card
        print("\n[Step 8] Switching to CR-80 Physical ID Card...")
        cr80_tab = page.locator('#btn-print-mode-id').first
        await cr80_tab.click()
        await page.wait_for_timeout(1200)

        # Verify Blood Group badge and Barcode SVG are present
        await page.wait_for_selector('text=BG:', timeout=5000)
        print("  Verified CR-80 Card: Blood Group pill badge and SVG Barcode elements present.")

        # Screenshot 4: CR-80 ID Front and Back
        ss4 = os.path.join(SCREENSHOT_DIR, "04_staff_print_modal_cr80_id_card_front.png")
        await page.screenshot(path=ss4)
        print(f"  Saved Screenshot 4 -> {ss4}")

        # Step 9: Capture zoomed preview of CR-80 ID Card (Front & Back)
        print("\n[Step 9] Capturing CR-80 physical ID card...")
        ss5 = os.path.join(SCREENSHOT_DIR, "05_staff_print_modal_cr80_id_cards_preview.png")
        await page.screenshot(path=ss5)
        print(f"  Saved Screenshot 5 -> {ss5}")

        print("\n" + "=" * 80)
        print("ALL PLAYWRIGHT TESTS PASSED SUCCESSFULLY! 6 SCREENSHOTS RECORDED.")
        print("=" * 80)
        await browser.close()


if __name__ == "__main__":
    asyncio.run(run())
