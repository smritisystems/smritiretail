"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.16.0
Created      : 2026-08-25
Modified     : 2026-08-25
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import uuid
import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy import select

from app.main import app
from app.db.session import get_company_sessionmaker
from app.core.security import create_access_token
from app.models.inventory import Product, StockMovement
from app.services.stock_acct_svc import StockAccountingBoundaryService
from app.schemas.stock_acct import (
    StockMovementRecordRequest,
    JournalVoucherCreateRequest,
    JournalEntryLine,
)


def _get_auth_headers(role: str = "SYSADMIN") -> dict:
    token = create_access_token(
        data={
            "sub": "usr-super",
            "username": "usr_super",
            "role": role,
            "company_id": "COMP-001",
            "branch_id": "BR-001",
            "tenant_id": "smriti001",
            "db_name": "smriti001",
            "is_active": True,
        }
    )
    return {
        "Authorization": f"Bearer {token}",
        "X-Company-ID": "COMP-001",
        "X-Company-Code": "001",
    }


@pytest.mark.asyncio
async def test_record_authoritative_stock_movement():
    """Verify recording stock movements writes immutable audit logs and adjusts on-hand balances."""
    sessionmaker = get_company_sessionmaker("smriti001")
    unique_suffix = uuid.uuid4().hex[:6]
    product_id = f"prod_{unique_suffix}"
    sku = f"SKU-{unique_suffix.upper()}"
    barcode_val = f"890{uuid.uuid4().int % 10000000000:010d}"

    async with sessionmaker() as session:
        # Create test product
        p = Product(
            id=product_id,
            company_id="COMP-001",
            code=sku,
            sku=sku,
            barcode=barcode_val,
            hsn_code="0000",
            name=f"Stock Test Item {unique_suffix}",
            stock=0,
            price=500.0,
            cost_price=300.0,
            mrp=500.0,
            category="TEST",
        )
        session.add(p)
        await session.commit()

        # 1. Inward GRN Movement: +50 units
        req_in = StockMovementRecordRequest(
            product_id=product_id,
            quantity=50.0,
            movement_type="INWARD_GRN",
            reference_doc_type="GRN",
            reference_doc_id=f"GRN-{unique_suffix.upper()}",
            warehouse_id="WH-MAIN",
            unit_cost=300.0,
            remarks="Initial inventory receipt",
        )
        mov_in = await StockAccountingBoundaryService.record_stock_movement(
            session=session, company_id="COMP-001", req=req_in, user_id="usr-test"
        )
        assert mov_in is not None
        assert mov_in.quantity == 50.0

        # Reload product
        p_reloaded = (await session.execute(select(Product).where(Product.id == product_id))).scalars().first()
        assert p_reloaded.stock == 50

        # 2. Outward Sale Movement: -15 units
        req_out = StockMovementRecordRequest(
            product_id=product_id,
            quantity=15.0,
            movement_type="OUTWARD_SALE",
            reference_doc_type="SALES_INVOICE",
            reference_doc_id=f"INV-{unique_suffix.upper()}",
            remarks="POS Retail Sale",
        )
        mov_out = await StockAccountingBoundaryService.record_stock_movement(
            session=session, company_id="COMP-001", req=req_out, user_id="usr-test"
        )
        assert mov_out is not None

        # Verify net stock: 50 - 15 = 35
        p_reloaded_2 = (await session.execute(select(Product).where(Product.id == product_id))).scalars().first()
        assert p_reloaded_2.stock == 35


@pytest.mark.asyncio
async def test_rebuild_materialized_balances_from_movements():
    """Verify materialized balances are accurately rebuildable from immutable movement ledgers."""
    sessionmaker = get_company_sessionmaker("smriti001")
    unique_suffix = uuid.uuid4().hex[:6]
    product_id = f"prod_reb_{unique_suffix}"
    sku = f"SKU-REB-{unique_suffix.upper()}"
    barcode_val = f"890{uuid.uuid4().int % 10000000000:010d}"

    async with sessionmaker() as session:
        p = Product(
            id=product_id,
            company_id="COMP-001",
            code=sku,
            sku=sku,
            barcode=barcode_val,
            hsn_code="0000",
            name=f"Rebuild Item {unique_suffix}",
            stock=0,
            price=200.0,
            cost_price=100.0,
            mrp=200.0,
            category="TEST",
        )
        session.add(p)
        await session.commit()

        # Inward 100, Outward 20, Adjustment +10 -> Net should be 90
        await StockAccountingBoundaryService.record_stock_movement(
            session, "COMP-001", StockMovementRecordRequest(product_id=product_id, quantity=100.0, movement_type="INWARD_GRN")
        )
        await StockAccountingBoundaryService.record_stock_movement(
            session, "COMP-001", StockMovementRecordRequest(product_id=product_id, quantity=20.0, movement_type="OUTWARD_SALE")
        )
        await StockAccountingBoundaryService.record_stock_movement(
            session, "COMP-001", StockMovementRecordRequest(product_id=product_id, quantity=10.0, movement_type="ADJUSTMENT_IN")
        )

        # Run rebuild
        rebuild_res = await StockAccountingBoundaryService.rebuild_materialized_balances_from_movements(
            session=session, company_id="COMP-001", fix_drift=False
        )
        assert rebuild_res is not None

        item_match = next((i for i in rebuild_res.items if i.product_id == product_id), None)
        assert item_match is not None
        assert item_match.materialized_on_hand == 90.0
        assert item_match.computed_from_movements == 90.0
        assert item_match.drift_quantity == 0.0
        assert item_match.has_drift is False
        assert item_match.status == "BALANCED"


@pytest.mark.asyncio
async def test_double_entry_equality_invariant_enforcement():
    """Verify strict double-entry balance: Debits == Credits succeeds; unbalanced fails closed."""
    sessionmaker = get_company_sessionmaker("smriti001")
    unique_suffix = uuid.uuid4().hex[:6]

    async with sessionmaker() as session:
        # 1. Balanced Voucher: Debit Cash 1180, Credit Sales 1000, Credit GST 180
        req_balanced = JournalVoucherCreateRequest(
            voucher_no=f"JV-BAL-{unique_suffix.upper()}",
            voucher_type="SALES_INVOICE",
            narration="Balanced retail invoice voucher",
            entries=[
                JournalEntryLine(account_code="CASH-001", account_name="Cash in Hand", debit_amount=1180.0, credit_amount=0.0),
                JournalEntryLine(account_code="REV-001", account_name="Sales Revenue", debit_amount=0.0, credit_amount=1000.0),
                JournalEntryLine(account_code="TAX-GST-OUT", account_name="Output GST 18%", debit_amount=0.0, credit_amount=180.0),
            ],
        )
        res = await StockAccountingBoundaryService.post_balanced_journal_voucher(
            session=session, company_id="COMP-001", req=req_balanced, created_by="usr-acct"
        )
        assert res.is_balanced is True
        assert res.total_debit == 1180.0
        assert res.total_credit == 1180.0
        assert res.entries_count == 3

        # 2. Unbalanced Voucher: Debit 1000, Credit 950 -> Must fail closed
        req_unbalanced = JournalVoucherCreateRequest(
            voucher_no=f"JV-UNBAL-{unique_suffix.upper()}",
            voucher_type="JOURNAL",
            narration="Unbalanced voucher test",
            entries=[
                JournalEntryLine(account_code="EXP-001", debit_amount=1000.0, credit_amount=0.0),
                JournalEntryLine(account_code="BANK-001", debit_amount=0.0, credit_amount=950.0),
            ],
        )
        with pytest.raises(ValueError) as excinfo:
            await StockAccountingBoundaryService.post_balanced_journal_voucher(
                session=session, company_id="COMP-001", req=req_unbalanced
            )
        assert "Double-entry balance violation" in str(excinfo.value)


@pytest.mark.asyncio
async def test_stock_reconciliation_detects_drift():
    """Verify stock reconciliation job detects manual/unauthorized stock mutations and fixes drift."""
    sessionmaker = get_company_sessionmaker("smriti001")
    unique_suffix = uuid.uuid4().hex[:6]
    product_id = f"prod_drift_{unique_suffix}"
    sku = f"SKU-DRIFT-{unique_suffix.upper()}"
    barcode_val = f"890{uuid.uuid4().int % 10000000000:010d}"

    async with sessionmaker() as session:
        p = Product(
            id=product_id,
            company_id="COMP-001",
            code=sku,
            sku=sku,
            barcode=barcode_val,
            hsn_code="0000",
            name=f"Drift Test Product {unique_suffix}",
            stock=0,
            price=100.0,
            cost_price=50.0,
            mrp=100.0,
            category="TEST",
        )
        session.add(p)
        await session.commit()

        # Inward 50
        await StockAccountingBoundaryService.record_stock_movement(
            session, "COMP-001", StockMovementRecordRequest(product_id=product_id, quantity=50.0, movement_type="INWARD_GRN")
        )

        # Intentionally tamper materialized stock (e.g. set to 80 instead of 50)
        p_tamper = (await session.execute(select(Product).where(Product.id == product_id))).scalars().first()
        p_tamper.stock = 80
        await session.commit()

        # Run stock reconciliation -> Must detect drift
        audit_rep = await StockAccountingBoundaryService.run_stock_reconciliation(session, "COMP-001")
        assert audit_rep.drift_products >= 1

        tampered_drift_item = next((d for d in audit_rep.drift_items if d.product_id == product_id), None)
        assert tampered_drift_item is not None
        assert tampered_drift_item.materialized_on_hand == 80.0
        assert tampered_drift_item.computed_from_movements == 50.0
        assert tampered_drift_item.drift_quantity == 30.0
        assert tampered_drift_item.status == "OVERSTATED"

        # Now rectify drift via rebuild with fix_drift=True
        rebuild_fixed = await StockAccountingBoundaryService.rebuild_materialized_balances_from_movements(
            session, "COMP-001", fix_drift=True
        )
        p_fixed = (await session.execute(select(Product).where(Product.id == product_id))).scalars().first()
        assert p_fixed.stock == 50


@pytest.mark.asyncio
async def test_gl_trial_balance_reconciliation():
    """Verify General Ledger reconciliation job verifies total debits == total credits and voucher validity."""
    sessionmaker = get_company_sessionmaker("smriti001")
    unique_suffix = uuid.uuid4().hex[:6]

    async with sessionmaker() as session:
        # Post a balanced voucher
        req = JournalVoucherCreateRequest(
            voucher_no=f"JV-RECON-{unique_suffix.upper()}",
            voucher_type="SUPPLIER_PAYMENT",
            narration="Payment to supplier",
            entries=[
                JournalEntryLine(account_code="SUPP-ACC-01", debit_amount=5000.0, credit_amount=0.0),
                JournalEntryLine(account_code="BANK-HDFC", debit_amount=0.0, credit_amount=5000.0),
            ],
        )
        await StockAccountingBoundaryService.post_balanced_journal_voucher(session, "COMP-001", req)

        gl_audit = await StockAccountingBoundaryService.run_gl_reconciliation(session, "COMP-001")
        assert gl_audit is not None
        assert gl_audit.is_trial_balance_equal is True
        assert gl_audit.unbalanced_vouchers_count == 0
        assert gl_audit.trial_balance_drift == 0.0


@pytest.mark.asyncio
async def test_api_boundary_endpoints():
    """Verify REST API boundary endpoints for stock movement logging, rebuild, GL posting, and audits."""
    unique_suffix = uuid.uuid4().hex[:4]
    transport = ASGITransport(app=app)

    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Post Balanced Journal Voucher via API
        jv_res = await client.post(
            "/api/v1/boundaries/gl/post",
            json={
                "voucher_no": f"JV-API-{unique_suffix.upper()}",
                "voucher_type": "JOURNAL",
                "narration": "API Balanced JV Test",
                "entries": [
                    {"account_code": "ASSET-INV", "debit_amount": 2500.0, "credit_amount": 0.0},
                    {"account_code": "CASH-REG", "debit_amount": 0.0, "credit_amount": 2500.0},
                ],
            },
            headers=_get_auth_headers(),
        )
        assert jv_res.status_code == 201
        jv_data = jv_res.json()
        assert jv_data["is_balanced"] is True
        assert jv_data["total_debit"] == 2500.0

        # 2. Stock Rebuild Audit endpoint
        rebuild_res = await client.post(
            "/api/v1/boundaries/stock/rebuild?fix_drift=false",
            headers=_get_auth_headers(),
        )
        assert rebuild_res.status_code == 200
        rebuild_data = rebuild_res.json()
        assert "total_products_checked" in rebuild_data

        # 3. GL Reconciliation Audit endpoint
        gl_recon_res = await client.get(
            "/api/v1/boundaries/reconcile/gl",
            headers=_get_auth_headers(),
        )
        assert gl_recon_res.status_code == 200
        assert gl_recon_res.json()["is_trial_balance_equal"] is True

        # 4. Comprehensive Financial Reconciliation endpoint
        fin_recon_res = await client.get(
            "/api/v1/boundaries/reconcile/financial",
            headers=_get_auth_headers(),
        )
        assert fin_recon_res.status_code == 200
        assert "overall_health" in fin_recon_res.json()
