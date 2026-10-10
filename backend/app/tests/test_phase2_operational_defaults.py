"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.16.2
Created      : 2026-10-09
Modified     : 2026-10-09
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Phase 2 Operational Defaults Verification Suite
"""

import pytest
from datetime import datetime, timezone, timedelta
from unittest.mock import AsyncMock, patch, MagicMock

from app.core.config import settings
from app.core.security import create_access_token, create_refresh_token, decode_token
from app.models.staff_profile import (
    StaffProfile,
    DEFAULT_STAFF_COUNTRY,
    DEFAULT_STAFF_EMPLOYMENT_TYPE,
    DEFAULT_STAFF_STATUS,
)
from app.services.auth import AuthService


def test_custom_access_token_expiration():
    """Verify create_access_token respects custom expires_minutes."""
    custom_minutes = 60
    data = {"sub": "usr-test1", "role": "CASHIER"}
    
    before = datetime.now(timezone.utc)
    token = create_access_token(data, expires_minutes=custom_minutes)
    after = datetime.now(timezone.utc)
    
    payload = decode_token(token)
    assert payload["sub"] == "usr-test1"
    assert payload["type"] == "access"
    
    exp_dt = datetime.fromtimestamp(payload["exp"], tz=timezone.utc)
    # Check that exp is approximately before + 60 minutes
    expected_approx = before + timedelta(minutes=custom_minutes)
    diff = abs((exp_dt - expected_approx).total_seconds())
    assert diff < 5, f"Expected exp close to 60 min, got diff {diff}s"


def test_default_access_token_expiration():
    """Verify create_access_token falls back to settings.ACCESS_TOKEN_EXPIRE_MINUTES."""
    data = {"sub": "usr-test2", "role": "CASHIER"}
    
    before = datetime.now(timezone.utc)
    token = create_access_token(data)
    
    payload = decode_token(token)
    exp_dt = datetime.fromtimestamp(payload["exp"], tz=timezone.utc)
    expected_approx = before + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    diff = abs((exp_dt - expected_approx).total_seconds())
    assert diff < 5, f"Expected exp close to {settings.ACCESS_TOKEN_EXPIRE_MINUTES} min, got diff {diff}s"


def test_custom_refresh_token_expiration():
    """Verify create_refresh_token respects custom expires_days."""
    custom_days = 14
    data = {"sub": "usr-test3"}
    
    before = datetime.now(timezone.utc)
    token = create_refresh_token(data, expires_days=custom_days)
    
    payload = decode_token(token)
    assert payload["type"] == "refresh"
    exp_dt = datetime.fromtimestamp(payload["exp"], tz=timezone.utc)
    expected_approx = before + timedelta(days=custom_days)
    diff = abs((exp_dt - expected_approx).total_seconds())
    assert diff < 5, f"Expected exp close to {custom_days} days, got diff {diff}s"


@pytest.mark.asyncio
async def test_auth_service_dynamic_expiration_resolution():
    """Verify AuthService._resolve_token_expirations queries SystemParameterService."""
    mock_db = AsyncMock()
    service = AuthService(db=mock_db)

    from app.services.system_parameter import SystemParameterService

    mock_param_min = MagicMock()
    mock_param_min.effective_value = 120

    mock_param_days = MagicMock()
    mock_param_days.effective_value = 3

    async def mock_resolve(db, param_code, company_id=None, branch_id=None, **kwargs):
        if param_code == "SMRITI.AUTH.TOKEN_EXPIRE_MINUTES":
            return mock_param_min
        if param_code == "SMRITI.AUTH.REFRESH_TOKEN_EXPIRE_DAYS":
            return mock_param_days
        return None

    with patch.object(SystemParameterService, "resolve_parameter", side_effect=mock_resolve):
        min_res, days_res = await service._resolve_token_expirations(company_id="COMP-001", branch_id="MAIN")
        assert min_res == 120
        assert days_res == 3


@pytest.mark.asyncio
async def test_auth_service_absent_parameters_fallback():
    """Verify absent parameters return (None, None) so application defaults take effect."""
    mock_db = AsyncMock()
    service = AuthService(db=mock_db)

    from app.services.system_parameter import SystemParameterService

    with patch.object(SystemParameterService, "resolve_parameter", return_value=None):
        min_res, days_res = await service._resolve_token_expirations(company_id="COMP-001")
        assert min_res is None
        assert days_res is None


@pytest.mark.asyncio
async def test_auth_service_invalid_parameter_fails_safely():
    """Verify invalid parameter values raise explicit SMRITI-AUTH-CFG-001 error."""
    mock_db = AsyncMock()
    service = AuthService(db=mock_db)

    from fastapi import HTTPException
    from app.services.system_parameter import SystemParameterService

    mock_invalid = MagicMock()
    mock_invalid.effective_value = "not-a-number"

    with patch.object(SystemParameterService, "resolve_parameter", return_value=mock_invalid):
        with pytest.raises(HTTPException) as exc_info:
            await service._resolve_token_expirations(company_id="COMP-001")
        assert exc_info.value.status_code == 500
        assert "SMRITI-AUTH-CFG-001" in exc_info.value.detail


@pytest.mark.asyncio
async def test_auth_service_resolver_failure_logged_and_fails_safely():
    """Verify unexpected database or resolver exception raises explicit SMRITI-AUTH-CFG-002 error."""
    mock_db = AsyncMock()
    service = AuthService(db=mock_db)

    from fastapi import HTTPException
    from app.services.system_parameter import SystemParameterService

    with patch.object(SystemParameterService, "resolve_parameter", side_effect=RuntimeError("Database connection lost")):
        with pytest.raises(HTTPException) as exc_info:
            await service._resolve_token_expirations(company_id="COMP-001")
        assert exc_info.value.status_code == 500
        assert "SMRITI-AUTH-CFG-002" in exc_info.value.detail


def test_staff_profile_model_canonical_constants():
    """Verify canonical defaults in StaffProfile model."""
    assert DEFAULT_STAFF_COUNTRY == "India"
    assert DEFAULT_STAFF_EMPLOYMENT_TYPE == "Permanent"
    assert DEFAULT_STAFF_STATUS == "Active"

    staff = StaffProfile(
        user_id="usr-test",
        display_name="Test Staff",
    )
    # ORM column defaults check
    assert StaffProfile.country.default.arg == "India"
    assert StaffProfile.employment_type.default.arg == "Permanent"
    assert StaffProfile.status.default.arg == "Active"
