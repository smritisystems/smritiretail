"""
Project      : SMRITI Retail OS
Repository   : SMRITIRetailNX
Classification: Migration v1532 Upgrade & Downgrade Safety Test (Phase 2.4)
"""

import os
import uuid
from urllib.parse import urlparse

import psycopg2
import pytest
from sqlalchemy import create_engine, inspect, text

import alembic.versions.v1532_cost_management_engine_foundations as v1532
from alembic.migration import MigrationContext
from alembic.operations import Operations
from app.core.config import settings
from app.models.profitability import (
    InvoiceProfitabilityLedger,
    ProductCostValuation,
    TransactionCostSnapshot,
)


def _get_pg_parts():
    parsed = urlparse(str(settings.DATABASE_URL))
    return {
        "host": parsed.hostname or "localhost",
        "port": parsed.port or 5432,
        "user": parsed.username or "postgres",
        "password": parsed.password or "postgres",
    }


def test_v1532_migration_clean_and_preexisting_lifecycle():
    """
    Requirement 7: Test migration upgrade and rollback against a disposable database
    with both a clean schema and a representative pre-existing schema.
    Guarantees zero writes to production and proves non-destructive downgrade safety.
    """
    parts = _get_pg_parts()
    test_db = f"smriti_test_mig_{uuid.uuid4().hex[:8]}"

    # 1. Create disposable test database
    admin = psycopg2.connect(dbname="postgres", **parts)
    admin.autocommit = True
    with admin.cursor() as cur:
        cur.execute(f'CREATE DATABASE "{test_db}"')
    admin.close()

    db_url = f"postgresql://{parts['user']}:{parts['password']}@{parts['host']}:{parts['port']}/{test_db}"
    engine = create_engine(db_url)

    try:
        # ─────────────────────────────────────────────────────────────
        # Part A: Clean Schema Upgrade & Downgrade
        # ─────────────────────────────────────────────────────────────
        with engine.connect() as conn:
            ctx = MigrationContext.configure(conn)
            op = Operations(ctx)
            # Patch alembic.op with active Operations instance for direct execution
            v1532.op = op

            # Also create prerequisite foreign key targets if upgrading clean
            conn.execute(text("CREATE TABLE companies (id VARCHAR(50) PRIMARY KEY)"))
            conn.execute(text("CREATE TABLE branches (id VARCHAR(50) PRIMARY KEY)"))
            conn.execute(text("CREATE TABLE products (id VARCHAR(50) PRIMARY KEY)"))
            conn.execute(text("CREATE TABLE sales_returns (id VARCHAR(50) PRIMARY KEY)"))
            conn.execute(text("CREATE TABLE sales_invoices (id VARCHAR(50) PRIMARY KEY)"))
            conn.execute(text("CREATE TABLE sales_invoice_items (id SERIAL PRIMARY KEY)"))
            conn.execute(text("""
                CREATE TABLE sales_return_items (
                    id SERIAL PRIMARY KEY,
                    return_id VARCHAR(50) REFERENCES sales_returns(id),
                    product_id VARCHAR(50) REFERENCES products(id),
                    code VARCHAR(50) NOT NULL,
                    name VARCHAR(255) NOT NULL,
                    quantity NUMERIC(12, 4) NOT NULL,
                    price NUMERIC(15, 2) NOT NULL,
                    total_amount NUMERIC(15, 2) NOT NULL
                )
            """))
            conn.commit()

            # Execute upgrade on clean schema
            v1532.upgrade()
            conn.commit()

            # Verify tables exist
            insp = inspect(conn)
            tables = insp.get_table_names()
            assert "product_cost_valuations" in tables
            assert "transaction_cost_snapshots" in tables
            assert "invoice_profitability_ledgers" in tables

            # Verify sales_return_items column added
            sri_cols = {c["name"]: str(c["type"]) for c in insp.get_columns("sales_return_items")}
            assert "sales_invoice_item_id" in sri_cols
            assert "INTEGER" in sri_cols["sales_invoice_item_id"]

            # Verify foreign key constraint on sales_return_items.sales_invoice_item_id
            sri_fks = insp.get_foreign_keys("sales_return_items")
            fk_match = next((fk for fk in sri_fks if "sales_invoice_item_id" in fk["constrained_columns"]), None)
            assert fk_match is not None, "Missing foreign key on sales_invoice_item_id"
            assert fk_match["referred_table"] == "sales_invoice_items"
            assert fk_match["referred_columns"] == ["id"]

            # Verify index on sales_return_items.sales_invoice_item_id
            sri_indexes = insp.get_indexes("sales_return_items")
            idx_match = next((idx for idx in sri_indexes if "sales_invoice_item_id" in idx["column_names"]), None)
            assert idx_match is not None, "Missing index on sales_invoice_item_id"

            # Verify column parity against SQLAlchemy models
            for model in [ProductCostValuation, TransactionCostSnapshot, InvoiceProfitabilityLedger]:
                expected_cols = set(model.__table__.columns.keys())
                actual_cols = {c["name"] for c in insp.get_columns(model.__tablename__)}
                missing = expected_cols - actual_cols
                assert not missing, f"Table {model.__tablename__} is missing columns from model: {missing}"

            # Execute downgrade on empty clean schema
            v1532.downgrade()
            conn.commit()

            # Verify empty tables dropped and column removed
            insp_down = inspect(conn)
            tables_down = insp_down.get_table_names()
            assert "product_cost_valuations" not in tables_down
            assert "transaction_cost_snapshots" not in tables_down
            assert "invoice_profitability_ledgers" not in tables_down
            sri_cols_down = {c["name"] for c in insp_down.get_columns("sales_return_items")}
            assert "sales_invoice_item_id" not in sri_cols_down

        # ─────────────────────────────────────────────────────────────
        # Part B: Representative Pre-existing Schema & Non-Destructive Downgrade
        # ─────────────────────────────────────────────────────────────
        with engine.connect() as conn:
            ctx = MigrationContext.configure(conn)
            op = Operations(ctx)
            v1532.op = op

            # Re-run upgrade
            v1532.upgrade()
            conn.commit()

            # Insert business records into product_cost_valuations
            conn.execute(text("INSERT INTO products (id) VALUES ('p1') ON CONFLICT (id) DO NOTHING"))
            conn.execute(text("""
                INSERT INTO product_cost_valuations (id, uuid, product_id, weighted_average_cost)
                VALUES ('pcv_pre_01', 'uuid_pre_01', 'p1', 125.00)
            """))
            conn.commit()

            # Re-running upgrade must be 100% idempotent
            v1532.upgrade()
            conn.commit()

            # Verify record is still intact
            cnt = conn.execute(text("SELECT COUNT(*) FROM product_cost_valuations")).scalar()
            assert cnt == 1

            # Downgrade on non-empty schema MUST abort with RuntimeError to prevent Alembic version inconsistency!
            with pytest.raises(RuntimeError, match="SMRITI Migration Safety Abort: Cannot downgrade"):
                v1532.downgrade()

            # Verify data and table are completely intact after safety abort
            post_cnt = conn.execute(text("SELECT COUNT(*) FROM product_cost_valuations")).scalar()
            assert post_cnt == 1

            # When explicit authorization SMRITI_ALLOW_DESTRUCTIVE_DOWNGRADE=1 is provided:
            os.environ["SMRITI_ALLOW_DESTRUCTIVE_DOWNGRADE"] = "1"
            try:
                v1532.downgrade()
                conn.commit()
            finally:
                os.environ.pop("SMRITI_ALLOW_DESTRUCTIVE_DOWNGRADE", None)

            # Reversible: all tables and column are now cleanly dropped
            insp_safe = inspect(conn)
            tables_safe = insp_safe.get_table_names()
            assert "product_cost_valuations" not in tables_safe
            assert "transaction_cost_snapshots" not in tables_safe
            assert "invoice_profitability_ledgers" not in tables_safe
            sri_cols_safe = {c["name"] for c in insp_safe.get_columns("sales_return_items")}
            assert "sales_invoice_item_id" not in sri_cols_safe

    finally:
        engine.dispose()
        # Drop disposable database
        admin = psycopg2.connect(dbname="postgres", **parts)
        admin.autocommit = True
        with admin.cursor() as cur:
            cur.execute(
                "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = %s AND pid != pg_backend_pid()",
                (test_db,),
            )
            cur.execute(f'DROP DATABASE IF EXISTS "{test_db}"')
        admin.close()
