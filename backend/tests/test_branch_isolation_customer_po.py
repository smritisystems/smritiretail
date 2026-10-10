"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.16.0
Created      : 2026-09-08
Modified     : 2026-09-08
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import sys
import uuid
import pytest
from datetime import date
from decimal import Decimal
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from fastapi import HTTPException
from sqlalchemy import delete, select

from app.api.deps import TenantContext
from app.db.session import get_company_sessionmaker
from app.models.tenant import Company, Branch
from app.models.crm import Customer, CustomerGroup
from app.models.inventory import Product
from app.models.customer_po import (
    CustomerPOInvoiceAllocation,
    CustomerPurchaseOrder,
    CustomerPurchaseOrderLine,
)
from app.schemas.customer_po import CustomerPOCreate, CustomerPOLineCreate
from app.services.customer_po import CustomerPOService


@pytest.fixture
async def isolation_test_fixture():
    """Setup isolated companies, branches, customers, and product for branch isolation testing."""
    suffix = uuid.uuid4().hex[:6]
    session_factory = get_company_sessionmaker("smriti001")

    # Primary company
    primary_company_id = "COMP-001"
    branch_a_id = f"br-a-{suffix}"
    branch_b_id = f"br-b-{suffix}"

    # Secondary company (to test cross-company leakage)
    secondary_company_id = f"comp-iso2-{suffix}"
    secondary_branch_a_id = f"br-iso2-a-{suffix}"

    # Product in COMP-001 (company-wide, branch_id IS NULL)
    prod_id = f"prod-iso-{suffix}"
    prod_code = f"SKU-ISO-{suffix}"

    # Customer 1: Same Company (COMP-001), Company-Wide (branch_id IS NULL)
    cust_comp_wide_id = f"cust-cwide-{suffix}"

    # Customer 2: Same Company (COMP-001), Specific to Branch B (branch_id = branch_b_id)
    cust_branch_b_id = f"cust-brb-{suffix}"

    # Customer 3: Same Company (COMP-001), Specific to Branch A (branch_id = branch_a_id)
    cust_branch_a_id = f"cust-bra-{suffix}"

    # Customer 4: Different Company (COMP-002), Company-Wide (branch_id IS NULL)
    cust_other_co_cwide_id = f"cust-other-cwide-{suffix}"

    # Customer 5: Different Company (COMP-002), Branch A
    cust_other_co_bra_id = f"cust-other-bra-{suffix}"

    cg_1_id = f"cg-iso1-{suffix}"
    cg_2_id = f"cg-iso2-{suffix}"

    async with session_factory() as session:
        # 1. Create Secondary Company
        other_co = Company(
            id=secondary_company_id,
            name=f"Other Company {suffix}",
            is_active=True,
            is_deleted=False,
        )
        session.add(other_co)
        await session.flush()

        # 2. Create Branches
        br_a = Branch(
            id=branch_a_id,
            company_id=primary_company_id,
            code=f"BRA_{suffix}",
            name=f"Branch A {suffix}",
            is_active=True,
            is_deleted=False,
        )
        br_b = Branch(
            id=branch_b_id,
            company_id=primary_company_id,
            code=f"BRB_{suffix}",
            name=f"Branch B {suffix}",
            is_active=True,
            is_deleted=False,
        )
        br_other = Branch(
            id=secondary_branch_a_id,
            company_id=secondary_company_id,
            code=f"BRO_{suffix}",
            name=f"Other Co Branch A {suffix}",
            is_active=True,
            is_deleted=False,
        )
        session.add_all([br_a, br_b, br_other])
        await session.flush()

        # 3. Create Customer Groups
        cg1 = CustomerGroup(
            id=cg_1_id,
            company_id=primary_company_id,
            name=f"ISO Group 1 {suffix}",
            is_active=True,
            is_deleted=False,
        )
        cg2 = CustomerGroup(
            id=cg_2_id,
            company_id=secondary_company_id,
            name=f"ISO Group 2 {suffix}",
            is_active=True,
            is_deleted=False,
        )
        session.add_all([cg1, cg2])
        await session.flush()

        # 4. Create Product (company-wide, branch_id IS NULL) in COMP-001
        product = Product(
            id=prod_id,
            company_id=primary_company_id,
            branch_id=None,
            code=prod_code,
            barcode=prod_code,
            name=f"ISO Product {suffix}",
            category="General",
            brand="Generic",
            buying_price=Decimal("100.00"),
            cost_price=Decimal("100.00"),
            price=Decimal("150.00"),
            mrp=Decimal("150.00"),
            gst_percentage=Decimal("18.00"),
            is_active=True,
            is_deleted=False,
        )
        session.add(product)

        # 5. Customer 1: Same company, company-wide (branch_id IS NULL)
        c1 = Customer(
            id=cust_comp_wide_id,
            company_id=primary_company_id,
            branch_id=None,
            name=f"Company-Wide Customer {suffix}",
            customer_group_id=cg_1_id,
            is_active=True,
            is_deleted=False,
        )
        # 6. Customer 2: Same company, Branch B specific
        c2 = Customer(
            id=cust_branch_b_id,
            company_id=primary_company_id,
            branch_id=branch_b_id,
            name=f"Branch B Customer {suffix}",
            customer_group_id=cg_1_id,
            is_active=True,
            is_deleted=False,
        )
        # 7. Customer 3: Same company, Branch A specific
        c3 = Customer(
            id=cust_branch_a_id,
            company_id=primary_company_id,
            branch_id=branch_a_id,
            name=f"Branch A Customer {suffix}",
            customer_group_id=cg_1_id,
            is_active=True,
            is_deleted=False,
        )
        # 8. Customer 4: Other company, company-wide (branch_id IS NULL)
        c4 = Customer(
            id=cust_other_co_cwide_id,
            company_id=secondary_company_id,
            branch_id=None,
            name=f"Other Co CW Customer {suffix}",
            customer_group_id=cg_2_id,
            is_active=True,
            is_deleted=False,
        )
        # 9. Customer 5: Other company, Branch specific
        c5 = Customer(
            id=cust_other_co_bra_id,
            company_id=secondary_company_id,
            branch_id=secondary_branch_a_id,
            name=f"Other Co Br Customer {suffix}",
            customer_group_id=cg_2_id,
            is_active=True,
            is_deleted=False,
        )
        session.add_all([c1, c2, c3, c4, c5])

        await session.commit()

    yield {
        "suffix": suffix,
        "primary_company_id": primary_company_id,
        "branch_a_id": branch_a_id,
        "branch_b_id": branch_b_id,
        "secondary_company_id": secondary_company_id,
        "secondary_branch_a_id": secondary_branch_a_id,
        "prod_id": prod_id,
        "cust_comp_wide_id": cust_comp_wide_id,
        "cust_branch_b_id": cust_branch_b_id,
        "cust_branch_a_id": cust_branch_a_id,
        "cust_other_co_cwide_id": cust_other_co_cwide_id,
        "cust_other_co_bra_id": cust_other_co_bra_id,
    }

    # Teardown
    async with session_factory() as session:
        # 1. Delete allocations referencing test POs/companies
        await session.execute(
            delete(CustomerPOInvoiceAllocation).where(
                CustomerPOInvoiceAllocation.company_id.in_([primary_company_id, secondary_company_id])
            )
        )
        pos = (await session.execute(
            select(CustomerPurchaseOrder.id).where(
                CustomerPurchaseOrder.company_id.in_([primary_company_id, secondary_company_id])
            )
        )).scalars().all()
        for p in pos:
            await session.execute(delete(CustomerPurchaseOrderLine).where(CustomerPurchaseOrderLine.customer_po_id == p))
            await session.execute(delete(CustomerPurchaseOrder).where(CustomerPurchaseOrder.id == p))

        await session.execute(delete(Customer).where(Customer.id.in_([
            cust_comp_wide_id, cust_branch_b_id, cust_branch_a_id, cust_other_co_cwide_id, cust_other_co_bra_id
        ])))
        await session.execute(delete(Product).where(Product.id == prod_id))
        await session.execute(delete(CustomerGroup).where(CustomerGroup.id.in_([cg_1_id, cg_2_id])))
        await session.execute(delete(Branch).where(Branch.id.in_([branch_a_id, branch_b_id, secondary_branch_a_id])))
        await session.execute(delete(Company).where(Company.id == secondary_company_id))
        await session.commit()


@pytest.mark.asyncio
async def test_same_company_company_level_customer_allowed(isolation_test_fixture):
    """
    PROVE RULE 1:
    A company-level customer (branch_id IS NULL) in the same company (COMP-001)
    IS ALLOWED when operating under branch context 'branch_a_id'.
    """
    ctx = TenantContext(
        company_id=isolation_test_fixture["primary_company_id"],
        branch_id=isolation_test_fixture["branch_a_id"]
    )
    session_factory = get_company_sessionmaker("smriti001")

    payload = CustomerPOCreate(
        customer_id=isolation_test_fixture["cust_comp_wide_id"],
        po_number=f"PO-CWIDE-{isolation_test_fixture['suffix']}",
        po_date=date.today(),
        lines=[
            CustomerPOLineCreate(
                line_number="1",
                product_id=isolation_test_fixture["prod_id"],
                code="SKU-1",
                description="Test Line",
                quantity_ordered=Decimal("10.0000"),
                unit_price=Decimal("150.00"),
            )
        ],
    )

    async with session_factory() as session:
        service = CustomerPOService(session, ctx)
        po = await service.create(payload)
        assert po is not None
        assert po.id is not None
        assert po.customer_id == isolation_test_fixture["cust_comp_wide_id"]
        assert po.branch_id == isolation_test_fixture["branch_a_id"]
        assert po.company_id == isolation_test_fixture["primary_company_id"]
        assert po.ordered_quantity == Decimal("10.0000")


@pytest.mark.asyncio
async def test_another_branch_specific_customer_rejected(isolation_test_fixture):
    """
    PROVE RULE 2:
    A branch-specific customer belonging to 'branch_b_id'
    MUST BE REJECTED when operating under branch context 'branch_a_id'.
    """
    ctx = TenantContext(
        company_id=isolation_test_fixture["primary_company_id"],
        branch_id=isolation_test_fixture["branch_a_id"]
    )
    session_factory = get_company_sessionmaker("smriti001")

    payload = CustomerPOCreate(
        customer_id=isolation_test_fixture["cust_branch_b_id"],
        po_number=f"PO-BRB-{isolation_test_fixture['suffix']}",
        po_date=date.today(),
        lines=[
            CustomerPOLineCreate(
                line_number="1",
                product_id=isolation_test_fixture["prod_id"],
                code="SKU-1",
                description="Test Line",
                quantity_ordered=Decimal("5.0000"),
                unit_price=Decimal("150.00"),
            )
        ],
    )

    async with session_factory() as session:
        service = CustomerPOService(session, ctx)
        with pytest.raises(HTTPException) as exc_info:
            await service.create(payload)

        assert exc_info.value.status_code == 404
        assert "Customer not found in the active company" in exc_info.value.detail


@pytest.mark.asyncio
async def test_null_branch_cross_company_strictly_rejected(isolation_test_fixture):
    """
    PROVE RULE 3:
    A company-wide customer (branch_id IS NULL) belonging to another company ('COMP-002')
    MUST BE REJECTED when operating under 'COMP-001'.
    Proves null-branch records CANNOT bypass company isolation.
    """
    ctx = TenantContext(
        company_id=isolation_test_fixture["primary_company_id"],
        branch_id=isolation_test_fixture["branch_a_id"]
    )
    session_factory = get_company_sessionmaker("smriti001")

    payload = CustomerPOCreate(
        customer_id=isolation_test_fixture["cust_other_co_cwide_id"],
        po_number=f"PO-OTHER-CWIDE-{isolation_test_fixture['suffix']}",
        po_date=date.today(),
        lines=[
            CustomerPOLineCreate(
                line_number="1",
                product_id=isolation_test_fixture["prod_id"],
                code="SKU-1",
                description="Test Line",
                quantity_ordered=Decimal("5.0000"),
                unit_price=Decimal("150.00"),
            )
        ],
    )

    async with session_factory() as session:
        service = CustomerPOService(session, ctx)
        with pytest.raises(HTTPException) as exc_info:
            await service.create(payload)

        assert exc_info.value.status_code == 404
        assert "Customer not found in the active company" in exc_info.value.detail


@pytest.mark.asyncio
async def test_cross_company_branch_customer_strictly_rejected(isolation_test_fixture):
    """
    PROVE RULE 4:
    A customer belonging to another company ('secondary_company_id')
    MUST BE REJECTED when operating under 'primary_company_id'.
    """
    ctx = TenantContext(
        company_id=isolation_test_fixture["primary_company_id"],
        branch_id=isolation_test_fixture["branch_a_id"]
    )
    session_factory = get_company_sessionmaker("smriti001")

    payload = CustomerPOCreate(
        customer_id=isolation_test_fixture["cust_other_co_bra_id"],
        po_number=f"PO-OTHER-BRA-{isolation_test_fixture['suffix']}",
        po_date=date.today(),
        lines=[
            CustomerPOLineCreate(
                line_number="1",
                product_id=isolation_test_fixture["prod_id"],
                code="SKU-1",
                description="Test Line",
                quantity_ordered=Decimal("5.0000"),
                unit_price=Decimal("150.00"),
            )
        ],
    )

    async with session_factory() as session:
        service = CustomerPOService(session, ctx)
        with pytest.raises(HTTPException) as exc_info:
            await service.create(payload)

        assert exc_info.value.status_code == 404
        assert "Customer not found in the active company" in exc_info.value.detail


@pytest.mark.asyncio
async def test_same_branch_specific_customer_allowed(isolation_test_fixture):
    """
    PROVE RULE 5:
    A branch-specific customer belonging to 'branch_a_id'
    IS ALLOWED when operating under branch context 'branch_a_id'.
    """
    ctx = TenantContext(
        company_id=isolation_test_fixture["primary_company_id"],
        branch_id=isolation_test_fixture["branch_a_id"]
    )
    session_factory = get_company_sessionmaker("smriti001")

    payload = CustomerPOCreate(
        customer_id=isolation_test_fixture["cust_branch_a_id"],
        po_number=f"PO-BRA-{isolation_test_fixture['suffix']}",
        po_date=date.today(),
        lines=[
            CustomerPOLineCreate(
                line_number="1",
                product_id=isolation_test_fixture["prod_id"],
                code="SKU-1",
                description="Test Line",
                quantity_ordered=Decimal("8.0000"),
                unit_price=Decimal("150.00"),
            )
        ],
    )

    async with session_factory() as session:
        service = CustomerPOService(session, ctx)
        po = await service.create(payload)
        assert po is not None
        assert po.id is not None
        assert po.customer_id == isolation_test_fixture["cust_branch_a_id"]
        assert po.branch_id == isolation_test_fixture["branch_a_id"]
        assert po.company_id == isolation_test_fixture["primary_company_id"]
        assert po.ordered_quantity == Decimal("8.0000")
