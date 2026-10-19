"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.99.0
Created      : 2026-10-19
Modified     : 2026-10-19
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Customer Master Lifecycle Security & Pre-flight Guards Test Suite
"""

import sys
import uuid
import pytest
from pathlib import Path
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock
from datetime import datetime, timezone

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from fastapi import HTTPException
from app.api.deps import TenantContext
from app.models.crm import (
    Customer,
    CustomerPolicy,
    CustomerRelationship,
    CustomerCompanyRelationship,
    CustomerGSTRegistration,
    CustomerDeliveryLocation,
    CustomerBillingLocation,
)
from app.schemas.crm import (
    CustomerDeleteEligibilityResponse,
    CustomerDeactivateRequest,
    CustomerResponse,
)
from app.services.crm import CrmService


def test_customer_delete_eligibility_schema_serialization():
    """Verify CustomerDeleteEligibilityResponse serialization with aliases and metrics."""
    resp = CustomerDeleteEligibilityResponse(
        customerId="cust-1001",
        customerCode="CUST-1001",
        customerName="Reliance Retail Ltd",
        status="Active",
        eligible=False,
        blockers=[
            "Customer has 12 tax invoice(s) on record.",
            "Customer has an unsettled financial ledger balance of ₹1,55,240.00.",
        ],
        warnings=[],
        recommendation="DEACTIVATE",
        reason="Customer has financial, transactional, or compliance dependencies.",
        metrics={
            "invoice_count": 12,
            "order_count": 5,
            "return_count": 0,
            "ledger_count": 17,
            "po_count": 2,
            "psv_count": 0,
            "relationship_count": 3,
            "outstanding_balance": 155240.0,
        },
    )

    dumped_alias = resp.model_dump(by_alias=True)
    assert dumped_alias["customerId"] == "cust-1001"
    assert dumped_alias["customerCode"] == "CUST-1001"
    assert dumped_alias["customerName"] == "Reliance Retail Ltd"
    assert dumped_alias["eligible"] is False
    assert len(dumped_alias["blockers"]) == 2
    assert dumped_alias["recommendation"] == "DEACTIVATE"
    assert dumped_alias["metrics"]["invoice_count"] == 12

    dumped_raw = resp.model_dump(by_alias=False)
    assert dumped_raw["customer_id"] == "cust-1001"
    assert dumped_raw["customer_code"] == "CUST-1001"
    assert dumped_raw["customer_name"] == "Reliance Retail Ltd"


def test_customer_deactivate_request_schema():
    """Verify CustomerDeactivateRequest payload schema."""
    req = CustomerDeactivateRequest(reason="Seasonal business closure")
    assert req.reason == "Seasonal business closure"

    req_empty = CustomerDeactivateRequest()
    assert req_empty.reason is None


@pytest.mark.asyncio
async def test_check_delete_eligibility_blocks_on_invoices_and_balance():
    """
    Assert that check_delete_eligibility correctly identifies blockers and
    recommends DEACTIVATE when tax invoices and outstanding balance exist.
    """
    mock_db = AsyncMock()
    tenant_ctx = TenantContext(company_id="COMP-001", branch_id="MAIN")
    service = CrmService(mock_db, tenant_ctx)

    mock_customer = Customer(
        id="cust-corp-001",
        code="CUST-001",
        name="Tata Consumer Products",
        status="Active",
        outstanding=Decimal("45000.00"),
        company_id="COMP-001",
        is_deleted=False,
    )

    # 1. Customer query
    cust_res = MagicMock()
    cust_res.scalars.return_value.first.return_value = mock_customer

    # Dependency counts:
    # 2. Invoices: 7
    inv_res = MagicMock()
    inv_res.scalar_one.return_value = 7
    # 3. Orders: 0
    so_res = MagicMock()
    so_res.scalar_one.return_value = 0
    # 4. Returns: 0
    ret_res = MagicMock()
    ret_res.scalar_one.return_value = 0
    # 5. Ledger: 14
    led_res = MagicMock()
    led_res.scalar_one.return_value = 14
    # 6. PO: 0
    po_res = MagicMock()
    po_res.scalar_one.return_value = 0
    # 7. PSV: 0
    psv_res = MagicMock()
    psv_res.scalar_one.return_value = 0
    # 8. Relationships: 0
    rel_res = MagicMock()
    rel_res.scalar_one.return_value = 0

    mock_db.execute.side_effect = [
        cust_res,
        inv_res,
        so_res,
        ret_res,
        led_res,
        po_res,
        psv_res,
        rel_res,
    ]

    eligibility = await service.check_delete_eligibility("cust-corp-001")

    assert eligibility.customer_id == "cust-corp-001"
    assert eligibility.customer_code == "CUST-001"
    assert eligibility.eligible is False
    assert eligibility.recommendation == "DEACTIVATE"
    assert any("tax invoice" in b.lower() for b in eligibility.blockers)
    assert any("ledger" in b.lower() for b in eligibility.blockers)
    assert any("45,000.00" in b for b in eligibility.blockers)
    assert eligibility.metrics["invoice_count"] == 7
    assert eligibility.metrics["outstanding_balance"] == 45000.0


@pytest.mark.asyncio
async def test_check_delete_eligibility_permits_clean_customer():
    """
    Assert that check_delete_eligibility returns eligible=True,
    recommendation=PERMANENT_DELETE when zero dependencies exist.
    """
    mock_db = AsyncMock()
    tenant_ctx = TenantContext(company_id="COMP-001", branch_id="MAIN")
    service = CrmService(mock_db, tenant_ctx)

    mock_customer = Customer(
        id="cust-draft-001",
        code="CUST-DRAFT-001",
        name="Unbilled New Customer",
        status="Active",
        outstanding=Decimal("0.00"),
        company_id="COMP-001",
        is_deleted=False,
    )

    cust_res = MagicMock()
    cust_res.scalars.return_value.first.return_value = mock_customer

    zero_res = MagicMock()
    zero_res.scalar_one.return_value = 0

    mock_db.execute.side_effect = [
        cust_res,
        zero_res,  # invoices
        zero_res,  # orders
        zero_res,  # returns
        zero_res,  # ledger
        zero_res,  # po
        zero_res,  # psv
        zero_res,  # rel
    ]

    eligibility = await service.check_delete_eligibility("cust-draft-001")

    assert eligibility.customer_id == "cust-draft-001"
    assert eligibility.eligible is True
    assert eligibility.recommendation == "PERMANENT_DELETE"
    assert len(eligibility.blockers) == 0
    assert "Safe to permanently delete" in eligibility.reason
    assert len(eligibility.warnings) == 1


@pytest.mark.asyncio
async def test_permanent_delete_raises_400_when_blocked():
    """Assert permanent_delete_customer raises HTTP 400 if customer has active dependencies."""
    mock_db = AsyncMock()
    tenant_ctx = TenantContext(company_id="COMP-001", branch_id="MAIN")
    service = CrmService(mock_db, tenant_ctx)

    mock_customer = Customer(
        id="cust-active-001",
        code="CUST-001",
        name="Active Billed Account",
        status="Active",
        outstanding=Decimal("12000.00"),
        company_id="COMP-001",
        is_deleted=False,
    )

    # First execute for customer query in permanent_delete_customer
    cust_res = MagicMock()
    cust_res.scalars.return_value.first.return_value = mock_customer

    # Next execute calls inside check_delete_eligibility
    cust_res_elig = MagicMock()
    cust_res_elig.scalars.return_value.first.return_value = mock_customer
    inv_res = MagicMock()
    inv_res.scalar_one.return_value = 5
    zero_res = MagicMock()
    zero_res.scalar_one.return_value = 0

    mock_db.execute.side_effect = [
        cust_res,
        cust_res_elig,
        inv_res,   # invoices: 5
        zero_res,  # orders
        zero_res,  # returns
        zero_res,  # ledger
        zero_res,  # po
        zero_res,  # psv
        zero_res,  # rel
    ]

    with pytest.raises(HTTPException) as exc_info:
        await service.permanent_delete_customer("cust-active-001")

    assert exc_info.value.status_code == 400
    assert exc_info.value.detail["error_code"] == "CUSTOMER_DELETE_BLOCKED"
    assert "Deactivate instead" in exc_info.value.detail["recommendation"]


@pytest.mark.asyncio
async def test_permanent_delete_executes_when_clean():
    """Assert permanent_delete_customer successfully deletes subordinate entities and customer."""
    mock_db = AsyncMock()
    tenant_ctx = TenantContext(company_id="COMP-001", branch_id="MAIN")
    service = CrmService(mock_db, tenant_ctx)

    mock_gst = CustomerGSTRegistration(id="gst-01")
    mock_loc = CustomerDeliveryLocation(id="loc-01")
    mock_bloc = CustomerBillingLocation(id="bloc-01")
    mock_policy = CustomerPolicy(id="pol-01")
    mock_rel = CustomerCompanyRelationship(id="ccr-01")

    mock_customer = Customer(
        id="cust-clean-001",
        code="CUST-CLEAN",
        name="Clean Unbilled Account",
        status="Active",
        outstanding=Decimal("0.00"),
        company_id="COMP-001",
        is_deleted=False,
        gst_registrations=[mock_gst],
        delivery_locations=[mock_loc],
        billing_locations=[mock_bloc],
        external_identities=[],
        policy=mock_policy,
        company_relationships=[mock_rel],
    )

    cust_res = MagicMock()
    cust_res.scalars.return_value.first.return_value = mock_customer
    cust_res_elig = MagicMock()
    cust_res_elig.scalars.return_value.first.return_value = mock_customer
    zero_res = MagicMock()
    zero_res.scalar_one.return_value = 0

    mock_db.execute.side_effect = [
        cust_res,
        cust_res_elig,
        zero_res,  # invoices: 0
        zero_res,  # orders: 0
        zero_res,  # returns: 0
        zero_res,  # ledger: 0
        zero_res,  # po: 0
        zero_res,  # psv: 0
        zero_res,  # rel: 0
    ]

    service._record_audit_event = AsyncMock()

    result = await service.permanent_delete_customer("cust-clean-001")

    assert result["status"] == "success"
    assert result["customer_id"] == "cust-clean-001"
    assert mock_db.delete.call_count >= 5  # subordinate records + customer
    mock_db.commit.assert_awaited_once()
    service._record_audit_event.assert_awaited_once()


@pytest.mark.asyncio
async def test_deactivate_and_reactivate_customer_lifecycle():
    """Assert deactivate_customer transitions Active -> Inactive and reactivate transitions Inactive -> Active."""
    mock_db = AsyncMock()
    tenant_ctx = TenantContext(company_id="COMP-001", branch_id="MAIN")
    service = CrmService(mock_db, tenant_ctx)
    service._record_audit_event = AsyncMock()

    mock_customer = Customer(
        id="cust-life-001",
        code="CUST-LIFE",
        name="Lifecycle Customer",
        status="Active",
        outstanding=Decimal("1500.00"),
        company_id="COMP-001",
        is_deleted=False,
    )

    cust_res = MagicMock()
    cust_res.scalars.return_value.first.return_value = mock_customer
    mock_db.execute.return_value = cust_res
    service.get_customer = AsyncMock(return_value=mock_customer)

    # 1. Deactivate
    deactivated = await service.deactivate_customer("cust-life-001", reason="Branch closure")
    assert deactivated.status == "Inactive"
    mock_db.commit.assert_awaited()

    # 2. Deactivating already inactive customer raises HTTP 400
    with pytest.raises(HTTPException) as exc_info:
        await service.deactivate_customer("cust-life-001")
    assert exc_info.value.status_code == 400
    assert "already inactive" in exc_info.value.detail

    # 3. Reactivate
    reactivated = await service.reactivate_customer("cust-life-001")
    assert reactivated.status == "Active"

    # 4. Reactivating already active customer raises HTTP 400
    with pytest.raises(HTTPException) as exc_info2:
        await service.reactivate_customer("cust-life-001")
    assert exc_info2.value.status_code == 400
    assert "already active" in exc_info2.value.detail
