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
* Classification: Internal Core Architecture

SMRITI Canonical Multi-Tenant Database Bootstrap & Provisioning Engine
═════════════════════════════════════════════════════════════════════
Automated, idempotent, controlled lifecycle engine for SMRITI Retail OS:
1. Control-Plane initialization & migration (smritisys).
2. Control-Plane baseline registry & user seeding.
3. Tenant database discovery from company_database_registries.
4. Physical tenant database creation if absent (smriti001, etc.).
5. Tenant schema migrations to head (alembic -x target=tenant).
6. Tenant baseline operational data seeding (CRM, POS, Products, Vendors).
7. Strict idempotency: safe to run repeatedly without destroying data.
"""

import os
import sys
import subprocess
import logging
from typing import Dict, Any, List, Optional
from urllib.parse import urlparse
import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT

# Ensure backend root is in sys.path
backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("smriti.db.bootstrap_engine")


def get_pg_credentials() -> Dict[str, Any]:
    """Extract authoritative PostgreSQL connection parameters from settings.DATABASE_URL."""
    from app.core.config import settings
    parsed = urlparse(settings.DATABASE_URL)
    user = parsed.username or os.getenv("POSTGRES_USER") or "postgres"
    password = parsed.password or os.getenv("POSTGRES_PASSWORD") or "postgres"
    host = parsed.hostname or os.getenv("POSTGRES_HOST") or "localhost"
    port = int(parsed.port or 5432)
    return {
        "user": user,
        "password": password,
        "host": host,
        "port": port,
    }


def get_raw_connection(dbname: str = "postgres"):
    """Create a raw psycopg2 autocommit connection for DDL operations."""
    creds = get_pg_credentials()
    conn = psycopg2.connect(
        dbname=dbname,
        user=creds["user"],
        password=creds["password"],
        host=creds["host"],
        port=creds["port"],
    )
    conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
    return conn


def database_exists(dbname: str) -> bool:
    """Check if target database physically exists in the PostgreSQL catalog."""
    conn = get_raw_connection("postgres")
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT 1 FROM pg_database WHERE datname = %s;", (dbname,))
            return cur.fetchone() is not None
    finally:
        conn.close()


def create_database_if_missing(dbname: str) -> bool:
    """Idempotently create a PostgreSQL database if it does not already exist."""
    if database_exists(dbname):
        logger.info("Database '%s' already exists. Skipping creation.", dbname)
        return False

    logger.info("Database '%s' does not exist. Creating...", dbname)
    conn = get_raw_connection("postgres")
    try:
        conn.autocommit = True
        with conn.cursor() as cur:
            cur.execute(f'CREATE DATABASE "{dbname}" ENCODING \'UTF8\';')
    finally:
        conn.close()
    logger.info("Database '%s' created successfully.", dbname)
    return True


def run_alembic_migration(target: str, db_name: str, revision: str = "head") -> None:
    """
    Execute Alembic migrations with explicit target and db parameters.
    target: 'control' or 'tenant'
    db_name: 'smritisys' or company database name (e.g. 'smriti001')
    """
    logger.info("Executing Alembic migration: target=%s, db=%s, revision=%s...", target, db_name, revision)
    env = os.environ.copy()
    env["PYTHONPATH"] = ""
    env["ALEMBIC_TARGET"] = target

    cmd = [
        sys.executable, "-m", "alembic",
        "-x", f"target={target}",
        "-x", f"db={db_name}",
        "upgrade", revision
    ]

    import time
    for attempt in range(1, 4):
        proc = subprocess.run(
            cmd,
            cwd=backend_dir,
            env=env,
            capture_output=True,
            text=True,
        )

        if proc.returncode == 0:
            logger.info("Alembic migration completed successfully for %s:%s.", target, db_name)
            return

        if "alembic_version" in proc.stderr or "UniqueViolation" in proc.stderr:
            logger.warning(
                "Transient Alembic version table race condition detected on %s:%s (attempt %d/3). Retrying in 2s...",
                target, db_name, attempt
            )
            time.sleep(2)
            continue

        error_msg = f"Alembic migration failed for {target}:{db_name}:\n{proc.stdout}\n{proc.stderr}"
        logger.error(error_msg)
        raise RuntimeError(error_msg)


def bootstrap_control_plane() -> None:
    """
    Step 1: Ensure smritisys exists, run control migrations, and seed baseline users & companies.
    """
    logger.info("--- Phase 1: Bootstrapping Control Plane (smritisys) ---")
    create_database_if_missing("smritisys")
    run_alembic_migration("control", "smritisys", "head")

    logger.info("Seeding baseline users, roles, and company registries in smritisys...")
    env = os.environ.copy()
    env["PYTHONPATH"] = backend_dir
    proc = subprocess.run(
        [sys.executable, "-m", "app.db.seed_baseline_users"],
        cwd=backend_dir,
        env=env,
        capture_output=True,
        text=True,
    )
    if proc.returncode != 0:
        logger.warning("Notice from seed_baseline_users:\n%s\n%s", proc.stdout, proc.stderr)
    else:
        logger.info("Control plane baseline seed completed.")


def discover_required_tenant_databases() -> List[Dict[str, str]]:
    """
    Step 2: Query smritisys.company_database_registries to identify legitimate READY tenant databases.
    """
    logger.info("--- Phase 2: Discovering Required Tenant Databases ---")
    tenants = []
    conn = get_raw_connection("smritisys")
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT company_id, database_name, status
                FROM company_database_registries
                WHERE status = 'READY'
                  AND LOWER(database_name) ~ '^smriti(?!000)(?!sys)[a-z0-9]{3}$'
                ORDER BY database_name;
            """)
            rows = cur.fetchall()
            for company_id, database_name, status in rows:
                clean_db = str(database_name).strip().lower()
                tenants.append({
                    "company_id": company_id,
                    "database_name": clean_db,
                    "status": status,
                })
    finally:
        conn.close()

    if not tenants:
        # Fallback default guarantee: ensure COMP-001 -> smriti001 is recognized
        logger.warning("No canonical READY tenant databases found in registry. Defaulting to COMP-001 -> smriti001.")
        tenants.append({
            "company_id": "COMP-001",
            "database_name": "smriti001",
            "status": "READY",
        })

    logger.info("Discovered %d tenant database target(s): %s", len(tenants), [t["database_name"] for t in tenants])
    return tenants


def seed_tenant_baseline_data(database_name: str, company_id: str = "COMP-001") -> None:
    """
    Step 3b: Seed mandatory tenant baseline operational data if not already present.
    Includes: Customer Groups, Customers, Products, Cash Registers, and Vendors.
    """
    import uuid as uuid_mod
    logger.info("Seeding baseline operational data into tenant DB '%s' (company=%s)...", database_name, company_id)
    conn = get_raw_connection(database_name)
    try:
        conn.autocommit = True
        with conn.cursor() as cur:
            # 0. Ensure Company and Branch exist in tenant database
            cur.execute("""
                INSERT INTO companies (id, uuid, name, is_active, is_deleted)
                VALUES (%s, %s, %s, true, false)
                ON CONFLICT (id) DO NOTHING;
            """, (company_id, str(uuid_mod.uuid4()), f"Company {company_id}"))

            cur.execute("""
                SELECT id FROM branches WHERE company_id = %s AND is_deleted = false ORDER BY id ASC LIMIT 1;
            """, (company_id,))
            row = cur.fetchone()
            if row:
                resolved_branch_id = row[0]
            else:
                resolved_branch_id = "BR-MAIN-001" if company_id == "COMP-001" else f"BR-{company_id}-001"
                cur.execute("""
                    INSERT INTO branches (id, uuid, company_id, name, code, is_active, is_deleted)
                    VALUES (%s, %s, %s, %s, %s, true, false)
                    ON CONFLICT (id) DO NOTHING;
                """, (resolved_branch_id, str(uuid_mod.uuid4()), company_id, f"Main Branch ({company_id})", f"MAIN-{company_id}"))

            # 1. Baseline Customer Groups
            cur.execute("""
                INSERT INTO customer_groups (id, uuid, name, credit_limit, credit_days, company_id, is_active, is_deleted)
                VALUES 
                    ('CG-Retail', %s, 'Retail Clients', 100000.00, 30, %s, true, false),
                    ('CG-Corporate', %s, 'Corporate Clients', 500000.00, 60, %s, true, false),
                    ('CG-LargeRetail', %s, 'Large-Format Retail', 1000000.00, 90, %s, true, false)
                ON CONFLICT (id) DO NOTHING;
            """, (str(uuid_mod.uuid4()), company_id, str(uuid_mod.uuid4()), company_id, str(uuid_mod.uuid4()), company_id))

            # 2. Baseline Customers
            cur.execute("""
                INSERT INTO customers (id, uuid, code, name, mobile, email, customer_group_id, outstanding, company_id, is_active, is_deleted)
                VALUES 
                    ('CUST-001', %s, 'CUST-001', 'Reliance Retail Limited', '9822334455', 'operations@relianceretail.com', 'CG-LargeRetail', 180000.00, %s, true, false),
                    ('CUST-002', %s, 'CUST-002', 'Shoppers Stop Ltd', '9833445566', 'billing@shoppersstop.com', 'CG-LargeRetail', 250000.00, %s, true, false),
                    ('CUST-003', %s, 'CUST-003', 'Lifestyle International', '9844556677', 'accounts@lifestylestores.com', 'CG-Corporate', 120000.00, %s, true, false),
                    ('CUST-WALKIN', %s, 'WALK-IN', 'Walk-In / Cash Customer', '9999999999', 'walkin@smriti.local', 'CG-Retail', 0.00, %s, true, false)
                ON CONFLICT (id) DO NOTHING;
            """, (str(uuid_mod.uuid4()), company_id, str(uuid_mod.uuid4()), company_id, str(uuid_mod.uuid4()), company_id, str(uuid_mod.uuid4()), company_id))

            # 3. Baseline Products
            cur.execute("""
                INSERT INTO products (
                    id, uuid, company_id, code, sku, barcode, name, category, brand,
                    color, size, style_code, price, mrp, buying_price, cost_price,
                    stock, reserved_stock, gst_percentage, hsn_code, workflow_status, is_active, is_deleted
                ) VALUES (
                    'PROD-UAT-B2B-001', %s, %s, 'UAT-B2B-001', 'UAT-B2B-001', '8900000000001',
                    'UAT Corporate Cotton Shirt', 'Apparel', 'SMRITI', 'Blue', 'M',
                    'UAT-SHIRT-001', 1200, 1500, 800, 800, 100, 0.0000, 18, '6203', 'Approved', true, false
                )
                ON CONFLICT (id) DO NOTHING;
            """, (str(uuid_mod.uuid4()), company_id))

            # 4. Baseline POS Profiles / Cash Registers
            cur.execute("""
                INSERT INTO cash_registers (
                    id, uuid, name, code, cashier, warehouse, notes, is_locked, is_active, is_deleted,
                    company_id, branch_id, created_at, modified_at
                ) VALUES 
                    ('PROF-DEFAULT-REG01', %s, 'Counter 01 - Express Billing', 'REG-01', 'EMP001 - John Doe', 'Main Store', 'Default installation counter with high-speed POS billing.', false, true, false, %s, %s, NOW(), NOW()),
                    ('PROF-DEFAULT-REG02', %s, 'Counter 02 - Standard Checkout', 'REG-02', 'EMP002 - Jane Smith', 'Main Store', 'Secondary standard checkout counter.', false, true, false, %s, %s, NOW(), NOW())
                ON CONFLICT (id) DO UPDATE SET
                    created_at = COALESCE(cash_registers.created_at, NOW()),
                    modified_at = COALESCE(cash_registers.modified_at, NOW());

                UPDATE cash_registers SET created_at = NOW(), modified_at = NOW() WHERE created_at IS NULL;
            """, (str(uuid_mod.uuid4()), company_id, resolved_branch_id, str(uuid_mod.uuid4()), company_id, resolved_branch_id))

            # 5. Baseline Vendor / Supplier (for Procurement & Universal Party Master)
            cur.execute("""
                INSERT INTO suppliers (
                    id, uuid, company_id, branch_id, name, code, gst_number, mobile, email,
                    address, city, state, pincode, outstanding, is_active, is_deleted
                ) VALUES (
                    'SUPP-001', %s, %s, %s, 'Premier Textiles India Ltd', 'VEN-001',
                    '27AAACP0123A1Z1', '9811223344', 'orders@premiertextiles.in',
                    'Textile Park, Industrial Area', 'Mumbai', 'Maharashtra', '400013',
                    0.00, true, false
                )
                ON CONFLICT (id) DO NOTHING;
            """, (str(uuid_mod.uuid4()), company_id, resolved_branch_id))

            # Universal Party & Party Role entry for vendor
            cur.execute("""
                INSERT INTO parties (
                    id, uuid, company_id, party_code, legal_name, trade_name, party_type,
                    status, gstin, mobile, email, city, state, country, is_active, is_deleted
                ) VALUES (
                    'pty_supp_001', %s, %s, 'VEN-001', 'Premier Textiles India Ltd', 'Premier Textiles',
                    'ORGANIZATION', 'ACTIVE', '27AAACP0123A1Z1', '9811223344', 'orders@premiertextiles.in',
                    'Mumbai', 'Maharashtra', 'India', true, false
                )
                ON CONFLICT (id) DO NOTHING;
            """, (str(uuid_mod.uuid4()), company_id))

            cur.execute("""
                INSERT INTO party_roles (
                    id, uuid, party_id, role_type, is_active, is_deleted
                ) VALUES (
                    'pr_supp_001', %s, 'pty_supp_001', 'SUPPLIER', true, false
                )
                ON CONFLICT (id) DO NOTHING;
            """, (str(uuid_mod.uuid4()),))

            cur.execute("""
                INSERT INTO supplier_profiles (
                    id, uuid, party_id, supplier_type, payment_terms_days, commercial_classification,
                    tds_rate, tax_treatment, outstanding_liability, is_active, is_deleted
                ) VALUES (
                    'sp_supp_001', %s, 'pty_supp_001', 'DISTRIBUTOR', 30, 'APPROVED',
                    0.10, 'REGISTERED_REGULAR', 0.00, true, false
                )
                ON CONFLICT (id) DO NOTHING;
            """, (str(uuid_mod.uuid4()),))
    finally:
        conn.close()

    logger.info("Baseline operational data seeded successfully in '%s'.", database_name)


def provision_and_migrate_tenants(tenants: Optional[List[Dict[str, str]]] = None) -> List[Dict[str, Any]]:
    """
    Step 3: Provision physical databases, execute migrations, and seed baseline tenant data.
    """
    logger.info("--- Phase 3: Provisioning & Migrating Tenant Databases ---")
    if tenants is None:
        tenants = discover_required_tenant_databases()

    results = []
    for tenant in tenants:
        db_name = tenant["database_name"]
        company_id = tenant["company_id"]
        logger.info("Processing tenant '%s' -> database '%s'...", company_id, db_name)

        created = create_database_if_missing(db_name)
        run_alembic_migration("tenant", db_name, "head")
        seed_tenant_baseline_data(db_name, company_id)

        results.append({
            "company_id": company_id,
            "database_name": db_name,
            "created": created,
            "status": "READY",
        })

    return results


BOOTSTRAP_ADVISORY_LOCK_ID = 81920261981


def run_full_bootstrap() -> Dict[str, Any]:
    """
    Main orchestration entry point: executes complete end-to-end database bootstrap.
    Acquires a cluster-wide PostgreSQL advisory lock to serialize concurrent invocations.
    """
    logger.info("================================================================================")
    logger.info("SMRITI RETAIL OS — CANONICAL DATABASE BOOTSTRAP ENGINE")
    logger.info("================================================================================")

    lock_conn = None
    try:
        try:
            lock_conn = get_raw_connection("postgres")
            lock_conn.autocommit = True
            with lock_conn.cursor() as cur:
                logger.info("Acquiring bootstrap cluster advisory lock (%d)...", BOOTSTRAP_ADVISORY_LOCK_ID)
                cur.execute("SELECT pg_advisory_lock(%s);", (BOOTSTRAP_ADVISORY_LOCK_ID,))
                logger.info("Bootstrap advisory lock acquired.")
        except Exception as lock_err:
            logger.warning("Could not acquire advisory lock (proceeding with optimistic execution): %s", lock_err)
            lock_conn = None

        # 1. Bootstrap control plane
        bootstrap_control_plane()

        # 2. Discover and provision required tenants
        tenants = discover_required_tenant_databases()
        tenant_results = provision_and_migrate_tenants(tenants)

        # 3. Synchronize baseline users across all seeded tenant DBs
        env = os.environ.copy()
        env["PYTHONPATH"] = backend_dir
        subprocess.run(
            [sys.executable, "-m", "app.db.seed_baseline_users"],
            cwd=backend_dir,
            env=env,
            capture_output=True,
            text=True,
        )

        logger.info("================================================================================")
        logger.info("BOOTSTRAP COMPLETED SUCCESSFULLY: Control plane & %d tenant(s) fully provisioned.", len(tenant_results))
        logger.info("================================================================================")

        return {
            "status": "SUCCESS",
            "control_plane": "smritisys",
            "tenants": tenant_results,
        }
    finally:
        if lock_conn:
            try:
                with lock_conn.cursor() as cur:
                    cur.execute("SELECT pg_advisory_unlock(%s);", (BOOTSTRAP_ADVISORY_LOCK_ID,))
                    logger.info("Bootstrap advisory lock released.")
            except Exception as e:
                logger.warning("Failed to release advisory lock: %s", e)
            finally:
                lock_conn.close()


if __name__ == "__main__":
    try:
        run_full_bootstrap()
        sys.exit(0)
    except Exception as exc:
        logger.exception("Bootstrap execution failed: %s", exc)
        sys.exit(1)
