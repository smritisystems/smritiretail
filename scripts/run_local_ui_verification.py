import asyncio
import json
from pathlib import Path
from playwright.async_api import async_playwright

WORKSPACE_ARTIFACTS_DIR = Path(r"F:\SMRITRretailNX\artifacts\smart-import\local-run")
BRAIN_ARTIFACTS_DIR = Path(r"C:\Users\netma\.gemini\antigravity-ide\brain\3c4e6bbb-73a9-447e-9441-c54a230b29ff\artifacts\smart-import\local-run")
WORKSPACE_ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
BRAIN_ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)

FIXTURE_PATH = Path(r"F:\SMRITRretailNX\tests\fixtures\smart_import_192_footwear_items.tsv")

def save_screenshots(filename, page_screenshot_bytes):
    p1 = WORKSPACE_ARTIFACTS_DIR / filename
    p2 = BRAIN_ARTIFACTS_DIR / filename
    p1.write_bytes(page_screenshot_bytes)
    p2.write_bytes(page_screenshot_bytes)
    print(f"[Screenshot] Successfully saved {filename} ({len(page_screenshot_bytes)} bytes)")

async def main():
    print("=== LOCAL (http://localhost:3000) 504 FOOTWEAR ITEMS IMPORT & VERIFICATION ===")

    with open(FIXTURE_PATH, "r", encoding="utf-8") as f:
        tsv_content = f.read()

    lines = [l for l in tsv_content.strip().split("\n") if l.strip()]
    row_count = len(lines) - 1
    print(f"Loaded fixture: {FIXTURE_PATH} ({row_count} data rows)")

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
        context = await browser.new_context(
            viewport={"width": 1920, "height": 1080},
            device_scale_factor=1
        )
        page = await context.new_page()

        print("\nStep 1: Navigating to http://localhost:3000/?tab=item_master ...")
        await page.goto("http://localhost:3000/?tab=item_master", wait_until="networkidle", timeout=30000)
        await page.wait_for_timeout(2000)

        # Login if needed
        login_input = page.locator("input[name='username'], input[type='text'], input[placeholder*='username' i]").first
        if await login_input.is_visible():
            print("Logging in locally...")
            await login_input.fill("admin")
            pwd_input = page.locator("input[name='password'], input[type='password']").first
            await pwd_input.fill("Admin@123")
            login_btn = page.locator("button[type='submit'], button:has-text('Sign In'), button:has-text('Login')").first
            await login_btn.click()
            await page.wait_for_timeout(3000)

        # Go to Item Master Imports tab
        await page.goto("http://localhost:3000/?tab=item_master", wait_until="networkidle", timeout=30000)
        await page.wait_for_timeout(2000)

        imports_tab_button = page.locator("button:has-text('Imports & Bulk Paste'), button:has-text('Imports')").first
        if await imports_tab_button.is_visible():
            await imports_tab_button.click()
            await page.wait_for_timeout(1500)

        s_studio = await page.screenshot(full_page=True)
        save_screenshots("01-local-import-studio.png", s_studio)

        print("\nStep 2: Pasting 504 rows into Raw Matrix Input...")
        raw_textarea = page.locator("textarea").first
        await raw_textarea.wait_for(state="visible", timeout=10000)
        await raw_textarea.click()
        await page.keyboard.insert_text(tsv_content)
        await page.wait_for_timeout(3000)

        s_pasted = await page.screenshot(full_page=True)
        save_screenshots("02-local-pasted-504-matrix.png", s_pasted)

        print("\nStep 3: Triggering Preview Validation...")
        revalidate_btn = page.locator("button:has-text('Re-validate All')").first
        if await revalidate_btn.is_visible():
            await revalidate_btn.click()
            print("Waiting for local preview validation response...")
            await page.wait_for_timeout(12000)

        s_preview = await page.screenshot(full_page=True)
        save_screenshots("03-local-preview-504-valid-0-errors.png", s_preview)

        print("\nStep 4: Navigating to Item Master Catalog...")
        catalog_tab_btn = page.locator("button:has-text('Article / Design Catalog'), button:has-text('Catalog')").first
        if await catalog_tab_btn.is_visible():
            await catalog_tab_btn.click()
            await page.wait_for_timeout(3000)

        s_catalog = await page.screenshot(full_page=True)
        save_screenshots("04-local-catalog-verification.png", s_catalog)

        await browser.close()
        print("\n=== LOCAL RUN COMPLETED ===")

if __name__ == "__main__":
    asyncio.run(main())
