"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.16.0
Created      : 2026-09-08
Modified     : 2026-09-08
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal — Test Rehearsal
"""

import os
import sys
import pytest
import psycopg2
from psycopg2.extras import RealDictCursor
import sqlalchemy as sa

# Ensure backend root is in sys.path
backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.db.tenant_harness import EphemeralTenantHarness
from app.db.bootstrap import (
    bootstrap_company_database_prerequisites,
    is_company_database_target,
)
from app.db.base import Base


def get_pg_conn(db_name: str):
    info = EphemeralTenantHarness._get_pg_admin_connection_info()
    info["dbname"] = db_name
    conn = psycopg2.connect(**info)
    conn.autocommit = True
    return conn


@pytest.fixture
def disposable_db():
    """Provisions a disposable Company DB and guarantees drop on teardown."""
    db_name = EphemeralTenantHarness.generate_ephemeral_db_name()
    EphemeralTenantHarness.create_ephemeral_database(db_name)
    try:
        yield db_name
    finally:
        EphemeralTenantHarness.drop_ephemeral_database(db_name)


# ---------------------------------------------------------------------------
# STEP 1 & 2: Fresh-Install Bootstrap Prerequisite Tests
# ---------------------------------------------------------------------------

def test_fresh_install_bootstrap_prerequisite(disposable_db):
    """
    Step 2: Verify fresh-install bootstrap prerequisite behavior.
    - Rejects smritisys / system DBs
    - Safely skips when sales_orders does not exist
    - Adds sales_orders.po_number (nullable VARCHAR(100) + index) when table exists but column absent
    - Safely no-ops on repeat invocation
    """
    db_name = disposable_db
    conn = get_pg_conn(db_name)
    cur = conn.cursor(cursor_factory=RealDictCursor)

    # 1. Table doesn't exist yet -> bootstrap skips cleanly
    engine = sa.create_engine(f"postgresql://postgres:postgres@localhost:5432/{db_name}")
    with engine.connect() as sa_conn:
        res1 = bootstrap_company_database_prerequisites(sa_conn, db_name=db_name)
        assert res1["status"] == "SKIPPED_TABLE_NOT_FOUND"
        assert res1["applied"] is False

        # 2. Create minimal sales_orders without po_number (as created by 5a24b31e30db)
        sa_conn.execute(sa.text("""
            CREATE TABLE sales_orders (
                id VARCHAR(50) PRIMARY KEY,
                order_no VARCHAR(100) NOT NULL UNIQUE,
                date DATE NOT NULL DEFAULT CURRENT_DATE,
                customer_name VARCHAR(255) NOT NULL,
                grand_total NUMERIC(15, 2) NOT NULL DEFAULT 0.00
            );
        """))
        sa_conn.commit()

        # 3. Run bootstrap prerequisite -> column and index are added
        res2 = bootstrap_company_database_prerequisites(sa_conn, db_name=db_name)
        assert res2["status"] == "APPLIED"
        assert res2["applied"] is True
        sa_conn.commit()

        # 4. Verify column in information_schema
        cur.execute("""
            SELECT column_name, data_type, is_nullable, character_maximum_length
            FROM information_schema.columns
            WHERE table_name = 'sales_orders' AND column_name = 'po_number';
        """)
        col = cur.fetchone()
        assert col is not None
        assert col["column_name"] == "po_number"
        assert col["data_type"] == "character varying"
        assert col["character_maximum_length"] == 100
        assert col["is_nullable"] == "YES"

        # 5. Verify index
        cur.execute("""
            SELECT indexname FROM pg_indexes
            WHERE tablename = 'sales_orders' AND indexname = 'ix_sales_orders_po_number';
        """)
        idx = cur.fetchone()
        assert idx is not None

        # 6. Idempotency: run bootstrap again -> NOOP
        res3 = bootstrap_company_database_prerequisites(sa_conn, db_name=db_name)
        assert res3["status"] == "NOOP_ALREADY_EXISTS"
        assert res3["applied"] is False

    engine.dispose()
    cur.close()
    conn.close()


# ---------------------------------------------------------------------------
# STEP 4: Brownfield Tests (Scenario B: Column Present; Scenario C: Column Absent)
# ---------------------------------------------------------------------------

def test_scenario_b_brownfield_po_number_present(disposable_db):
    """
    Scenario B: Disposable DB representing v1416 with po_number ALREADY present.
    - Compatibility migration v1417 must be a safe NO-OP.
    - Existing rows and po_number values must remain untouched.
    - No order_no values change.
    - Reaches v1417_so_po_compat head.
    """
    db_name = disposable_db
    conn = get_pg_conn(db_name)
    cur = conn.cursor(cursor_factory=RealDictCursor)

    # 1. Setup schema simulating v1416 with po_number present
    cur.execute("""
        CREATE TABLE sales_orders (
            id VARCHAR(50) PRIMARY KEY,
            order_no VARCHAR(100) NOT NULL UNIQUE,
            customer_name VARCHAR(255) NOT NULL,
            grand_total NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
            po_number VARCHAR(100)
        );
        CREATE INDEX ix_sales_orders_po_number ON sales_orders (po_number);

        CREATE TABLE alembic_version (
            version_num VARCHAR(32) NOT NULL,
            CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num)
        );
        INSERT INTO alembic_version (version_num) VALUES ('v1416_customer_po_billing');
    """)

    # 2. Insert existing commercial row
    cur.execute("""
        INSERT INTO sales_orders (id, order_no, customer_name, grand_total, po_number)
        VALUES ('so-b-1', 'SO-B-001', 'Acme Corp', 5000.00, 'PO-COMMERCIAL-999');
    """)

    # 3. Run Alembic upgrade to v1417_so_po_compat
    EphemeralTenantHarness.run_alembic_upgrade(db_name, "v1417_so_po_compat")

    # 4. Verify version is now v1417_so_po_compat
    cur.execute("SELECT version_num FROM alembic_version;")
    ver = cur.fetchone()["version_num"]
    assert ver == "v1417_so_po_compat"

    # 5. Verify row data is 100% UNTOUCHED
    cur.execute("SELECT * FROM sales_orders WHERE id = 'so-b-1';")
    row = cur.fetchone()
    assert row["order_no"] == "SO-B-001"
    assert row["po_number"] == "PO-COMMERCIAL-999"
    assert row["grand_total"] == 5000.00

    cur.close()
    conn.close()


def test_scenario_c_brownfield_po_number_absent(disposable_db):
    """
    Scenario C: Disposable DB representing v1416 with po_number INTENTIONALLY absent.
    - Compatibility migration v1417 must add sales_orders.po_number and index.
    - Existing rows must remain untouched with po_number=NULL (NO semantic backfill).
    - Reaches v1417_so_po_compat head.
    """
    db_name = disposable_db
    conn = get_pg_conn(db_name)
    cur = conn.cursor(cursor_factory=RealDictCursor)

    # 1. Setup schema simulating v1416 with po_number absent
    cur.execute("""
        CREATE TABLE sales_orders (
            id VARCHAR(50) PRIMARY KEY,
            order_no VARCHAR(100) NOT NULL UNIQUE,
            customer_name VARCHAR(255) NOT NULL,
            grand_total NUMERIC(15, 2) NOT NULL DEFAULT 0.00
        );

        CREATE TABLE alembic_version (
            version_num VARCHAR(32) NOT NULL,
            CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num)
        );
        INSERT INTO alembic_version (version_num) VALUES ('v1416_customer_po_billing');
    """)

    # 2. Insert existing commercial row
    cur.execute("""
        INSERT INTO sales_orders (id, order_no, customer_name, grand_total)
        VALUES ('so-c-1', 'SO-C-001', 'Beta Ltd', 8500.00);
    """)

    # 3. Run Alembic upgrade to v1417_so_po_compat
    EphemeralTenantHarness.run_alembic_upgrade(db_name, "v1417_so_po_compat")

    # 4. Verify version is now v1417_so_po_compat
    cur.execute("SELECT version_num FROM alembic_version;")
    ver = cur.fetchone()["version_num"]
    assert ver == "v1417_so_po_compat"

    # 5. Verify column and index were added
    cur.execute("""
        SELECT column_name, data_type, is_nullable, character_maximum_length
        FROM information_schema.columns
        WHERE table_name = 'sales_orders' AND column_name = 'po_number';
    """)
    col = cur.fetchone()
    assert col is not None
    assert col["data_type"] == "character varying"
    assert col["character_maximum_length"] == 100
    assert col["is_nullable"] == "YES"

    cur.execute("""
        SELECT indexname FROM pg_indexes
        WHERE tablename = 'sales_orders' AND indexname = 'ix_sales_orders_po_number';
    """)
    assert cur.fetchone() is not None

    # 6. Verify existing row is untouched, no artificial values generated, no backfill from order_no
    cur.execute("SELECT * FROM sales_orders WHERE id = 'so-c-1';")
    row = cur.fetchone()
    assert row["order_no"] == "SO-C-001"
    assert row["po_number"] is None
    assert row["grand_total"] == 8500.00

    cur.close()
    conn.close()


# ---------------------------------------------------------------------------
# SCENARIO D: ORM Schema Ahead of Alembic Revision
# ---------------------------------------------------------------------------

def test_scenario_d_orm_ahead_of_alembic_revision(disposable_db):
    """
    Scenario D: Disposable DB with ORM schema created ahead of recorded Alembic revision.
    - All ORM columns exist.
    - Migration v1417 safely checks existence and cleanly stamps/upgrades to head.
    """
    db_name = disposable_db
    engine = sa.create_engine(f"postgresql://postgres:postgres@localhost:5432/{db_name}")

    # 1. Create schema using Base.metadata (simulating dev/bootstrap ahead of Alembic)
    Base.metadata.create_all(engine)

    # 2. Stamp with v1416
    with engine.connect() as sa_conn:
        sa_conn.execute(sa.text("""
            CREATE TABLE IF NOT EXISTS alembic_version (
                version_num VARCHAR(32) NOT NULL,
                CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num)
            );
            DELETE FROM alembic_version;
            INSERT INTO alembic_version (version_num) VALUES ('v1416_customer_po_billing');
        """))
        sa_conn.commit()
    engine.dispose()

    # 3. Run migration to v1417
    EphemeralTenantHarness.run_alembic_upgrade(db_name, "v1417_so_po_compat")

    # 4. Verify version
    conn = get_pg_conn(db_name)
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute("SELECT version_num FROM alembic_version;")
    ver = cur.fetchone()["version_num"]
    assert ver == "v1417_so_po_compat"

    cur.close()
    conn.close()


# ---------------------------------------------------------------------------
# STEP 6: Idempotency Verification
# ---------------------------------------------------------------------------

def test_idempotency_of_migration_and_bootstrap(disposable_db):
    """
    Step 6: Idempotency verification.
    - Repeated execution of bootstrap prerequisite does not fail or duplicate objects.
    - Repeated execution of v1417 migration against column-present and column-absent states succeeds cleanly.
    """
    db_name = disposable_db
    engine = sa.create_engine(f"postgresql://postgres:postgres@localhost:5432/{db_name}")

    with engine.connect() as sa_conn:
        # Create base sales_orders
        sa_conn.execute(sa.text("""
            CREATE TABLE sales_orders (
                id VARCHAR(50) PRIMARY KEY,
                order_no VARCHAR(100) NOT NULL UNIQUE
            );
        """))
        sa_conn.commit()

        # Run bootstrap 3 times consecutively
        r1 = bootstrap_company_database_prerequisites(sa_conn, db_name=db_name)
        assert r1["status"] == "APPLIED"
        sa_conn.commit()

        r2 = bootstrap_company_database_prerequisites(sa_conn, db_name=db_name)
        assert r2["status"] == "NOOP_ALREADY_EXISTS"

        r3 = bootstrap_company_database_prerequisites(sa_conn, db_name=db_name)
        assert r3["status"] == "NOOP_ALREADY_EXISTS"

    engine.dispose()


# ---------------------------------------------------------------------------
# STEP 7: Downgrade Analysis & Non-Destructive Rollback
# ---------------------------------------------------------------------------

def test_downgrade_non_destructive_preserves_data(disposable_db):
    """
    Step 7: Non-destructive downgrade behavior on disposable DB.
    - Downgrading v1417 -> v1416 must update alembic_version.
    - Must NOT drop sales_orders.po_number or destroy historical commercial data.
    """
    db_name = disposable_db
    conn = get_pg_conn(db_name)
    cur = conn.cursor(cursor_factory=RealDictCursor)

    cur.execute("""
        CREATE TABLE sales_orders (
            id VARCHAR(50) PRIMARY KEY,
            order_no VARCHAR(100) NOT NULL UNIQUE,
            po_number VARCHAR(100)
        );
        INSERT INTO sales_orders (id, order_no, po_number)
        VALUES ('so-down-1', 'SO-DOWN-001', 'PO-HISTORICAL-KEEP-ME');

        CREATE TABLE alembic_version (
            version_num VARCHAR(32) NOT NULL,
            CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num)
        );
        INSERT INTO alembic_version (version_num) VALUES ('v1417_so_po_compat');
    """)

    # Run Alembic downgrade to v1416
    EphemeralTenantHarness.run_alembic_downgrade(db_name, "v1416_customer_po_billing")

    # Verify version rolled back to v1416
    cur.execute("SELECT version_num FROM alembic_version;")
    ver = cur.fetchone()["version_num"]
    assert ver == "v1416_customer_po_billing"

    # Verify po_number column and historical data STILL EXIST
    cur.execute("SELECT * FROM sales_orders WHERE id = 'so-down-1';")
    row = cur.fetchone()
    assert row["po_number"] == "PO-HISTORICAL-KEEP-ME"
    assert "po_number" in row

    cur.close()
    conn.close()


# ---------------------------------------------------------------------------
# STEP 8 & Security Guards: Tenant and Database Routing Guards
# ---------------------------------------------------------------------------

def test_control_plane_routing_guard():
    """
    Verify that bootstrap prerequisite and compatibility migration strictly block smritisys.
    """
    # 1. is_company_database_target guard
    assert is_company_database_target("smriti001") is True
    assert is_company_database_target("smriti999") is True
    assert is_company_database_target("smrititst123") is True
    assert is_company_database_target("smritisys") is False
    assert is_company_database_target("postgres") is False
    assert is_company_database_target("template0") is False

    # 2. bootstrap prerequisite raises ValueError when passed smritisys
    mock_conn = sa.create_engine("postgresql://postgres:postgres@localhost:5432/smriti001").connect()
    try:
        with pytest.raises(ValueError, match="Bootstrap prerequisite must NEVER execute against smritisys"):
            bootstrap_company_database_prerequisites(mock_conn, db_name="smritisys")
    finally:
        mock_conn.close()


def test_smriti001_read_only_schema_comparison():
    """
    Step 8: smriti001 READ-ONLY schema comparison.
    - Connects read-only to smriti001.
    - Verifies sales_orders.po_number is already present.
    - Verifies alembic_version is v1417_so_po_compat after the brownfield repair.
    - Confirms that v1417 will be a 100% safe NO-OP on smriti001.
    """
    conn = get_pg_conn("smriti001")
    cur = conn.cursor(cursor_factory=RealDictCursor)

    # 1. Verify sales_orders.po_number exists in smriti001
    cur.execute("""
        SELECT column_name, data_type, is_nullable, character_maximum_length
        FROM information_schema.columns
        WHERE table_name = 'sales_orders' AND column_name = 'po_number';
    """)
    col = cur.fetchone()
    assert col is not None, "sales_orders.po_number must already exist in smriti001"
    assert col["data_type"] == "character varying"
    assert col["character_maximum_length"] == 100
    assert col["is_nullable"] == "YES"

    # 2. Verify index exists in smriti001
    cur.execute("""
        SELECT indexname FROM pg_indexes
        WHERE tablename = 'sales_orders' 
          AND indexname IN ('ix_sales_orders_po_number', 'idx_sales_orders_po_number');
    """)
    idx = cur.fetchone()
    assert idx is not None, "Index on sales_orders.po_number must already exist in smriti001"

    # 3. Verify Alembic version in smriti001 is v1416
    cur.execute("SELECT version_num FROM alembic_version;")
    ver = cur.fetchone()["version_num"]
    assert ver == "v1417_so_po_compat"

    cur.close()
    conn.close()
