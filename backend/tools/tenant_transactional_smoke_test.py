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

import asyncio
import os
import sys
import uuid
from datetime import date
from decimal import Decimal

# Ensure backend root in path
backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

os.environ.setdefault("JWT_SECRET_KEY", "dev-test-jwt-secret-key-32-chars-long-smriti")
os.environ.setdefault("INTERNAL_SERVICE_KEY", "dev-test-internal-service-key-32-chars")
os.environ.setdefault("SGIP_VAULT_MASTER_KEY", "dev-test-sgip-vault-master-key-32-chars")

from sqlalchemy import delete, select

from app.api.deps import TenantContext
from app.db.session import get_company_sessionmaker, resolve_company_database_name
from app.models.crm import Customer, CustomerGroup
from app.models.customer_po import (
    CustomerPOInvoiceAllocation,
    CustomerPurchaseOrder,
    CustomerPurchaseOrderLine,
)
from app.models.inventory import Product
from app.models.sales import SalesInvoice, SalesInvoiceItem
from app.schemas.customer_po import (
    CustomerPOBillingLine,
    CustomerPOBillingRequest,
    CustomerPOCreate,
    CustomerPOLineCreate,
)
from app.services.customer_po import CustomerPOService


async def run_smoke_test():
    print("================================================================================")
    print("TENANT-SCOPED LIVE TRANSACTIONAL SMOKE TEST")
    print("================================================================================")

    # 1. Authoritative Routing Resolution
    company_id = "COMP-001"
    branch_id = "MAIN"
    print(f"[STEP 1] Resolving authoritative database for company '{company_id}'...")
    target_db = await resolve_company_database_name(company_id)
    print(f"  -> Resolved database: '{target_db}'")
    assert target_db == "smriti001", f"Expected smriti001, got {target_db}"

    # 2. Session Context
    print(f"[STEP 2] Initializing tenant sessionmaker for '{target_db}'...")
    session_factory = get_company_sessionmaker(target_db)
    tenant_ctx = TenantContext(company_id=company_id, branch_id=branch_id)

    suffix = uuid.uuid4().hex[:6]
    cg_id = f"cg-smoke-{suffix}"
    cust_id = f"cust-smoke-{suffix}"
    prod1_id = f"prod-smoke1-{suffix}"
    prod2_id = f"prod-smoke2-{suffix}"

    try:
        async with session_factory() as session:
            print(f"[STEP 3] Seeding test master entities (Customer, Products)...")
            cg = CustomerGroup(
                id=cg_id,
                company_id=company_id,
                name=f"Smoke Group {suffix}",
                credit_limit=Decimal("100000.00"),
                is_active=True,
                is_deleted=False,
            )
            session.add(cg)

            cust = Customer(
                id=cust_id,
                company_id=company_id,
                branch_id=None,  # Company-wide customer
                name=f"Smoke Test Customer {suffix}",
                customer_group_id=cg_id,
                is_active=True,
                is_deleted=False,
            )
            session.add(cust)

            p1 = Product(
                id=prod1_id,
                company_id=company_id,
                branch_id=None,
                code=f"SKU-S1-{suffix}",
                barcode=f"BC-S1-{suffix}",
                name=f"Smoke Product 1 {suffix}",
                category="General",
                brand="Generic",
                price=Decimal("150.00"),
                cost_price=Decimal("100.00"),
                buying_price=Decimal("100.00"),
                mrp=Decimal("150.00"),
                gst_percentage=Decimal("18.00"),
                is_active=True,
                is_deleted=False,
            )
            p2 = Product(
                id=prod2_id,
                company_id=company_id,
                branch_id=None,
                code=f"SKU-S2-{suffix}",
                barcode=f"BC-S2-{suffix}",
                name=f"Smoke Product 2 {suffix}",
                category="General",
                brand="Generic",
                price=Decimal("200.00"),
                cost_price=Decimal("120.00"),
                buying_price=Decimal("120.00"),
                mrp=Decimal("200.00"),
                gst_percentage=Decimal("18.00"),
                is_active=True,
                is_deleted=False,
            )
            session.add_all([p1, p2])
            await session.commit()
            print("  -> Customer and Products committed to PostgreSQL.")

            # 4. Create Customer Purchase Order
            print(f"[STEP 4] Creating Customer Purchase Order via CustomerPOService...")
            service = CustomerPOService(session, tenant_ctx)
            po_create = CustomerPOCreate(
                customer_id=cust_id,
                po_number=f"PO-LIVE-{suffix}",
                po_date=date.today(),
                lines=[
                    CustomerPOLineCreate(
                        line_number="1",
                        product_id=prod1_id,
                        code=f"SKU-S1-{suffix}",
                        description=f"Smoke Product 1",
                        quantity_ordered=Decimal("10.0000"),
                        unit_price=Decimal("150.00"),
                        gst_rate=Decimal("18.00"),
                    ),
                    CustomerPOLineCreate(
                        line_number="2",
                        product_id=prod2_id,
                        code=f"SKU-S2-{suffix}",
                        description=f"Smoke Product 2",
                        quantity_ordered=Decimal("5.0000"),
                        unit_price=Decimal("200.00"),
                        gst_rate=Decimal("18.00"),
                    ),
                ],
            )
            po = await service.create(po_create)
            print(f"  -> PO created: ID={po.id}, Status={po.status}")
            print(f"  -> Total Ordered Qty: {po.ordered_quantity}, Total Value: {po.ordered_value}")
            assert po.ordered_quantity == Decimal("15.0000")
            assert po.remaining_quantity == Decimal("15.0000")
            assert po.ordered_value == Decimal("2500.00")

            line1_id = po.lines[0].id
            line2_id = po.lines[1].id

            # 5. Validate Partial Billing
            print(f"[STEP 5] Validating partial billing: Line 1 (4 units), Line 2 (2 units)...")
            billing_req = CustomerPOBillingRequest(
                lines=[
                    CustomerPOBillingLine(customer_po_line_id=line1_id, quantity=Decimal("4.0000")),
                    CustomerPOBillingLine(customer_po_line_id=line2_id, quantity=Decimal("2.0000")),
                ],
                invoice={
                    "customer_id": cust_id,
                    "date": date.today(),
                    "payment_mode": "CASH",
                    "notes": "Smoke test partial bill",
                }
            )
            v_po, v_lines = await service.validate_billing(po.id, billing_req, lock=False, enforce_policy=True)
            print("  -> Billing validation successful! Row bounds verified.")

            # 6. Execute live atomic bill transaction
            print(f"[STEP 6] Executing live atomic CustomerPOService.bill()...")
            invoice = await service.bill(po.id, billing_req)
            allocations = await service.history(po.id)
            print(f"  -> Invoice generated: ID={invoice.id}, Invoice No={invoice.invoice_no}")
            print(f"  -> Allocations generated: {len(allocations)}")
            assert len(allocations) == 2, f"Expected 2 allocations, got {len(allocations)}"

            # 7. Post-Billing Verification from Postgres
            print(f"[STEP 7] Verifying updated PO and allocation state in PostgreSQL...")
            updated_po = await service.get(po.id)
            print(f"  -> PO Status: {updated_po.status}")
            print(f"  -> PO Billed Qty: {updated_po.billed_quantity} (Expected: 6.0000)")
            print(f"  -> PO Remaining Qty: {updated_po.remaining_quantity} (Expected: 9.0000)")
            print(f"  -> Line 1: Billed={updated_po.lines[0].quantity_billed}, Remaining={updated_po.lines[0].quantity_remaining}, Status={updated_po.lines[0].line_status}")
            print(f"  -> Line 2: Billed={updated_po.lines[1].quantity_billed}, Remaining={updated_po.lines[1].quantity_remaining}, Status={updated_po.lines[1].line_status}")

            assert updated_po.billed_quantity == Decimal("6.0000")
            assert updated_po.remaining_quantity == Decimal("9.0000")
            assert updated_po.status == "PARTIALLY_BILLED"

            # Check allocation foreign keys & line links
            for alloc in allocations:
                print(f"  -> Allocation {alloc.id}: PO={alloc.customer_po_id}, Line={alloc.customer_po_line_id}, Inv={alloc.invoice_id}, Item={alloc.invoice_item_id}, Qty={alloc.allocated_quantity}, Val={alloc.allocated_value}")
                assert alloc.customer_po_id == po.id
                assert alloc.invoice_id == invoice.id

            print("--------------------------------------------------------------------------------")
            print("LIVE TRANSACTIONAL SMOKE TEST: ALL ASSERTIONS PASSED (100% GREEN)")
            print("--------------------------------------------------------------------------------")

    finally:
        # Cleanup
        print(f"[STEP 8] Performing teardown cleanup in '{target_db}'...")
        async with session_factory() as clean_session:
            if "po" in locals() and po:
                await clean_session.execute(delete(CustomerPOInvoiceAllocation).where(CustomerPOInvoiceAllocation.customer_po_id == po.id))
            if "invoice" in locals() and invoice:
                await clean_session.execute(delete(SalesInvoiceItem).where(SalesInvoiceItem.invoice_id == invoice.id))
                await clean_session.execute(delete(SalesInvoice).where(SalesInvoice.id == invoice.id))
            if "po" in locals() and po:
                await clean_session.execute(delete(CustomerPurchaseOrderLine).where(CustomerPurchaseOrderLine.customer_po_id == po.id))
                await clean_session.execute(delete(CustomerPurchaseOrder).where(CustomerPurchaseOrder.id == po.id))
            await clean_session.execute(delete(Product).where(Product.id.in_([prod1_id, prod2_id])))
            await clean_session.execute(delete(Customer).where(Customer.id == cust_id))
            await clean_session.execute(delete(CustomerGroup).where(CustomerGroup.id == cg_id))
            await clean_session.commit()
            print("  -> Cleanup committed. Database pristine.")


if __name__ == "__main__":
    asyncio.run(run_smoke_test())
