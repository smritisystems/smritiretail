"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.16.0
Created      : 2026-09-24
Modified     : 2026-09-24
Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal

SMRITI Retail OS — Stage 2: End-to-End Retail Business Lifecycle Test Suite
Validates the complete retail lifecycle:
  1. Authentication & JWT Extraction (Admin Login)
  2. Company Selection & Tenant Verification (COMP-001 -> READY)
  3. Register & Shift Open (Till Float Initialization)
  4. Customer Master Lifecycle (Create & Verify)
  5. Item Master Lifecycle (Create Product, SKU, Barcode, Pricing)
  6. Purchase / Stock Inflow (Inward Initial Inventory)
  7. POS Billing / Checkout (Invoice generation, tax, tender)
  8. Stock Deduction Verification (Real-time inventory decrement)
  9. Day Close / Shift Close (Cash reconciliation & shift closure)
"""

import argparse
import json
import sys
import time
import urllib.request
import urllib.error
from decimal import Decimal
from typing import Dict, Any, Optional, Tuple


class RetailLifecycleTester:
    def __init__(self, base_url: str):
        self.base_url = base_url.rstrip("/")
        self.access_token: Optional[str] = None
        self.headers: Dict[str, str] = {
            "Content-Type": "application/json",
            "Accept": "application/json",
        }
        self.company_id = "COMP-001"
        self.branch_id = "BR-MAIN-001"
        self.shift_id: Optional[str] = None
        self.register_id: Optional[str] = None
        self.customer_id: Optional[str] = None
        self.product_id: Optional[str] = None
        self.product_code: Optional[str] = None
        self.barcode: Optional[str] = None
        self.invoice_no: Optional[str] = None

    def _http_request(
        self,
        method: str,
        path: str,
        data: Optional[Dict[str, Any]] = None,
        extra_headers: Optional[Dict[str, str]] = None,
    ) -> Tuple[int, Any]:
        url = f"{self.base_url}{path}"
        req_headers = dict(self.headers)
        if self.access_token:
            req_headers["Authorization"] = f"Bearer {self.access_token}"
            req_headers["X-Company-ID"] = self.company_id
            req_headers["X-Branch-ID"] = self.branch_id

        if extra_headers:
            req_headers.update(extra_headers)

        payload_bytes = json.dumps(data).encode("utf-8") if data is not None else None
        req = urllib.request.Request(url, data=payload_bytes, headers=req_headers, method=method)

        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                status_code = resp.status
                body = resp.read().decode("utf-8")
                try:
                    parsed = json.loads(body)
                except Exception:
                    parsed = body
                return status_code, parsed
        except urllib.error.HTTPError as e:
            err_body = e.read().decode("utf-8")
            try:
                parsed = json.loads(err_body)
            except Exception:
                parsed = err_body
            return e.code, parsed
        except Exception as e:
            return 0, str(e)

    def run_all(self) -> bool:
        print("=" * 80)
        print("  SMRITI RETAIL OS — STAGE 2: COMPLETE RETAIL E2E LIFECYCLE TEST")
        print(f"  Target URL: {self.base_url}")
        print("=" * 80)

        steps = [
            ("STEP 1: User Authentication & JWT Extraction", self.step_1_login),
            ("STEP 2: Company Selection & Tenant Verification", self.step_2_company_selection),
            ("STEP 3: Register & POS Shift Open", self.step_3_register_and_shift_open),
            ("STEP 4: Customer Master Creation", self.step_4_customer_master),
            ("STEP 5: Item Master Creation & Catalog Search", self.step_5_item_master),
            ("STEP 6: Purchase & Stock Inflow", self.step_6_stock_inflow),
            ("STEP 7: POS Billing & Sales Checkout", self.step_7_pos_billing),
            ("STEP 8: Stock Decrement Verification", self.step_8_verify_stock_decrement),
            ("STEP 9: Day Close & Shift Reconciliation", self.step_9_day_close),
        ]

        passed = 0
        failed = 0

        for title, func in steps:
            print(f"\n--- {title} ---")
            try:
                ok, msg = func()
                if ok:
                    print(f"  [PASS] {msg}")
                    passed += 1
                else:
                    print(f"  [FAIL] {msg}")
                    failed += 1
                    break
            except Exception as e:
                print(f"  [CRASH] Unexpected exception in {title}: {e}")
                failed += 1
                break

        print("\n" + "=" * 80)
        print(f"STAGE 2 SUMMARY: Passed: {passed}/{len(steps)} | Failed: {failed}")
        if failed == 0:
            print("RETAIL BUSINESS LIFECYCLE TEST: PASS")
            print("=" * 80)
            return True
        else:
            print("RETAIL BUSINESS LIFECYCLE TEST: FAIL")
            print("=" * 80)
            return False

    def step_1_login(self) -> Tuple[bool, str]:
        code, resp = self._http_request(
            "POST",
            "/api/v1/auth/login",
            {"username": "admin", "password": "Admin@123"},
        )
        if code != 200:
            return False, f"HTTP {code}: {resp}"

        self.access_token = resp.get("access_token")
        if not self.access_token:
            return False, "Login response missing access_token."

        role = resp.get("role")
        user = resp.get("user", {})
        return True, f"Authenticated successfully as {user.get('username')} (role: {role})."

    def step_2_company_selection(self) -> Tuple[bool, str]:
        code, resp = self._http_request("GET", "/api/v1/auth/tenants")
        if code != 200:
            return False, f"HTTP {code}: {resp}"

        companies = resp.get("companies", [])
        if not companies:
            return False, "No companies available for tenant context."

        comp_ids = [c.get("id") for c in companies]
        if "COMP-001" not in comp_ids:
            return False, f"COMP-001 not found in companies: {comp_ids}"

        # Ensure branch exists
        branches = resp.get("branches", [])
        branch_ids = [b.get("id") for b in branches if b.get("company_id") == "COMP-001"]
        if branch_ids:
            self.branch_id = branch_ids[0]

        return True, f"Tenant COMP-001 verified (selected branch: {self.branch_id})."

    def step_3_register_and_shift_open(self) -> Tuple[bool, str]:
        # 1. Fetch available cash registers / POS profiles
        code, resp = self._http_request("GET", "/api/v1/pos/profiles/")
        if code != 200 or not resp:
            # Fallback to registers/
            code, resp = self._http_request("GET", "/api/v1/registers/")
            if code != 200 or not resp:
                return False, f"Failed to list cash registers/profiles: HTTP {code}: {resp}"

        # Pick a register
        self.register_id = resp[0].get("id")

        # 2. Check if register has an open shift already
        code, active_shift = self._http_request(
            "GET", f"/api/v1/pos/shifts/active/{self.register_id}"
        )
        if code == 200 and active_shift and active_shift.get("status") == "OPEN":
            self.shift_id = active_shift.get("id")
            return True, f"Found existing open shift {self.shift_id} on register {self.register_id}."

        # 3. Open a new shift
        code, new_shift = self._http_request(
            "POST",
            "/api/v1/pos/shifts/open",
            {
                "register_id": self.register_id,
                "opening_balance": "1000.00",
            },
        )
        if code not in (200, 201):
            return False, f"Failed to open shift: HTTP {code}: {new_shift}"

        self.shift_id = new_shift.get("id")
        return True, f"Shift opened successfully: {self.shift_id} (Opening Float: Rs. 1000.00)."

    def step_4_customer_master(self) -> Tuple[bool, str]:
        ts = int(time.time())
        customer_code = f"CUST-E2E-{ts}"
        cust_payload = {
            "name": f"Aarav Sharma {ts % 10000}",
            "code": customer_code,
            "mobile": f"98{ts % 100000000:08d}",
            "email": f"aarav.{ts}@example.com",
            "status": "Active",
        }
        code, resp = self._http_request("POST", "/api/v1/crm/customers", cust_payload)
        if code not in (200, 201):
            return False, f"Failed to create customer: HTTP {code}: {resp}"

        self.customer_id = resp.get("id")
        return True, f"Customer created: {resp.get('name')} (ID: {self.customer_id}, Code: {customer_code})."

    def step_5_item_master(self) -> Tuple[bool, str]:
        ts = int(time.time())
        self.product_code = f"RICE-5KG-{ts % 100000}"
        self.barcode = f"890{ts % 1000000000:010d}"

        product_payload = {
            "name": f"Organic Basmati Rice 5kg [{ts % 1000}]",
            "code": self.product_code,
            "barcode": self.barcode,
            "category": "General",
            "brand": "SMRITI",
            "price": 420.00,
            "mrp": 450.00,
            "cost_price": 300.00,
            "buying_price": 350.00,
            "stock": 0,
            "gst_percentage": 5.0,
            "hsn_code": "1006",
            "attributes": {
                "style_no": "BASMATI-PREMIUM",
                "article_no": "ART-RICE-001",
            },
        }

        code, resp = self._http_request("POST", "/api/v1/inventory/", product_payload)
        if code not in (200, 201):
            # Try /products/ alias
            code, resp = self._http_request("POST", "/api/v1/products/", product_payload)
            if code not in (200, 201):
                return False, f"Failed to create product: HTTP {code}: {resp}"

        self.product_id = resp.get("id")

        # Verify search
        code_s, resp_s = self._http_request("GET", f"/api/v1/products/search?q={self.product_code}")
        if code_s != 200 or not resp_s:
            return False, f"Product created but not discoverable via search: HTTP {code_s}"

        return True, f"Product created & verified: {resp.get('name')} (ID: {self.product_id}, Barcode: {self.barcode})."

    def step_6_stock_inflow(self) -> Tuple[bool, str]:
        # Perform stock inward (50 units)
        ts = int(time.time())
        doc_no = f"GRN-E2E-{ts}"

        # Authoritative internal service authorization key
        svc_key = "53196014DB95E1429A426AC68CBF1AB6B0E98C14432E25DD84F4B18729A759F8"

        inward_payload = {
            "product_id": self.product_id,
            "product_name": "Organic Basmati Rice 5kg",
            "sku": self.product_code,
            "quantity": "50.00",
            "movement_type": "INWARD_GRN",
            "reference_doc_type": "PURCHASE_RECEIPT",
            "reference_doc_id": doc_no,
            "unit_cost": "350.00",
            "company_id": self.company_id,
            "branch_id": self.branch_id,
        }

        code, resp = self._http_request(
            "POST",
            "/api/v1/inventory/stock-movements",
            inward_payload,
            extra_headers={"X-Internal-Service-Key": svc_key},
        )

        if code not in (200, 201):
            return False, f"Failed to record stock movement: HTTP {code}: {resp}"

        # Verify via stock ledger
        code_l, resp_l = self._http_request(
            "GET", f"/api/v1/inventory/ledger?product_id={self.product_id}"
        )
        if code_l != 200 or not resp_l.get("items"):
            return False, f"Stock movement not found in ledger: HTTP {code_l}"

        return True, f"Inward 50 units recorded successfully (Doc: {doc_no}, Ledger verified)."

    def step_7_pos_billing(self) -> Tuple[bool, str]:
        ts = int(time.time())
        self.invoice_no = f"INV-E2E-{ts}"

        checkout_payload = {
            "invoice_no": self.invoice_no,
            "shift_id": self.shift_id,
            "payment_mode": "CASH",
            "grand_total": 1260.00,
            "customer_id": self.customer_id,
            "customer_name": "Aarav Sharma",
            "items": [
                {
                    "product_id": self.product_id,
                    "code": self.product_code,
                    "name": "Organic Basmati Rice 5kg",
                    "quantity": 3.0,
                    "price": 420.0,
                    "mrp": 450.0,
                    "gst_rate": 5.0,
                    "hsn_code": "1006",
                }
            ],
        }

        code, resp = self._http_request("POST", "/api/v1/pos/checkout", checkout_payload)
        if code != 200:
            return False, f"Checkout failed: HTTP {code}: {resp}"

        if not resp.get("success"):
            return False, f"Checkout returned failure flag: {resp}"

        inv_id = resp.get("invoice_id")
        return True, f"POS Sale completed: Invoice {self.invoice_no} (ID: {inv_id}, Grand Total: Rs. {resp.get('grand_total')})."

    def step_8_verify_stock_decrement(self) -> Tuple[bool, str]:
        code, resp = self._http_request(
            "GET", f"/api/v1/inventory/ledger?product_id={self.product_id}"
        )
        if code != 200:
            return False, f"Failed to retrieve stock ledger: HTTP {code}"

        items = resp.get("items", [])
        if len(items) < 2:
            return False, f"Expected at least 2 movements (inward + sale outward), found: {len(items)}"

        # The latest movement should be outward sale of 3 units
        sale_mvs = [m for m in items if m.get("movement_type") in ("OUTWARD_SALE", "SALE")]
        if not sale_mvs:
            return False, "No OUTWARD_SALE movement found in ledger after checkout."

        sale_qty = abs(float(sale_mvs[0].get("quantity", 0)))
        totals = resp.get("totals", {})
        net_qty = float(totals.get("net_qty", 0))

        if net_qty != 47.0:
            return False, f"Expected net stock of 47.0 (50 in - 3 out), got: {net_qty}"

        return True, f"Stock deducted accurately: 50.0 initial - {sale_qty} sold = {net_qty} remaining."

    def step_9_day_close(self) -> Tuple[bool, str]:
        # Expected cash = Opening float (1000.00) + Cash Sale (1260.00) = 2260.00
        # Denomination breakdown:
        # 4 x 500 = 2000
        # 2 x 100 = 200
        # 1 x 50  = 50
        # 1 x 10  = 10
        # Total = 2260.00
        close_payload = {
            "closing_balance": "2260.00",
            "closing_notes": "SMRITI Release-Hardening Automated Day Close Test",
            "denominations": {
                "notes_2000": 0,
                "notes_500": 4,
                "notes_200": 0,
                "notes_100": 2,
                "notes_50": 1,
                "notes_20": 0,
                "notes_10": 1,
                "notes_5": 0,
                "notes_2": 0,
                "notes_1": 0,
                "coins_total": "0.00",
            },
        }

        code, resp = self._http_request(
            "POST", f"/api/v1/pos/shifts/close/{self.shift_id}", close_payload
        )
        if code != 200:
            return False, f"Shift close failed: HTTP {code}: {resp}"

        shift_status = resp.get("status")
        variance = resp.get("variance")
        if shift_status != "CLOSED":
            return False, f"Shift status after closure is {shift_status}, expected CLOSED."

        return True, f"Day close successful: Shift {self.shift_id} CLOSED (Reconciled Cash: Rs. 2260.00, Variance: {variance})."


def main():
    parser = argparse.ArgumentParser(description="SMRITI Stage 2 E2E Retail Lifecycle Tester")
    parser.add_argument("--api-url", default="http://localhost:8000", help="Base URL of SMRITI API")
    args = parser.parse_args()

    tester = RetailLifecycleTester(args.api_url)
    success = tester.run_all()
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
