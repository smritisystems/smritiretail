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
from app.models.auth import User, UserRole
from app.api.v1.company_control_center import (
    validate_company_code,
    get_company_detail,
    create_company_request,
    execute_lifecycle_action,
    ValidateCodeRequest,
    CreateCompanyRequest,
    LifecycleActionRequest
)

sysadmin_user = User(id="usr-super", role=UserRole.SYSADMIN, company_id="COMP-001")
ordinary_user = User(id="usr-cashier", role=UserRole.CASHIER, company_id="COMP-001")

def test_valid_company_code_validation_abc():
    """Verify code validation accepts ABC and returns smritiABC."""
    req = ValidateCodeRequest(company_code="abc")
    res = validate_company_code(req)
    assert res["company_code"] == "ABC"
    assert res["database_name"] == "smritiABC"
    assert res["valid"] is True

def test_invalid_company_code_rejection_000_and_sys():
    """Verify reserved 000 and SYS codes are rejected with HTTP 400."""
    with pytest.raises(HTTPException) as exc_000:
        validate_company_code(ValidateCodeRequest(company_code="000"))
    assert exc_000.value.status_code == 400

    with pytest.raises(HTTPException) as exc_sys:
        validate_company_code(ValidateCodeRequest(company_code="SYS"))
    assert exc_sys.value.status_code == 400

def test_unauthorized_company_access_returns_403():
    """Verify unauthorized user access to company context returns HTTP 403."""
    with pytest.raises(HTTPException) as exc_info:
        get_company_detail("COMP-999", current_user=ordinary_user)
    assert exc_info.value.status_code == 403

def test_zero_credentials_in_company_detail_payload():
    """Verify company detail endpoint returns zero DB passwords or connection strings."""
    res = get_company_detail("COMP-001", current_user=sysadmin_user)
    assert res["database_name"] == "smriti001"
    assert "password" not in res
    assert "connection_string" not in res

def test_dry_run_company_create_request_zero_mutations():
    """Verify company create request runs in dry-run mode without DB mutations."""
    req = CreateCompanyRequest(company_id="COMP-MUM", company_name="SMRITI Mumbai Megastore", company_code="MUM")
    res = create_company_request(req, current_user=sysadmin_user)
    assert res["dry_run_plan"]["database_name"] == "smritiMUM"
    assert res["dry_run_plan"]["database_mutations"] == 0

def test_delete_action_requires_dual_approval_gate():
    """Verify DELETE action is rejected without dual administrative approval gate."""
    req = LifecycleActionRequest(company_id="COMP-001", action="DELETE")
    with pytest.raises(HTTPException) as exc_info:
        execute_lifecycle_action(req, current_user=sysadmin_user)
    assert exc_info.value.status_code == 403
