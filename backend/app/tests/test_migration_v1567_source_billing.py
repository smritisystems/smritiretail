import uuid
from urllib.parse import urlparse

import psycopg2
import pytest
from alembic.migration import MigrationContext
from alembic.operations import Operations
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.exc import IntegrityError

import alembic.versions.v1567_source_billing_allocations as v1567
import alembic.versions.v1568_customer_single_parent as v1568
from app.core.config import settings


def _connection_parts():
    parsed = urlparse(settings.DATABASE_URL)
    return {
        "host": parsed.hostname or "localhost",
        "port": parsed.port or 5432,
        "user": parsed.username or "postgres",
        "password": parsed.password or "postgres",
    }


@pytest.mark.integration
def test_v1567_upgrade_backfills_only_authoritative_ownership():
    parts = _connection_parts()
    database_name = f"smriti_test_v1567_{uuid.uuid4().hex[:8]}"
    admin = psycopg2.connect(dbname="postgres", **parts)
    admin.autocommit = True
    with admin.cursor() as cursor:
        cursor.execute(f'CREATE DATABASE "{database_name}"')
    admin.close()


    engine = create_engine(
        f"postgresql://{parts['user']}:{parts['password']}@{parts['host']}:{parts['port']}/{database_name}"
    )
    try:
        with engine.begin() as connection:
            connection.execute(text("CREATE TABLE companies (id VARCHAR(50) PRIMARY KEY)"))
            connection.execute(text("CREATE TABLE branches (id VARCHAR(50) PRIMARY KEY)"))
            connection.execute(text("CREATE TABLE customers (id VARCHAR(50) PRIMARY KEY)"))
            connection.execute(text("""
                CREATE TABLE sales_orders (
                    id VARCHAR(50) PRIMARY KEY,
                    company_id VARCHAR(50) NOT NULL,
                    order_no VARCHAR(100)
                )
            """))
            connection.execute(text("""
                CREATE TABLE sales_order_items (
                    id SERIAL PRIMARY KEY,
                    order_id VARCHAR(50) NOT NULL,
                    product_id VARCHAR(50) NOT NULL,
                    is_deleted BOOLEAN NOT NULL DEFAULT FALSE
                )
            """))
            connection.execute(text("""
                CREATE TABLE sales_invoices (
                    id VARCHAR(50) PRIMARY KEY,
                    invoice_no VARCHAR(100),
                    company_id VARCHAR(50) NOT NULL,
                    customer_id VARCHAR(50),
                    rule_snapshots JSONB
                )
            """))
            connection.execute(text("CREATE TABLE sales_invoice_items (id SERIAL PRIMARY KEY)"))
            connection.execute(text("""
                CREATE TABLE packing_slips (
                    id VARCHAR(50) PRIMARY KEY,
                    company_id VARCHAR(50),
                    branch_id VARCHAR(50),
                    sales_invoice_id VARCHAR(100),
                    is_deleted BOOLEAN NOT NULL DEFAULT FALSE
                )
            """))
            connection.execute(text("""
                CREATE TABLE packing_slip_items (
                    id VARCHAR(50) PRIMARY KEY,
                    packing_slip_id VARCHAR(50) NOT NULL,
                    product_id VARCHAR(50) NOT NULL,
                    is_deleted BOOLEAN NOT NULL DEFAULT FALSE
                )
            """))
            connection.execute(text("INSERT INTO companies (id) VALUES ('company-1')"))
            connection.execute(text("INSERT INTO branches (id) VALUES ('branch-1')"))
            connection.execute(text("INSERT INTO customers (id) VALUES ('customer-1')"))
            connection.execute(text("""
                INSERT INTO sales_orders (id, company_id, order_no)
                VALUES ('order-1', 'company-1', 'SO-1')
            """))
            connection.execute(text("""
                INSERT INTO sales_order_items (order_id, product_id)
                VALUES ('order-1', 'product-1')
            """))
            connection.execute(text("""
                INSERT INTO sales_invoices (id, invoice_no, company_id, customer_id, rule_snapshots)
                VALUES ('invoice-1', 'INV-1', 'company-1', 'customer-1', '{"source_order_id":"order-1"}')
            """))
            connection.execute(text("""
                INSERT INTO packing_slips (id, company_id, branch_id, sales_invoice_id)
                VALUES
                    ('slip-1', 'company-1', 'branch-1', 'invoice-1'),
                    ('slip-2', 'company-1', 'branch-1', 'UNBILLED')
            """))
            connection.execute(text("""
                INSERT INTO packing_slip_items (id, packing_slip_id, product_id)
                VALUES ('slip-line-1', 'slip-1', 'product-1')
            """))
            context = MigrationContext.configure(connection)
            migration_ops = Operations(context)
            original_ops = v1567.op
            v1567.op = migration_ops
            try:
                v1567.upgrade()
                v1567.upgrade()
            finally:
                v1567.op = original_ops

        with engine.connect() as connection:
            inspector = inspect(connection)
            assert "sales_source_invoice_allocations" in inspector.get_table_names()
            assert {"customer_id", "order_id", "billing_ownership_status"} <= {
                column["name"] for column in inspector.get_columns("packing_slips")
            }
            verified = connection.execute(text("""
                SELECT customer_id, order_id, billing_ownership_status
                FROM packing_slips WHERE id = 'slip-1'
            """)).one()
            assert verified == ("customer-1", "order-1", "VERIFIED")
            assert connection.execute(text("""
                SELECT billing_ownership_status FROM packing_slips WHERE id = 'slip-2'
            """)).scalar_one() == "QUARANTINED"
            assert connection.execute(text("""
                SELECT order_item_id FROM packing_slip_items WHERE id = 'slip-line-1'
            """)).scalar_one() == 1
    finally:
        engine.dispose()
        admin = psycopg2.connect(dbname="postgres", **parts)
        admin.autocommit = True
        with admin.cursor() as cursor:
            cursor.execute(
                "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = %s",
                (database_name,),
            )
            cursor.execute(f'DROP DATABASE IF EXISTS "{database_name}"')
        admin.close()


@pytest.mark.integration
def test_v1568_rejects_ambiguous_parents_and_enforces_one_active_parent():
    parts = _connection_parts()
    database_name = f"smriti_test_v1568_{uuid.uuid4().hex[:8]}"
    admin = psycopg2.connect(dbname="postgres", **parts)
    admin.autocommit = True
    with admin.cursor() as cursor:
        cursor.execute(f'CREATE DATABASE "{database_name}"')
    admin.close()

    engine = create_engine(
        f"postgresql://{parts['user']}:{parts['password']}@{parts['host']}:{parts['port']}/{database_name}"
    )
    try:
        with engine.begin() as connection:
            connection.execute(text("""
                CREATE TABLE customer_relationships (
                    id VARCHAR(50) PRIMARY KEY,
                    company_id VARCHAR(50),
                    parent_customer_id VARCHAR(50) NOT NULL,
                    dependant_customer_id VARCHAR(50) NOT NULL,
                    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
                    CONSTRAINT uq_customer_relationship_pair
                        UNIQUE (parent_customer_id, dependant_customer_id)
                )
            """))
            connection.execute(text("""
                INSERT INTO customer_relationships
                    (id, company_id, parent_customer_id, dependant_customer_id)
                VALUES
                    ('rel-1', 'company-1', 'parent-1', 'child-1'),
                    ('rel-2', 'company-1', 'parent-2', 'child-1')
            """))
            migration_ops = Operations(MigrationContext.configure(connection))
            original_ops = v1568.op
            v1568.op = migration_ops
            try:
                with pytest.raises(RuntimeError, match="ambiguous"):
                    v1568.upgrade()

                connection.execute(text(
                    "DELETE FROM customer_relationships WHERE id = 'rel-2'"
                ))
                v1568.upgrade()
                v1568.upgrade()
            finally:
                v1568.op = original_ops

        with engine.begin() as connection:
            indexes = {
                index["name"]: index
                for index in inspect(connection).get_indexes("customer_relationships")
            }
            assert indexes[v1568.INDEX_NAME]["unique"] is True
            assert "uq_customer_relationship_pair" not in {
                constraint["name"]
                for constraint in inspect(connection).get_unique_constraints("customer_relationships")
            }

            with pytest.raises(IntegrityError):
                with connection.begin_nested():
                    connection.execute(text("""
                        INSERT INTO customer_relationships
                            (id, company_id, parent_customer_id, dependant_customer_id)
                        VALUES ('rel-conflict', 'company-1', 'parent-2', 'child-1')
                    """))

            connection.execute(text("""
                INSERT INTO customer_relationships
                    (id, company_id, parent_customer_id, dependant_customer_id, is_deleted)
                VALUES ('rel-history', 'company-1', 'parent-2', 'child-1', TRUE)
            """))
    finally:
        engine.dispose()
        admin = psycopg2.connect(dbname="postgres", **parts)
        admin.autocommit = True
        with admin.cursor() as cursor:
            cursor.execute(
                "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = %s",
                (database_name,),
            )
            cursor.execute(f'DROP DATABASE IF EXISTS "{database_name}"')
        admin.close()
