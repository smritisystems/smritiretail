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
Classification: Enterprise Consolidated Customer Credit Exposure Test Suite (BD-6)
"""

import sys
from pathlib import Path
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from fastapi import HTTPException
from app.api.deps import TenantContext
from app.models.crm import (
    Customer,
    CustomerCompanyRelationship,
    CustomerCreditLedgerEntry,
)
from app.models.tenant import Company
from app.schemas.crm import (
    CompanyCreditExposureItem,
    CustomerCreditExposureResponse,
)
from app.services.crm import CrmService
from app.api.v1.crm import get_customer_credit_exposure


def test_credit_exposure_schema_serialization():
    """Verify CompanyCreditExposureItem and CustomerCreditExposureResponse serialization and camelCase aliases."""
    item = CompanyCreditExposureItem(
        companyId="COMP-001",
        companyName="Reliance Retail Ltd",
        companyCode="RRL",
        creditLimit=Decimal("500000.00"),
        creditDays=45,
        creditHold=False,
        creditUsed=Decimal("250000.00"),
        availableCredit=Decimal("250000.00"),
        utilizationPercent=50.0,
        exposureStatus="NORMAL",
        status="Active",
    )
    assert item.company_id == "COMP-001"
    assert item.credit_limit == Decimal("500000.00")
    assert item.credit_used == Decimal("250000.00")
    assert item.exposure_status == "NORMAL"

    dumped_item = item.model_dump(by_alias=True)
    assert dumped_item["companyId"] == "COMP-001"
    assert dumped_item["creditLimit"] == Decimal("500000.00")
    assert dumped_item["utilizationPercent"] == 50.0

    resp = CustomerCreditExposureResponse(
        customerId="cust-rrl-001",
        customerName="Reliance Retail Limited",
        totalCreditLimit=Decimal("1500000.00"),
        totalCreditUsed=Decimal("600000.00"),
        totalAvailableCredit=Decimal("900000.00"),
        groupUtilizationPercent=40.0,
        groupRiskLevel="LOW",
        companyCount=2,
        holdCount=0,
        companyExposures=[item],
    )
    assert resp.customer_id == "cust-rrl-001"
    assert resp.total_credit_limit == Decimal("1500000.00")
    assert resp.group_risk_level == "LOW"
    assert resp.company_count == 2

    dumped_resp = resp.model_dump(by_alias=True)
    assert dumped_resp["customerId"] == "cust-rrl-001"
    assert dumped_resp["groupRiskLevel"] == "LOW"
    assert len(dumped_resp["companyExposures"]) == 1


@pytest.mark.asyncio
async def test_get_customer_credit_exposure_single_company():
    """Verify credit exposure calculation for a single-company customer with Model C relationship."""
    mock_db = AsyncMock()
    tenant_ctx = TenantContext(
        company_id="COMP-001",
        branch_id="BR-001",
    )

    customer = Customer(
        id="cust-001",
        name="Alpha Industries",
        code="ALPHA-001",
        identity_code="CRM-CUS-00000001",
        pan_number="AAACA1234A",
        company_id="COMP-001",
        outstanding=Decimal("45000.00"),
        is_deleted=False,
    )
    rel1 = CustomerCompanyRelationship(
        id="rel-001",
        customer_id="cust-001",
        company_id="COMP-001",
        credit_limit=Decimal("100000.00"),
        credit_days=30,
        credit_hold=False,
        status="Active",
        is_active=True,
        is_deleted=False,
    )
    customer.company_relationships = [rel1]

    # Setup mock query results
    res_cust = MagicMock()
    res_cust.scalars.return_value.first.return_value = customer

    res_comp = MagicMock()
    res_comp.all.return_value = [("COMP-001", "Alpha Retail Co", "COMP-001")]

    res_ccle = MagicMock()
    res_ccle.scalar_one_or_none.return_value = Decimal("45000.00")

    mock_db.execute.side_effect = [res_cust, res_comp, res_ccle]

    service = CrmService(mock_db, tenant_ctx)
    exposure = await service.get_customer_credit_exposure("cust-001")

    assert exposure.customer_id == "cust-001"
    assert exposure.customer_name == "Alpha Industries"
    assert exposure.total_credit_limit == Decimal("100000.00")
    assert exposure.total_credit_used == Decimal("45000.00")
    assert exposure.total_available_credit == Decimal("55000.00")
    assert exposure.group_utilization_percent == 45.0
    assert exposure.group_risk_level == "LOW"
    assert exposure.company_count == 1
    assert exposure.hold_count == 0

    assert len(exposure.company_exposures) == 1
    exp1 = exposure.company_exposures[0]
    assert exp1.company_id == "COMP-001"
    assert exp1.company_name == "Alpha Retail Co"
    assert exp1.credit_limit == Decimal("100000.00")
    assert exp1.credit_used == Decimal("45000.00")
    assert exp1.available_credit == Decimal("55000.00")
    assert exp1.utilization_percent == 45.0
    assert exp1.exposure_status == "NORMAL"


@pytest.mark.asyncio
async def test_get_customer_credit_exposure_multi_company_aggregation():
    """Verify multi-company group credit aggregation across 2 operating entities."""
    mock_db = AsyncMock()
    tenant_ctx = TenantContext(
        company_id="COMP-001",
        branch_id="BR-001",
    )

    customer = Customer(
        id="cust-multi-001",
        name="Tata Consumer Products",
        code="TCP-001",
        identity_code="CRM-CUS-00000002",
        pan_number="AAACT1234T",
        company_id="COMP-001",
        outstanding=Decimal("0.00"),
        is_deleted=False,
    )
    rel1 = CustomerCompanyRelationship(
        id="rel-001",
        customer_id="cust-multi-001",
        company_id="COMP-001",
        credit_limit=Decimal("500000.00"),
        credit_days=30,
        credit_hold=False,
        status="Active",
        is_active=True,
        is_deleted=False,
    )
    rel2 = CustomerCompanyRelationship(
        id="rel-002",
        customer_id="cust-multi-001",
        company_id="COMP-002",
        credit_limit=Decimal("300000.00"),
        credit_days=45,
        credit_hold=False,
        status="Active",
        is_active=True,
        is_deleted=False,
    )
    customer.company_relationships = [rel1, rel2]

    res_cust = MagicMock()
    res_cust.scalars.return_value.first.return_value = customer

    res_comp = MagicMock()
    res_comp.all.return_value = [
        ("COMP-001", "Smriti Retail Co", "COMP-001"),
        ("COMP-002", "Smriti Wholesale Co", "COMP-002"),
    ]

    res_ccle_1 = MagicMock()
    res_ccle_1.scalar_one_or_none.return_value = Decimal("200000.00")

    res_ccle_2 = MagicMock()
    res_ccle_2.scalar_one_or_none.return_value = Decimal("100000.00")

    mock_db.execute.side_effect = [res_cust, res_comp, res_ccle_1, res_ccle_2]

    service = CrmService(mock_db, tenant_ctx)
    exposure = await service.get_customer_credit_exposure("cust-multi-001")

    assert exposure.customer_id == "cust-multi-001"
    assert exposure.total_credit_limit == Decimal("800000.00")
    assert exposure.total_credit_used == Decimal("300000.00")
    assert exposure.total_available_credit == Decimal("500000.00")
    assert exposure.group_utilization_percent == 37.5
    assert exposure.group_risk_level == "LOW"
    assert exposure.company_count == 2
    assert exposure.hold_count == 0


@pytest.mark.asyncio
async def test_credit_hold_propagation_to_group_risk():
    """Verify that credit hold in any operating company propagates to ON_HOLD group risk."""
    mock_db = AsyncMock()
    tenant_ctx = TenantContext(company_id="COMP-001", branch_id="BR-001")

    customer = Customer(
        id="cust-hold-001",
        name="Gamma Traders",
        pan_number="AAACG1234G",
        is_deleted=False,
    )
    rel1 = CustomerCompanyRelationship(
        id="rel-001",
        customer_id="cust-hold-001",
        company_id="COMP-001",
        credit_limit=Decimal("200000.00"),
        credit_hold=True,  # Invoicing blocked!
        status="Active",
        is_active=True,
        is_deleted=False,
    )
    rel2 = CustomerCompanyRelationship(
        id="rel-002",
        customer_id="cust-hold-001",
        company_id="COMP-002",
        credit_limit=Decimal("100000.00"),
        credit_hold=False,
        status="Active",
        is_active=True,
        is_deleted=False,
    )
    customer.company_relationships = [rel1, rel2]

    res_cust = MagicMock()
    res_cust.scalars.return_value.first.return_value = customer
    res_comp = MagicMock()
    res_comp.all.return_value = [("COMP-001", "Company 1", "C1"), ("COMP-002", "Company 2", "C2")]
    res_ccle_1 = MagicMock()
    res_ccle_1.scalar_one_or_none.return_value = Decimal("50000.00")
    res_ccle_2 = MagicMock()
    res_ccle_2.scalar_one_or_none.return_value = Decimal("20000.00")

    mock_db.execute.side_effect = [res_cust, res_comp, res_ccle_1, res_ccle_2]

    service = CrmService(mock_db, tenant_ctx)
    exposure = await service.get_customer_credit_exposure("cust-hold-001")

    assert exposure.hold_count == 1
    assert exposure.group_risk_level == "ON_HOLD"
    assert exposure.company_exposures[0].exposure_status == "ON_HOLD"
    assert exposure.company_exposures[0].credit_hold is True
    assert exposure.company_exposures[1].exposure_status == "NORMAL"


@pytest.mark.asyncio
async def test_credit_breach_and_warning_thresholds():
    """Verify CRITICAL_BREACH (>100%) and HIGH_WARNING (>=80%) status assignments."""
    mock_db = AsyncMock()
    tenant_ctx = TenantContext(company_id="COMP-001", branch_id="BR-001")

    customer = Customer(
        id="cust-breach-001",
        name="Delta Retailers",
        is_deleted=False,
    )
    rel1 = CustomerCompanyRelationship(
        id="rel-001",
        customer_id="cust-breach-001",
        company_id="COMP-001",
        credit_limit=Decimal("100000.00"),
        credit_hold=False,
        status="Active",
        is_active=True,
        is_deleted=False,
    )
    rel2 = CustomerCompanyRelationship(
        id="rel-002",
        customer_id="cust-breach-001",
        company_id="COMP-002",
        credit_limit=Decimal("100000.00"),
        credit_hold=False,
        status="Active",
        is_active=True,
        is_deleted=False,
    )
    customer.company_relationships = [rel1, rel2]

    res_cust = MagicMock()
    res_cust.scalars.return_value.first.return_value = customer
    res_comp = MagicMock()
    res_comp.all.return_value = [("COMP-001", "Company 1", "C1"), ("COMP-002", "Company 2", "C2")]

    # Rel1: 85,000 / 100,000 = 85% -> HIGH_WARNING
    res_ccle_1 = MagicMock()
    res_ccle_1.scalar_one_or_none.return_value = Decimal("85000.00")

    # Rel2: 120,000 / 100,000 = 120% -> CRITICAL_BREACH
    res_ccle_2 = MagicMock()
    res_ccle_2.scalar_one_or_none.return_value = Decimal("120000.00")

    mock_db.execute.side_effect = [res_cust, res_comp, res_ccle_1, res_ccle_2]

    service = CrmService(mock_db, tenant_ctx)
    exposure = await service.get_customer_credit_exposure("cust-breach-001")

    assert exposure.company_exposures[0].exposure_status == "HIGH_WARNING"
    assert exposure.company_exposures[0].utilization_percent == 85.0

    assert exposure.company_exposures[1].exposure_status == "CRITICAL_BREACH"
    assert exposure.company_exposures[1].utilization_percent == 120.0

    # Group total: 205,000 / 200,000 = 102.5% -> CRITICAL
    assert exposure.total_credit_limit == Decimal("200000.00")
    assert exposure.total_credit_used == Decimal("205000.00")
    assert exposure.group_utilization_percent == 102.5
    assert exposure.group_risk_level == "CRITICAL"


@pytest.mark.asyncio
async def test_get_customer_credit_exposure_not_found():
    """Verify 404 is raised when customer does not exist."""
    mock_db = AsyncMock()
    tenant_ctx = TenantContext(company_id="COMP-001", branch_id="BR-001")

    res_cust = MagicMock()
    res_cust.scalars.return_value.first.return_value = None
    mock_db.execute.return_value = res_cust

    service = CrmService(mock_db, tenant_ctx)
    with pytest.raises(HTTPException) as exc_info:
        await service.get_customer_credit_exposure("non-existent-id")

    assert exc_info.value.status_code == 404
    assert "not found" in exc_info.value.detail.lower()


@pytest.mark.asyncio
async def test_api_endpoint_credit_exposure():
    """Verify FastAPI GET /customers/{customer_id}/credit-exposure route integration."""
    mock_db = AsyncMock()
    tenant_ctx = TenantContext(company_id="COMP-001", branch_id="BR-001")

    customer = Customer(
        id="cust-api-001",
        name="Omega Enterprises",
        pan_number="AAACO1234O",
        company_id="COMP-001",
        outstanding=Decimal("0.00"),
        is_deleted=False,
    )
    rel = CustomerCompanyRelationship(
        id="rel-api-001",
        customer_id="cust-api-001",
        company_id="COMP-001",
        credit_limit=Decimal("50000.00"),
        credit_days=15,
        credit_hold=False,
        status="Active",
        is_active=True,
        is_deleted=False,
    )
    customer.company_relationships = [rel]

    res_cust = MagicMock()
    res_cust.scalars.return_value.first.return_value = customer
    res_comp = MagicMock()
    res_comp.all.return_value = [("COMP-001", "Omega Operating Co", "COMP-001")]
    res_ccle = MagicMock()
    res_ccle.scalar_one_or_none.return_value = Decimal("10000.00")

    mock_db.execute.side_effect = [res_cust, res_comp, res_ccle]

    resp = await get_customer_credit_exposure(
        customer_id="cust-api-001",
        include_inactive=False,
        db=mock_db,
        tenant_ctx=tenant_ctx,
    )
    assert resp.customer_id == "cust-api-001"
    assert resp.total_credit_limit == Decimal("50000.00")
    assert resp.total_credit_used == Decimal("10000.00")
    assert resp.total_available_credit == Decimal("40000.00")
    assert resp.group_utilization_percent == 20.0
    assert resp.group_risk_level == "LOW"
