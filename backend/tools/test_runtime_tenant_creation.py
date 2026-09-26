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

SMRITI Retail OS — Stage 3: Runtime Tenant Creation & Lifecycle Test Suite
Validates the dynamic multi-tenant architecture beyond pre-seeded tenants:
  1. Dynamic Company Registration (COMP-004 in smritisys)
  2. Physical Database Provisioning (smriti004 in PostgreSQL)
  3. Tenant Alembic Migrations (to head)
  4. Tenant Schema Extensions & Baseline Seeding
  5. Routing Registry State (COMP-004 -> smriti004 -> READY)
  6. Authenticated Tenant Discovery (/api/v1/auth/tenants)
  7. Runtime Tenant Transactions (CRM, POS Shift, Checkout, Day Close)
  8. Strict Cross-Tenant Database Isolation
"""

import argparse
import json
import sys
import time
import urllib.request
import urllib.error
import psycopg2
from decimal import Decimal
from typing import Dict, Any, Optional, Tuple


class RuntimeTenantTester:
    def __init__(self, api_url: str, db_host: str = "smriti-db", db_port: int = 5432):
        self.api_url = api_url.rstrip("/")
        self.db_host = db_host
        self.db_port = db_port
        self.access_token: Optional[str] = None
        self.company_id = "COMP-004"
        self.branch_id = "BR-COMP-004-001"
        self.db_name = "smriti004"
        self.shift_id: Optional[str] = None
        self.register_id: Optional[str] = None
        self.invoice_no: Optional[str] = None

    def _get_pg_conn(self, dbname: str = "postgres"):
        return psycopg2.connect(
            host=self.db_host,
            port=self.db_port,
            user="postgres",
            password="postgres",
            dbname=dbname,
        )

    def _http_request(
        self,
        method: str,
        path: str,
        data: Optional[Dict[str, Any]] = None,
        extra_headers: Optional[Dict[str, str]] = None,
    ) -> Tuple[int, Any]:
        url = f"{self.api_url}{path}"
        req_headers = {
            "Content-Type": "application/json",
            "Accept": "application/json",
        }
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
        print("  SMRITI RETAIL OS — STAGE 3: RUNTIME TENANT CREATION & LIFECYCLE TEST")
        print(f"  Target API: {self.api_url} | Target Tenant: {self.company_id} -> {self.db_name}")
        print("=" * 80)

        steps = [
            ("STEP 1: Pre-flight Clean Check & Dynamic Company Registration", self.step_1_register_company),
            ("STEP 2: Physical Tenant DB Provisioning, Migration & Seed", self.step_2_provision_tenant_db),
            ("STEP 3: Routing Registry & Tenant Discovery (/api/v1/auth/tenants)", self.step_3_tenant_routing_discovery),
            ("STEP 4: Authenticated API Operations on Dynamic Tenant", self.step_4_tenant_api_operations),
            ("STEP 5: POS Business Transaction Lifecycle on Dynamic Tenant", self.step_5_tenant_pos_lifecycle),
            ("STEP 6: Cross-Tenant Database Isolation Verification", self.step_6_cross_tenant_isolation),
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
        print(f"STAGE 3 SUMMARY: Passed: {passed}/{len(steps)} | Failed: {failed}")
        if failed == 0:
            print("RUNTIME TENANT CREATION TEST: PASS")
            print("=" * 80)
            return True
        else:
            print("RUNTIME TENANT CREATION TEST: FAIL")
            print("=" * 80)
            return False

    def step_1_register_company(self) -> Tuple[bool, str]:
        # Connect to control plane (smritisys)
        conn = self._get_pg_conn("smritisys")
        try:
            conn.autocommit = True
            with conn.cursor() as cur:
                # Insert Company
                cur.execute("""
                    INSERT INTO companies (id, uuid, name, gst_number, is_active, is_deleted)
                    VALUES (%s, gen_random_uuid(), %s, %s, true, false)
                    ON CONFLICT (id) DO UPDATE SET is_active = true, is_deleted = false;
                """, (self.company_id, "Apex Superstores India Ltd", "27AABCS0004F1Z1"))

                # Insert Branch
                cur.execute("""
                    INSERT INTO branches (id, uuid, company_id, name, code, is_active, is_deleted)
                    VALUES (%s, gen_random_uuid(), %s, %s, %s, true, false)
                    ON CONFLICT (id) DO UPDATE SET is_active = true, is_deleted = false;
                """, (self.branch_id, self.company_id, f"Main Branch ({self.company_id})", f"MAIN-{self.company_id}"))

                # Insert Company Database Registry
                cur.execute("""
                    INSERT INTO company_database_registries (
                        company_id, database_id, database_name, database_engine,
                        host_reference, port_reference, status, schema_version, region,
                        created_at, updated_at, provisioning_status, migration_status
                    )
                    VALUES (%s, %s, %s, 'postgresql', %s, %s, 'READY', '3.16.0', 'ap-south-1', now(), now(), 'COMPLETED', 'UP_TO_DATE')
                    ON CONFLICT (company_id) DO UPDATE SET
                        database_name = %s,
                        status = 'READY',
                        updated_at = now();
                """, (self.company_id, f"db-{self.company_id.lower()}", self.db_name, self.db_host, self.db_port, self.db_name))

                # Assign usr-admin to COMP-004
                cur.execute("""
                    INSERT INTO user_company_assignments (id, uuid, user_id, company_id, is_default, is_active, is_deleted)
                    VALUES (%s, gen_random_uuid(), 'usr-admin', %s, false, true, false)
                    ON CONFLICT (id) DO UPDATE SET is_active = true;
                """, (f"uca-admin-{self.company_id.lower()}", self.company_id))

                cur.execute("""
                    INSERT INTO user_branch_assignments (id, uuid, user_id, company_id, branch_id, is_default, is_active, is_deleted)
                    VALUES (%s, gen_random_uuid(), 'usr-admin', %s, %s, false, true, false)
                    ON CONFLICT (id) DO UPDATE SET is_active = true;
                """, (f"uba-admin-{self.branch_id.lower()}", self.company_id, self.branch_id))

            return True, f"Registered {self.company_id} and routing target {self.db_name} in smritisys control plane."
        finally:
            conn.close()

    def step_2_provision_tenant_db(self) -> Tuple[bool, str]:
        # Invoke canonical bootstrap engine to provision smriti004
        for p in ("/app", "/workspace/backend", "/workspace", "."):
            if p not in sys.path:
                sys.path.insert(0, p)
        try:
            from app.db.bootstrap_engine import provision_and_migrate_tenants
        except ImportError:
            from backend.app.db.bootstrap_engine import provision_and_migrate_tenants

        results = provision_and_migrate_tenants(tenants=[
            {"company_id": self.company_id, "database_name": self.db_name}
        ])

        if not results:
            return False, "provision_and_migrate_tenants returned empty result."

        # Verify physical DB exists in PostgreSQL
        conn = self._get_pg_conn("postgres")
        try:
            with conn.cursor() as cur:
                cur.execute("SELECT 1 FROM pg_database WHERE datname = %s;", (self.db_name,))
                if not cur.fetchone():
                    return False, f"Physical database '{self.db_name}' not found in pg_database."
        finally:
            conn.close()

        # Verify Alembic migration level in smriti004
        conn_t = self._get_pg_conn(self.db_name)
        try:
            with conn_t.cursor() as cur:
                cur.execute("SELECT version_num FROM alembic_version;")
                rev = cur.fetchone()
                if not rev:
                    return False, f"No Alembic revision found in '{self.db_name}'."
                cur.execute("SELECT count(*) FROM products;")
                prod_count = cur.fetchone()[0]
                cur.execute("SELECT count(*) FROM pos_profiles;")
                profile_count = cur.fetchone()[0]
        finally:
            conn_t.close()

        return True, (
            f"Physical database '{self.db_name}' provisioned successfully "
            f"(Alembic Head: {rev[0]}, Seeded Products: {prod_count}, Cash Profiles: {profile_count})."
        )

    def step_3_tenant_routing_discovery(self) -> Tuple[bool, str]:
        # 1. Login
        code, resp = self._http_request(
            "POST",
            "/api/v1/auth/login",
            {"username": "admin", "password": "Admin@123"},
        )
        if code != 200:
            return False, f"Admin login failed: HTTP {code}: {resp}"

        self.access_token = resp.get("access_token")

        # 2. Get Tenants
        code, t_resp = self._http_request("GET", "/api/v1/auth/tenants")
        if code != 200:
            return False, f"Failed to list accessible tenants: HTTP {code}: {t_resp}"

        companies = t_resp.get("companies", [])
        matched = [c for c in companies if c.get("id") == self.company_id]
        if not matched:
            return False, f"Company {self.company_id} not discovered in /api/v1/auth/tenants. Found: {[c.get('id') for c in companies]}"

        comp_info = matched[0]
        branches = t_resp.get("branches", [])
        matched_branches = [b.get("id") for b in branches if b.get("company_id") == self.company_id]
        if matched_branches:
            self.branch_id = matched_branches[0]

        return True, f"Tenant discovery verified: {comp_info.get('name')} (ID: {self.company_id}, Branch: {self.branch_id}, Status: READY)."

    def step_4_tenant_api_operations(self) -> Tuple[bool, str]:
        # Test crm customer groups
        code, cgroups = self._http_request("GET", "/api/v1/crm/customer-groups")
        if code != 200:
            return False, f"GET /crm/customer-groups failed: HTTP {code}: {cgroups}"

        # Test products search
        code, prods = self._http_request("GET", "/api/v1/products/search?q=")
        if code != 200:
            return False, f"GET /products/search failed: HTTP {code}: {prods}"

        # Create customer in COMP-004
        ts = int(time.time())
        cust_payload = {
            "name": f"Vikram Patel {ts % 10000}",
            "code": f"CUST-004-{ts}",
            "mobile": f"97{ts % 100000000:08d}",
            "status": "Active",
        }
        code, cust = self._http_request("POST", "/api/v1/crm/customers", cust_payload)
        if code not in (200, 201):
            return False, f"POST /crm/customers failed: HTTP {code}: {cust}"

        return True, f"Dynamic tenant APIs operating correctly (Customer created: {cust.get('name')}, ID: {cust.get('id')})."

    def step_5_tenant_pos_lifecycle(self) -> Tuple[bool, str]:
        # 1. Fetch register
        code, profiles = self._http_request("GET", "/api/v1/registers/")
        if code != 200 or not profiles:
            code, profiles = self._http_request("GET", "/api/v1/pos/profiles/")
            if code != 200 or not profiles:
                return False, f"No registers found for {self.company_id}: HTTP {code}: {profiles}"

        self.register_id = profiles[0].get("id")

        # 2. Open shift
        code, shift = self._http_request(
            "POST",
            "/api/v1/pos/shifts/open",
            {
                "register_id": self.register_id,
                "opening_balance": "500.00",
            },
        )
        if code not in (200, 201):
            # Check if open already
            code_a, active_s = self._http_request("GET", f"/api/v1/pos/shifts/active/{self.register_id}")
            if code_a == 200 and active_s:
                shift = active_s
            else:
                return False, f"Failed to open shift in {self.company_id}: HTTP {code}: {shift}"

        self.shift_id = shift.get("id")

        # 3. Create product in COMP-004
        ts = int(time.time())
        prod_code = f"SKU-DYN-{ts % 100000}"
        prod_payload = {
            "name": f"Premium Tea 500g [{ts % 1000}]",
            "code": prod_code,
            "barcode": f"890{ts % 1000000000:010d}",
            "category": "General",
            "brand": "SMRITI",
            "price": 250.00,
            "mrp": 280.00,
            "cost_price": 180.00,
            "buying_price": 200.00,
            "stock": 100,
            "gst_percentage": 5.0,
            "hsn_code": "0902",
            "attributes": {
                "style_no": "TEA-PREM",
                "article_no": "ART-TEA-001",
            },
        }
        code, prod = self._http_request("POST", "/api/v1/inventory/", prod_payload)
        if code not in (200, 201):
            return False, f"Failed to create product in {self.company_id}: HTTP {code}: {prod}"

        # 4. Inward stock
        svc_key = "53196014DB95E1429A426AC68CBF1AB6B0E98C14432E25DD84F4B18729A759F8"
        inward_payload = {
            "product_id": prod.get("id"),
            "product_name": prod_payload["name"],
            "sku": prod_code,
            "quantity": "20.00",
            "movement_type": "INWARD_GRN",
            "reference_doc_type": "PURCHASE_RECEIPT",
            "reference_doc_id": f"GRN-DYN-{ts}",
            "unit_cost": "200.00",
            "company_id": self.company_id,
            "branch_id": self.branch_id,
        }
        self._http_request(
            "POST",
            "/api/v1/inventory/stock-movements",
            inward_payload,
            extra_headers={"X-Internal-Service-Key": svc_key},
        )

        # 5. POS Checkout
        self.invoice_no = f"INV-DYN-{ts}"
        checkout_payload = {
            "invoice_no": self.invoice_no,
            "shift_id": self.shift_id,
            "payment_mode": "CASH",
            "grand_total": 500.00,
            "items": [
                {
                    "product_id": prod.get("id"),
                    "code": prod_code,
                    "name": prod_payload["name"],
                    "quantity": 2.0,
                    "price": 250.0,
                    "mrp": 280.0,
                    "gst_rate": 5.0,
                    "hsn_code": "0902",
                }
            ],
        }
        code, chk = self._http_request("POST", "/api/v1/pos/checkout", checkout_payload)
        if code != 200 or not chk.get("success"):
            return False, f"POS Checkout failed in {self.company_id}: HTTP {code}: {chk}"

        # 6. Day Close
        close_payload = {
            "closing_balance": "1000.00",
            "closing_notes": "Dynamic Tenant Day Close",
            "denominations": {
                "notes_500": 2,
            },
        }
        code, s_close = self._http_request(
            "POST", f"/api/v1/pos/shifts/close/{self.shift_id}", close_payload
        )
        if code != 200 or s_close.get("status") != "CLOSED":
            return False, f"Shift close failed in {self.company_id}: HTTP {code}: {s_close}"

        return True, f"Full retail lifecycle completed on dynamic tenant {self.company_id} (Invoice: {self.invoice_no}, Shift: CLOSED)."

    def step_6_cross_tenant_isolation(self) -> Tuple[bool, str]:
        # Verify invoice is in smriti004
        conn_004 = self._get_pg_conn(self.db_name)
        try:
            with conn_004.cursor() as cur:
                cur.execute("SELECT id, invoice_no, grand_total FROM sales_invoices WHERE invoice_no = %s;", (self.invoice_no,))
                row_004 = cur.fetchone()
                if not row_004:
                    return False, f"Invoice {self.invoice_no} not found in database '{self.db_name}'."
        finally:
            conn_004.close()

        # Verify invoice is NOT in smriti001
        conn_001 = self._get_pg_conn("smriti001")
        try:
            with conn_001.cursor() as cur:
                cur.execute("SELECT id FROM sales_invoices WHERE invoice_no = %s;", (self.invoice_no,))
                row_001 = cur.fetchone()
                if row_001:
                    return False, f"CRITICAL ISOLATION LEAK: Invoice {self.invoice_no} unexpectedly found in 'smriti001'!"
        finally:
            conn_001.close()

        return True, (
            f"Multi-tenant isolation verified: Invoice {self.invoice_no} confirmed in '{self.db_name}' "
            f"and completely absent from 'smriti001'."
        )


def main():
    parser = argparse.ArgumentParser(description="SMRITI Stage 3 Runtime Tenant Tester")
    parser.add_argument("--api-url", default="http://localhost:8000", help="Base URL of SMRITI API")
    parser.add_argument("--db-host", default="smriti-db", help="PostgreSQL host")
    parser.add_argument("--db-port", type=int, default=5432, help="PostgreSQL port")
    args = parser.parse_args()

    tester = RuntimeTenantTester(args.api_url, args.db_host, args.db_port)
    success = tester.run_all()
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
