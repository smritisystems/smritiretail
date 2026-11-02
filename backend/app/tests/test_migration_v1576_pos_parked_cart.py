import uuid
from urllib.parse import urlparse

import psycopg2
import pytest
from alembic.migration import MigrationContext
from alembic.operations import Operations
from sqlalchemy import create_engine, inspect, select, text
from sqlalchemy.orm import Session

import alembic.versions.v1576_pos_parked_cart_base_entity as v1576
from app.core.config import settings
from app.models.pos import POSParkedCart


def _connection_parts():
    parsed = urlparse(settings.DATABASE_URL)
    return {
        "host": parsed.hostname or "localhost",
        "port": parsed.port or 5432,
        "user": parsed.username or "postgres",
        "password": parsed.password or "postgres",
    }


@pytest.mark.integration
def test_v1576_adds_missing_base_entity_columns_for_parked_cart_orm_reads():
    parts = _connection_parts()
    database_name = f"smriti_test_v1576_{uuid.uuid4().hex[:8]}"
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
                CREATE TABLE pos_parked_carts (
                    id VARCHAR(50) PRIMARY KEY,
                    tenant_id VARCHAR(50) NOT NULL,
                    company_id VARCHAR(50) NOT NULL,
                    branch_id VARCHAR(50) NOT NULL,
                    session_id VARCHAR(100) NOT NULL,
                    cashier_id VARCHAR(50) NOT NULL,
                    hold_slip_number VARCHAR(50) NOT NULL UNIQUE,
                    customer_id VARCHAR(50),
                    customer_name VARCHAR(255),
                    customer_phone VARCHAR(50),
                    items_count INTEGER NOT NULL DEFAULT 0,
                    total_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
                    cart_snapshot JSONB NOT NULL,
                    status VARCHAR(20) NOT NULL DEFAULT 'PARKED',
                    parked_at TIMESTAMP WITH TIME ZONE NOT NULL,
                    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
                    recalled_at TIMESTAMP WITH TIME ZONE,
                    recalled_by VARCHAR(50),
                    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                    is_active BOOLEAN NOT NULL DEFAULT TRUE,
                    is_deleted BOOLEAN NOT NULL DEFAULT FALSE
                )
            """))
            connection.execute(text("""
                INSERT INTO pos_parked_carts (
                    id, tenant_id, company_id, branch_id, session_id, cashier_id,
                    hold_slip_number, customer_id, customer_name, items_count,
                    total_amount, cart_snapshot, parked_at, expires_at
                ) VALUES (
                    'park-1', 'tenant-1', 'company-1', 'branch-1', 'session-1',
                    'cashier-1', 'HOLD-1', 'customer-1', 'Customer 1', 1,
                    12.50, '{"items":[]}', now(), now() + interval '4 hours'
                )
            """))
            operations = Operations(MigrationContext.configure(connection))
            original_ops = v1576.op
            v1576.op = operations
            try:
                v1576.upgrade()
                v1576.upgrade()
            finally:
                v1576.op = original_ops

        with engine.connect() as connection:
            columns = {column["name"] for column in inspect(connection).get_columns("pos_parked_carts")}
            assert set(POSParkedCart.__table__.columns.keys()) <= columns

        with Session(engine) as session:
            cart = session.execute(
                select(POSParkedCart).where(POSParkedCart.id == "park-1")
            ).scalar_one()
            assert cart.hold_slip_number == "HOLD-1"
            assert cart.customer_id == "customer-1"
            assert cart.uuid
            assert cart.version == 1
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
