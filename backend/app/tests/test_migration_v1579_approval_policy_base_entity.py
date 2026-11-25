import uuid
from urllib.parse import urlparse

import psycopg2
import pytest
from alembic.migration import MigrationContext
from alembic.operations import Operations
from sqlalchemy import create_engine, inspect, select, text
from sqlalchemy.orm import Session

import alembic.versions.v1579_approval_policy_base_entity as v1579
from app.core.config import settings
from app.models.approval import ApprovalPolicy


def _connection_parts():
    parsed = urlparse(settings.DATABASE_URL)
    return {
        "host": parsed.hostname or "localhost",
        "port": parsed.port or 5432,
        "user": parsed.username or "postgres",
        "password": parsed.password or "postgres",
    }


@pytest.mark.integration
def test_v1579_adds_base_entity_columns_for_approval_policy_orm_reads():
    parts = _connection_parts()
    database_name = f"smriti_test_v1579_{uuid.uuid4().hex[:8]}"
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
                CREATE TABLE approval_policies (
                    id VARCHAR(50) PRIMARY KEY,
                    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                    name VARCHAR(200) NOT NULL,
                    code VARCHAR(50) NOT NULL UNIQUE,
                    document_type VARCHAR(50) NOT NULL,
                    min_amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
                    max_amount NUMERIC(15, 2),
                    required_role VARCHAR(50) NOT NULL,
                    priority INTEGER NOT NULL DEFAULT 1,
                    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
                    description TEXT
                )
            """))
            connection.execute(text("""
                INSERT INTO approval_policies (id, name, code, document_type, required_role)
                VALUES ('policy-1', 'Default policy', 'DEFAULT', 'SALES_INVOICE', 'MANAGER')
            """))
            operations = Operations(MigrationContext.configure(connection))
            original_ops = v1579.op
            v1579.op = operations
            try:
                v1579.upgrade()
                v1579.upgrade()
            finally:
                v1579.op = original_ops

        with engine.connect() as connection:
            columns = {column["name"] for column in inspect(connection).get_columns("approval_policies")}
            assert set(ApprovalPolicy.__table__.columns.keys()) <= columns

        with Session(engine) as session:
            policy = session.execute(
                select(ApprovalPolicy).where(ApprovalPolicy.id == "policy-1")
            ).scalar_one()
            assert policy.name == "Default policy"
            assert policy.is_active is True
            assert policy.is_deleted is False
            assert policy.uuid
            assert policy.version == 1
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
