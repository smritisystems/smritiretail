"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.24.0
Created      : 2026-08-23
Modified     : 2026-08-23
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

import os
import pytest
from unittest.mock import patch
from app.core.config import Settings, load_settings
from app.services.control_database_registry import ControlDatabaseRegistryService
from app.models.company_database_registry import CompanyDatabaseRegistry


def test_production_mode_fails_on_default_postgres_password():
    """
    Production startup guard must fail closed if default 'postgres:postgres'
    credentials are used in production mode.
    """
    env_vars = {
        "ENVIRONMENT": "production",
        "JWT_SECRET_KEY": "prod-secure-jwt-key-minimum-32-chars-long-smriti",
        "INTERNAL_SERVICE_KEY": "prod-secure-internal-key-32-chars-long-smriti",
        "POSTGRES_PASSWORD": "postgres",
        "DATABASE_URL": "postgresql+asyncpg://postgres:postgres@db.production.local:5432/smritisys"
    }
    with patch.dict(os.environ, env_vars, clear=False):
        with pytest.raises(ValueError, match="SECURITY FAULT: Production mode requires a dedicated, non-default POSTGRES_PASSWORD"):
            load_settings()


def test_production_mode_fails_on_default_jwt_secret():
    """
    Production startup guard must fail closed if dev JWT secret is used.
    """
    env_vars = {
        "ENVIRONMENT": "production",
        "JWT_SECRET_KEY": "dev-test-jwt-secret-key-32-chars-long-smriti",
        "INTERNAL_SERVICE_KEY": "prod-secure-internal-key-32-chars-long-smriti",
        "POSTGRES_PASSWORD": "strong-production-password-12345",
        "DATABASE_URL": "postgresql+asyncpg://postgres:strong-production-password-12345@db.production.local:5432/smritisys"
    }
    with patch.dict(os.environ, env_vars, clear=False):
        with pytest.raises(ValueError, match="SECURITY FAULT: Production mode requires a dedicated, cryptographically strong JWT_SECRET_KEY"):
            load_settings()


def test_production_mode_fails_on_default_internal_service_key():
    """
    Production startup guard must fail closed if dev internal service key is used.
    """
    env_vars = {
        "ENVIRONMENT": "production",
        "JWT_SECRET_KEY": "prod-secure-jwt-key-minimum-32-chars-long-smriti",
        "INTERNAL_SERVICE_KEY": "dev-test-internal-service-key-32-chars",
        "POSTGRES_PASSWORD": "strong-production-password-12345",
        "DATABASE_URL": "postgresql+asyncpg://postgres:strong-production-password-12345@db.production.local:5432/smritisys"
    }
    with patch.dict(os.environ, env_vars, clear=False):
        with pytest.raises(ValueError, match="SECURITY FAULT: Production mode requires a dedicated, cryptographically strong INTERNAL_SERVICE_KEY"):
            load_settings()


def test_production_mode_succeeds_with_strong_credentials():
    """
    Production startup succeeds when all required secrets are cryptographically strong.
    """
    env_vars = {
        "ENVIRONMENT": "production",
        "JWT_SECRET_KEY": "prod-secure-jwt-key-minimum-32-chars-long-smriti",
        "INTERNAL_SERVICE_KEY": "prod-secure-internal-key-32-chars-long-smriti",
        "POSTGRES_PASSWORD": "strong-production-password-12345",
        "DATABASE_URL": "postgresql+asyncpg://smritiapp:strong-production-password-12345@db.production.local:5432/smritisys"
    }
    with patch.dict(os.environ, env_vars, clear=False):
        loaded = load_settings()
        assert loaded.ENVIRONMENT == "production"
        assert loaded.STRICT_STATUTORY_MODE is True


def test_development_mode_permits_local_credentials():
    """
    Development/local test environments permit local development configuration.
    """
    env_vars = {
        "ENVIRONMENT": "development",
        "JWT_SECRET_KEY": "dev-test-jwt-secret-key-32-chars-long-smriti",
        "INTERNAL_SERVICE_KEY": "dev-test-internal-service-key-32-chars",
        "POSTGRES_PASSWORD": "postgres",
        "DATABASE_URL": "postgresql+asyncpg://postgres:postgres@localhost:5432/smritisys"
    }
    with patch.dict(os.environ, env_vars, clear=False):
        loaded = load_settings()
        assert loaded.ENVIRONMENT == "development"


def test_control_database_registry_dynamic_credential_binding():
    """
    ControlDatabaseRegistryService dynamically binds credentials from environment.
    """
    env_vars = {
        "POSTGRES_USER": "enterprise_user",
        "POSTGRES_PASSWORD": "enterprise_secret_pwd_999",
    }
    dummy_meta = CompanyDatabaseRegistry(
        company_id="c_test",
        database_id="db_test",
        database_name="smriti001",
        host_reference="db.cluster.internal",
        port_reference=5432
    )
    with patch.dict(os.environ, env_vars, clear=False):
        url = ControlDatabaseRegistryService.build_connection_url(dummy_meta)
        assert url == "postgresql+asyncpg://enterprise_user:enterprise_secret_pwd_999@db.cluster.internal:5432/smriti001"
