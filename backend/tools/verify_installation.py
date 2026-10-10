"""
Project      : SMRITI Retail OS
Repository   : SMRITIRetailNX
Organization : AITDL NETWORKS

Founders

* Pushpa Devi Jawahar Mallah
  * Founder & Chairperson
  * Phone: [REDACTED_PUBLIC_PII]
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

SMRITI Comprehensive Installation & Database Topology Verification Suite
════════════════════════════════════════════════════════════════════════
Verifies Rules 8, 9, 10:
1. Physical database topology (smritisys, smriti001).
2. Schema & table presence per canonical table ownership contract.
3. Tenant routing resolution (COMP-001 -> smriti001, status='READY').
4. Direct PostgreSQL connectivity to control plane and tenant databases.
5. Live API endpoint responses:
   - GET /api/v1/crm/customers
   - GET /api/v1/crm/customer-groups
   - GET /api/v1/pos/shifts/
   - GET /api/v1/pos/profiles/
   - GET /api/v1/products/search
   - GET /api/v1/purchase/vendors/
"""

import os
import sys
import logging
from typing import Dict, Any, List, Tuple
from urllib.parse import urlparse
import psycopg2

# Ensure backend root is in sys.path
backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

os.environ.setdefault("JWT_SECRET_KEY", "dev-test-jwt-secret-key-32-chars-long-smriti")
os.environ.setdefault("INTERNAL_SERVICE_KEY", "dev-test-internal-service-key-32-chars")
os.environ.setdefault("SGIP_VAULT_MASTER_KEY", "dev-test-sgip-vault-master-key-32-chars")

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("smriti.verify_installation")


def get_pg_credentials() -> Dict[str, Any]:
    from app.core.config import settings
    parsed = urlparse(settings.DATABASE_URL)
    return {
        "user": parsed.username or os.getenv("POSTGRES_USER") or "postgres",
        "password": parsed.password or os.getenv("POSTGRES_PASSWORD") or "postgres",
        "host": parsed.hostname or os.getenv("POSTGRES_HOST") or "localhost",
        "port": int(parsed.port or 5432),
    }


def get_pg_connection(dbname: str):
    creds = get_pg_credentials()
    return psycopg2.connect(
        dbname=dbname,
        user=creds["user"],
        password=creds["password"],
        host=creds["host"],
        port=creds["port"],
    )


def verify_database_topology() -> List[Tuple[str, bool, str]]:
    """Verify physical presence of smritisys and smriti001 in PostgreSQL catalog."""
    checks = []
    with get_pg_connection("postgres") as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT datname FROM pg_database WHERE datistemplate = false;")
            dbs = {row[0] for row in cur.fetchall()}

    # 1. smritisys
    has_ctrl = "smritisys" in dbs
    checks.append(("Database: smritisys exists", has_ctrl, "Present in pg_database" if has_ctrl else "MISSING from pg_database"))

    # 2. smriti001
    has_tenant = "smriti001" in dbs
    checks.append(("Database: smriti001 exists", has_tenant, "Present in pg_database" if has_tenant else "MISSING from pg_database"))

    return checks


def verify_table_presence() -> List[Tuple[str, bool, str]]:
    """Verify core tables exist in control plane and tenant databases."""
    checks = []

    # Control Plane tables
    ctrl_required = [
        "companies", "branches", "company_database_registries",
        "users", "roles", "user_company_assignments", "smriti_menus"
    ]
    try:
        with get_pg_connection("smritisys") as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';")
                ctrl_tables = {row[0] for row in cur.fetchall()}
        missing_ctrl = [t for t in ctrl_required if t not in ctrl_tables]
        checks.append((
            "Control Plane Core Tables (smritisys)",
            len(missing_ctrl) == 0,
            f"All {len(ctrl_required)} verified" if not missing_ctrl else f"Missing: {missing_ctrl}"
        ))
    except Exception as e:
        checks.append(("Control Plane Core Tables (smritisys)", False, f"Connection failed: {e}"))

    # Tenant tables
    tenant_required = [
        "customers", "customer_groups", "products", "cash_registers",
        "shifts", "suppliers", "parties", "party_roles", "sales_invoices",
        "sales_orders", "stock_movements"
    ]
    try:
        with get_pg_connection("smriti001") as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';")
                tenant_tables = {row[0] for row in cur.fetchall()}
        missing_tenant = [t for t in tenant_required if t not in tenant_tables]
        checks.append((
            "Tenant Core Tables (smriti001)",
            len(missing_tenant) == 0,
            f"All {len(tenant_required)} verified ({len(tenant_tables)} total tables)" if not missing_tenant else f"Missing: {missing_tenant}"
        ))
    except Exception as e:
        checks.append(("Tenant Core Tables (smriti001)", False, f"Connection failed: {e}"))

    return checks


def verify_tenant_routing() -> List[Tuple[str, bool, str]]:
    """Verify COMP-001 is registered and mapped to smriti001 with READY status."""
    checks = []
    try:
        with get_pg_connection("smritisys") as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT id, name FROM companies WHERE id = 'COMP-001';")
                comp = cur.fetchone()
                has_comp = comp is not None
                checks.append((
                    "Company: COMP-001 exists in smritisys.companies",
                    has_comp,
                    f"Name: {comp[1]}" if has_comp else "MISSING"
                ))

                cur.execute("""
                    SELECT database_name, status
                    FROM company_database_registries
                    WHERE company_id = 'COMP-001';
                """)
                reg = cur.fetchone()
                valid_reg = reg is not None and reg[0] == "smriti001" and reg[1] == "READY"
                details = f"Database: {reg[0]}, Status: {reg[1]}" if reg else "NO REGISTRY ENTRY"
                checks.append((
                    "Routing: COMP-001 -> smriti001 (status=READY)",
                    valid_reg,
                    details
                ))
    except Exception as e:
        checks.append(("Tenant Routing Verification", False, f"Query failed: {e}"))

    return checks


async def verify_real_apis_async(api_base_url: str = "http://localhost:8000") -> List[Tuple[str, bool, str]]:
    """
    Test the 6 required API endpoints against live FastAPI app using TestClient / httpx.
    """
    checks = []
    import httpx
    from app.core.security import create_access_token

    # Generate a legitimate token for admin with COMP-001 context
    token = create_access_token(
        data={
            "sub": "usr-admin",
            "username": "admin",
            "role": "SYSADMIN",
            "company_id": "COMP-001",
            "branch_id": "BR-MAIN-001",
            "type": "access",
        }
    )

    headers = {
        "Authorization": f"Bearer {token}",
        "X-Company-Code": "COMP-001",
        "X-Branch-Code": "MAIN",
    }

    endpoints_to_test = [
        ("CRM Customers", "/api/v1/crm/customers"),
        ("CRM Customer Groups", "/api/v1/crm/customer-groups"),
        ("POS Shifts", "/api/v1/pos/shifts/"),
        ("POS Profiles", "/api/v1/pos/profiles/"),
        ("Products Search", "/api/v1/products/search"),
        ("Purchase Vendors", "/api/v1/purchase/vendors/"),
    ]

    # Test via httpx against local or remote URL
    # If API is running externally, use api_base_url; otherwise use internal app TestClient
    use_remote = True
    async with httpx.AsyncClient(base_url=api_base_url, timeout=10.0) as client:
        try:
            h_resp = await client.get("/health")
            if h_resp.status_code != 200:
                use_remote = False
        except Exception:
            use_remote = False

    if use_remote:
        logger.info("Verifying APIs via live HTTP against %s...", api_base_url)
        async with httpx.AsyncClient(base_url=api_base_url, timeout=15.0) as client:
            for name, path in endpoints_to_test:
                try:
                    resp = await client.get(path, headers=headers)
                    passed = resp.status_code == 200
                    checks.append((
                        f"API: {name} ({path})",
                        passed,
                        f"HTTP {resp.status_code} OK (Items: {len(resp.json()) if isinstance(resp.json(), list) else 'Object'})"
                        if passed else f"HTTP {resp.status_code}: {resp.text[:120]}"
                    ))
                except Exception as e:
                    checks.append((f"API: {name} ({path})", False, f"Request failed: {e}"))
    else:
        logger.info("API server not listening externally on %s. Verifying directly via in-process ASGI engine...", api_base_url)
        from app.main import app
        from httpx import ASGITransport

        transport = ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://testserver", timeout=15.0) as client:
            for name, path in endpoints_to_test:
                try:
                    resp = await client.get(path, headers=headers)
                    passed = resp.status_code == 200
                    checks.append((
                        f"API (In-Process): {name} ({path})",
                        passed,
                        f"HTTP {resp.status_code} OK (Items: {len(resp.json()) if isinstance(resp.json(), list) else 'Object'})"
                        if passed else f"HTTP {resp.status_code}: {resp.text[:120]}"
                    ))
                except Exception as e:
                    checks.append((f"API (In-Process): {name} ({path})", False, f"Request failed: {e}"))

    return checks


def main():
    import argparse
    import asyncio

    parser = argparse.ArgumentParser(description="SMRITI Installation & Database Topology Verifier")
    parser.add_argument("--api-url", default=os.getenv("BACKEND_API_URL", "http://localhost:8000"), help="Base URL of running API backend")
    args = parser.parse_args()

    print("================================================================================")
    print("SMRITI RETAIL OS — INSTALLATION & TOPOLOGY VERIFICATION REPORT")
    print("================================================================================")

    all_checks: List[Tuple[str, bool, str]] = []

    # 1. Topology
    topo_checks = verify_database_topology()
    all_checks.extend(topo_checks)

    # 2. Table Presence
    table_checks = verify_table_presence()
    all_checks.extend(table_checks)

    # 3. Routing
    routing_checks = verify_tenant_routing()
    all_checks.extend(routing_checks)

    # 4. Live APIs
    api_checks = asyncio.run(verify_real_apis_async(args.api_url))
    all_checks.extend(api_checks)

    # Output formatted report table
    print("\n{:<45} | {:<8} | {:<35}".format("CHECK ITEM", "STATUS", "DETAILS"))
    print("-" * 95)

    all_passed = True
    for item, passed, details in all_checks:
        status_str = "PASSED" if passed else "FAILED"
        if not passed:
            all_passed = False
        print("{:<45} | {:<8} | {:<35}".format(item, status_str, details[:35]))

    print("-" * 95)

    total = len(all_checks)
    passed_count = sum(1 for _, p, _ in all_checks if p)
    failed_count = total - passed_count

    print(f"Summary: Total: {total} | Passed: {passed_count} | Failed: {failed_count}")
    print("================================================================================")

    if not all_passed:
        print("VERIFICATION FAILED: Critical database topology or API endpoints are non-functional.")
        sys.exit(1)

    print("VERIFICATION PASSED: Database topology, routing, and operational APIs verified.")
    sys.exit(0)


if __name__ == "__main__":
    main()
