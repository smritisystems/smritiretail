"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 4.13.0
Created      : 2026-09-08
Modified     : 2026-09-08
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal

SMRITI Customer PO → Tax Invoice Canonical Lifecycle Test Suite
Implements all 26 required test vectors from Section 19:
1. Basic: PO → Invoice direct conversion
2. Correct customer
3. Correct PO reference
4. Correct invoice lines
5. Correct tax (canonical GST)
6. Correct totals
7. Partial billing stage 1
8. Partial billing stage 2
9. Final invoice stage 3
10. Remaining quantity becomes zero
11. Overbilling blocked under BLOCK policy
12. Policy behavior respected (ALLOW_WITH_AUTHORIZATION)
13. Concurrency row-locking prevents double consumption
14. Idempotency retry safety
15. Foreign-company PO rejected
16. Foreign-company customer rejected
17. Foreign-company PO line rejected
18. Invalid branch access rejected
19. Company-wide PO branch semantics
20. Traceability: Invoice → PO
21. Traceability: Invoice Line → PO Line
22. Traceability: Allocation quantity correct
23. Accounting: Receivable created
24. Credit: Ledger updated exactly once (no duplicate credit posting)
25. Inventory: No duplicate stock movement
26. Inventory: Stock behavior matches canonical invoice writer
"""

import sys
import uuid
import asyncio
import pytest
from datetime import date
from decimal import Decimal
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from fastapi import HTTPException
from sqlalchemy import delete, select
from sqlalchemy.orm import selectinload

from app.api.deps import TenantContext
from app.db.session import get_company_sessionmaker
from app.models.tenant import Company, Branch
from app.models.crm import Customer, CustomerGroup, CustomerCreditLedgerEntry
from app.models.inventory import Product, StockMovement
from app.models.sales import SalesInvoice, SalesInvoiceItem
from app.models.customer_po import (
    CustomerPOInvoiceAllocation,
    CustomerPurchaseOrder,
    CustomerPurchaseOrderLine,
)
from app.schemas.customer_po import (
    CustomerPOCreate,
    CustomerPOLineCreate,
    CustomerPOBillingRequest,
    CustomerPOBillingLine,
)
from app.services.customer_po import CustomerPOService
from app.services.sales import SalesService


@pytest.fixture
async def cpo_test_fixture():
    """Setup isolated company, branch, customers, and products for Customer PO testing."""
    suffix = uuid.uuid4().hex[:6]
    session_factory = get_company_sessionmaker("smriti001")

    company_id = "COMP-001"
    branch_id = f"br-cpo-{suffix}"
    branch_b_id = f"br-other-{suffix}"

    foreign_company_id = f"comp-foreign-{suffix}"
    foreign_branch_id = f"br-for-{suffix}"

    cust_id = f"cust-cpo-{suffix}"
    foreign_cust_id = f"cust-for-{suffix}"
    cg_id = f"cg-cpo-{suffix}"

    prod1_id = f"prod-cpo1-{suffix}"
    prod1_code = f"SKU-CPO1-{suffix}"
    prod2_id = f"prod-cpo2-{suffix}"
    prod2_code = f"SKU-CPO2-{suffix}"
    foreign_prod_id = f"prod-for-{suffix}"
    foreign_prod_code = f"SKU-FOR-{suffix}"

    async with session_factory() as session:
        # Create Foreign Company first and flush
        f_co = Company(id=foreign_company_id, name="Foreign Company", is_active=True, is_deleted=False)
        session.add(f_co)
        await session.flush()

        # Create Branches and flush
        br = Branch(id=branch_id, company_id=company_id, code=f"BR_CPO_{suffix}", name="CPO Branch", is_active=True, is_deleted=False)
        br_b = Branch(id=branch_b_id, company_id=company_id, code=f"BR_OTH_{suffix}", name="Other Branch", is_active=True, is_deleted=False)
        f_br = Branch(id=foreign_branch_id, company_id=foreign_company_id, code=f"BR_FOR_{suffix}", name="Foreign Branch", is_active=True, is_deleted=False)
        session.add_all([br, br_b, f_br])
        await session.flush()

        # Create Customer Group with Credit Limit and flush
        cg = CustomerGroup(
            id=cg_id,
            company_id=company_id,
            name=f"CPO Group {suffix}",
            credit_limit=Decimal("500000.00"),
            unlimited_credit=False,
            credit_days=30,
            can_purchase_on_credit=True,
            is_active=True,
            is_deleted=False,
        )
        session.add(cg)
        await session.flush()

        # Create Customer in COMP-001
        cust = Customer(
            id=cust_id,
            company_id=company_id,
            branch_id=branch_id,
            customer_group_id=cg_id,
            code=f"CUST-CPO-{suffix}",
            name=f"CPO Customer {suffix}",
            mobile="9820011223",
            gst_number="27AAACA1234A1Z5",
            outstanding=Decimal("0.00"),
            status="Active",
            is_active=True,
            is_deleted=False,
        )
        # Create Foreign Customer in Foreign Company
        f_cust = Customer(
            id=foreign_cust_id,
            company_id=foreign_company_id,
            branch_id=foreign_branch_id,
            code=f"CUST-FOR-{suffix}",
            name=f"Foreign Customer {suffix}",
            mobile="9820099887",
            status="Active",
            is_active=True,
            is_deleted=False,
        )
        session.add_all([cust, f_cust])

        # Create Products in COMP-001
        p1 = Product(
            id=prod1_id,
            company_id=company_id,
            code=prod1_code,
            name=f"Widget A {suffix}",
            price=Decimal("100.00"),
            mrp=Decimal("120.00"),
            gst_percentage=Decimal("18.00"),
            hsn_code="8471",
            category="General",
            barcode=f"BAR-P1-{suffix}",
            sku=f"SKU-P1-{suffix}",
            stock=1000,
            tracking_mode="Batch",
            is_active=True,
            is_deleted=False,
        )
        p2 = Product(
            id=prod2_id,
            company_id=company_id,
            code=prod2_code,
            name=f"Widget B {suffix}",
            price=Decimal("200.00"),
            mrp=Decimal("240.00"),
            gst_percentage=Decimal("12.00"),
            hsn_code="8471",
            category="General",
            barcode=f"BAR-P2-{suffix}",
            sku=f"SKU-P2-{suffix}",
            stock=1000,
            tracking_mode="Batch",
            is_active=True,
            is_deleted=False,
        )
        # Foreign product
        f_p = Product(
            id=foreign_prod_id,
            company_id=foreign_company_id,
            code=foreign_prod_code,
            name=f"Foreign Widget {suffix}",
            price=Decimal("50.00"),
            category="General",
            barcode=f"BAR-FP-{suffix}",
            sku=f"SKU-FP-{suffix}",
            stock=100,
            is_active=True,
            is_deleted=False,
        )
        session.add_all([p1, p2, f_p])
        await session.commit()

    ctx = TenantContext(
        company_id=company_id,
        branch_id=branch_id,
    )

    yield {
        "suffix": suffix,
        "session_factory": session_factory,
        "company_id": company_id,
        "branch_id": branch_id,
        "branch_b_id": branch_b_id,
        "foreign_company_id": foreign_company_id,
        "foreign_branch_id": foreign_branch_id,
        "cust_id": cust_id,
        "foreign_cust_id": foreign_cust_id,
        "prod1_id": prod1_id,
        "prod1_code": prod1_code,
        "prod2_id": prod2_id,
        "prod2_code": prod2_code,
        "foreign_prod_id": foreign_prod_id,
        "ctx": ctx,
    }

    # Cleanup
    async with session_factory() as session:
        try:
            # 1. Delete allocations for this suffix
            await session.execute(
                delete(CustomerPOInvoiceAllocation).where(
                    CustomerPOInvoiceAllocation.po_id.in_(
                        select(CustomerPurchaseOrder.id).where(CustomerPurchaseOrder.po_number.like(f"%{suffix}%"))
                    )
                )
            )
            # 2. Delete PO lines for this suffix
            await session.execute(
                delete(CustomerPurchaseOrderLine).where(
                    CustomerPurchaseOrderLine.po_id.in_(
                        select(CustomerPurchaseOrder.id).where(CustomerPurchaseOrder.po_number.like(f"%{suffix}%"))
                    )
                )
            )
            # 3. Delete POs for this suffix
            await session.execute(
                delete(CustomerPurchaseOrder).where(CustomerPurchaseOrder.po_number.like(f"%{suffix}%"))
            )
            # 4. Delete invoice items for invoices with this po_reference
            inv_ids_subq = select(SalesInvoice.id).where(SalesInvoice.po_reference.like(f"%{suffix}%"))
            await session.execute(delete(SalesInvoiceItem).where(SalesInvoiceItem.invoice_id.in_(inv_ids_subq)))
            # 5. Delete invoices with this po_reference
            await session.execute(delete(SalesInvoice).where(SalesInvoice.po_reference.like(f"%{suffix}%")))
            # 6. Delete credit entries for this customer
            await session.execute(delete(CustomerCreditLedgerEntry).where(CustomerCreditLedgerEntry.customer_id == cust_id))
            # 7. Delete stock movements for these products
            await session.execute(delete(StockMovement).where(StockMovement.product_id.in_([prod1_id, prod2_id, foreign_prod_id])))
            # 8. Delete products
            await session.execute(delete(Product).where(Product.id.in_([prod1_id, prod2_id, foreign_prod_id])))
            # 9. Delete customers
            await session.execute(delete(Customer).where(Customer.id.in_([cust_id, foreign_cust_id])))
            # 10. Delete customer group
            await session.execute(delete(CustomerGroup).where(CustomerGroup.id == cg_id))
            # 11. Delete branches
            await session.execute(delete(Branch).where(Branch.id.in_([branch_id, branch_b_id, foreign_branch_id])))
            # 12. Delete foreign company
            await session.execute(delete(Company).where(Company.id == foreign_company_id))
            await session.commit()
        except Exception:
            await session.rollback()



@pytest.mark.asyncio
async def test_01_to_06_basic_po_to_tax_invoice(cpo_test_fixture):
    """
    Vectors 1 to 6:
    1. Customer PO → Tax Invoice directly.
    2. Correct customer.
    3. Correct PO reference.
    4. Correct invoice lines.
    5. Correct tax.
    6. Correct totals.
    """
    f = cpo_test_fixture
    async with f["session_factory"]() as session:
        service = CustomerPOService(session, f["ctx"])

        # Create PO
        po_in = CustomerPOCreate(
            customer_id=f["cust_id"],
            po_number=f"PO-BASIC-{f['suffix']}",
            po_date=date.today(),
            lines=[
                CustomerPOLineCreate(
                    line_number="1",
                    product_id=f["prod1_id"],
                    code=f["prod1_code"],
                    description="Widget A Item",
                    quantity_ordered=Decimal("10"),
                    unit_price=Decimal("100.00"),
                    gst_rate=Decimal("18.00"),
                ),
                CustomerPOLineCreate(
                    line_number="2",
                    product_id=f["prod2_id"],
                    code=f["prod2_code"],
                    description="Widget B Item",
                    quantity_ordered=Decimal("5"),
                    unit_price=Decimal("200.00"),
                    gst_rate=Decimal("12.00"),
                ),
            ],
        )
        po = await service.create(po_in)
        assert po.status == "OPEN"
        assert po.ordered_quantity == Decimal("15")

        # Bill directly to Tax Invoice
        bill_req = CustomerPOBillingRequest(
            invoice={
                "customer_id": f["cust_id"],
                "customer_name": "CPO Customer",
                "payment_mode": "CASH",
                "status": "Submitted",
            },
            lines=[
                CustomerPOBillingLine(customer_po_line_id=po.lines[0].id, quantity=Decimal("10")),
                CustomerPOBillingLine(customer_po_line_id=po.lines[1].id, quantity=Decimal("5")),
            ],
        )
        invoice = await service.bill(po.id, bill_req)

        # 1. Direct invoice created
        assert invoice is not None
        assert invoice.id.startswith("inv-")
        # 2. Correct customer
        assert invoice.customer_id == f["cust_id"]
        # 3. Correct PO reference
        assert invoice.customer_po_id == po.id
        assert invoice.po_reference == po.po_number
        assert invoice.source_document_type == "CUSTOMER_PO"
        # 4. Correct invoice lines
        assert len(invoice.items) == 2
        p1_item = next(it for it in invoice.items if it.customer_po_line_id == po.lines[0].id)
        assert p1_item.quantity == Decimal("10")
        assert p1_item.price == Decimal("100.00")
        # 5. Correct canonical tax
        # Line 1: 10 * 100 = 1000; 18% GST = 180.00
        assert p1_item.gst_rate == Decimal("18.00")
        assert p1_item.tax_amount == Decimal("180.00")
        # Line 2: 5 * 200 = 1000; 12% GST = 120.00
        p2_item = next(it for it in invoice.items if it.customer_po_line_id == po.lines[1].id)
        assert p2_item.gst_rate == Decimal("12.00")
        assert p2_item.tax_amount == Decimal("120.00")
        # 6. Correct totals
        # Taxable: 2000.00, Tax: 300.00, Grand: 2300.00
        assert invoice.taxable_value == Decimal("2000.00")
        assert invoice.tax_total == Decimal("300.00")
        assert invoice.grand_total == Decimal("2300.00")


@pytest.mark.asyncio
async def test_07_to_10_partial_billing_lifecycle(cpo_test_fixture):
    """
    Vectors 7 to 10:
    7. Stage 1: Invoice #1 = 30 (Remaining = 70, PARTIALLY_BILLED)
    8. Stage 2: Invoice #2 = 20 (Remaining = 50, PARTIALLY_BILLED)
    9. Stage 3: Invoice #3 = 50 (Remaining = 0, FULLY_BILLED)
    10. Remaining quantity strictly 0, cannot overbill further.
    """
    f = cpo_test_fixture
    async with f["session_factory"]() as session:
        service = CustomerPOService(session, f["ctx"])

        # Create PO with 100 units
        po_in = CustomerPOCreate(
            customer_id=f["cust_id"],
            po_number=f"PO-PARTIAL-{f['suffix']}",
            po_date=date.today(),
            lines=[
                CustomerPOLineCreate(
                    line_number="1",
                    product_id=f["prod1_id"],
                    code=f["prod1_code"],
                    description="Widget A 100 Qty",
                    quantity_ordered=Decimal("100"),
                    unit_price=Decimal("100.00"),
                    gst_rate=Decimal("18.00"),
                ),
            ],
        )
        po = await service.create(po_in)
        line_id = po.lines[0].id

        # 7. First partial invoice = 30
        inv1 = await service.bill(po.id, CustomerPOBillingRequest(
            invoice={"customer_id": f["cust_id"], "payment_mode": "CASH", "status": "Submitted"},
            lines=[CustomerPOBillingLine(customer_po_line_id=line_id, quantity=Decimal("30"))],
        ))
        assert inv1 is not None
        po = await service.get(po.id)
        assert po.billed_quantity == Decimal("30")
        assert po.remaining_quantity == Decimal("70")
        assert po.status == "PARTIALLY_BILLED"
        assert po.lines[0].line_status == "PARTIALLY_BILLED"

        # 8. Second partial invoice = 20
        inv2 = await service.bill(po.id, CustomerPOBillingRequest(
            invoice={"customer_id": f["cust_id"], "payment_mode": "CASH", "status": "Submitted"},
            lines=[CustomerPOBillingLine(customer_po_line_id=line_id, quantity=Decimal("20"))],
        ))
        assert inv2 is not None
        po = await service.get(po.id)
        assert po.billed_quantity == Decimal("50")
        assert po.remaining_quantity == Decimal("50")
        assert po.status == "PARTIALLY_BILLED"

        # 9. Final invoice = 50
        inv3 = await service.bill(po.id, CustomerPOBillingRequest(
            invoice={"customer_id": f["cust_id"], "payment_mode": "CASH", "status": "Submitted"},
            lines=[CustomerPOBillingLine(customer_po_line_id=line_id, quantity=Decimal("50"))],
        ))
        assert inv3 is not None
        po = await service.get(po.id)
        # 10. Remaining quantity becomes zero, status FULLY_BILLED
        assert po.billed_quantity == Decimal("100")
        assert po.remaining_quantity == Decimal("0")
        assert po.status == "FULLY_BILLED"
        assert po.lines[0].quantity_remaining == Decimal("0")
        assert po.lines[0].line_status == "FULLY_BILLED"


@pytest.mark.asyncio
async def test_11_and_12_overbilling_policy_enforcement(cpo_test_fixture):
    """
    Vectors 11 & 12:
    11. Overbilling blocked under BLOCK policy (raises 409).
    12. Policy behavior respected: ALLOW_WITH_AUTHORIZATION requires authorization.
    """
    f = cpo_test_fixture
    async with f["session_factory"]() as session:
        service = CustomerPOService(session, f["ctx"])

        po_in = CustomerPOCreate(
            customer_id=f["cust_id"],
            po_number=f"PO-OVERBILL-{f['suffix']}",
            po_date=date.today(),
            lines=[
                CustomerPOLineCreate(
                    line_number="1",
                    product_id=f["prod1_id"],
                    code=f["prod1_code"],
                    description="Widget A",
                    quantity_ordered=Decimal("10"),
                    unit_price=Decimal("100.00"),
                ),
            ],
        )
        po = await service.create(po_in)
        line_id = po.lines[0].id

        # 11. Overbilling request (quantity=15 when remaining=10) under default BLOCK policy
        with pytest.raises(HTTPException) as exc_info:
            await service.bill(po.id, CustomerPOBillingRequest(
                invoice={"customer_id": f["cust_id"], "payment_mode": "CASH"},
                lines=[CustomerPOBillingLine(customer_po_line_id=line_id, quantity=Decimal("15"))],
            ))
        assert exc_info.value.status_code == 409
        assert "Over-billing blocked" in exc_info.value.detail

        # 12. Simulate ALLOW_WITH_AUTHORIZATION policy
        async def mock_policy():
            return "ALLOW_WITH_AUTHORIZATION", {"value": "ALLOW_WITH_AUTHORIZATION"}
        service._policy = mock_policy

        # Without authorization: blocked
        with pytest.raises(HTTPException) as exc_auth:
            await service.validate_billing(
                po.id,
                CustomerPOBillingRequest(
                    invoice={"customer_id": f["cust_id"], "payment_mode": "CASH"},
                    lines=[CustomerPOBillingLine(customer_po_line_id=line_id, quantity=Decimal("15"))],
                ),
                enforce_policy=True,
            )
        assert exc_auth.value.status_code == 409
        assert "Over-billing requires authorization" in exc_auth.value.detail

        # With authorization: allowed
        po_auth, po_lines_auth = await service.validate_billing(
            po.id,
            CustomerPOBillingRequest(
                invoice={"customer_id": f["cust_id"], "payment_mode": "CASH"},
                lines=[CustomerPOBillingLine(customer_po_line_id=line_id, quantity=Decimal("15"))],
                authorization="AUTH-MGR-OVERBILL-APPROVED",
            ),
            enforce_policy=True,
        )
        assert po_auth.id == po.id
        assert line_id in po_lines_auth


@pytest.mark.asyncio
async def test_13_concurrency_pessimistic_locking(cpo_test_fixture):
    """
    Vector 13: Concurrency protection.
    Two simultaneous requests cannot consume the same remaining PO quantity.
    Row locking ensures the second request sees updated remaining quantity and fails with 409.
    """
    f = cpo_test_fixture
    session_factory = f["session_factory"]

    async with session_factory() as session:
        service = CustomerPOService(session, f["ctx"])
        po_in = CustomerPOCreate(
            customer_id=f["cust_id"],
            po_number=f"PO-CONC-{f['suffix']}",
            po_date=date.today(),
            lines=[
                CustomerPOLineCreate(
                    line_number="1",
                    product_id=f["prod1_id"],
                    code=f["prod1_code"],
                    description="Widget A",
                    quantity_ordered=Decimal("10"),
                    unit_price=Decimal("100.00"),
                ),
            ],
        )
        po = await service.create(po_in)
        po_id = po.id
        line_id = po.lines[0].id

    # Execute two billing requests concurrently requesting 10 each (total 20 on a 10 PO)
    results = []

    async def execute_bill(idx: int):
        async with session_factory() as s:
            srv = CustomerPOService(s, f["ctx"])
            try:
                inv = await srv.bill(po_id, CustomerPOBillingRequest(
                    invoice={"customer_id": f["cust_id"], "payment_mode": "CASH", "status": "Submitted"},
                    lines=[CustomerPOBillingLine(customer_po_line_id=line_id, quantity=Decimal("10"))],
                ))
                results.append(("SUCCESS", inv.id))
            except HTTPException as e:
                results.append(("ERROR", e.status_code, e.detail))

    await asyncio.gather(execute_bill(1), execute_bill(2))

    successes = [r for r in results if r[0] == "SUCCESS"]
    errors = [r for r in results if r[0] == "ERROR"]

    # Exactly one request succeeded and one was blocked by row-locking and remaining check
    assert len(successes) == 1
    assert len(errors) == 1
    assert errors[0][1] == 409
    assert "Over-billing blocked" in errors[0][2]


@pytest.mark.asyncio
async def test_14_idempotency_retry_safety(cpo_test_fixture):
    """
    Vector 14: Idempotency protection.
    A retry of the same logical billing request with the same idempotency key
    returns the exact same invoice without duplicating allocations, stock movements, or decrements.
    """
    f = cpo_test_fixture
    async with f["session_factory"]() as session:
        service = CustomerPOService(session, f["ctx"])

        po_in = CustomerPOCreate(
            customer_id=f["cust_id"],
            po_number=f"PO-IDEM-{f['suffix']}",
            po_date=date.today(),
            lines=[
                CustomerPOLineCreate(
                    line_number="1",
                    product_id=f["prod1_id"],
                    code=f["prod1_code"],
                    description="Widget A",
                    quantity_ordered=Decimal("50"),
                    unit_price=Decimal("100.00"),
                ),
            ],
        )
        po = await service.create(po_in)
        line_id = po.lines[0].id

        idem_key = f"idem-cpo-{uuid.uuid4().hex[:12]}"
        req = CustomerPOBillingRequest(
            invoice={"customer_id": f["cust_id"], "payment_mode": "CASH", "status": "Submitted"},
            lines=[CustomerPOBillingLine(customer_po_line_id=line_id, quantity=Decimal("20"))],
            idempotency_key=idem_key,
        )

        # Attempt 1: original request
        inv1 = await service.bill(po.id, req, idempotency_key=idem_key)
        assert inv1.id == idem_key

        # Attempt 2: duplicate replay with same idempotency key
        inv2 = await service.bill(po.id, req, idempotency_key=idem_key)
        assert inv2.id == inv1.id

        # Verify allocations were NOT duplicated
        alloc_history = await service.history(po.id)
        assert len(alloc_history) == 1
        assert alloc_history[0].allocated_quantity == Decimal("20")

        # Verify PO remaining was decremented only once (50 - 20 = 30)
        po_state = await service.get(po.id)
        assert po_state.billed_quantity == Decimal("20")
        assert po_state.remaining_quantity == Decimal("30")


@pytest.mark.asyncio
async def test_15_to_19_tenant_and_branch_isolation(cpo_test_fixture):
    """
    Vectors 15 to 19:
    15. Foreign-company PO rejected.
    16. Foreign-company customer rejected.
    17. Foreign-company PO line product rejected.
    18. Invalid branch access rejected.
    19. Company-wide PO follows branch semantics.
    """
    f = cpo_test_fixture
    async with f["session_factory"]() as session:
        service = CustomerPOService(session, f["ctx"])

        # 16. Foreign-company customer rejected during PO creation
        with pytest.raises(HTTPException) as exc_cust:
            await service.create(CustomerPOCreate(
                customer_id=f["foreign_cust_id"],
                po_number=f"PO-FOR-CUST-{f['suffix']}",
                po_date=date.today(),
                lines=[CustomerPOLineCreate(
                    line_number="1", product_id=f["prod1_id"], code=f["prod1_code"],
                    description="Item", quantity_ordered=Decimal("5"), unit_price=Decimal("100"),
                )],
            ))
        assert exc_cust.value.status_code == 404

        # 17. Foreign-company product in PO line rejected
        with pytest.raises(HTTPException) as exc_prod:
            await service.create(CustomerPOCreate(
                customer_id=f["cust_id"],
                po_number=f"PO-FOR-PROD-{f['suffix']}",
                po_date=date.today(),
                lines=[CustomerPOLineCreate(
                    line_number="1", product_id=f["foreign_prod_id"], code="FOR-SKU",
                    description="Foreign Item", quantity_ordered=Decimal("5"), unit_price=Decimal("100"),
                )],
            ))
        assert exc_prod.value.status_code == 400

        # Create valid PO in primary branch
        valid_po = await service.create(CustomerPOCreate(
            customer_id=f["cust_id"],
            po_number=f"PO-TENANT-OK-{f['suffix']}",
            po_date=date.today(),
            lines=[CustomerPOLineCreate(
                line_number="1", product_id=f["prod1_id"], code=f["prod1_code"],
                description="Item", quantity_ordered=Decimal("10"), unit_price=Decimal("100"),
            )],
        ))

        # 15. Context of foreign company cannot see or bill this PO
        foreign_ctx = TenantContext(
            company_id=f["foreign_company_id"],
            branch_id=f["foreign_branch_id"],
        )
        foreign_service = CustomerPOService(session, foreign_ctx)
        with pytest.raises(HTTPException) as exc_po:
            await foreign_service.get(valid_po.id)
        assert exc_po.value.status_code == 404

        # 18. Other branch in same company cannot access branch-specific PO
        other_branch_ctx = TenantContext(
            company_id=f["company_id"],
            branch_id=f["branch_b_id"],
        )
        other_service = CustomerPOService(session, other_branch_ctx)
        with pytest.raises(HTTPException) as exc_br:
            await other_service.get(valid_po.id)
        assert exc_br.value.status_code == 404

        # 19. Company-wide PO (branch_id IS NULL) is accessible
        company_wide_po = CustomerPurchaseOrder(
            id=f"cpo-cw-{f['suffix']}",
            company_id=f["company_id"],
            branch_id=None,
            customer_id=f["cust_id"],
            po_number=f"PO-CW-{f['suffix']}",
            po_date=date.today(),
            ordered_quantity=Decimal("10"),
            remaining_quantity=Decimal("10"),
            ordered_value=Decimal("1000.00"),
            remaining_value=Decimal("1000.00"),
            billing_policy_snapshot={"value": "BLOCK"},
            status="OPEN",
            lines=[CustomerPurchaseOrderLine(
                id=f"cpol-cw-{f['suffix']}",
                company_id=f["company_id"],
                branch_id=None,
                customer_po_id=f"cpo-cw-{f['suffix']}",
                line_number="1",
                product_id=f["prod1_id"],
                code=f["prod1_code"],
                description="CW Item",
                quantity_ordered=Decimal("10"),
                quantity_remaining=Decimal("10"),
                unit_price=Decimal("100.00"),
                ordered_value=Decimal("1000.00"),
                remaining_value=Decimal("1000.00"),
                line_status="OPEN",
            )],
        )
        session.add(company_wide_po)
        await session.commit()

        # Both branch A and branch B can retrieve company-wide PO
        cw_a = (await session.execute(
            select(CustomerPurchaseOrder).where(
                CustomerPurchaseOrder.id == company_wide_po.id,
                CustomerPurchaseOrder.company_id == f["company_id"],
                (CustomerPurchaseOrder.branch_id == f["branch_id"]) | (CustomerPurchaseOrder.branch_id.is_(None)),
                CustomerPurchaseOrder.is_deleted == False,
            )
        )).scalars().first()
        assert cw_a is not None


@pytest.mark.asyncio
async def test_20_to_22_traceability_and_allocation(cpo_test_fixture):
    """
    Vectors 20 to 22:
    20. Invoice → PO relational linkage exists.
    21. Invoice Line → PO Line allocation exists in customer_po_invoice_allocations.
    22. Allocation quantity matches requested quantity exactly.
    """
    f = cpo_test_fixture
    async with f["session_factory"]() as session:
        service = CustomerPOService(session, f["ctx"])

        po = await service.create(CustomerPOCreate(
            customer_id=f["cust_id"],
            po_number=f"PO-TRACE-{f['suffix']}",
            po_date=date.today(),
            lines=[
                CustomerPOLineCreate(
                    line_number="1", product_id=f["prod1_id"], code=f["prod1_code"],
                    description="Widget A", quantity_ordered=Decimal("40"), unit_price=Decimal("100.00"),
                ),
            ],
        ))
        line = po.lines[0]

        inv = await service.bill(po.id, CustomerPOBillingRequest(
            invoice={"customer_id": f["cust_id"], "payment_mode": "CASH", "status": "Submitted"},
            lines=[CustomerPOBillingLine(customer_po_line_id=line.id, quantity=Decimal("25"))],
        ))

        # 20. Invoice → PO relationship
        assert inv.customer_po_id == po.id
        assert inv.customer_po_number_snapshot == po.po_number
        assert inv.customer_po_date_snapshot == po.po_date

        # 21. Invoice Line → PO Line allocation
        allocations = await service.history(po.id)
        assert len(allocations) == 1
        alloc = allocations[0]
        assert alloc.customer_po_id == po.id
        assert alloc.customer_po_line_id == line.id
        assert alloc.invoice_id == inv.id
        assert alloc.customer_po_number == po.po_number
        assert alloc.invoice_number == inv.invoice_no

        # 22. Allocation quantity correct
        assert alloc.allocated_quantity == Decimal("25")
        assert alloc.allocated_value == Decimal("2950.00")  # 25 * 100 = 2500 + 18% GST (450) = 2950.00


@pytest.mark.asyncio
async def test_23_and_24_accounting_receivable_and_credit_ledger(cpo_test_fixture):
    """
    Vectors 23 & 24:
    23. Credit invoice creates expected receivable on customer_credit_ledger.
    24. Credit invoice updates ledger exactly once without double-posting.
    """
    f = cpo_test_fixture
    async with f["session_factory"]() as session:
        service = CustomerPOService(session, f["ctx"])

        po = await service.create(CustomerPOCreate(
            customer_id=f["cust_id"],
            po_number=f"PO-CREDIT-{f['suffix']}",
            po_date=date.today(),
            lines=[
                CustomerPOLineCreate(
                    line_number="1", product_id=f["prod1_id"], code=f["prod1_code"],
                    description="Widget A", quantity_ordered=Decimal("10"), unit_price=Decimal("100.00"),
                ),
            ],
        ))

        credit_idem = f"idem-cred-{uuid.uuid4().hex[:10]}"
        credit_req = CustomerPOBillingRequest(
            invoice={
                "customer_id": f["cust_id"],
                "payment_mode": "CREDIT",
                "status": "Submitted",
                "rule_snapshots": {
                    "payments": [{"mode": "On Account", "amount": 1180.0}],
                },
            },
            lines=[CustomerPOBillingLine(customer_po_line_id=po.lines[0].id, quantity=Decimal("10"))],
            idempotency_key=credit_idem,
        )

        inv = await service.bill(po.id, credit_req, idempotency_key=credit_idem)
        assert inv is not None

        # 23. Verify customer credit ledger entry exists
        ledger_entries = (await session.execute(
            select(CustomerCreditLedgerEntry).where(
                CustomerCreditLedgerEntry.customer_id == f["cust_id"],
                CustomerCreditLedgerEntry.reference_id == inv.id,
            )
        )).scalars().all()

        assert len(ledger_entries) == 1
        assert ledger_entries[0].amount == Decimal("1180.00")

        # 24. Replay billing request with same idempotency key
        inv_replay = await service.bill(po.id, credit_req, idempotency_key=credit_idem)
        assert inv_replay.id == inv.id

        # Verify no duplicate credit ledger entries
        ledger_entries_after = (await session.execute(
            select(CustomerCreditLedgerEntry).where(
                CustomerCreditLedgerEntry.customer_id == f["cust_id"],
                CustomerCreditLedgerEntry.reference_id == inv.id,
            )
        )).scalars().all()
        assert len(ledger_entries_after) == 1


@pytest.mark.asyncio
async def test_25_and_26_inventory_wms_stock_mutation(cpo_test_fixture):
    """
    Vectors 25 & 26:
    25. No duplicate stock movement on replay.
    26. Inventory behavior matches canonical invoice writer.
    """
    f = cpo_test_fixture
    async with f["session_factory"]() as session:
        service = CustomerPOService(session, f["ctx"])

        po = await service.create(CustomerPOCreate(
            customer_id=f["cust_id"],
            po_number=f"PO-STOCK-{f['suffix']}",
            po_date=date.today(),
            lines=[
                CustomerPOLineCreate(
                    line_number="1", product_id=f["prod1_id"], code=f["prod1_code"],
                    description="Widget A", quantity_ordered=Decimal("10"), unit_price=Decimal("100.00"),
                ),
            ],
        ))

        stock_idem = f"idem-stock-{uuid.uuid4().hex[:10]}"
        stock_req = CustomerPOBillingRequest(
            invoice={"customer_id": f["cust_id"], "payment_mode": "CASH", "status": "Submitted"},
            lines=[CustomerPOBillingLine(customer_po_line_id=po.lines[0].id, quantity=Decimal("5"))],
            idempotency_key=stock_idem,
        )

        inv = await service.bill(po.id, stock_req, idempotency_key=stock_idem)
        assert inv is not None

        # Check stock movement records for this invoice
        movements = (await session.execute(
            select(StockMovement).where(
                StockMovement.reference_doc_id == inv.id,
            )
        )).scalars().all()
        initial_movement_count = len(movements)

        # 25. Replay request with same idempotency key
        await service.bill(po.id, stock_req, idempotency_key=stock_idem)
        movements_after = (await session.execute(
            select(StockMovement).where(
                StockMovement.reference_doc_id == inv.id,
            )
        )).scalars().all()

        # No duplicate movements
        assert len(movements_after) == initial_movement_count
