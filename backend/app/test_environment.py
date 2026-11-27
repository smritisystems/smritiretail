"""Safety checks shared by pytest configuration and the local test runner."""

import os
import re
from urllib.parse import urlparse


LOCAL_HOSTS = {"localhost", "127.0.0.1", "::1"}
POSTGRES_SCHEMES = {"postgres", "postgresql", "postgresql+asyncpg", "postgresql+psycopg2"}


def parse_isolated_test_url(value: str):
    parsed = urlparse(value)
    database_name = (parsed.path or "").lstrip("/").split("?", 1)[0].lower()
    if parsed.scheme not in POSTGRES_SCHEMES:
        raise ValueError("The test database URL must use a PostgreSQL scheme.")
    if (parsed.hostname or "").lower() not in LOCAL_HOSTS:
        raise ValueError("Tests may only use a loopback PostgreSQL host.")
    if database_name != "smritisys":
        raise ValueError("The isolated test URL must use the control-plane database name smritisys.")
    if not parsed.username or not parsed.port:
        raise ValueError("The test database URL must include a user and explicit port.")
    return parsed


def require_isolated_test_environment() -> None:
    if os.getenv("TESTING") != "1" or os.getenv("ENVIRONMENT", "").lower() != "test":
        raise RuntimeError(
            "Database-backed tests require TESTING=1 and ENVIRONMENT=test. "
            "Use backend/scripts/run_test_suite.py with a dedicated local PostgreSQL instance."
        )

    explicit_url = os.getenv("SMRITI_TEST_DATABASE_URL", "")
    configured_url = os.getenv("DATABASE_URL", "")
    if not explicit_url or not configured_url:
        raise RuntimeError("Set SMRITI_TEST_DATABASE_URL and DATABASE_URL to the isolated local test database.")

    test_target = parse_isolated_test_url(explicit_url)
    configured_target = parse_isolated_test_url(configured_url)
    if (
        test_target.hostname != configured_target.hostname
        or test_target.port != configured_target.port
        or test_target.path != configured_target.path
    ):
        raise RuntimeError("DATABASE_URL does not match the explicit SMRITI_TEST_DATABASE_URL target.")


def validate_test_tenant_name(name: str) -> str:
    clean_name = name.strip().lower()
    if not re.fullmatch(r"smriti_test_[a-z0-9_]+", clean_name):
        raise ValueError(f"Refusing non-test database name: {name}")
    return clean_name
