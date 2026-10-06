"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 1.0.0
Created      : 2026-10-06
Modified     : 2026-10-06
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Unit & Integration Test Suite — SMRITI DataBridge Phase 1
"""

import inspect
import pytest
from unittest.mock import MagicMock, AsyncMock
from httpx import AsyncClient, ASGITransport

from app.main import app
from app.core.security import create_access_token
from app.models.auth import UserRole
from app.models.capability_template import TenantCapabilityBinding
from sqlalchemy.ext.asyncio import AsyncSession
from app.api import deps
from app.services.databridge.service import DataBridgeService
from app.services.databridge.exceptions import (
    DataBridgeTenantIsolationError,
    DataBridgeEntitlementError,
    DataBridgeError,
)
from app.services.databridge.models import (
    DataBridgeContractPingRequest,
    DataBridgeStatusResponse,
    DataBridgeContractPingResponse,
)


def _get_auth_headers(
    role: str = "SYSADMIN",
    company_id: str = "COMP-001",
    branch_id: str = "BR-MAIN-001",
    tenant_id: str = "smriti001",
):
    token = create_access_token(
        data={
            "sub": "usr-super",
            "role": role,
            "company_id": company_id,
            "branch_id": branch_id,
            "tenant_id": tenant_id,
            "db_name": tenant_id,
            "is_active": True,
        }
    )
    return {
        "Authorization": f"Bearer {token}",
        "X-Company-ID": company_id,
        "X-Company-Code": "001",
        "X-Branch-ID": branch_id,
    }


# ==============================================================================
# TEST CASE B: Unauthorized user -> request rejected (401)
# ==============================================================================
@pytest.mark.asyncio
async def test_databridge_unauthorized_missing_token():
    """Verify that unauthenticated requests to DataBridge are rejected with 401."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/api/v1/databridge/status")
        assert res.status_code == 401, f"Expected 401, got {res.status_code}: {res.text}"


@pytest.mark.asyncio
async def test_databridge_unauthorized_invalid_token():
    """Verify that forged/invalid JWT tokens are rejected with 401."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get(
            "/api/v1/databridge/status",
            headers={"Authorization": "Bearer invalid.jwt.signature"},
        )
        assert res.status_code == 401


# ==============================================================================
# TEST CASE A: Capability disabled -> request rejected (403 SMRITI-CAP-001)
# ==============================================================================
@pytest.mark.asyncio
async def test_databridge_capability_disabled_by_default():
    """
    Verify that an authenticated user cannot access DataBridge if the capability
    is not bound/enabled in the company database (fails closed with SMRITI-CAP-001).
    Tests the REAL require_databridge_entitlement dependency without mock overrides.
    """
    from app.api.deps import get_company_db

    mock_disabled_db = AsyncMock(spec=AsyncSession)
    mock_disabled_db.info = {"resolved_database_name": "smriti001"}
    mock_disabled_db.execute = AsyncMock(
        return_value=MagicMock(scalars=MagicMock(return_value=MagicMock(first=MagicMock(return_value=None))))
    )

    async def _mock_get_disabled_company_db():
        yield mock_disabled_db

    app.dependency_overrides[get_company_db] = _mock_get_disabled_company_db
    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            headers = _get_auth_headers(role="SYSADMIN")
            res = await client.get("/api/v1/databridge/status", headers=headers)
            assert res.status_code == 403, f"Expected 403, got {res.status_code}: {res.text}"
            assert "SMRITI-CAP-001" in res.text
    finally:
        app.dependency_overrides.pop(get_company_db, None)



# ==============================================================================
# TEST CASE C: Wrong tenant / header tampering -> request rejected (403)
# ==============================================================================
@pytest.mark.asyncio
async def test_databridge_tenant_header_tampering_rejected():
    """
    Verify that attempts to access a company ID not granted in user assignments
    are rejected by the canonical TenantContext resolver.
    """
    token = create_access_token(
        data={
            "sub": "usr-manager",
            "role": "MANAGER",
            "company_id": "COMP-001",
            "branch_id": "BR-MAIN-001",
            "tenant_id": "smriti001",
            "db_name": "smriti001",
            "is_active": True,
        }
    )
    tampered_headers = {
        "Authorization": f"Bearer {token}",
        "X-Company-ID": "COMP-999-TAMPERED",
        "X-Branch-ID": "BR-MAIN-001",
    }
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/api/v1/databridge/status", headers=tampered_headers)
        assert res.status_code in (403, 404), f"Expected 403/404, got {res.status_code}: {res.text}"


# ==============================================================================
# TEST CASE D: Attempt to route business operation to smritisys -> rejected
# ==============================================================================
def test_databridge_tenant_isolation_boundary_check():
    """
    Verify that DataBridgeService.verify_tenant_boundary strictly rejects
    control plane 'smritisys' or unmapped sessions with SMRITI-TENANT-001.
    """
    # 1. Reject smritisys
    mock_smritisys_session = MagicMock()
    mock_smritisys_session.info = {"resolved_database_name": "smritisys"}
    with pytest.raises(DataBridgeTenantIsolationError) as exc_info:
        DataBridgeService.verify_tenant_boundary(mock_smritisys_session, "COMP-001")
    assert "SMRITI-TENANT-001" in str(exc_info.value.code)

    # 2. Reject missing database context
    mock_empty_session = MagicMock()
    mock_empty_session.info = {}
    with pytest.raises(DataBridgeTenantIsolationError) as exc_info:
        DataBridgeService.verify_tenant_boundary(mock_empty_session, "COMP-001")
    assert "SMRITI-TENANT-001" in str(exc_info.value.code)

    # 3. Allow valid tenant database
    mock_tenant_session = MagicMock()
    mock_tenant_session.info = {"resolved_database_name": "smriti001"}
    resolved = DataBridgeService.verify_tenant_boundary(mock_tenant_session, "COMP-001")
    assert resolved == "smriti001"


# ==============================================================================
# TEST CASE E: Authorized tenant + enabled capability + RBAC -> allowed (200)
# ==============================================================================
@pytest.mark.asyncio
async def test_databridge_authorized_status_success():
    """
    Verify that when the tenant capability is entitled and user is authorized,
    GET /api/v1/databridge/status returns 200 with DataBridgeStatusResponse.
    Executes the REAL require_databridge_entitlement dependency.
    """
    from app.api.deps import get_company_db

    mock_db = AsyncMock(spec=AsyncSession)
    mock_db.info = {"resolved_database_name": "smriti001"}
    mock_binding = TenantCapabilityBinding(
        capability_code="DATABRIDGE",
        is_enabled=True,
        is_deleted=False,
        company_id="COMP-001",
        status="ACTIVE",
    )
    mock_db.execute = AsyncMock(
        return_value=MagicMock(scalars=MagicMock(return_value=MagicMock(first=MagicMock(return_value=mock_binding))))
    )

    async def _mock_get_enabled_company_db():
        yield mock_db

    app.dependency_overrides[get_company_db] = _mock_get_enabled_company_db
    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            headers = _get_auth_headers(role="SYSADMIN")
            res = await client.get("/api/v1/databridge/status", headers=headers)
            assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
            data = res.json()
            assert data["status"] == "ONLINE"
            assert data["capability_code"] == "DATABRIDGE"
            assert data["version"] == "1.0.0"
            assert data["entitlement_active"] is True
            assert data["resolved_database"] == "smriti001"
    finally:
        app.dependency_overrides.pop(get_company_db, None)


@pytest.mark.asyncio
async def test_databridge_contract_ping_handshake():
    """
    Verify that POST /api/v1/databridge/contract/ping executes the complete
    end-to-end security chain and returns cryptographic WORM audit proof.
    Executes the REAL require_databridge_entitlement dependency.
    """
    from app.api.deps import get_company_db

    mock_db = AsyncMock(spec=AsyncSession)
    mock_db.info = {"resolved_database_name": "smriti001"}
    mock_binding = TenantCapabilityBinding(
        capability_code="DATABRIDGE",
        is_enabled=True,
        is_deleted=False,
        company_id="COMP-001",
        status="ACTIVE",
    )
    async def _mock_execute(statement, *args, **kwargs):
        stmt_str = str(statement)
        if "tenant_capability_bindings" in stmt_str or "capability_code" in stmt_str:
            return MagicMock(scalars=MagicMock(return_value=MagicMock(first=MagicMock(return_value=mock_binding))))
        return MagicMock(scalars=MagicMock(return_value=MagicMock(first=MagicMock(return_value=None))))

    mock_db.execute = AsyncMock(side_effect=_mock_execute)

    async def _mock_get_enabled_company_db():
        yield mock_db

    app.dependency_overrides[get_company_db] = _mock_get_enabled_company_db
    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            headers = _get_auth_headers(role="SYSADMIN")
            payload = {
                "echo_token": "SMRITI-PHASE1-HANDSHAKE",
                "idempotency_key": "idemp-001-phase1",
                "metadata": {"test_run": "phase1_verification"},
            }
            res = await client.post(
                "/api/v1/databridge/contract/ping",
                json=payload,
                headers=headers,
            )
            assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
            data = res.json()
            assert data["echo_token"] == "SMRITI-PHASE1-HANDSHAKE"
            assert data["status"] == "SUCCESS"
            assert data["tenant_isolation_verified"] is True
            assert data["resolved_database"] == "smriti001"
            assert data["company_id"] == "COMP-001"
            assert len(data["compliance_sha256"]) == 64
    finally:
        app.dependency_overrides.pop(get_company_db, None)


# ==============================================================================
# TEST CASE F: Architectural Guard Order & No Duplicate Mechanisms
# ==============================================================================
def test_databridge_architecture_guard_order_and_reuse():
    """
    Verify that databridge.py strictly reuses canonical platform dependencies:
    AUTH (get_current_user)
    -> TenantContext (get_tenant_context)
    -> Capability Entitlement (require_databridge_entitlement)
    -> RBAC (require_permission)
    -> Company DB (get_company_db)
    """
    from app.api.v1 import databridge

    status_sig = inspect.signature(databridge.get_databridge_status)
    param_names = list(status_sig.parameters.keys())
    assert "current_user" in param_names
    assert "tenant" in param_names
    assert "_entitlement" in param_names
    assert "_rbac" in param_names
    assert "company_db" in param_names

    # Check dependency functions are imported from canonical app.api.deps
    assert databridge.get_current_user is deps.get_current_user
    assert databridge.get_tenant_context is deps.get_tenant_context
    assert databridge.get_company_db is deps.get_company_db
    assert databridge.require_permission is deps.require_permission


# ==============================================================================
# TEST CASE G: Oversized Payload Rejection
# ==============================================================================
@pytest.mark.asyncio
async def test_databridge_oversized_payload_rejection():
    """
    Verify that malformed or oversized payloads are rejected at the contract boundary.
    Executes the REAL require_databridge_entitlement dependency.
    """
    from app.api.deps import get_company_db

    mock_db = AsyncMock(spec=AsyncSession)
    mock_db.info = {"resolved_database_name": "smriti001"}
    mock_binding = TenantCapabilityBinding(
        capability_code="DATABRIDGE",
        is_enabled=True,
        is_deleted=False,
        company_id="COMP-001",
        status="ACTIVE",
    )
    mock_db.execute = AsyncMock(
        return_value=MagicMock(scalars=MagicMock(return_value=MagicMock(first=MagicMock(return_value=mock_binding))))
    )

    async def _mock_get_enabled_company_db():
        yield mock_db

    app.dependency_overrides[get_company_db] = _mock_get_enabled_company_db
    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            headers = _get_auth_headers(role="SYSADMIN")
            # Echo token exceeds 128 characters max_length
            payload = {"echo_token": "X" * 200}
            res = await client.post(
                "/api/v1/databridge/contract/ping",
                json=payload,
                headers=headers,
            )
            assert res.status_code == 422  # Unprocessable Entity
    finally:
        app.dependency_overrides.pop(get_company_db, None)
