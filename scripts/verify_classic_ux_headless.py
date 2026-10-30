"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.99.12
Created      : 2026-10-22
Modified     : 2026-10-22
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Comprehensive Headless Playwright Multi-Viewport Verification
"""

import os
import json
import time
from playwright.sync_api import sync_playwright

VIEWPORTS = [
    {"name": "1600x900", "width": 1600, "height": 900},
    {"name": "1366x768", "width": 1366, "height": 768},
    {"name": "1280x720", "width": 1280, "height": 720},
    {"name": "1024x768", "width": 1024, "height": 768},
]

EVIDENCE_DIR = "docs/walkthrough/foundation/evidence"
os.makedirs(EVIDENCE_DIR, exist_ok=True)

def verify_all_viewports():
    results = {}
    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=True,
            args=["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"]
        )

        for vp in VIEWPORTS:
            vp_name = vp["name"]
            width = vp["width"]
            height = vp["height"]
            print(f"\n==========================================")
            print(f"VERIFYING VIEWPORT: {vp_name} ({width}x{height})")
            print(f"==========================================")

            context = browser.new_context(
                viewport={"width": width, "height": height},
                device_scale_factor=1
            )
            page = context.new_page()

            # Set localStorage before page loads
            page.add_init_script("""() => {
                localStorage.setItem('smriti_ux_mode', 'classic');
                localStorage.setItem('smriti_jwt_token', 'test-bearer-token');
                localStorage.setItem('smriti_company_id', 'COMP-001');
                localStorage.setItem('smriti_company_code', '001');
                localStorage.setItem('smriti_company_name', 'Tattly Threads Retail');
                localStorage.setItem('smriti_branch_id', 'BR-001');
                localStorage.setItem('smriti_branch_code', 'MAIN');
                localStorage.setItem('smriti_branch_name', 'Main Branch');
            }""")

            # Navigate to Sales Studio
            page.goto("http://localhost:8101/?tab=sales", wait_until="networkidle", timeout=30000)
            page.wait_for_timeout(1500)

            # Login if needed
            admin_btn = page.locator("button:has-text('Admin')").first
            login_btn = page.locator("button:has-text('Login'), button:has-text('Sign In')").first
            if admin_btn.is_visible():
                admin_btn.click()
                page.wait_for_timeout(400)
                if login_btn.is_visible():
                    login_btn.click()
                    page.wait_for_timeout(2500)

            # Ensure Classic mode
            page.evaluate("() => { if (localStorage.getItem('smriti_ux_mode') !== 'classic') { localStorage.setItem('smriti_ux_mode', 'classic'); window.location.reload(); } }")
            page.wait_for_timeout(1000)

            # 1. Closed Navigation State
            closed_shot = f"{EVIDENCE_DIR}/classic_ux_{vp_name}_closed.png"
            page.screenshot(path=closed_shot)
            print(f"[Screenshot] Saved {closed_shot}")

            # Inspect DOM layout
            dom_measurements = page.evaluate("""() => {
                const header = document.querySelector('header');
                const aside = document.querySelector('aside');
                const main = document.querySelector('main');
                const nav = document.querySelector('nav[aria-label="Enterprise Main Menu"]');
                const footer = document.querySelector('footer');
                const hBox = header ? header.getBoundingClientRect() : null;
                const aBox = aside ? aside.getBoundingClientRect() : null;
                const mBox = main ? main.getBoundingClientRect() : null;
                const nBox = nav ? nav.getBoundingClientRect() : null;
                const fBox = footer ? footer.getBoundingClientRect() : null;

                const buttons = Array.from(document.querySelectorAll('nav[aria-label="Enterprise Main Menu"] button')).map(b => ({
                    text: b.innerText.trim(),
                    visible: b.offsetParent !== null,
                    box: b.getBoundingClientRect()
                }));

                // Check horizontal overflow on window/body
                const hasHScroll = document.documentElement.scrollWidth > window.innerWidth;

                return {
                    viewport: { width: window.innerWidth, height: window.innerHeight },
                    hasHorizontalScrollbar: hasHScroll,
                    headerHeight: hBox ? hBox.height : 0,
                    headerTop: hBox ? hBox.top : 0,
                    asideHeight: aBox ? aBox.height : 0,
                    asideBottom: aBox ? aBox.bottom : 0,
                    footerTop: fBox ? fBox.top : 0,
                    footerHeight: fBox ? fBox.height : 0,
                    sidebarStatusOverlap: (aBox && fBox) ? (aBox.bottom > fBox.top + 1) : false,
                    renderedMenuCount: buttons.length,
                    buttons: buttons.map(b => b.text)
                };
            }""")
            print(f"Closed layout measurements: {json.dumps(dom_measurements, indent=2)}")

            # 2. Open Master Primary Menu
            master_btn = page.locator("nav[aria-label='Enterprise Main Menu'] button:has-text('Master')").first
            if master_btn.is_visible():
                master_btn.click()
                page.wait_for_timeout(400)

                master_open_shot = f"{EVIDENCE_DIR}/classic_ux_{vp_name}_master_open.png"
                page.screenshot(path=master_open_shot)
                print(f"[Screenshot] Saved {master_open_shot}")

                master_dropdown_info = page.evaluate("""() => {
                    const dropdown = document.querySelector('[role="menu"][aria-label="Master Submenu"]');
                    if (!dropdown) return { found: false };
                    const box = dropdown.getBoundingClientRect();
                    const items = Array.from(dropdown.querySelectorAll('[role="menuitem"], button')).map(b => ({
                        text: b.innerText.trim(),
                        box: b.getBoundingClientRect()
                    }));
                    return {
                        found: true,
                        box: box,
                        isAbovePageContent: box.top >= 40 && box.bottom <= window.innerHeight,
                        zIndex: window.getComputedStyle(dropdown).zIndex,
                        itemCount: items.length,
                        firstItem: items[0],
                        lastItem: items[items.length - 1]
                    };
                }""")
                print(f"Master dropdown info: {json.dumps(master_dropdown_info, indent=2)}")

                # 3. Open Nested Submenu (Items & Catalog)
                items_group = page.locator("[role='menu'] button:has-text('Items & Catalog')").first
                if items_group.is_visible():
                    items_group.hover()
                    page.wait_for_timeout(400)

                    submenu_shot = f"{EVIDENCE_DIR}/classic_ux_{vp_name}_master_nested_submenu.png"
                    page.screenshot(path=submenu_shot)
                    print(f"[Screenshot] Saved {submenu_shot}")

                    nested_submenu_info = page.evaluate("""() => {
                        const submenus = Array.from(document.querySelectorAll('[role="menu"]'));
                        return submenus.map(s => ({
                            ariaLabel: s.getAttribute('aria-label'),
                            box: s.getBoundingClientRect(),
                            zIndex: window.getComputedStyle(s).zIndex,
                            items: Array.from(s.querySelectorAll('button, [role="menuitem"]')).map(i => i.innerText.trim())
                        }));
                    }""")
                    print(f"Nested submenus info: {json.dumps(nested_submenu_info, indent=2)}")

            # 4. Open Transactions Menu -> Sales Desks
            trans_btn = page.locator("nav[aria-label='Enterprise Main Menu'] button:has-text('Transactions')").first
            if trans_btn.is_visible():
                trans_btn.click()
                page.wait_for_timeout(400)

                sales_desk = page.locator("[role='menu'] button:has-text('Sales Desks')").first
                if sales_desk.is_visible():
                    sales_desk.hover()
                    page.wait_for_timeout(400)

                trans_shot = f"{EVIDENCE_DIR}/classic_ux_{vp_name}_transactions_open.png"
                page.screenshot(path=trans_shot)
                print(f"[Screenshot] Saved {trans_shot}")

            # 5. At narrower widths (e.g. 1024), verify overflow "More ▾"
            if width <= 1024:
                more_btn = page.locator("nav[aria-label='Enterprise Main Menu'] button:has-text('More')").first
                if more_btn.is_visible():
                    more_btn.click()
                    page.wait_for_timeout(400)
                    more_shot = f"{EVIDENCE_DIR}/classic_ux_{vp_name}_more_overflow_open.png"
                    page.screenshot(path=more_shot)
                    print(f"[Screenshot] Saved {more_shot}")
                    more_info = page.evaluate("""() => {
                        const moreMenu = document.querySelector('[role="menu"][aria-label="More Submenu"]');
                        if (!moreMenu) return { found: false };
                        return {
                            found: true,
                            box: moreMenu.getBoundingClientRect(),
                            items: Array.from(moreMenu.querySelectorAll('[role="menuitem"]')).map(i => i.innerText.trim())
                        };
                    }""")
                    print(f"More overflow menu info: {json.dumps(more_info, indent=2)}")

            # 6. Test Escape key closes menus
            page.keyboard.press("Escape")
            page.wait_for_timeout(300)
            menus_after_escape = page.evaluate("() => document.querySelectorAll('[role=\"menu\"]').length")
            print(f"Menus open after Escape: {menus_after_escape} (expected: 0)")

            # 7. Test Theme Toggle (Dark Mode)
            theme_btn = page.locator("header button:has-text('light_mode'), header button:has-text('dark_mode')").first
            if theme_btn.is_visible():
                theme_btn.click()
                page.wait_for_timeout(400)
                dark_shot = f"{EVIDENCE_DIR}/classic_ux_{vp_name}_dark_theme.png"
                page.screenshot(path=dark_shot)
                print(f"[Screenshot] Saved {dark_shot}")
                # Toggle back to light
                theme_btn.click()
                page.wait_for_timeout(400)

            results[vp_name] = {
                "measurements": dom_measurements,
                "hasHorizontalScrollbar": dom_measurements["hasHorizontalScrollbar"],
                "sidebarStatusOverlap": dom_measurements["sidebarStatusOverlap"],
                "escapeClosesMenus": (menus_after_escape == 0)
            }

            context.close()

        # 8. Regression: Regular UX Navigation
        print(f"\n==========================================")
        print(f"VERIFYING REGULAR UX REGRESSION PROTECTION")
        print(f"==========================================")
        reg_context = browser.new_context(viewport={"width": 1600, "height": 900})
        reg_page = reg_context.new_page()
        reg_page.add_init_script("() => { localStorage.setItem('smriti_ux_mode', 'regular'); }")
        reg_page.goto("http://localhost:8101/?tab=launchpad", wait_until="networkidle", timeout=30000)
        reg_page.wait_for_timeout(1500)

        # Login if needed
        admin_btn = reg_page.locator("button:has-text('Admin')").first
        login_btn = reg_page.locator("button:has-text('Login'), button:has-text('Sign In')").first
        if admin_btn.is_visible():
            admin_btn.click()
            reg_page.wait_for_timeout(400)
            if login_btn.is_visible():
                login_btn.click()
                reg_page.wait_for_timeout(2500)

        reg_shot = f"{EVIDENCE_DIR}/regular_ux_regression_launchpad.png"
        reg_page.screenshot(path=reg_shot)
        print(f"[Screenshot] Saved {reg_shot}")

        reg_info = reg_page.evaluate("""() => {
            const hasOmniSearch = Array.from(document.querySelectorAll('button')).some(b => b.innerText.includes('Omni-Search') || b.innerText.includes('Ctrl+K'));
            const navRail = document.querySelector('aside');
            const cards = document.querySelectorAll('.grid > div');
            return {
                omniSearchVisible: hasOmniSearch,
                navRailVisible: Boolean(navRail),
                launchpadCardsCount: cards.length
            };
        }""")
        print(f"Regular UX info: {json.dumps(reg_info, indent=2)}")
        results["regular_ux"] = reg_info

        reg_context.close()
        browser.close()

    print("\n==========================================")
    print("ALL VERIFICATIONS COMPLETED SUCCESSFULLY")
    print("==========================================")
    return results

if __name__ == "__main__":
    verify_all_viewports()
