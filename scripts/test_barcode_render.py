"""
Check error during BarcodeStudioTab render
"""
import urllib.request, json
from playwright.sync_api import sync_playwright

req = urllib.request.Request(
    'http://127.0.0.1:8000/api/v1/auth/login',
    data=json.dumps({'username': 'admin', 'password': 'Admin@123'}).encode('utf-8'),
    headers={'Content-Type': 'application/json'}
)
with urllib.request.urlopen(req) as resp:
    tok = json.loads(resp.read().decode('utf-8'))['access_token']

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1600, "height": 950})
    page.on("console", lambda msg: print(f"[CONSOLE {msg.type}] {msg.text}"))
    page.on("pageerror", lambda err: print(f"[PAGE ERROR] {err}"))
    
    # Pre-set localStorage
    page.goto("http://localhost:3000/")
    page.evaluate("""(t) => {
        localStorage.setItem("smriti_jwt_token", t);
        localStorage.setItem("smriti_company_id", "COMP-001");
        localStorage.setItem("smriti_company_code", "COMP-001");
        localStorage.setItem("smriti_branch_id", "MAIN");
        localStorage.setItem("smriti_branch_code", "MAIN");
        localStorage.setItem("smriti_company_name", "Tattly Threads Private Limited");
        localStorage.setItem("smriti_branch_name", "Main Store");
        localStorage.setItem("smriti_user_role", "SYSADMIN");
        localStorage.setItem("smriti_user_name", "admin");
    }""", tok)

    page.goto("http://localhost:3000/?standalone_tab=barcode")
    page.wait_for_timeout(5000)
    page.screenshot(path="scratch/check_barcode_screen.png")
    browser.close()
