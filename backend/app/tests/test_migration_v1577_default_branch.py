import uuid
from urllib.parse import urlparse

import psycopg2
import pytest
from alembic.migration import MigrationContext
from alembic.operations import Operations
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.exc import IntegrityError

import alembic.versions.v1577_company_default_branch as v1577
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
def test_v1577_selects_one_active_default_per_company_and_enforces_uniqueness():
    parts = _connection_parts()
    database_name = f"smriti_test_v1577_{uuid.uuid4().hex[:8]}"
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
                CREATE TABLE branches (
                    id VARCHAR(50) PRIMARY KEY,
                    company_id VARCHAR(50) NOT NULL,
                    code VARCHAR(50) NOT NULL,
                    is_active BOOLEAN NOT NULL DEFAULT TRUE,
                    is_deleted BOOLEAN NOT NULL DEFAULT FALSE
                )
            """))
            connection.execute(text("""
                INSERT INTO branches (id, company_id, code, is_active, is_deleted)
                VALUES
                    ('a-z', 'company-a', 'Z-STORE', TRUE, FALSE),
                    ('a-a', 'company-a', 'A-STORE', TRUE, FALSE),
                    ('b-north', 'company-b', 'NORTH', TRUE, FALSE),
                    ('b-main', 'company-b', 'BR-MAIN-001', TRUE, FALSE),
                    ('c-closed', 'company-c', 'ONLY', FALSE, FALSE)
            """))
            operations = Operations(MigrationContext.configure(connection))
            original_ops = v1577.op
            v1577.op = operations
            try:
                v1577.upgrade()
                v1577.upgrade()
            finally:
                v1577.op = original_ops

        with engine.connect() as connection:
            assert "is_default" in {
                column["name"] for column in inspect(connection).get_columns("branches")
            }
            defaults = connection.execute(text("""
                SELECT company_id, id
                FROM branches
                WHERE is_default IS TRUE
                ORDER BY company_id
            """)).all()
            assert defaults == [("company-a", "a-a"), ("company-b", "b-main")]
            assert connection.execute(text("""
                SELECT COUNT(*) FROM branches
                WHERE company_id = 'company-c' AND is_default IS TRUE
            """)).scalar_one() == 0

        with pytest.raises(IntegrityError):
            with engine.begin() as connection:
                connection.execute(text("""
                    UPDATE branches SET is_default = TRUE WHERE id = 'a-z'
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
