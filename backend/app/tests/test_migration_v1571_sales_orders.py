import uuid
from urllib.parse import urlparse

import psycopg2
import pytest
from alembic.migration import MigrationContext
from alembic.operations import Operations
from sqlalchemy import create_engine, inspect, text

import alembic.versions.v1571_sales_order_schema_parity as v1571
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
def test_v1571_adds_missing_sales_order_columns_without_changing_orders():
    parts = _connection_parts()
    database_name = f"smriti_test_v1571_{uuid.uuid4().hex[:8]}"
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
                CREATE TABLE sales_orders (
                    id VARCHAR(50) PRIMARY KEY,
                    order_no VARCHAR(100) NOT NULL,
                    date DATE NOT NULL,
                    customer_name VARCHAR(255) NOT NULL,
                    tax_total NUMERIC(15, 2),
                    grand_total NUMERIC(15, 2) NOT NULL,
                    status VARCHAR(20),
                    source_quotation_id VARCHAR(50)
                )
            """))
            connection.execute(text("""
                INSERT INTO sales_orders
                    (id, order_no, date, customer_name, tax_total, grand_total, status)
                VALUES
                    ('order-1', 'SO-1', '2026-10-31', 'Customer 1', 18, 118, 'Draft')
            """))
            operations = Operations(MigrationContext.configure(connection))
            original_ops = v1571.op
            v1571.op = operations
            try:
                v1571.upgrade()
                v1571.upgrade()
            finally:
                v1571.op = original_ops

        with engine.connect() as connection:
            columns = {column["name"] for column in inspect(connection).get_columns("sales_orders")}
            assert {
                "po_number", "po_date", "delivery_date", "site_code", "site_name",
                "delivery_address", "vendor_code", "customer_id", "customer_gstin",
                "basic_total", "is_interstate", "total_qty", "billed_qty", "billed_value",
                "pending_qty", "pending_value", "fulfillment_status", "po_metadata",
            } <= columns
            row = connection.execute(text("""
                SELECT order_no, customer_name, grand_total, po_metadata
                FROM sales_orders WHERE id = 'order-1'
            """)).one()
            assert row.order_no == "SO-1"
            assert row.customer_name == "Customer 1"
            assert row.grand_total == 118
            assert row.po_metadata == {}
    finally:
        engine.dispose()
        admin = psycopg2.connect(dbname="postgres", **parts)
        admin.autocommit = True
        with admin.cursor() as cursor:
            cursor.execute(
                "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = %s",
                (database_name,),
            )
            cursor.execute(f'DROP DATABASE "{database_name}"')
        admin.close()
