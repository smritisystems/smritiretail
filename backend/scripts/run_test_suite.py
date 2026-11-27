"""Provision and run backend tests against an explicitly isolated local PostgreSQL server."""

import argparse
import os
import subprocess
import sys
from pathlib import Path
from urllib.parse import unquote, urlunparse

import psycopg2
from psycopg2 import sql

BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

from app.test_environment import parse_isolated_test_url, validate_test_tenant_name  # noqa: E402

TEST_DATABASES = ("smriti_test_001", "smriti_test_002")
MARKER_TABLE = "smriti_test_database_marker"
MARKER_VALUE = "disposable-local-test-database"


def _connection_parts(parsed) -> dict[str, object]:
    return {
        "host": parsed.hostname,
        "port": parsed.port,
        "user": unquote(parsed.username),
        "password": unquote(parsed.password or ""),
    }


def _verify_or_create_marker(database_name: str, parts: dict[str, object], newly_created: bool) -> None:
    connection = psycopg2.connect(dbname=database_name, **parts)
    try:
        with connection:
            with connection.cursor() as cursor:
                cursor.execute("SELECT to_regclass(%s)", (f"public.{MARKER_TABLE}",))
                marker_exists = cursor.fetchone()[0] is not None
                if marker_exists:
                    cursor.execute(
                        sql.SQL("SELECT marker_value FROM {} WHERE marker_name = %s").format(
                            sql.Identifier(MARKER_TABLE)
                        ),
                        ("environment",),
                    )
                    row = cursor.fetchone()
                    if not row or row[0] != MARKER_VALUE:
                        raise RuntimeError(f"Database {database_name} has an invalid test-database marker.")
                    return

                if not newly_created:
                    raise RuntimeError(
                        f"Database {database_name} already exists without the test marker; "
                        "refusing to alter it. Use a fresh, dedicated local test PostgreSQL instance."
                    )

                cursor.execute(
                    sql.SQL(
                        "CREATE TABLE {} (marker_name TEXT PRIMARY KEY, marker_value TEXT NOT NULL)"
                    ).format(sql.Identifier(MARKER_TABLE))
                )
                cursor.execute(
                    sql.SQL("INSERT INTO {} (marker_name, marker_value) VALUES (%s, %s)").format(
                        sql.Identifier(MARKER_TABLE)
                    ),
                    ("environment", MARKER_VALUE),
                )
    finally:
        connection.close()


def _provision_database(database_name: str, admin_connection, parts: dict[str, object]) -> None:
    with admin_connection.cursor() as cursor:
        cursor.execute("SELECT 1 FROM pg_database WHERE datname = %s", (database_name,))
        exists = cursor.fetchone() is not None
        if not exists:
            cursor.execute(sql.SQL("CREATE DATABASE {}").format(sql.Identifier(database_name)))
    _verify_or_create_marker(database_name, parts, newly_created=not exists)


def _async_url(parsed) -> str:
    scheme = "postgresql+asyncpg"
    return urlunparse(parsed._replace(scheme=scheme, path="/smritisys", params="", fragment=""))


def _run_migration(target: str, database_name: str, environment: dict[str, str]) -> None:
    subprocess.run(
        [
            sys.executable,
            "-m",
            "alembic",
            "-x",
            f"target={target}",
            "-x",
            f"db={database_name}",
            "-x",
            "test_scope_filter=true",
            "upgrade",
            f"{target}@head",
        ],
        cwd=BACKEND_DIR,
        env=environment,
        check=True,
    )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--setup-only",
        action="store_true",
        help="Create and migrate test databases without starting pytest.",
    )
    parser.add_argument(
        "--tenant-only",
        action="store_true",
        help="Skip control-plane migration for focused tests using isolated tenant databases.",
    )
    parser.add_argument("pytest_args", nargs=argparse.REMAINDER, help="Optional pytest arguments after --.")
    args = parser.parse_args()

    raw_url = os.getenv("SMRITI_TEST_DATABASE_URL", "")
    try:
        parsed = parse_isolated_test_url(raw_url)
        parts = _connection_parts(parsed)
    except ValueError as exc:
        parser.error(f"{exc} Set SMRITI_TEST_DATABASE_URL to an explicit loopback URL ending in /smritisys.")

    if not parsed.password:
        parser.error("SMRITI_TEST_DATABASE_URL must include the local test PostgreSQL password.")

    test_url = _async_url(parsed)
    environment = os.environ.copy()
    environment.update(
        {
            "DATABASE_URL": test_url,
            "SMRITI_TEST_DATABASE_URL": test_url,
            "ENVIRONMENT": "test",
            "TESTING": "1",
            "JWT_SECRET_KEY": "local-test-jwt-secret-key-at-least-32-chars",
            "INTERNAL_SERVICE_KEY": "local-test-internal-service-key-32-chars",
            "SGIP_VAULT_MASTER_KEY": "local-test-vault-master-key-32-chars",
            "POSTGRES_HOST": str(parts["host"]),
            "POSTGRES_PORT": str(parts["port"]),
            "POSTGRES_USER": str(parts["user"]),
            "POSTGRES_PASSWORD": str(parts["password"]),
            "POSTGRES_DB": "smritisys",
            "SMRITI_TENANT_DATABASES": ",".join(TEST_DATABASES),
        }
    )

    admin = psycopg2.connect(dbname="postgres", **parts)
    admin.autocommit = True
    try:
        _provision_database("smritisys", admin, parts)
        for database_name in TEST_DATABASES:
            _provision_database(validate_test_tenant_name(database_name), admin, parts)
    finally:
        admin.close()

    if not args.tenant_only:
        _run_migration("control", "smritisys", environment)
    for database_name in TEST_DATABASES:
        _run_migration("tenant", database_name, environment)

    if args.setup_only:
        print("Isolated local test databases are ready; no test data was deleted.")
        return 0

    pytest_args = args.pytest_args
    if pytest_args and pytest_args[0] == "--":
        pytest_args = pytest_args[1:]
    command = [
        sys.executable,
        "-m",
        "pytest",
        *(pytest_args or ["tests/", "app/tests/", "app/compliance/tests/", "-v", "--tb=short"]),
    ]
    return subprocess.run(command, cwd=BACKEND_DIR, env=environment, check=False).returncode


if __name__ == "__main__":
    raise SystemExit(main())
