"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.99.13
Created      : 2026-10-22
Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Unit & Integration Test Suite
"""

import pytest
from unittest.mock import AsyncMock, MagicMock
from decimal import Decimal
from types import SimpleNamespace
from fastapi import HTTPException
from sqlalchemy import select, and_, or_

from app.models.crm import Customer, CustomerRelationship
from app.schemas.crm import CustomerCreate, CustomerUpdate, CustomerResponse, map_customer_to_response_dict
from app.schemas.billing_catalog import BillingCustomerItem
from app.repositories.customer import CustomerRepository
from app.api.deps import TenantContext
from app.services.headless_billing import HeadlessBillingCore
from app.schemas.canonical_posting import CanonicalPostingRequest, CanonicalPostingContext, CanonicalPostingLineItem


def test_parent_setting_defaults_to_disabled():
    """Requirement 2: Show Child Customers in Billing must default to False/Disabled."""
    payload = CustomerCreate(
        name="Parent Holding Corp",
        customerType="Corporate"
    )
    assert payload.show_child_customers_in_billing is False
    assert payload.model_dump(by_alias=True)["showChildCustomersInBilling"] is False


def test_parent_setting_accepts_explicit_toggle():
    """Requirement 2: Toggle can be explicitly enabled with alias support."""
    payload_enabled = CustomerCreate(
        name="Parent Corp Enabled",
        showChildCustomersInBilling=True
    )
    assert payload_enabled.show_child_customers_in_billing is True

    update_payload = CustomerUpdate(
        showChildCustomersInBilling=True
    )
    assert update_payload.show_child_customers_in_billing is True


def test_customer_response_and_mapping_exposes_billing_toggle():
    """Requirement 2 & 6: Setting is reflected in CustomerResponse DTO."""
    mock_cust = SimpleNamespace(
        id="cust-parent-1",
        uuid=None,
        customer_group_id="CG-Corporate",
        code="PARENT-001",
        name="Tata Retail Enterprises",
        mobile="9820098200",
        email="corp@tata.com",
        gst_number="27AAACT1234F1Z5",
        outstanding=Decimal("50000.00"),
        status="Active",
        created_date=None,
        tags=["Corporate"],
        is_tax_inclusive=True,
        pricing_basis="MRP",
        allow_promotions_on_rate=False,
        is_dependant=False,
        show_child_customers_in_billing=True,
        created_at=None,
        modified_at=None,
        is_active=True,
        is_deleted=False,
        version=1,
        company_id="COMP-001",
        branch_id="MAIN",
    )

    mapped = map_customer_to_response_dict(mock_cust)
    assert mapped["show_child_customers_in_billing"] is True

    resp = CustomerResponse.model_validate(mapped)
    assert resp.show_child_customers_in_billing is True


def test_billing_customer_item_exposes_child_metadata():
    """Requirement 5: Billing customer selector displays child status and parent name."""
    item = BillingCustomerItem(
        id="cust-child-1",
        code="WESTSIDE-MUM-01",
        name="Westside Mumbai Flagship",
        is_child_customer=True,
        parent_customer_id="cust-parent-1",
        parent_customer_name="Tata Retail Enterprises",
        credit_limit=Decimal("100000.00"),
        balance=Decimal("20000.00"),
        available_credit=Decimal("80000.00")
    )
    assert item.is_child_customer is True
    assert item.parent_customer_id == "cust-parent-1"
    assert item.parent_customer_name == "Tata Retail Enterprises"


def test_customer_repository_billing_filter_ast_construction():
    """Requirement 3 & 4: CustomerRepository._apply_billing_visibility_filter constructs correct SQL conditions."""
    repo = CustomerRepository(db=AsyncMock(), tenant_ctx=TenantContext(company_id="COMP-001", branch_id="MAIN"))
    stmt = select(Customer)
    filtered_stmt = repo._apply_billing_visibility_filter(stmt)
    sql_str = str(filtered_stmt.compile(compile_kwargs={"literal_binds": False}))

    # Verify that Customer.is_dependant, customer_relationships and show_child_customers_in_billing are in AST
    assert "is_dependant" in sql_str
    assert "customer_relationships" in sql_str
    assert "show_child_customers_in_billing" in sql_str


@pytest.mark.asyncio
async def test_checkout_rejects_child_customer_when_parent_visibility_disabled():
    """Requirement 3 & 4: Direct API checkout must reject billing for child customer whose parent disabled visibility."""
    session = AsyncMock()

    child_cust = SimpleNamespace(
        id="cust-child-01",
        name="Reliance Retail Store 101",
        company_id="COMP-001",
        is_dependant=True,
        is_deleted=False,
    )
    parent_cust = SimpleNamespace(
        id="cust-parent-01",
        name="Reliance Retail Limited",
        company_id="COMP-001",
        is_dependant=False,
        show_child_customers_in_billing=False,  # Visibility DISABLED
        is_deleted=False,
    )
    rel = SimpleNamespace(
        parent_customer_id=parent_cust.id,
        dependant_customer_id=child_cust.id,
        is_deleted=False,
    )

    # First execute: customer query returns child_cust
    # Second execute: rel_stmt query returns rel and parent_cust
    session.execute.side_effect = [
        MagicMock(scalars=lambda: MagicMock(first=lambda: child_cust)),
        MagicMock(all=lambda: [(rel, parent_cust)]),
    ]

    req = CanonicalPostingRequest(
        context=CanonicalPostingContext(
            company_id="COMP-001",
            branch_id="MAIN",
            idempotency_key="idemp-test-001",
        ),
        customer_id=child_cust.id,
        items=[
            CanonicalPostingLineItem(code="SHOE-001", quantity=Decimal("1.00"), unit_price=Decimal("100.00"))
        ],
    )

    with pytest.raises(HTTPException) as exc_info:
        await HeadlessBillingCore.calculate_billing(
            session=session,
            req=req,
        )

    assert exc_info.value.status_code == 400
    assert "SMRITI-CUST-042" in exc_info.value.detail
    assert "child customer visibility is disabled" in exc_info.value.detail


@pytest.mark.asyncio
async def test_checkout_allows_child_customer_when_parent_visibility_enabled():
    """Requirement 3 & 4: Child customer can be billed when parent visibility is explicitly enabled."""
    session = AsyncMock()

    child_cust = SimpleNamespace(
        id="cust-child-02",
        name="Reliance Retail Store 102",
        company_id="COMP-001",
        is_dependant=True,
        is_deleted=False,
        gst_number="27AAACR1921R1Z5",
    )
    parent_cust = SimpleNamespace(
        id="cust-parent-01",
        name="Reliance Retail Limited",
        company_id="COMP-001",
        is_dependant=False,
        show_child_customers_in_billing=True,  # Visibility ENABLED
        is_deleted=False,
    )
    rel = SimpleNamespace(
        parent_customer_id=parent_cust.id,
        dependant_customer_id=child_cust.id,
        is_deleted=False,
    )

    # Session mock resolves customer and relationship without raising SMRITI-CUST-042
    call_count = 0
    def dynamic_execute(*args, **kwargs):
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            return MagicMock(scalars=lambda: MagicMock(first=lambda: child_cust))
        elif call_count == 2:
            return MagicMock(all=lambda: [(rel, parent_cust)])
        return MagicMock(scalars=lambda: MagicMock(first=lambda: None), first=lambda: None, all=lambda: [])
    session.execute.side_effect = dynamic_execute

    req = CanonicalPostingRequest(
        context=CanonicalPostingContext(
            company_id="COMP-001",
            branch_id="MAIN",
            idempotency_key="idemp-test-002",
        ),
        customer_id=child_cust.id,
        items=[
            CanonicalPostingLineItem(code="SHOE-001", quantity=Decimal("1.00"), unit_price=Decimal("100.00"))
        ],
    )

    # Mock other helper dependencies in HeadlessBillingCore
    session.get.side_effect = lambda model, ident: SimpleNamespace(
        id=ident,
        gstin="27AAACC0000A1Z5",
        gst_number="27AAACC0000A1Z5",
        state_code="27",
    )

    # Should not raise SMRITI-CUST-042
    try:
        await HeadlessBillingCore.calculate_billing(
            session=session,
            req=req,
        )
    except HTTPException as e:
        # If it fails later on missing products or taxes, that's expected in isolated mock,
        # but it must NOT fail with SMRITI-CUST-042.
        assert "SMRITI-CUST-042" not in e.detail
