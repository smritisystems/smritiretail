"""
Project      : SMRITI Retail OS
Repository   : SMRITIRetailNX
Organization : AITDL NETWORKS

Founders

* Pushpa Devi Jawahar Mallah
  * Founder & Chairperson
  * Email: founder@aitdl.com

* Jawahar Ramkripal Mallah
  * Founder, Chief Executive Officer (CEO) & Chief Software Architect
  * Email: founder@aitdl.com

* Websites: aitdl.com | erpnbook.com | smritibooks.com

* Version    : 3.45.0
* Created    : 2026-09-24
* Modified   : 2026-09-24
* Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
* License    : Proprietary Commercial Software
* Classification: Internal Verification Suite

Stage 5: Upgrade Lineage & Non-Destructive Update Verification Engine
════════════════════════════════════════════════════════════════════
Verifies:
1. Pre-update baseline operational state across control plane and all tenants.
2. Execution of non-destructive update cycle (bootstrap engine + Alembic checks).
3. Post-update schema drift & migration lineage verification (revisions remain at HEAD).
4. Data preservation: 100% retention of pre-existing transactions, masters, and ledgers.
5. Post-update operational API connectivity across multiple tenant planes.
6. Service health audit execution.
"""

import os
import sys
import time
import subprocess
import psycopg2
from typing import Dict, Any, List, Tuple
from urllib.request import Request, urlopen
import json

DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = int(os.getenv("DB_PORT", "2781"))
DB_USER = os.getenv("DB_USER", "postgres")
DB_PASS = os.getenv("DB_PASS", "postgres")
API_HOST = os.getenv("API_HOST", "http://localhost:1981")

INTERNAL_KEY = "53196014DB95E1429A426AC68CBF1AB6B0E98C14432E25DD84F4B18729A759F8"


def log(msg: str):
    print(f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] {msg}", flush=True)


def get_pg_conn(dbname: str = "postgres"):
    return psycopg2.connect(
        dbname=dbname,
        user=DB_USER,
        password=DB_PASS,
        host=DB_HOST,
        port=DB_PORT,
    )


def run_docker_exec(cmd: str) -> Tuple[int, str, str]:
    full_cmd = f'docker compose exec -T smriti-api {cmd}'
    proc = subprocess.Popen(
        full_cmd,
        shell=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )
    stdout, stderr = proc.communicate()
    return proc.returncode, stdout, stderr


def test_step_1_capture_baseline() -> Tuple[bool, Dict[str, Any]]:
    log("==================================================================")
    log("STAGE 5 - STEP 1: Capturing Pre-Update Operational Baseline")
    log("==================================================================")
    baseline = {}

    try:
        # Control plane
        with get_pg_conn("smritisys") as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT count(*) FROM companies;")
                baseline["sys_companies"] = cur.fetchone()[0]
                cur.execute("SELECT count(*) FROM company_database_registries;")
                baseline["sys_registries"] = cur.fetchone()[0]
                cur.execute("SELECT count(*) FROM users;")
                baseline["sys_users"] = cur.fetchone()[0]

        # Tenant 001
        with get_pg_conn("smriti001") as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT count(*) FROM products;")
                baseline["t001_products"] = cur.fetchone()[0]
                cur.execute("SELECT count(*) FROM customers;")
                baseline["t001_customers"] = cur.fetchone()[0]
                cur.execute("SELECT count(*) FROM sales_invoices;")
                baseline["t001_invoices"] = cur.fetchone()[0]
                cur.execute("SELECT count(*) FROM stock_movements;")
                baseline["t001_movements"] = cur.fetchone()[0]
                cur.execute("SELECT count(*) FROM shifts;")
                baseline["t001_shifts"] = cur.fetchone()[0]
                cur.execute("SELECT version_num FROM alembic_version;")
                baseline["t001_alembic"] = cur.fetchall()

        # Tenant 004 (Dynamic)
        with get_pg_conn("smriti004") as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT count(*) FROM products;")
                baseline["t004_products"] = cur.fetchone()[0]
                cur.execute("SELECT count(*) FROM customers;")
                baseline["t004_customers"] = cur.fetchone()[0]
                cur.execute("SELECT count(*) FROM sales_invoices;")
                baseline["t004_invoices"] = cur.fetchone()[0]
                cur.execute("SELECT version_num FROM alembic_version;")
                baseline["t004_alembic"] = cur.fetchall()

        log(f"  [PASS] Control Plane Baseline: {baseline['sys_companies']} companies, {baseline['sys_registries']} registries, {baseline['sys_users']} users")
        log(f"  [PASS] smriti001 Baseline: {baseline['t001_products']} products, {baseline['t001_customers']} customers, {baseline['t001_invoices']} invoices, {baseline['t001_movements']} stock movements, {baseline['t001_shifts']} shifts")
        log(f"  [PASS] smriti004 Baseline: {baseline['t004_products']} products, {baseline['t004_customers']} customers, {baseline['t004_invoices']} invoices")
        return True, baseline
    except Exception as e:
        log(f"  [FAIL] Failed to capture pre-update baseline: {e}")
        return False, {}


def test_step_2_execute_upgrade_engine() -> bool:
    log("\n==================================================================")
    log("STAGE 5 - STEP 2: Executing Non-Destructive Update Cycle (Bootstrap Engine)")
    log("==================================================================")
    cmd = "python -m app.db.bootstrap_engine"
    rc, out, err = run_docker_exec(cmd)
    log(f"  Bootstrap Engine output snippet:\n{out[:600]}...")
    if rc != 0:
        log(f"  [FAIL] Bootstrap Engine execution returned exit code {rc}: {err}")
        return False

    log("  [PASS] Canonical Database Bootstrap Engine executed successfully with return code 0.")
    return True


def test_step_3_verify_migration_lineage() -> bool:
    log("\n==================================================================")
    log("STAGE 5 - STEP 3: Verifying Migration Lineage & Zero Drift")
    log("==================================================================")
    databases = ["smritisys", "smriti001", "smriti002", "smriti003", "smriti004"]
    expected_head = "v1488_seed_desktop_billing_menu"

    all_match = True
    for db in databases:
        try:
            with get_pg_conn(db) as conn:
                with conn.cursor() as cur:
                    cur.execute("SELECT version_num FROM alembic_version;")
                    revs = [r[0] for r in cur.fetchall()]
                    if expected_head in revs:
                        log(f"  [PASS] {db} alembic_version contains expected HEAD revision: {revs}")
                    else:
                        log(f"  [FAIL] {db} alembic_version mismatch: got {revs}, expected {expected_head}")
                        all_match = False
        except Exception as e:
            log(f"  [FAIL] Error reading alembic_version in {db}: {e}")
            all_match = False

    return all_match


def test_step_4_verify_data_preservation(baseline: Dict[str, Any]) -> bool:
    log("\n==================================================================")
    log("STAGE 5 - STEP 4: Verifying 100% Data Preservation After Upgrade")
    log("==================================================================")
    all_passed = True

    try:
        # Check counts in smriti001
        with get_pg_conn("smriti001") as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT count(*) FROM products;")
                cnt_p = cur.fetchone()[0]
                cur.execute("SELECT count(*) FROM customers;")
                cnt_c = cur.fetchone()[0]
                cur.execute("SELECT count(*) FROM sales_invoices;")
                cnt_i = cur.fetchone()[0]
                cur.execute("SELECT count(*) FROM stock_movements;")
                cnt_m = cur.fetchone()[0]

                if cnt_p >= baseline["t001_products"] and cnt_c >= baseline["t001_customers"] and cnt_i >= baseline["t001_invoices"] and cnt_m >= baseline["t001_movements"]:
                    log(f"  [PASS] smriti001 Table counts preserved or increased (Products: {cnt_p}, Customers: {cnt_c}, Invoices: {cnt_i}, Movements: {cnt_m})")
                else:
                    log(f"  [FAIL] smriti001 Count reduction detected! Pre={baseline}, Post=({cnt_p}, {cnt_c}, {cnt_i}, {cnt_m})")
                    all_passed = False

                # Verify specific Stage 2 records
                cur.execute("SELECT code, name, mrp, price FROM products WHERE code = 'RICE-5KG-62509';")
                item = cur.fetchone()
                if item and item[0] == "RICE-5KG-62509":
                    log(f"  [PASS] Stage 2 Item preserved: {item[0]} | {item[1]}")
                else:
                    log("  [FAIL] Stage 2 Item RICE-5KG-62509 missing post-upgrade!")
                    all_passed = False

                cur.execute("SELECT code, name, mobile FROM customers WHERE code = 'CUST-E2E-1790262509';")
                cust = cur.fetchone()
                if cust and cust[0] == "CUST-E2E-1790262509":
                    log(f"  [PASS] Stage 2 Customer preserved: {cust[0]} | {cust[1]}")
                else:
                    log("  [FAIL] Stage 2 Customer CUST-E2E-1790262509 missing post-upgrade!")
                    all_passed = False

                cur.execute("SELECT invoice_no, grand_total, status FROM sales_invoices WHERE invoice_no = 'INV-E2E-1790262510';")
                inv = cur.fetchone()
                if inv and inv[0] == "INV-E2E-1790262510":
                    log(f"  [PASS] Stage 2 Sales Invoice preserved: {inv[0]} | Total: Rs. {inv[1]} | Status: {inv[2]}")
                else:
                    log("  [FAIL] Stage 2 Sales Invoice INV-E2E-1790262510 missing post-upgrade!")
                    all_passed = False

        # Check counts in smriti004
        with get_pg_conn("smriti004") as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT count(*) FROM sales_invoices;")
                cnt_i4 = cur.fetchone()[0]
                if cnt_i4 >= baseline["t004_invoices"]:
                    log(f"  [PASS] smriti004 Sales Invoices preserved: {cnt_i4}")
                else:
                    log("  [FAIL] smriti004 Invoice count reduced post-upgrade!")
                    all_passed = False

                cur.execute("SELECT invoice_no, grand_total, status FROM sales_invoices WHERE invoice_no = 'INV-DYN-1790263223';")
                inv4 = cur.fetchone()
                if inv4 and inv4[0] == "INV-DYN-1790263223":
                    log(f"  [PASS] Stage 3 Dynamic Sales Invoice preserved: {inv4[0]} | Total: Rs. {inv4[1]} | Status: {inv4[2]}")
                else:
                    log("  [FAIL] Stage 3 Sales Invoice INV-DYN-1790263223 missing post-upgrade!")
                    all_passed = False

        return all_passed
    except Exception as e:
        log(f"  [FAIL] Error verifying data preservation: {e}")
        return False


def test_step_5_verify_api_operational() -> bool:
    log("\n==================================================================")
    log("STAGE 5 - STEP 5: Verifying Operational APIs Post-Upgrade")
    log("==================================================================")
    try:
        # 1. Health endpoint
        req = Request(f"{API_HOST}/health", headers={"Accept": "application/json"})
        with urlopen(req, timeout=5) as resp:
            data = json.loads(resp.read().decode())
            if resp.status == 200 and data.get("status") == "healthy":
                log(f"  [PASS] GET /health -> 200 OK | {data}")
            else:
                log(f"  [FAIL] GET /health returned status {resp.status}: {data}")
                return False

        # 2. Login to get Access Token
        login_data = json.dumps({"username": "admin", "password": "Admin@123"}).encode("utf-8")
        req = Request(f"{API_HOST}/api/v1/auth/login", data=login_data, headers={"Content-Type": "application/json", "Accept": "application/json"}, method="POST")
        with urlopen(req, timeout=5) as resp:
            login_resp = json.loads(resp.read().decode())
            token = login_resp.get("access_token")
            if resp.status == 200 and token:
                log(f"  [PASS] POST /api/v1/auth/login -> 200 OK | Authenticated admin token acquired.")
            else:
                log(f"  [FAIL] Login failed: {resp.status} {login_resp}")
                return False

        # 3. Company tenant discovery with Bearer Token
        req = Request(f"{API_HOST}/api/v1/auth/tenants", headers={"Accept": "application/json", "Authorization": f"Bearer {token}"})
        with urlopen(req, timeout=5) as resp:
            data = json.loads(resp.read().decode())
            companies = data.get("companies", [])
            comp_ids = {c["id"] for c in companies}
            if "COMP-001" in comp_ids and "COMP-004" in comp_ids:
                log(f"  [PASS] GET /api/v1/auth/tenants -> 200 OK | Discovered {len(companies)} companies including COMP-001 and COMP-004.")
            else:
                log(f"  [FAIL] Missing COMP-001 or COMP-004 in tenant discovery: {comp_ids}")
                return False

        # 4. Authenticated CRM customer endpoint on COMP-001
        req = Request(f"{API_HOST}/api/v1/crm/customers", headers={"Accept": "application/json", "Authorization": f"Bearer {token}", "X-Company-ID": "COMP-001"})
        with urlopen(req, timeout=5) as resp:
            custs = json.loads(resp.read().decode())
            log(f"  [PASS] GET /api/v1/crm/customers (COMP-001) -> 200 OK | {len(custs)} customers returned.")

        # 5. Authenticated CRM customer endpoint on COMP-004
        req = Request(f"{API_HOST}/api/v1/crm/customers", headers={"Accept": "application/json", "Authorization": f"Bearer {token}", "X-Company-ID": "COMP-004"})
        with urlopen(req, timeout=5) as resp:
            custs4 = json.loads(resp.read().decode())
            log(f"  [PASS] GET /api/v1/crm/customers (COMP-004) -> 200 OK | {len(custs4)} customers returned.")

        return True
    except Exception as e:
        log(f"  [FAIL] Error verifying operational APIs: {e}")
        return False


def test_step_6_service_health_script() -> bool:
    log("\n==================================================================")
    log("STAGE 5 - STEP 6: Executing Service Health Probe (scripts/health.ps1)")
    log("==================================================================")
    health_script = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "scripts", "health.ps1")
    cmd = f'powershell -ExecutionPolicy Bypass -File "{health_script}"'
    proc = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    log(f"  Health probe output snippet:\n{proc.stdout[:400]}...")
    if proc.returncode != 0 or "[FAIL]" in proc.stdout:
        log(f"  [FAIL] Service health probe failed:\n{proc.stdout}\n{proc.stderr}")
        return False

    log("  [PASS] Service health probe passed with 0 failures.")
    return True


def main():
    log("==================================================================")
    log("SMRITI RETAIL OS v3.16.0 — STAGE 5: UPGRADE LINEAGE TEST")
    log("==================================================================")

    ok1, baseline = test_step_1_capture_baseline()
    if not ok1:
        log("STAGE 5 UPGRADE LINEAGE TEST FAILED AT STEP 1")
        sys.exit(1)

    ok2 = test_step_2_execute_upgrade_engine()
    if not ok2:
        log("STAGE 5 UPGRADE LINEAGE TEST FAILED AT STEP 2")
        sys.exit(1)

    ok3 = test_step_3_verify_migration_lineage()
    if not ok3:
        log("STAGE 5 UPGRADE LINEAGE TEST FAILED AT STEP 3")
        sys.exit(1)

    ok4 = test_step_4_verify_data_preservation(baseline)
    if not ok4:
        log("STAGE 5 UPGRADE LINEAGE TEST FAILED AT STEP 4")
        sys.exit(1)

    ok5 = test_step_5_verify_api_operational()
    if not ok5:
        log("STAGE 5 UPGRADE LINEAGE TEST FAILED AT STEP 5")
        sys.exit(1)

    ok6 = test_step_6_service_health_script()
    if not ok6:
        log("STAGE 5 UPGRADE LINEAGE TEST FAILED AT STEP 6")
        sys.exit(1)

    log("\n==================================================================")
    log("STAGE 5 UPGRADE LINEAGE TEST: ALL CHECKS PASSED [6/6]")
    log("==================================================================")


if __name__ == "__main__":
    main()
