"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.16.0
Created      : 2026-08-25
Modified     : 2026-08-25
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import pytest
import uuid
from decimal import Decimal
from datetime import datetime, timezone
from httpx import AsyncClient, ASGITransport
from sqlalchemy import select

from app.main import app
from app.core.security import create_access_token
from app.models.auth import UserRole
from app.db.session import get_company_sessionmaker
from app.models.psv import PSVParty, PSVStockBalance
from app.services.psv_projection import PSVProjectionService
from app.schemas.psv import (
    PSVVisibilityPolicyCreateReq,
    PSVPartyScopeCreateReq,
)


def get_auth_headers(role: str = "SYSADMIN", company_id: str = "COMP-001", branch_id: str = "BR-001") -> dict:
    token = create_access_token(
        data={
            "sub": "usr-super",
            "username": "usr_super",
            "role": role,
            "company_id": company_id,
            "branch_id": branch_id,
            "tenant_id": "smriti001",
            "db_name": "smriti001",
            "is_active": True,
        }
    )
    return {
        "Authorization": f"Bearer {token}",
        "X-Company-ID": company_id,
        "X-Company-Code": "001",
    }


@pytest.mark.asyncio
async def test_psv_party_visibility_policy_and_scoping():
    """Verify PSV visibility policy creation and party scope bindings."""
    sessionmaker = get_company_sessionmaker("smriti001")
    suffix = uuid.uuid4().hex[:6]
    party_id = f"pty_psv_{suffix}"

    async with sessionmaker() as session:
        # Create visibility policy
        pol = await PSVProjectionService.create_visibility_policy(
            session=session,
            company_id="COMP-001",
            req=PSVVisibilityPolicyCreateReq(
                policy_code=f"POL_DIST_{suffix.upper()}",
                name="Distributor Limited Visibility Policy",
                allowed_sku_patterns=["SKU-DIST-*"],
                max_lookback_days=60,
            ),
        )
        assert pol.id is not None
        assert pol.policy_code == f"POL_DIST_{suffix.upper()}"

        # Bind scope
        scope = await PSVProjectionService.assign_party_scope(
            session=session,
            company_id="COMP-001",
            req=PSVPartyScopeCreateReq(
                party_id=party_id,
                policy_code=pol.policy_code,
                allowed_branch_ids=["BR-001", "BR-002"],
                allowed_categories=["APPAREL", "ACCESSORIES"],
            ),
        )
        assert scope.id is not None
        assert scope.party_id == party_id
        assert scope.policy_code == pol.policy_code


@pytest.mark.asyncio
async def test_psv_projection_idempotency_and_balance_accumulation():
    """Verify idempotent PSV stock event ingestion and balance aggregation."""
    sessionmaker = get_company_sessionmaker("smriti001")
    suffix = uuid.uuid4().hex[:6]
    party_id = f"pty_bal_{suffix}"
    sku = f"SKU-PSV-{suffix.upper()}"
    src_evt_id = f"EVT-SRC-{uuid.uuid4().hex[:10].upper()}"

    async with sessionmaker() as session:
        event_payload = {
            "source_event_id": src_evt_id,
            "correlation_id": f"corr_{suffix}",
            "company_code": "001",
            "source_document_type": "GST_INVOICE",
            "source_document_id": f"INV-{suffix}",
            "psv_party_id": party_id,
            "sku": sku,
            "movement_type": "GST_BILLED",
            "quantity": Decimal("25.0000"),
            "source_event_created_at": datetime.now(timezone.utc),
            "event_date": datetime.now(timezone.utc),
        }

        # 1. Initial projection
        res1 = await PSVProjectionService.project_psv_stock_event(
            psv_session=session,
            event_payload=event_payload,
        )
        assert res1["status"] == "PROJECTED_SUCCESSFULLY"
        assert res1["current_balance"] == 25.0

        # 2. Duplicate projection (idempotency check)
        res2 = await PSVProjectionService.project_psv_stock_event(
            psv_session=session,
            event_payload=event_payload,
        )
        assert res2["status"] == "SKIPPED_ALREADY_PROJECTED"

        # 3. Subsequent sale movement
        sale_payload = {
            "source_event_id": f"EVT-SALE-{uuid.uuid4().hex[:10].upper()}",
            "correlation_id": f"corr_sale_{suffix}",
            "company_code": "001",
            "source_document_type": "POS_BILL",
            "source_document_id": f"POS-{suffix}",
            "psv_party_id": party_id,
            "sku": sku,
            "movement_type": "SOLD",
            "quantity": Decimal("10.0000"),
            "source_event_created_at": datetime.now(timezone.utc),
            "event_date": datetime.now(timezone.utc),
        }
        res3 = await PSVProjectionService.project_psv_stock_event(
            psv_session=session,
            event_payload=sale_payload,
        )
        assert res3["status"] == "PROJECTED_SUCCESSFULLY"
        assert res3["current_balance"] == 15.0


@pytest.mark.asyncio
async def test_psv_multi_party_scoped_isolation():
    """Verify strict multi-party projection isolation (Party A cannot see Party B's inventory)."""
    sessionmaker = get_company_sessionmaker("smriti001")
    suffix = uuid.uuid4().hex[:6]
    party_a = f"pty_a_{suffix}"
    party_b = f"pty_b_{suffix}"
    sku_a = f"SKU-A-{suffix.upper()}"
    sku_b = f"SKU-B-{suffix.upper()}"

    async with sessionmaker() as session:
        # Project 100 units for Party A
        await PSVProjectionService.project_psv_stock_event(
            psv_session=session,
            event_payload={
                "source_event_id": f"EVT-A-{uuid.uuid4().hex[:8].upper()}",
                "company_code": "001",
                "source_document_type": "INVOICE",
                "source_document_id": f"INV-A-{suffix}",
                "psv_party_id": party_a,
                "sku": sku_a,
                "movement_type": "INWARD",
                "quantity": Decimal("100.0000"),
                "source_event_created_at": datetime.now(timezone.utc),
            },
        )

        # Project 50 units for Party B
        await PSVProjectionService.project_psv_stock_event(
            psv_session=session,
            event_payload={
                "source_event_id": f"EVT-B-{uuid.uuid4().hex[:8].upper()}",
                "company_code": "001",
                "source_document_type": "INVOICE",
                "source_document_id": f"INV-B-{suffix}",
                "psv_party_id": party_b,
                "sku": sku_b,
                "movement_type": "INWARD",
                "quantity": Decimal("50.0000"),
                "source_event_created_at": datetime.now(timezone.utc),
            },
        )

        # Query Party A scoped view
        view_a = await PSVProjectionService.get_scoped_party_visibility(
            session=session,
            company_code="001",
            party_id=party_a,
        )
        assert view_a.party_id == party_a
        assert view_a.total_skus_tracked == 1
        assert view_a.balances[0].sku == sku_a
        assert view_a.balances[0].current_balance == Decimal("100.0000")

        # Query Party B scoped view
        view_b = await PSVProjectionService.get_scoped_party_visibility(
            session=session,
            company_code="001",
            party_id=party_b,
        )
        assert view_b.party_id == party_b
        assert view_b.total_skus_tracked == 1
        assert view_b.balances[0].sku == sku_b
        assert view_b.balances[0].current_balance == Decimal("50.0000")


@pytest.mark.asyncio
async def test_api_psv_endpoints():
    """Verify PSV REST API endpoints."""
    headers = get_auth_headers()
    transport = ASGITransport(app=app)
    suffix = uuid.uuid4().hex[:6]

    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Create Policy
        p_res = await client.post(
            "/api/v1/psv/policies",
            json={
                "policy_code": f"POL_API_{suffix.upper()}",
                "name": f"API Policy {suffix}",
                "allowed_sku_patterns": ["SKU-*"],
                "max_lookback_days": 30,
            },
            headers=headers,
        )
        assert p_res.status_code == 200
        assert p_res.json()["status"] == "SUCCESS"

        # 2. Get Scoped Balances
        b_res = await client.get(
            f"/api/v1/psv/scoped-balances/pty_unknown_{suffix}",
            headers=headers,
        )
        assert b_res.status_code == 200
        assert b_res.json()["is_scoped"] == True
        assert b_res.json()["total_skus_tracked"] == 0
