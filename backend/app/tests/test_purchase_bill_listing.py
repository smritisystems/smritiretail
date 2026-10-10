"""
Project      : SMRITI Retail OS
Repository   : SMRITIRetailNX
Organization : AITDL NETWORKS

Founders

* Pushpa Devi Jawahar Mallah — Founder & Chairperson
* Jawahar Ramkripal Mallah  — Founder, CEO & Chief Software Architect
* Websites: aitdl.com | erpnbook.com | smritibooks.com

* Version    : 6.49.8
* Created    : 2026-10-02
* Modified   : 2026-10-02
* Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
* License    : Proprietary Commercial Software
Classification: Internal

Automated Test Battery: Procurement Phase 2.6 — Purchase Bill Listing & Schema Parity
Verifies:
  1. list_purchase_bills returns all tenant purchase bills
  2. list_purchase_bills correctly filters by supplier_id
  3. list_purchase_bills correctly filters by status
  4. PurchaseBillResponse schema serializes due_date and paid_amount
  5. get_purchase_bill retrieves correct bill by ID
  6. get_purchase_bill raises 404 on missing bill
"""

import uuid
from decimal import Decimal
from datetime import datetime, timezone, date, timedelta
import pytest
from fastapi import HTTPException

from app.models.tenant import Company, Branch
from app.models.purchase import Supplier, PurchaseBill
from app.api.deps import TenantContext
from app.schemas.purchase import PurchaseBillResponse
from app.services.purchase import PurchaseService

pytestmark = pytest.mark.asyncio


@pytest.fixture
async def setup_test_bills(db_session):
    test_id = uuid.uuid4().hex[:8]
    company = Company(
        id=f"cmp_bill_{test_id}",
        name=f"Bill Test Company {test_id}",
        company_code=f"CMP{test_id.upper()[:8]}",
        is_active=True,
        is_deleted=False,
    )
    branch = Branch(
        id=f"br_bill_{test_id}",
        company_id=company.id,
        name=f"Bill Test Branch {test_id}",
        code=f"BR{test_id.upper()[:8]}",
        is_active=True,
        is_deleted=False,
    )
    db_session.add_all([company, branch])
    await db_session.commit()

    supplier1 = Supplier(
        id=f"sup1_{test_id}",
        company_id=company.id,
        branch_id=branch.id,
        name=f"Supplier One {test_id}",
        code=f"S1_{test_id[:4]}".upper(),
        outstanding=Decimal("50000.00"),
        is_active=True,
        is_deleted=False,
    )
    supplier2 = Supplier(
        id=f"sup2_{test_id}",
        company_id=company.id,
        branch_id=branch.id,
        name=f"Supplier Two {test_id}",
        code=f"S2_{test_id[:4]}".upper(),
        outstanding=Decimal("20000.00"),
        is_active=True,
        is_deleted=False,
    )
    db_session.add_all([supplier1, supplier2])
    await db_session.commit()

    today = date.today()
    bill1 = PurchaseBill(
        id=f"pb1_{test_id}",
        bill_no=f"BILL-001-{test_id}",
        supplier_id=supplier1.id,
        company_id=company.id,
        branch_id=branch.id,
        bill_date=today - timedelta(days=10),
        due_date=today + timedelta(days=20),
        taxable_amount=Decimal("10000.00"),
        tax_amount=Decimal("1800.00"),
        total_amount=Decimal("11800.00"),
        paid_amount=Decimal("1800.00"),
        status="POSTED",
        is_deleted=False,
    )
    bill2 = PurchaseBill(
        id=f"pb2_{test_id}",
        bill_no=f"BILL-002-{test_id}",
        supplier_id=supplier1.id,
        company_id=company.id,
        branch_id=branch.id,
        bill_date=today - timedelta(days=5),
        due_date=today + timedelta(days=25),
        taxable_amount=Decimal("20000.00"),
        tax_amount=Decimal("3600.00"),
        total_amount=Decimal("23600.00"),
        paid_amount=Decimal("23600.00"),
        status="PAID",
        is_deleted=False,
    )
    bill3 = PurchaseBill(
        id=f"pb3_{test_id}",
        bill_no=f"BILL-003-{test_id}",
        supplier_id=supplier2.id,
        company_id=company.id,
        branch_id=branch.id,
        bill_date=today,
        due_date=today + timedelta(days=30),
        taxable_amount=Decimal("5000.00"),
        tax_amount=Decimal("900.00"),
        total_amount=Decimal("5900.00"),
        paid_amount=Decimal("0.00"),
        status="POSTED",
        is_deleted=False,
    )
    db_session.add_all([bill1, bill2, bill3])
    await db_session.commit()

    tenant_ctx = TenantContext(
        company_id=company.id,
        branch_id=branch.id,
    )

    return {
        "tenant": tenant_ctx,
        "supplier1": supplier1,
        "supplier2": supplier2,
        "bill1": bill1,
        "bill2": bill2,
        "bill3": bill3,
    }


async def test_list_all_tenant_bills(db_session, setup_test_bills):
    data = setup_test_bills
    service = PurchaseService(db_session, data["tenant"])
    bills = await service.list_purchase_bills()
    assert len(bills) == 3
    bill_ids = [b.id for b in bills]
    assert data["bill1"].id in bill_ids
    assert data["bill2"].id in bill_ids
    assert data["bill3"].id in bill_ids


async def test_list_bills_by_supplier(db_session, setup_test_bills):
    data = setup_test_bills
    service = PurchaseService(db_session, data["tenant"])
    bills = await service.list_purchase_bills(supplier_id=data["supplier1"].id)
    assert len(bills) == 2
    for b in bills:
        assert b.supplier_id == data["supplier1"].id


async def test_list_bills_by_status(db_session, setup_test_bills):
    data = setup_test_bills
    service = PurchaseService(db_session, data["tenant"])
    posted_bills = await service.list_purchase_bills(status="POSTED")
    assert len(posted_bills) == 2
    for b in posted_bills:
        assert b.status == "POSTED"

    paid_bills = await service.list_purchase_bills(status="PAID")
    assert len(paid_bills) == 1
    assert paid_bills[0].id == data["bill2"].id


async def test_purchase_bill_response_schema(db_session, setup_test_bills):
    data = setup_test_bills
    service = PurchaseService(db_session, data["tenant"])
    bill = await service.get_purchase_bill(data["bill1"].id)
    resp = PurchaseBillResponse.model_validate(bill)

    assert resp.id == data["bill1"].id
    assert resp.bill_no == data["bill1"].bill_no
    assert resp.due_date == data["bill1"].due_date
    assert resp.paid_amount == Decimal("1800.00")
    assert resp.total_amount == Decimal("11800.00")
    assert resp.status == "POSTED"


async def test_get_purchase_bill_by_id(db_session, setup_test_bills):
    data = setup_test_bills
    service = PurchaseService(db_session, data["tenant"])
    bill = await service.get_purchase_bill(data["bill2"].id)
    assert bill.id == data["bill2"].id
    assert bill.status == "PAID"


async def test_get_purchase_bill_not_found(db_session, setup_test_bills):
    data = setup_test_bills
    service = PurchaseService(db_session, data["tenant"])
    with pytest.raises(HTTPException) as exc:
        await service.get_purchase_bill("non_existent_bill_id")
    assert exc.value.status_code == 404
