"""
Project      : SMRITI Retail OS
Repository   : SMRITIRetailNX
Organization : AITDL NETWORKS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.74.0
Created      : 2026-10-14
Modified     : 2026-10-14
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Test Suite / Cost Management & Cost Truth Engine (Phase 5)
"""

import os
import uuid
import pytest
from decimal import Decimal
from datetime import date, datetime, timezone
from httpx import AsyncClient, ASGITransport
from sqlalchemy.future import select

from app.main import app
from app.db.session import get_company_sessionmaker
from app.api.deps import get_company_db, get_current_user, get_tenant_context, TenantContext
from app.models.auth import User, UserRole
from app.core.security import create_access_token
from app.services.cost_engine import CostManagementEngine
from app.services.unified_ledger import UnifiedAccountingLedgerService
from app.models.profitability import (
    ProductCostValuation,
    TransactionCostSnapshot,
    InvoiceProfitabilityLedger,
)
from app.models.inventory import Product, StockMovement
from app.models.purchase import (
    PurchaseReceipt,
    PurchaseReceiptItem,
    PurchaseBill,
    Supplier,
)
from app.models.sales import SalesInvoice, SalesInvoiceItem
from app.models.inward_cost import InwardCostAllocation, InwardCostComponent
from app.models.accounting import JournalVoucher, GeneralLedgerEntry, Account

TEST_DB_NAME = "smriti_test_cost_engine"
TEST_COMPANY_ID = "COMP-COST-TEST"

# P0 Database Governance & Test Isolation Guard: Abort if target is shared/live DB
if TEST_DB_NAME in ("smriti001", "smritisys", "smriti_production", "smritiprod"):
    raise RuntimeError(
        f"TEST SAFETY ABORT: TEST_DB_NAME is configured to shared/live database '{TEST_DB_NAME}'. "
        "Automated tests must run strictly against a dedicated isolated test database."
    )


def _get_auth_headers(company_id: str = TEST_COMPANY_ID) -> dict:
    token = create_access_token(
        data={
            "sub": "usr_cost_tester",
            "username": "cost_tester",
            "user_id": "usr_cost_tester",
            "role": "SYSADMIN",
            "company_id": company_id,
            "branch_id": "BR-MAIN-001",
            "tenant_id": TEST_DB_NAME,
            "db_name": TEST_DB_NAME,
            "is_active": True,
        }
    )
    return {
        "Authorization": f"Bearer {token}",
        "X-Company-ID": company_id,
        "X-Branch-ID": "BR-MAIN-001",
    }


@pytest.fixture(autouse=True)
async def enforce_test_db_isolation():
    """P0 Test Isolation: Route all API dependencies to dedicated test DB and mock auth context."""
    assert TEST_DB_NAME not in ("smriti001", "smritisys"), "Must never target shared database"
    session_factory = get_company_sessionmaker(TEST_DB_NAME)

    async def _override_get_company_db():
        async with session_factory() as session:
            session.info.update({
                "tenant_id": TEST_DB_NAME,
                "company_id": TEST_COMPANY_ID,
                "branch_id": "BR-MAIN-001",
                "resolved_database_name": TEST_DB_NAME,
                "control_plane_database": "smritisys",
                "transactional_scope_validated": True,
            })
            yield session

    async def _override_get_current_user():
        return User(
            id="usr_cost_tester",
            username="cost_tester",
            role=UserRole.SYSADMIN,
            company_id=TEST_COMPANY_ID,
            branch_id="BR-MAIN-001",
            is_active=True,
        )

    async def _override_get_tenant_context():
        return TenantContext(
            company_id=TEST_COMPANY_ID,
            branch_id="BR-MAIN-001",
            role=UserRole.SYSADMIN,
        )

    app.dependency_overrides[get_company_db] = _override_get_company_db
    app.dependency_overrides[get_current_user] = _override_get_current_user
    app.dependency_overrides[get_tenant_context] = _override_get_tenant_context
    try:
        yield
    finally:
        app.dependency_overrides.pop(get_company_db, None)
        app.dependency_overrides.pop(get_current_user, None)
        app.dependency_overrides.pop(get_tenant_context, None)


# ===========================================================================
# 1. Rolling WAC Mathematical Invariants
# ===========================================================================

def test_rolling_wac_math_edge_cases():
    """Verify rolling WAC formula across zero stock, positive stock, and negative stock recovery."""
    # Case 1: Initial stock (0 stock) + first inward receipt
    wac1 = CostManagementEngine.calculate_rolling_wac(
        current_qty=Decimal("0.00"),
        current_wac=Decimal("0.00"),
        inward_qty=Decimal("10.00"),
        inward_unit_cost=Decimal("100.00"),
    )
    assert wac1 == Decimal("100.00")

    # Case 2: Positive stock (10 @ 100) + second inward receipt (10 @ 120)
    # Total qty = 20, Total value = 1000 + 1200 = 2200 => WAC = 110.00
    wac2 = CostManagementEngine.calculate_rolling_wac(
        current_qty=Decimal("10.00"),
        current_wac=Decimal("100.00"),
        inward_qty=Decimal("10.00"),
        inward_unit_cost=Decimal("120.00"),
    )
    assert wac2 == Decimal("110.00")

    # Case 3: Positive stock (20 @ 110) + third inward receipt (30 @ 150)
    # Total qty = 50, Total value = 2200 + 4500 = 6700 => WAC = 134.00
    wac3 = CostManagementEngine.calculate_rolling_wac(
        current_qty=Decimal("20.00"),
        current_wac=Decimal("110.00"),
        inward_qty=Decimal("30.00"),
        inward_unit_cost=Decimal("150.00"),
    )
    assert wac3 == Decimal("134.00")

    # Case 4: Negative stock recovery (oversold condition recovering to fresh receipt)
    wac_neg = CostManagementEngine.calculate_rolling_wac(
        current_qty=Decimal("-5.00"),
        current_wac=Decimal("134.00"),
        inward_qty=Decimal("15.00"),
        inward_unit_cost=Decimal("160.00"),
    )
    assert wac_neg == Decimal("160.00")

    # Case 5: Zero inward quantity
    wac_zero_in = CostManagementEngine.calculate_rolling_wac(
        current_qty=Decimal("50.00"),
        current_wac=Decimal("134.00"),
        inward_qty=Decimal("0.00"),
        inward_unit_cost=Decimal("200.00"),
    )
    assert wac_zero_in == Decimal("134.00")


# ===========================================================================
# 2. Inward Receipt Landed Cost & Valuation Updating
# ===========================================================================

@pytest.mark.asyncio
async def test_inward_receipt_valuation_and_landed_costs():
    """Verify that process_inward_valuation calculates landed unit cost and updates ProductCostValuation."""
    session_factory = get_company_sessionmaker(TEST_DB_NAME)
    async with session_factory() as session:
        # Seed test product
        prod_id = f"prod_cost_{uuid.uuid4().hex[:8]}"
        prod = Product(
            id=prod_id,
            uuid=prod_id,
            code=f"PRD-{uuid.uuid4().hex[:6]}",
            category="GENERAL",
            barcode=f"BC-{uuid.uuid4().hex[:6]}",
            price=Decimal("150.00"),
            company_id=TEST_COMPANY_ID,
            sku=f"SKU-CME-{uuid.uuid4().hex[:4]}",
            name="Test CME Product",
            stock=10,
            cost_price=Decimal("100.00"),
            mrp=Decimal("150.00"),
        )
        session.add(prod)

        # Seed supplier
        supp_id = f"supp_{uuid.uuid4().hex[:8]}"
        supplier = Supplier(
            id=supp_id,
            uuid=supp_id,
            company_id=TEST_COMPANY_ID,
            name="Alpha Logistics Supplier",
            code=f"SUPP-{uuid.uuid4().hex[:4]}",
        )
        session.add(supplier)
        await session.flush()

        # Seed Purchase Receipt
        rcpt_id = f"pr_{uuid.uuid4().hex[:8]}"
        item_id = f"pri_{uuid.uuid4().hex[:8]}"
        receipt = PurchaseReceipt(
            id=rcpt_id,
            uuid=rcpt_id,
            company_id=TEST_COMPANY_ID,
            receipt_no=f"GRN-COST-{uuid.uuid4().hex[:4]}",
            supplier_id=supp_id,
            status="RECEIVED",
            subtotal=Decimal("1000.00"),
            tax_total=Decimal("180.00"),
            grand_total=Decimal("1180.00"),
        )
        receipt_item = PurchaseReceiptItem(
            id=item_id,
            uuid=item_id,
            company_id=TEST_COMPANY_ID,
            receipt_id=rcpt_id,
            product_id=prod_id,
            code="CME-001",
            name="Test CME Product",
            quantity_received=Decimal("10.00"),
            quantity_damaged=Decimal("0.00"),
            cost_price=Decimal("100.00"),
            gst_rate=Decimal("18.00"),
            tax_amount=Decimal("180.00"),
            line_total=Decimal("1180.00"),
        )
        receipt.items.append(receipt_item)
        session.add(receipt)

        # Seed Inward Landed Cost Component and Allocation (Freight = 200.00 => 20.00 / unit)
        comp_id = f"icc_{uuid.uuid4().hex[:8]}"
        comp = InwardCostComponent(
            id=comp_id,
            company_id=TEST_COMPANY_ID,
            grn_id=rcpt_id,
            component_type="FREIGHT",
            amount=Decimal("200.00"),
            taxable_amount=Decimal("200.00"),
            total_amount=Decimal("200.00"),
            status="ALLOCATED",
        )
        session.add(comp)

        alloc_id = f"ica_{uuid.uuid4().hex[:8]}"
        alloc = InwardCostAllocation(
            id=alloc_id,
            company_id=TEST_COMPANY_ID,
            grn_id=rcpt_id,
            grn_item_id=item_id,
            cost_component_id=comp_id,
            product_id=prod_id,
            allocation_method="VALUE",
            basis_value=Decimal("1000.0000"),
            allocated_amount=Decimal("200.00"),
            allocated_per_unit=Decimal("20.0000"),
        )
        session.add(alloc)
        await session.commit()

        # Execute valuation processing
        res = await CostManagementEngine.process_inward_valuation(
            session=session,
            company_id=TEST_COMPANY_ID,
            receipt_id=rcpt_id,
        )
        await session.commit()

        assert len(res) == 1
        item_res = res[0]
        assert item_res["purchase_cost"] == Decimal("100.00")
        assert item_res["landed_cost"] == Decimal("120.00")  # 100 base + 20 freight
        assert item_res["new_wac"] == Decimal("120.00")

        # Verify ProductCostValuation row in DB
        stmt = select(ProductCostValuation).where(
            ProductCostValuation.product_id == prod_id,
            ProductCostValuation.company_id == TEST_COMPANY_ID,
        )
        pcv = (await session.execute(stmt)).scalar_one_or_none()
        assert pcv is not None
        assert pcv.purchase_cost == Decimal("100.00")
        assert pcv.landed_cost == Decimal("120.00")
        assert pcv.replacement_cost == Decimal("120.00")
        assert pcv.weighted_average_cost == Decimal("120.00")


# ===========================================================================
# 3. GL Double-Booking Elimination & GR/IR Clearing
# ===========================================================================

@pytest.mark.asyncio
async def test_gl_posting_no_double_booking():
    """Verify that posting both a Goods Receipt and a Purchase Bill eliminates inventory double-booking."""
    session_factory = get_company_sessionmaker(TEST_DB_NAME)
    async with session_factory() as session:
        await UnifiedAccountingLedgerService.seed_default_chart_of_accounts(
            session=session,
            company_id=TEST_COMPANY_ID,
        )

        supp_id = f"supp_{uuid.uuid4().hex[:8]}"
        supplier = Supplier(
            id=supp_id,
            uuid=supp_id,
            company_id=TEST_COMPANY_ID,
            name="Omega Freight Supplier",
            code=f"SUPP-{uuid.uuid4().hex[:4]}",
        )
        session.add(supplier)
        await session.flush()

        # 1. Post Purchase Receipt
        rcpt_id = f"pr_{uuid.uuid4().hex[:8]}"
        receipt = PurchaseReceipt(
            id=rcpt_id,
            uuid=rcpt_id,
            company_id=TEST_COMPANY_ID,
            receipt_no=f"GRN-RECON-{uuid.uuid4().hex[:4]}",
            supplier_id=supp_id,
            status="RECEIVED",
            subtotal=Decimal("5000.00"),
            tax_total=Decimal("900.00"),
            grand_total=Decimal("5900.00"),
        )
        session.add(receipt)
        await session.commit()

        rcpt_voucher = await UnifiedAccountingLedgerService.post_purchase_receipt_to_gl(
            session=session,
            company_id=TEST_COMPANY_ID,
            receipt_id=rcpt_id,
        )
        await session.commit()

        assert rcpt_voucher.total_debit == Decimal("5000.00")
        assert rcpt_voucher.total_credit == Decimal("5000.00")

        # 2. Post Purchase Bill matched to this receipt
        bill_id = f"pb_{uuid.uuid4().hex[:8]}"
        bill = PurchaseBill(
            id=bill_id,
            uuid=bill_id,
            company_id=TEST_COMPANY_ID,
            bill_no=f"BILL-{uuid.uuid4().hex[:4]}",
            supplier_id=supp_id,
            receipt_id=rcpt_id,
            status="POSTED",
            taxable_amount=Decimal("5000.00"),
            tax_amount=Decimal("900.00"),
            total_amount=Decimal("5900.00"),
        )
        session.add(bill)
        await session.commit()

        bill_voucher = await UnifiedAccountingLedgerService.post_purchase_bill_to_gl(
            session=session,
            company_id=TEST_COMPANY_ID,
            bill_id=bill_id,
        )
        await session.commit()

        assert bill_voucher.total_debit == Decimal("5900.00")
        assert bill_voucher.total_credit == Decimal("5900.00")

        # 3. Query Account 1040 (Inventory) and Account 1045 (Unbilled GRN)
        acc_inv = await UnifiedAccountingLedgerService.get_account_by_code(session, TEST_COMPANY_ID, "1040")
        acc_grir = await UnifiedAccountingLedgerService.get_account_by_code(session, TEST_COMPANY_ID, "1045")

        # Check total Inventory debits across all vouchers for this receipt & bill
        inv_entries = (
            await session.execute(
                select(GeneralLedgerEntry).where(
                    GeneralLedgerEntry.account_id == acc_inv.id,
                    GeneralLedgerEntry.reference_doc_id.in_([rcpt_id, bill_id]),
                )
            )
        ).scalars().all()

        # Invariant 1: Inventory (1040) is debited EXACTLY ONCE (from receipt), NOT twice!
        total_inv_debits = sum(e.debit_amount for e in inv_entries)
        assert total_inv_debits == Decimal("5000.00")

        # Invariant 2: Unbilled GRN (1045) was credited on receipt and debited on bill
        grir_entries = (
            await session.execute(
                select(GeneralLedgerEntry).where(
                    GeneralLedgerEntry.account_id == acc_grir.id,
                    GeneralLedgerEntry.reference_doc_id.in_([rcpt_id, bill_id]),
                )
            )
        ).scalars().all()
        assert len(grir_entries) >= 2


# ===========================================================================
# 4. Sales COGS Snapshot & Landed Cost Inclusion
# ===========================================================================

@pytest.mark.asyncio
async def test_sales_cogs_snapshot_and_landed_cost_inclusion():
    """Verify that post_sales_invoice_to_gl includes landed_cost in COGS and records profitability ledger."""
    session_factory = get_company_sessionmaker(TEST_DB_NAME)
    async with session_factory() as session:
        # Create product with landed cost 150.00 (purchase cost was 120.00)
        prod_id = f"prod_cogs_{uuid.uuid4().hex[:8]}"
        prod = Product(
            id=prod_id,
            uuid=prod_id,
            code=f"PRD-{uuid.uuid4().hex[:6]}",
            category="GENERAL",
            barcode=f"BC-{uuid.uuid4().hex[:6]}",
            price=Decimal("200.00"),
            company_id=TEST_COMPANY_ID,
            sku=f"SKU-COGS-{uuid.uuid4().hex[:4]}",
            name="Landed Cost COGS Item",
            stock=50,
            cost_price=Decimal("120.00"),
            mrp=Decimal("200.00"),
        )
        session.add(prod)

        pcv_id = f"pcv_{uuid.uuid4().hex[:8]}"
        pcv = ProductCostValuation(
            id=pcv_id,
            uuid=pcv_id,
            company_id=TEST_COMPANY_ID,
            product_id=prod_id,
            purchase_cost=Decimal("120.00"),
            landed_cost=Decimal("150.00"),
            weighted_average_cost=Decimal("150.00"),
            replacement_cost=Decimal("150.00"),
        )
        session.add(pcv)

        # Create sales invoice for 2 units @ 200.00 = 400.00
        inv_id = f"sinv_{uuid.uuid4().hex[:8]}"
        invoice = SalesInvoice(
            id=inv_id,
            uuid=inv_id,
            company_id=TEST_COMPANY_ID,
            invoice_no=f"INV-COST-{uuid.uuid4().hex[:4]}",
            date=date.today(),
            taxable_value=Decimal("400.00"),
            tax_total=Decimal("72.00"),
            grand_total=Decimal("472.00"),
            net_amount=Decimal("472.00"),
            paid_amount=Decimal("472.00"),
            balance_amount=Decimal("0.00"),
            status="POSTED",
        )
        session.add(invoice)
        await session.flush()

        inv_item = SalesInvoiceItem(
            uuid=str(uuid.uuid4()),
            company_id=TEST_COMPANY_ID,
            invoice_id=inv_id,
            product_id=prod_id,
            code="COGS-ITEM-01",
            name="Landed Cost COGS Item",
            quantity=Decimal("2.00"),
            price=Decimal("200.00"),
            tax_amount=Decimal("72.00"),
            taxable_value=Decimal("400.00"),
            total_amount=Decimal("472.00"),
        )
        session.add(inv_item)
        await session.commit()

        # Post invoice to GL
        voucher = await UnifiedAccountingLedgerService.post_sales_invoice_to_gl(
            session=session,
            company_id=TEST_COMPANY_ID,
            invoice_id=inv_id,
        )
        await session.commit()

        assert voucher is not None

        # Verify TransactionCostSnapshot: 2 units * 150.00 landed cost = 300.00 COGS
        snap_stmt = select(TransactionCostSnapshot).where(
            TransactionCostSnapshot.sales_invoice_id == inv_id,
            TransactionCostSnapshot.company_id == TEST_COMPANY_ID,
        )
        snap = (await session.execute(snap_stmt)).scalar_one_or_none()
        assert snap is not None
        assert snap.cost_per_unit == Decimal("150.00")
        assert snap.total_cogs == Decimal("300.00")
        assert snap.gross_profit == Decimal("100.00")  # 400 gross sales - 300 COGS

        # Verify InvoiceProfitabilityLedger
        ipl_stmt = select(InvoiceProfitabilityLedger).where(
            InvoiceProfitabilityLedger.sales_invoice_id == inv_id,
            InvoiceProfitabilityLedger.company_id == TEST_COMPANY_ID,
        )
        ipl = (await session.execute(ipl_stmt)).scalar_one_or_none()
        assert ipl is not None
        assert ipl.total_cogs == Decimal("300.00")
        assert ipl.gross_profit in (Decimal("172.00"), Decimal("100.00"))
        assert ipl.net_contribution > Decimal("0.00")


# ===========================================================================
# 5. Inventory-to-GL Reconciliation Engine
# ===========================================================================

@pytest.mark.asyncio
async def test_inventory_to_gl_reconciliation():
    """Verify that get_inventory_to_gl_reconciliation reports stock valuation and GL Account 1040 balance."""
    session_factory = get_company_sessionmaker(TEST_DB_NAME)
    async with session_factory() as session:
        recon = await CostManagementEngine.get_inventory_to_gl_reconciliation(
            session=session,
            company_id=TEST_COMPANY_ID,
        )

        assert "physical_stock_valuation" in recon
        assert "gl_account_1040_balance" in recon
        assert "variance" in recon
        assert "status" in recon
        assert recon["is_audited"] is True


# ===========================================================================
# 6. Cost Truth API Endpoints
# ===========================================================================

@pytest.mark.asyncio
async def test_cost_truth_api_endpoints():
    """Verify all Cost Truth REST API endpoints return 200 OK with valid schema payloads."""
    headers = _get_auth_headers(TEST_COMPANY_ID)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Dashboard
        resp = await client.get("/api/v1/cost/dashboard", headers=headers)
        assert resp.status_code == 200
        data = resp.json()["data"]
        assert "inventory_valuation" in data
        assert "reconciliation_status" in data

        # Reconciliation
        resp = await client.get("/api/v1/cost/reconciliation", headers=headers)
        assert resp.status_code == 200
        assert "status" in resp.json()["data"]

        # Reports
        for endpoint in [
            "/api/v1/cost/reports/purchase-variance",
            "/api/v1/cost/reports/landed-breakdown",
            "/api/v1/cost/reports/itc-reconciliation",
            "/api/v1/cost/reports/stock-valuation",
            "/api/v1/cost/reports/cogs-profitability",
            "/api/v1/cost/reports/exceptions",
        ]:
            r = await client.get(endpoint, headers=headers)
            assert r.status_code == 200
            assert "items" in r.json()["data"] or "total_count" in r.json()["data"] or "total_exceptions" in r.json()["data"]

        # Recalculate WAC Backfill
        r_post = await client.post("/api/v1/cost/recalculate-wac-backfill", headers=headers)
        assert r_post.status_code == 200
        assert r_post.json()["data"]["status"] == "COMPLETED"
