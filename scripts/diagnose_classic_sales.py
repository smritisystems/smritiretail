import os
import json
from playwright.sync_api import sync_playwright

def run_diagnostic():
    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=True,
            args=["--no-sandbox", "--disable-gpu"]
        )
        context = browser.new_context(
            viewport={"width": 1600, "height": 900},
            device_scale_factor=1
        )
        page = context.new_page()

        page.on("console", lambda msg: print(f"[CONSOLE {msg.type}] {msg.text}"))
        page.on("pageerror", lambda err: print(f"[PAGE ERROR] {err}"))

        print("Navigating to http://localhost:8101/?tab=sales...")
        page.goto("http://localhost:8101/?tab=sales", wait_until="networkidle", timeout=30000)
        page.wait_for_timeout(2000)

        # Check if login screen is showing
        admin_btn = page.locator("button:has-text('Admin')").first
        login_btn = page.locator("button:has-text('Login'), button:has-text('Sign In')").first
        if admin_btn.is_visible():
            print("Clicking Admin role shortcut...")
            admin_btn.click()
            page.wait_for_timeout(500)
            if login_btn.is_visible():
                login_btn.click()
                page.wait_for_timeout(3000)

        # Set localStorage for classic UX mode if needed
        current_ux = page.evaluate("() => localStorage.getItem('smriti_ux_mode')")
        print(f"Current smriti_ux_mode: {current_ux}")
        if current_ux != "classic":
            print("Switching localStorage smriti_ux_mode to classic...")
            page.evaluate("() => { localStorage.setItem('smriti_ux_mode', 'classic'); }")
            page.reload(wait_until="networkidle")
            page.wait_for_timeout(2000)

        # Check DOM layout
        layout_info = page.evaluate("""() => {
            const header = document.querySelector('header');
            const aside = document.querySelector('aside');
            const main = document.querySelector('main');
            const menuNav = document.querySelector('nav[aria-label="Enterprise Main Menu"]');
            const breadcrumb = document.querySelector('[aria-label="Breadcrumb"]') || document.querySelector('.flex-1.flex.flex-col > div');
            const statusBar = document.querySelector('footer');

            const getBox = (el) => el ? el.getBoundingClientRect() : null;

            return {
                viewport: { width: window.innerWidth, height: window.innerHeight },
                headerBox: getBox(header),
                asideBox: getBox(aside),
                mainBox: getBox(main),
                menuNavBox: getBox(menuNav),
                statusBarBox: getBox(statusBar),
                headerClasses: header ? header.className : null,
                menuItems: Array.from(document.querySelectorAll('nav[aria-label="Enterprise Main Menu"] button')).map(b => ({
                    text: b.innerText.trim(),
                    box: b.getBoundingClientRect()
                }))
            };
        }""")

        print("\n=== LAYOUT DIAGNOSTIC INFO ===")
        print(json.dumps(layout_info, indent=2))

        # Save diagnostic screenshot
        os.makedirs("docs/walkthrough/foundation/evidence", exist_ok=True)
        page.screenshot(path="docs/walkthrough/foundation/evidence/classic_sales_diagnostic_1600.png")
        print("[Screenshot] Saved classic_sales_diagnostic_1600.png")

        # Now test clicking Master menu
        master_btn = page.locator("nav[aria-label='Enterprise Main Menu'] button:has-text('Master')").first
        if master_btn.is_visible():
            print("Clicking Master menu trigger...")
            master_btn.click()
            page.wait_for_timeout(500)
            dropdown_info = page.evaluate("""() => {
                const menus = Array.from(document.querySelectorAll('[role="menu"]'));
                return menus.map(m => ({
                    role: m.getAttribute('role'),
                    ariaLabel: m.getAttribute('aria-label'),
                    box: m.getBoundingClientRect(),
                    items: Array.from(m.querySelectorAll('[role="menuitem"], button')).map(i => ({
                        text: i.innerText.trim(),
                        box: i.getBoundingClientRect()
                    }))
                }));
            }""")
            print("\n=== DROPDOWN MENU INFO ===")
            print(json.dumps(dropdown_info, indent=2))
            page.screenshot(path="docs/walkthrough/foundation/evidence/classic_sales_master_open_1600.png")
            print("[Screenshot] Saved classic_sales_master_open_1600.png")

        browser.close()

if __name__ == "__main__":
    run_diagnostic()
