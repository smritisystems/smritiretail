"""
Project      : SMRITI Retail OS
Organization : SmritiSys
Module       : SCDM v1.1 Settlement & Claims Engine Unit Tests
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

import pytest
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock

from app.services.scdm_service import SCDMService
from app.models.scdm_settlement import (
    ClaimStatus,
    SettlementStatus,
    SCDMClaimType,
    SCDMClaim,
    SCDMSettlement,
)


@pytest.mark.asyncio
async def test_list_claim_types_seeds_defaults():
    """If no claim types exist, list_claim_types seeds 5 default claim types."""
    mock_db = AsyncMock()
    mock_res = MagicMock()
    mock_res.scalars().all.return_value = []
    mock_db.execute.return_value = mock_res

    svc = SCDMService(db=mock_db, tenant_ctx=None)
    types = await svc.list_claim_types()

    assert len(types) == 5
    assert types[0].code == "CT-SHORT"
    assert types[1].code == "CT-DMG"
    assert types[2].code == "CT-SCHEME"
    assert types[3].code == "CT-PRICE"
    assert types[4].code == "CT-FREIGHT"


@pytest.mark.asyncio
async def test_submit_retailer_claim():
    """Filing a claim creates an SCDMClaim record in SUBMITTED status."""
    mock_db = AsyncMock()
    svc = SCDMService(db=mock_db, tenant_ctx=None)

    claim = await svc.submit_retailer_claim(
        customer_id="cust-100",
        claim_category="Shortage",
        claimed_amount=Decimal("2500.00"),
        reason="Short supply of 10 items in Invoice INV-900",
    )

    assert claim.customer_id == "cust-100"
    assert claim.claim_category == "Shortage"
    assert claim.claimed_amount == Decimal("2500.00")
    assert claim.status == ClaimStatus.SUBMITTED
    assert claim.claim_number.startswith("CLM-")


@pytest.mark.asyncio
async def test_approve_claim():
    """Approving a claim transitions status to APPROVED and sets approved_amount."""
    mock_db = AsyncMock()
    svc = SCDMService(db=mock_db, tenant_ctx=None)

    mock_claim = SCDMClaim(
        id="clm-1",
        claim_number="CLM-001",
        customer_id="cust-100",
        claimed_amount=Decimal("2500.00"),
        approved_amount=Decimal("0.00"),
        status=ClaimStatus.SUBMITTED,
    )
    mock_res = MagicMock()
    mock_res.scalars().first.return_value = mock_claim
    mock_db.execute.return_value = mock_res

    updated = await svc.approve_claim(
        claim_id="clm-1",
        approved_amount=Decimal("2500.00"),
        approved_by="AdminUser",
    )

    assert updated.status == ClaimStatus.APPROVED
    assert updated.approved_amount == Decimal("2500.00")
    assert updated.approved_by == "AdminUser"


@pytest.mark.asyncio
async def test_create_and_reconcile_settlement():
    """Creating a remittance settlement computes unreconciled variance accurately."""
    mock_db = AsyncMock()
    svc = SCDMService(db=mock_db, tenant_ctx=None)

    stl = await svc.create_settlement(
        customer_id="cust-100",
        remittance_ref="PAY-998877",
        gross_dispatch_value=Decimal("100000.00"),
        total_deductions=Decimal("5000.00"),
        net_received_amount=Decimal("95000.00"),
    )

    assert stl.gross_dispatch_value == Decimal("100000.00")
    assert stl.total_deductions == Decimal("5000.00")
    assert stl.net_received_amount == Decimal("95000.00")
    assert stl.unreconciled_variance == Decimal("0.00")  # 100000 - (95000 + 5000) = 0
    assert stl.status == SettlementStatus.DRAFT
