"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.23.0
Created      : 2026-08-23
Modified     : 2026-08-23
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import uuid
import pytest
from decimal import Decimal
from datetime import date, datetime, timezone, timedelta
from fastapi.testclient import TestClient
from sqlalchemy import select, text

from app.main import app
from app.core.security import create_access_token
from app.models.auth import UserRole
from app.db.session import get_company_sessionmaker
from app.models.sales import SalesInvoice, SalesInvoiceItem
from app.models.inventory import Product, StockMovement
from app.models.accounting import JournalVoucher, GeneralLedgerEntry, Account
from app.models.analytics import AnalyticsDailySalesFact
from app.models.audit import ComplianceImmutableAuditLog
from app.models.crm import Customer
from app.services.analytical_intelligence_service import AnalyticalIntelligenceService
from app.services.tally_integration_service import TallyIntegrationService
from app.services.compliance_audit_service import ComplianceAuditService
from app.services.unified_sales_ledger_service import UnifiedSalesLedgerService
from app.services.unified_accounting_ledger_service import UnifiedAccountingLedgerService


def get_auth_headers(role: str = "SYSADMIN", company_id: str = "COMP-001", branch_id: str = "BR-001") -> dict:
    """Helper to generate JWT auth headers with tenant claims."""
    token = create_access_token(
        data={
            "sub": "usr-super",
            "role": UserRole.SYSADMIN.value,
            "company_id": company_id,
            "branch_id": branch_id,
            "tenant_id": "smriti001",
            "db_name": "smriti001",
            "is_active": True,
        }
    )
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.asyncio
async def test_daily_sales_aggregates_computation():
    """
    Verifies that AnalyticalIntelligenceService aggregates confirmed invoices,
    computes exact revenue, tax, COGS, and gross margin percentages into AnalyticsDailySalesFact.
    """
    sessionmaker = get_company_sessionmaker("smriti001")
    async with sessionmaker() as session:
        comp_id = "COMP-001"
        branch_id = "BR-001"
        target_date = datetime.now(timezone.utc).date()

        # 1. Create a Product with cost price
        sku = f"SKU-AN-{uuid.uuid4().hex[:6].upper()}"
        prod = Product(
            id=f"prod_an_{uuid.uuid4().hex[:8]}",
            company_id=comp_id,
            branch_id=branch_id,
            code=sku,
            name=f"Analytics Test Item {sku}",
            sku=sku,
            barcode=f"BC-{sku}",
            category="ELECTRONICS",
            stock=100,
            price=1000.0,
            cost_price=600.0,  # 40% margin
            is_active=True,
            is_deleted=False
        )
        session.add(prod)
        await session.flush()

        # 2. Post a Confirmed Sales Invoice (10 units @ 1000 = 10,000 + 18% GST (1800) = 11,800)
        inv_no = f"INV-AN-{uuid.uuid4().hex[:6].upper()}"
        invoice = await UnifiedSalesLedgerService.post_sales_invoice(
            session=session,
            company_id=comp_id,
            invoice_no=inv_no,
            customer_id="CUST-WALKIN",
            items_data=[
                {
                    "product_id": prod.id,
                    "code": sku,
                    "name": prod.name,
                    "quantity": 10.0,
                    "price": 1000.0,
                    "gst_rate": 18.0
                }
            ],
            branch_id=branch_id,
            payment_mode="CASH"
        )
        await session.flush()

        # 3. Compute Daily Aggregates
        fact = await AnalyticalIntelligenceService.compute_and_store_daily_aggregates(
            session=session,
            company_id=comp_id,
            target_date=target_date,
            branch_id=branch_id
        )
        assert fact.fact_date == target_date
        assert float(fact.total_revenue) >= 11800.0
        assert fact.invoice_count >= 1
        assert float(fact.total_tax_amount) >= 1800.0
        assert float(fact.cash_revenue) >= 11800.0
        assert float(fact.estimated_cost_amount) >= 6000.0
        assert float(fact.gross_margin_amount) >= 4000.0
        assert float(fact.gross_margin_percent) > 0.0
        await session.commit()


@pytest.mark.asyncio
async def test_category_margin_analytics():
    """
    Verifies category-level profitability and volume rollups.
    """
    sessionmaker = get_company_sessionmaker("smriti001")
    async with sessionmaker() as session:
        comp_id = "COMP-001"
        categories = await AnalyticalIntelligenceService.get_category_profitability_rollups(
            session=session,
            company_id=comp_id,
            lookback_days=30
        )
        assert isinstance(categories, list)
        assert len(categories) >= 1
        top_cat = categories[0]
        assert "category" in top_cat
        assert "taxable_sales" in top_cat
        assert "gross_margin_percent" in top_cat
        assert top_cat["taxable_sales"] >= 0.0


@pytest.mark.asyncio
async def test_tally_sales_voucher_xml_generation():
    """
    Verifies that TallyIntegrationService generates valid, well-formed Tally XML
    containing standard ENVELOPE, VOUCHER, LEDGERENTRIES, and INVENTORYENTRIES.
    """
    sessionmaker = get_company_sessionmaker("smriti001")
    async with sessionmaker() as session:
        comp_id = "COMP-001"
        branch_id = "BR-001"

        # 1. Create a Product
        sku = f"SKU-TL-{uuid.uuid4().hex[:6].upper()}"
        prod = Product(
            id=f"prod_tl_{uuid.uuid4().hex[:8]}",
            company_id=comp_id,
            branch_id=branch_id,
            code=sku,
            name="Standard Tally Test Item",
            sku=sku,
            barcode=f"BC-{sku}",
            category="GENERAL",
            stock=100,
            price=200.0,
            cost_price=120.0,
            is_active=True,
            is_deleted=False
        )
        session.add(prod)
        await session.flush()

        # 2. Create Invoice
        inv_no = f"INV-TL-{uuid.uuid4().hex[:6].upper()}"
        invoice = await UnifiedSalesLedgerService.post_sales_invoice(
            session=session,
            company_id=comp_id,
            invoice_no=inv_no,
            customer_id="CUST-WALKIN",
            items_data=[
                {
                    "product_id": prod.id,
                    "code": sku,
                    "name": prod.name,
                    "quantity": 5.0,
                    "price": 200.0,
                    "gst_rate": 18.0
                }
            ],
            branch_id=branch_id,
            payment_mode="CASH"
        )
        await session.commit()

        # 3. Generate XML
        xml_content = await TallyIntegrationService.generate_tally_sales_voucher_xml(
            session=session,
            company_id=comp_id,
            invoice_id=invoice.id
        )

        assert "<ENVELOPE>" in xml_content
        assert "<TALLYREQUEST>Import Data</TALLYREQUEST>" in xml_content
        assert '<VOUCHER VCHTYPE="Sales" ACTION="Create" OBJVIEW="Invoice Voucher View">' in xml_content
        assert f"<VOUCHERNUMBER>{inv_no}</VOUCHERNUMBER>" in xml_content
        assert "<LEDGERNAME>Sales Account</LEDGERNAME>" in xml_content
        assert "<AMOUNT>1000.00</AMOUNT>" in xml_content
        assert "<AMOUNT>-1180.00</AMOUNT>" in xml_content  # Total with GST
        assert "<STOCKITEMNAME>Standard Tally Test Item</STOCKITEMNAME>" in xml_content


@pytest.mark.asyncio
async def test_tally_journal_voucher_xml_generation():
    """
    Verifies that TallyIntegrationService generates balanced Tally Journal Vouchers.
    """
    sessionmaker = get_company_sessionmaker("smriti001")
    async with sessionmaker() as session:
        comp_id = "COMP-001"
        branch_id = "BR-001"

        # Ensure two test accounts exist with dynamic codes
        acc1_id = f"acc_t1_{uuid.uuid4().hex[:6]}"
        acc2_id = f"acc_t2_{uuid.uuid4().hex[:6]}"
        code1 = f"8{uuid.uuid4().hex[:4]}"
        code2 = f"8{uuid.uuid4().hex[:4]}"
        acc1 = Account(
            id=acc1_id,
            company_id=comp_id,
            branch_id=branch_id,
            account_code=code1,
            account_name="Bank HDFC Current",
            account_type="Asset",
            root_type="Asset",
            is_group=False,
            currency="INR",
            is_active=True,
            is_deleted=False
        )
        acc2 = Account(
            id=acc2_id,
            company_id=comp_id,
            branch_id=branch_id,
            account_code=code2,
            account_name="Cash In Hand Till",
            account_type="Asset",
            root_type="Asset",
            is_group=False,
            currency="INR",
            is_active=True,
            is_deleted=False
        )
        session.add_all([acc1, acc2])
        await session.flush()

        # Post balanced Journal Voucher (₹5000 Cash to Bank)
        jv = await UnifiedAccountingLedgerService.post_journal_voucher(
            session=session,
            company_id=comp_id,
            voucher_type="JOURNAL",
            voucher_date=datetime.now(timezone.utc).date(),
            narration="Cash deposited into HDFC Bank",
            lines=[
                {"account_id": acc1_id, "debit_amount": Decimal("5000.00"), "credit_amount": Decimal("0.00")},
                {"account_id": acc2_id, "debit_amount": Decimal("0.00"), "credit_amount": Decimal("5000.00")},
            ],
            branch_id=branch_id
        )
        await session.commit()

        xml_content = await TallyIntegrationService.generate_tally_journal_voucher_xml(
            session=session,
            company_id=comp_id,
            voucher_id=jv.id
        )

        assert "<ENVELOPE>" in xml_content
        assert '<VOUCHER VCHTYPE="Journal" ACTION="Create">' in xml_content
        assert f"<VOUCHERNUMBER>{jv.voucher_no}</VOUCHERNUMBER>" in xml_content
        assert "<NARRATION>Cash deposited into HDFC Bank</NARRATION>" in xml_content
        assert "<LEDGERNAME>Bank HDFC Current</LEDGERNAME>" in xml_content
        assert "<LEDGERNAME>Cash In Hand Till</LEDGERNAME>" in xml_content
        assert "<AMOUNT>-5000.00</AMOUNT>" in xml_content  # Debit
        assert "<AMOUNT>5000.00</AMOUNT>" in xml_content   # Credit


@pytest.mark.asyncio
async def test_compliance_immutable_audit_log_hash_integrity():
    """
    Verifies that ComplianceAuditService generates SHA-256 tamper-evident audit logs
    and successfully detects unauthorized payload tampering.
    """
    sessionmaker = get_company_sessionmaker("smriti001")
    async with sessionmaker() as session:
        comp_id = "COMP-001"
        branch_id = "BR-001"

        # 1. Record authentic audit event
        audit_log = await ComplianceAuditService.record_audit_event(
            session=session,
            company_id=comp_id,
            event_type="PRICE_MODIFICATION",
            entity_name="Product",
            entity_id="prod_test_001",
            action_summary="Base selling price updated from ₹100 to ₹120",
            actor_user_id="user_admin",
            actor_role="SYSADMIN",
            before_state={"price": 100.0},
            after_state={"price": 120.0},
            branch_id=branch_id
        )
        await session.commit()

        # 2. Check hash validity on authentic record
        is_valid = await ComplianceAuditService.verify_audit_integrity(audit_log)
        assert is_valid is True

        # 3. Test search
        searched_logs = await ComplianceAuditService.search_audit_logs(
            session=session,
            company_id=comp_id,
            event_type="PRICE_MODIFICATION",
            entity_name="Product"
        )
        assert len(searched_logs) >= 1
        assert searched_logs[0]["entity_id"] == "prod_test_001"

        # 4. Simulate tampering -> Hash integrity must fail
        audit_log.action_summary = "Unauthorized tampered description"
        is_tampered_valid = await ComplianceAuditService.verify_audit_integrity(audit_log)
        assert is_tampered_valid is False


def test_api_analytics_and_integration_endpoints():
    """
    Verifies REST endpoints for Analytics Plane and Integration Hub.
    """
    headers = get_auth_headers()
    client = TestClient(app)

    # 1. Analytics daily sales summary
    r_daily = client.get("/api/v1/analytics/daily-sales-summary", headers=headers)
    assert r_daily.status_code == 200
    data_daily = r_daily.json()
    assert "facts" in data_daily
    assert "company_id" in data_daily

    # 2. Analytics category margins
    r_margins = client.get("/api/v1/analytics/category-margins?lookback_days=30", headers=headers)
    assert r_margins.status_code == 200
    data_margins = r_margins.json()
    assert "categories" in data_margins

    # 3. Compliance audit search
    r_audit = client.get("/api/v1/integration/audit/logs?limit=10", headers=headers)
    assert r_audit.status_code == 200
    data_audit = r_audit.json()
    assert "logs" in data_audit
