"""
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.16.0
 * Created      : 2026-08-15
 * Modified     : 2026-08-15
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
"""

import sys, os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import pytest
from fastapi import HTTPException
from app.services.company_database_resolver import CompanyDatabaseResolver

def test_company_control_center_zero_credentials_exposed():
    """Verify resolved company object contains database_name but ZERO raw passwords or secrets."""
    res = CompanyDatabaseResolver.resolve_company_database("usr_sysadmin", "COMP-001")
    assert "database_name" in res
    assert res["database_name"] == "smriti001"
    # Ensure sensitive credentials are never leaked
    assert "password" not in res
    assert "postgres_password" not in res
    assert "secret_key" not in res

def test_company_control_center_security_isolation():
    """Verify unauthorized user access to company context returns HTTP 403."""
    with pytest.raises(HTTPException) as exc_info:
        CompanyDatabaseResolver.resolve_company_database("unauthorized_user_999", "COMP-999")
    assert exc_info.value.status_code == 403

def test_company_control_center_role_permissions():
    """Verify SYSADMIN user gets access to COMP-001."""
    res = CompanyDatabaseResolver.resolve_company_database("usr_sysadmin", "COMP-001")
    assert res["company_id"] == "COMP-001"
    assert res["database_status"] == "READY"
