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
Classification: Enterprise Customer Relationships Test Suite
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
from app.models.crm import Customer, CustomerGroup, CustomerCompanyRelationship
from app.schemas.crm import (
    CustomerCompanyRelationshipCreate,
    CustomerCompanyRelationshipUpdate,
    CustomerCompanyRelationshipResponse,
)
from app.services.crm import CrmService


def test_customer_company_relationship_schema_validation():
    """Verify DTO schemas conform to enterprise commercial requirements."""
    create_dto = CustomerCompanyRelationshipCreate(
        customer_id="cust-12345",
        company_id="COMP-001",
        customer_group_id="CG-CORP",
        credit_limit=Decimal("500000.00"),
        credit_days=45,
        credit_hold=False,
        status="Active",
    )
    assert create_dto.customer_id == "cust-12345"
    assert create_dto.company_id == "COMP-001"
    assert create_dto.credit_limit == Decimal("500000.00")
    assert create_dto.credit_days == 45
    assert create_dto.credit_hold is False

    update_dto = CustomerCompanyRelationshipUpdate(
        credit_limit=Decimal("750000.00"),
        credit_days=60,
        credit_hold=True,
    )
    assert update_dto.credit_limit == Decimal("750000.00")
    assert update_dto.credit_days == 60
    assert update_dto.credit_hold is True

    now = datetime.now(timezone.utc)
    resp_dto = CustomerCompanyRelationshipResponse(
        id="ccr-123456",
        uuid=str(uuid.uuid4()),
        customer_id="cust-12345",
        company_id="COMP-001",
        branch_id="MAIN",
        customer_group_id="CG-CORP",
        price_tier_id=None,
        credit_limit=Decimal("500000.00"),
        credit_days=45,
        credit_hold=False,
        status="Active",
        is_active=True,
        is_deleted=False,
        created_at=now,
        modified_at=None,
    )
    assert resp_dto.id == "ccr-123456"
    assert resp_dto.credit_limit == Decimal("500000.00")


def test_customer_company_relationship_model_structure():
    """Verify ORM model columns, constraints, and relationships exist."""
    assert hasattr(CustomerCompanyRelationship, "id")
    assert hasattr(CustomerCompanyRelationship, "uuid")
    assert hasattr(CustomerCompanyRelationship, "customer_id")
    assert hasattr(CustomerCompanyRelationship, "company_id")
    assert hasattr(CustomerCompanyRelationship, "branch_id")
    assert hasattr(CustomerCompanyRelationship, "customer_group_id")
    assert hasattr(CustomerCompanyRelationship, "credit_limit")
    assert hasattr(CustomerCompanyRelationship, "credit_days")
    assert hasattr(CustomerCompanyRelationship, "credit_hold")
    assert hasattr(CustomerCompanyRelationship, "status")
    assert hasattr(CustomerCompanyRelationship, "is_active")
    assert hasattr(CustomerCompanyRelationship, "is_deleted")

    # Verify relationships on related models
    assert hasattr(Customer, "company_relationships")
    assert hasattr(CustomerGroup, "company_relationships")


@pytest.mark.asyncio
async def test_cross_company_customer_group_guard():
    """
    Blocker 4 / BD-1 Enforcement:
    Assert that CrmService._validate_customer_group_company rejects
    cross-company CustomerGroup assignments with HTTP 422.
    """
    mock_db = AsyncMock()
    tenant_ctx = TenantContext(company_id="COMP-001", branch_id="MAIN")
    service = CrmService(mock_db, tenant_ctx)

    # Mock foreign group belonging to COMP-002
    foreign_group = CustomerGroup(
        id="cg-foreign-002",
        company_id="COMP-002",
        name="Foreign Company Group",
    )
    mock_result = MagicMock()
    mock_result.scalars.return_value.first.return_value = foreign_group
    mock_db.execute.return_value = mock_result

    # Expect HTTP 422 when assigning COMP-002 group to COMP-001 relationship
    with pytest.raises(HTTPException) as exc_info:
        await service._validate_customer_group_company("cg-foreign-002", "COMP-001")

    assert exc_info.value.status_code == 422
    assert "Cross-company customer group assignment is prohibited" in exc_info.value.detail


@pytest.mark.asyncio
async def test_matching_company_customer_group_passes_guard():
    """
    Assert that CrmService._validate_customer_group_company allows
    same-company CustomerGroup assignments.
    """
    mock_db = AsyncMock()
    tenant_ctx = TenantContext(company_id="COMP-001", branch_id="MAIN")
    service = CrmService(mock_db, tenant_ctx)

    # Mock matching group belonging to COMP-001
    matching_group = CustomerGroup(
        id="cg-local-001",
        company_id="COMP-001",
        name="Local Company Group",
    )
    mock_result = MagicMock()
    mock_result.scalars.return_value.first.return_value = matching_group
    mock_db.execute.return_value = mock_result

    # Should succeed without raising an exception
    await service._validate_customer_group_company("cg-local-001", "COMP-001")
