"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.16.1
Created      : 2026-10-09
Modified     : 2026-10-09
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Phase 1 Operational Hardening Verification Suite
"""

import pytest
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock, patch

from app.models.tenant import Company, Branch
from app.models.inventory import Warehouse
from app.api.deps import TenantContext
from app.services.eway_bill_service import EWayBillService, VALID_GST_STATE_CODES
from app.services.purchase import PurchaseService
from app.core.gst_engine import GST_STATE_CODES


def test_eway_bill_state_codes_parity():
    """Verify VALID_GST_STATE_CODES is unified with canonical GST_STATE_CODES."""
    assert VALID_GST_STATE_CODES is GST_STATE_CODES
    # Verify statutory codes 99, 25, 28 are present
    assert "99" in VALID_GST_STATE_CODES
    assert "25" in VALID_GST_STATE_CODES
    assert "28" in VALID_GST_STATE_CODES
    assert "27" in VALID_GST_STATE_CODES


@pytest.mark.asyncio
@pytest.mark.parametrize("source_type", ["SALES_ORDER", "PACKING_SLIP_CONSOLIDATED"])
async def test_source_invoice_creation_requires_atomic_billing(source_type):
    from fastapi import HTTPException
    from types import SimpleNamespace

    from app.services.sales import SalesService

    service = SalesService(db=AsyncMock(), tenant_ctx=TenantContext(company_id="COMP-XYZ", branch_id="BR-01"))
    with pytest.raises(HTTPException) as error:
        await service.create_sales_invoice(
            SimpleNamespace(source_document_type=source_type, customer_po_id=None)
        )

    assert error.value.status_code == 410
    assert "atomic" in error.value.detail.lower()


@pytest.mark.asyncio
@pytest.mark.parametrize("source_type", ["SALES_ORDER", "PACKING_SLIP_CONSOLIDATED"])
async def test_canonical_writer_blocks_unsafe_source_billing(source_type):
    from fastapi import HTTPException
    from types import SimpleNamespace

    from app.services.canonical_sales_writer import CanonicalSalesPostingWriter

    request = SimpleNamespace(
        source_document_type=source_type,
        context=SimpleNamespace(source_channel="DIRECT"),
    )
    with pytest.raises(HTTPException) as error:
        await CanonicalSalesPostingWriter.post_sales_transaction(
            session=AsyncMock(),
            req=request,
        )

    assert error.value.status_code == 410


def test_source_billing_commit_is_disabled_by_default(monkeypatch):
    from app.services.source_billing import source_billing_commit_enabled

    monkeypatch.delenv("SMRITI_SOURCE_BILLING_ENABLED", raising=False)
    assert source_billing_commit_enabled() is False
    monkeypatch.setenv("SMRITI_SOURCE_BILLING_ENABLED", "true")
    assert source_billing_commit_enabled() is True


@pytest.mark.asyncio
async def test_source_order_prepare_rejects_order_with_packing_slips():
    from fastapi import HTTPException
    from types import SimpleNamespace

    from app.schemas.source_billing import SourceBillingPrepareRequest
    from app.services.source_billing import SourceBillingService

    session = AsyncMock()
    result = MagicMock()
    result.scalar_one_or_none.return_value = "ps-1"
    session.execute.return_value = result
    service = SourceBillingService(
        session,
        TenantContext(company_id="COMP-XYZ", branch_id="BR-01"),
    )
    service._load_order = AsyncMock(return_value=SimpleNamespace(id="order-1"))

    with pytest.raises(HTTPException) as error:
        await service.prepare(SourceBillingPrepareRequest(
            source_type="SALES_ORDER",
            source_document_id="order-1",
        ))

    assert error.value.status_code == 409
    assert "Packing Slips" in error.value.detail


@pytest.mark.asyncio
async def test_source_order_prepare_is_read_only_and_uses_committed_balance():
    from types import SimpleNamespace

    from app.schemas.source_billing import SourceBillingPrepareRequest
    from app.services.source_billing import SourceBillingService

    session = AsyncMock()
    order_line = SimpleNamespace(
        id=71,
        quantity=Decimal("10"),
        billed_quantity=Decimal("1"),
        line_status="OPEN",
        product_id="product-1",
        item_id="item-1",
        variant_id="variant-1",
        code="SKU-1",
        name="Sample item",
        price=Decimal("12.50"),
        gst_rate=Decimal("5"),
        hsn_code="6109",
    )
    order = SimpleNamespace(
        id="order-1",
        order_no="SO-1",
        customer_id="customer-1",
        customer_gstin=None,
        status="OPEN",
        items=[order_line],
    )
    service = SourceBillingService(
        session,
        TenantContext(company_id="COMP-XYZ", branch_id="BR-01"),
    )
    service._load_order = AsyncMock(return_value=order)
    service._require_visible_customer = AsyncMock(return_value=SimpleNamespace(
        id="customer-1",
        name="Customer",
    ))
    service._allocated_order_quantity = AsyncMock(return_value=Decimal("3"))
    result = MagicMock()
    result.scalar_one_or_none.return_value = None
    session.execute.return_value = result

    response = await service.prepare(SourceBillingPrepareRequest(
        source_type="SALES_ORDER",
        source_document_id="order-1",
    ))

    assert response.customer_id == "customer-1"
    assert response.lines[0].previously_billed_quantity == Decimal("3")
    assert response.lines[0].remaining_quantity == Decimal("7")
    assert response.lines[0].unit_price == Decimal("12.50")
    session.commit.assert_not_awaited()
    session.add.assert_not_called()
    session.flush.assert_not_awaited()


@pytest.mark.asyncio
async def test_source_billing_commit_stays_disabled_by_default(monkeypatch):
    from fastapi import HTTPException

    from app.schemas.source_billing import (
        SourceBillingCommitRequest,
        SourceBillingLineRequest,
    )
    from app.schemas.sales import SalesInvoiceBase
    from app.services.source_billing import SourceBillingService

    monkeypatch.delenv("SMRITI_SOURCE_BILLING_ENABLED", raising=False)
    service = SourceBillingService(
        AsyncMock(),
        TenantContext(company_id="COMP-XYZ", branch_id="BR-01"),
    )
    request = SourceBillingCommitRequest(
        source_type="SALES_ORDER",
        source_document_id="order-1",
        lines=[SourceBillingLineRequest(source_line_id="71", quantity=Decimal("1"))],
        invoice=SalesInvoiceBase(),
    )

    with pytest.raises(HTTPException) as error:
        await service.commit(request, "test-idempotency-key")

    assert error.value.status_code == 503


@pytest.mark.asyncio
async def test_dispatched_packing_slip_is_not_preparable_for_billing():
    from fastapi import HTTPException
    from types import SimpleNamespace

    from app.schemas.source_billing import SourceBillingPrepareRequest
    from app.services.source_billing import SourceBillingService

    service = SourceBillingService(
        AsyncMock(),
        TenantContext(company_id="COMP-XYZ", branch_id="BR-01"),
    )
    service._load_packing_slip = AsyncMock(return_value=SimpleNamespace(
        id="ps-1",
        order_id="order-1",
        customer_id="customer-1",
        status="DISPATCHED",
        items=[object()],
    ))
    service._load_order = AsyncMock(return_value=SimpleNamespace(
        id="order-1",
        customer_id="customer-1",
        status="OPEN",
    ))
    service._require_visible_customer = AsyncMock(return_value=SimpleNamespace(
        id="customer-1",
        name="Customer",
    ))

    with pytest.raises(HTTPException) as error:
        await service.prepare(SourceBillingPrepareRequest(
            source_type="PACKING_SLIP",
            source_document_id="ps-1",
        ))

    assert error.value.status_code == 409
    assert "dispatched" in error.value.detail.lower()


@pytest.mark.asyncio
async def test_purchase_jurisdiction_dynamic_resolution():
    """Verify PurchaseService.get_jurisdiction resolves dynamically from company GST number."""
    mock_db = AsyncMock()
    tenant = TenantContext(company_id="COMP-XYZ", branch_id="BR-01")
    service = PurchaseService(db=mock_db, tenant=tenant)

    # Mock PurchaseJurisdictionConfig returning None
    mock_comp = MagicMock(spec=Company)
    mock_comp.gst_number = "29AABCU9603R1ZM"  # Karnataka
    mock_comp.state = "Karnataka"

    async def mock_execute(stmt, *args, **kwargs):
        stmt_str = str(stmt).lower()
        res = MagicMock()
        if "purchase_jurisdiction_configs" in stmt_str:
            res.scalars.return_value.first.return_value = None
        elif "companies" in stmt_str or "from companies" in stmt_str:
            res.scalars.return_value.first.return_value = mock_comp
        else:
            res.scalars.return_value.first.return_value = None
        return res

    mock_db.execute.side_effect = mock_execute

    jurisdiction = await service.get_jurisdiction()
    assert jurisdiction == "29"  # Karnataka, not hardcoded "DL"


@pytest.mark.asyncio
async def test_dispatch_from_snapshot_dynamic_seller_identity():
    """
    Verify that CanonicalSalesPostingWriter.post_sales_transaction populates
    dispatch_from_snapshot with the dynamic company legal name and GSTIN,
    and NEVER defaults to 'Tattly Threads' or '27AAXFT2508H1ZR'.
    """
    from app.schemas.canonical_posting import (
        CanonicalPostingRequest,
        CanonicalPostingContext,
        CanonicalPostingLineItem,
        CanonicalTenderItem,
        BillingCalculationResult,
        BillingCalculatedLine,
    )
    from app.services.canonical_sales_writer import CanonicalSalesPostingWriter
    from app.services.inventory_wms import InventoryWmsService
    from app.services.headless_billing import HeadlessBillingCore
    from app.services.transaction_integrity_engine import TransactionIntegrityEngine
    from app.services.identity.engine import IdentityEngine
    from app.services.numbering import NumberingService
    from app.services.system_parameter import SystemParameterService

    mock_db = AsyncMock()
    mock_db.add = MagicMock()

    # Dynamic tenant company
    custom_company_name = "Acme Retail Enterprise India Ltd"
    custom_gstin = "24AAACA1234A1Z5"  # Gujarat

    mock_comp = MagicMock(spec=Company)
    mock_comp.id = "COMP-ACME"
    mock_comp.name = custom_company_name
    mock_comp.gst_number = custom_gstin
    mock_comp.state = "Gujarat"

    mock_branch = MagicMock(spec=Branch)
    mock_branch.id = "BR-AHM"
    mock_branch.code = "AHM-01"
    mock_branch.company_id = "COMP-ACME"
    mock_branch.name = "Ahmedabad Central Store"
    mock_branch.gst_number = custom_gstin
    mock_branch.state_code = "24"

    mock_wh = MagicMock(spec=Warehouse)
    mock_wh.id = "WH-AHM"
    mock_wh.code = "WH-AHM"
    mock_wh.name = "Central Depot Ahmedabad"
    mock_wh.company_id = "COMP-ACME"
    mock_wh.is_deleted = False
    mock_wh.is_active = True
    mock_wh.pincode = "380001"
    mock_wh.state = "Gujarat"
    mock_wh.address = "SG Highway, Ahmedabad"
    mock_wh.contact_person = "Depot Manager"
    mock_wh.phone = "9123456780"

    async def mock_execute(stmt, *args, **kwargs):
        stmt_str = str(stmt).lower()
        res = MagicMock()
        if "from companies" in stmt_str or "into companies" in stmt_str:
            res.scalars.return_value.first.return_value = mock_comp
        elif "from branches" in stmt_str or "into branches" in stmt_str:
            res.scalars.return_value.first.return_value = mock_branch
        elif "from warehouses" in stmt_str or "into warehouses" in stmt_str:
            res.scalars.return_value.first.return_value = mock_wh
        else:
            res.scalars.return_value.first.return_value = None
        return res

    mock_db.execute.side_effect = mock_execute

    req = CanonicalPostingRequest(
        context=CanonicalPostingContext(
            company_id="COMP-ACME",
            branch_id="BR-AHM",
            terminal_id="TERM-01",
            warehouse_id="WH-AHM",
            idempotency_key="TEST-IDEM-PHASE1-01",
            source_channel="POS_RETAIL",
        ),
        customer_id=None,
        dispatch_from_location_id="WH-AHM",
        items=[
            CanonicalPostingLineItem(
                code="PROD-01",
                product_id="prod_01",
                quantity=Decimal("1.0000"),
                unit_price=Decimal("100.00"),
                gst_rate=Decimal("18.00"),
            )
        ],
        tenders=[
            CanonicalTenderItem(tender_type="CASH", amount=Decimal("118.00"))
        ],
    )

    calc_line = BillingCalculatedLine(
        product_id="prod_01",
        item_id="item_01",
        variant_id="var_01",
        code="PROD-01",
        name="Product 1",
        line_no=1,
        quantity=Decimal("1.0000"),
        unit_price=Decimal("100.00"),
        disc_pct=Decimal("0.00"),
        disc_amount=Decimal("0.00"),
        taxable_value=Decimal("100.00"),
        gst_rate=Decimal("18.00"),
        cgst_amount=Decimal("9.00"),
        sgst_amount=Decimal("9.00"),
        igst_amount=Decimal("0.00"),
        tax_amount=Decimal("18.00"),
        total_amount=Decimal("118.00"),
        is_tax_inclusive=False,
    )

    billing_res = BillingCalculationResult(
        gross_amount=Decimal("100.00"),
        discount_amount=Decimal("0.00"),
        discounted_base=Decimal("100.00"),
        taxable_amount=Decimal("100.00"),
        cgst_amount=Decimal("9.00"),
        sgst_amount=Decimal("9.00"),
        igst_amount=Decimal("0.00"),
        tax_total=Decimal("18.00"),
        subtotal=Decimal("118.00"),
        round_off=Decimal("0.00"),
        net_amount=Decimal("118.00"),
        items_count=1,
        total_quantity=Decimal("1.0000"),
        lines=[calc_line],
        batch_deductions=[],
    )

    saved_invoices = []

    def mock_add(entity):
        from app.models.sales import SalesInvoice
        if isinstance(entity, SalesInvoice):
            saved_invoices.append(entity)

    mock_db.add.side_effect = mock_add

    with patch.object(SystemParameterService, "resolve_parameter", new_callable=AsyncMock) as mock_resolve, \
         patch.object(InventoryWmsService, "atomic_mutate_batch_stock", new_callable=AsyncMock), \
         patch.object(HeadlessBillingCore, "calculate_billing", new_callable=AsyncMock) as mock_calc, \
         patch.object(TransactionIntegrityEngine, "try_acquire_advisory_lock", new_callable=AsyncMock) as mock_lock, \
         patch.object(IdentityEngine, "allocate_internal", new_callable=AsyncMock) as mock_ident, \
         patch.object(NumberingService, "allocate_voucher_number", new_callable=AsyncMock) as mock_num:

        mock_lock.return_value = True
        mock_ident.return_value = ("inv_phase1", "INV_P1_01")
        mock_num.return_value = "INV-2026-0999"
        mock_calc.return_value = billing_res
        mock_resolve.return_value = None

        await CanonicalSalesPostingWriter.post_sales_transaction(session=mock_db, req=req, commit=False)

        assert len(saved_invoices) == 1
        inv = saved_invoices[0]
        snapshot = inv.dispatch_from_snapshot
        assert snapshot is not None

        # Verify dynamic seller name
        assert snapshot["name"] == custom_company_name
        assert snapshot["name"] != "Tattly Threads"

        # Verify dynamic seller GSTIN
        assert snapshot["gstin"] == custom_gstin
        assert snapshot["gstin"] != "27AAXFT2508H1ZR"

        # Verify dynamic dispatch state
        assert snapshot["state_code"] == "24"
        assert snapshot["state"] == "Gujarat"


@pytest.mark.asyncio
async def test_purchase_jurisdiction_fails_explicitly_when_absent():
    """Verify PurchaseService.get_jurisdiction FAILS explicitly and NEVER defaults to 'DL'."""
    from fastapi import HTTPException
    from app.services.system_parameter import SystemParameterService

    mock_db = AsyncMock()
    tenant = TenantContext(company_id="COMP-NODEF", branch_id="BR-NODEF")
    service = PurchaseService(db=mock_db, tenant=tenant)

    # Empty company with no GSTIN or state
    mock_comp = MagicMock(spec=Company)
    mock_comp.gst_number = None
    mock_comp.state = None
    mock_comp.state_code = None

    async def mock_execute(stmt, *args, **kwargs):
        res = MagicMock()
        res.scalars.return_value.first.return_value = None
        return res

    mock_db.execute.side_effect = mock_execute

    with patch.object(SystemParameterService, "resolve_parameter", return_value=None):
        with pytest.raises(HTTPException) as exc_info:
            await service.get_jurisdiction()
        assert exc_info.value.status_code == 400
        assert "SMRITI-JURISDICTION-001" in exc_info.value.detail


@pytest.mark.asyncio
async def test_purchase_jurisdiction_respects_system_parameter():
    """Verify PurchaseService.get_jurisdiction respects configured system parameter."""
    from app.services.system_parameter import SystemParameterService

    mock_db = AsyncMock()
    tenant = TenantContext(company_id="COMP-PARAM", branch_id="BR-PARAM")
    service = PurchaseService(db=mock_db, tenant=tenant)

    async def mock_execute(stmt, *args, **kwargs):
        res = MagicMock()
        res.scalars.return_value.first.return_value = None
        return res

    mock_db.execute.side_effect = mock_execute

    mock_param = MagicMock()
    mock_param.effective_value = "KA"

    with patch.object(SystemParameterService, "resolve_parameter", return_value=mock_param):
        jurisdiction = await service.get_jurisdiction()
        assert jurisdiction == "KA"
        assert jurisdiction != "DL"


@pytest.mark.asyncio
async def test_sales_convert_to_invoice_fails_explicitly_when_jurisdiction_absent():
    """Verify SalesService.convert_order_to_invoice FAILS explicitly and NEVER defaults to '27'."""
    from fastapi import HTTPException
    from app.services.sales import SalesService
    from app.models.sales import SalesOrder, SalesOrderItem
    from app.services.system_parameter import SystemParameterService

    mock_db = AsyncMock()
    service = SalesService(db=mock_db, tenant_ctx=TenantContext(company_id="comp-noseller", branch_id="br-noseller"))

    mock_so = MagicMock(spec=SalesOrder)
    mock_so.id = "so-123"
    mock_so.order_number = "SO-123"
    mock_so.company_id = "comp-noseller"
    mock_so.branch_id = "br-noseller"
    mock_so.customer_gstin = None

    mock_item = MagicMock(spec=SalesOrderItem)
    mock_item.pending_quantity = Decimal("2.0")
    mock_item.quantity = Decimal("2.0")
    mock_item.price = Decimal("100.00")
    mock_item.gst_rate = Decimal("18.00")
    mock_item.mrp = Decimal("100.00")
    mock_item.disc_pct = Decimal("0.00")
    mock_item.line_status = "PENDING"
    mock_item.id = "item-1"

    mock_so.items = [mock_item]
    mock_so.allocations = []
    mock_so.pending_qty = Decimal("2.0")

    async def mock_execute(stmt, *args, **kwargs):
        stmt_str = str(stmt).lower()
        res = MagicMock()
        if "sales_orders" in stmt_str:
            res.scalars.return_value.first.return_value = mock_so
            res.unique.return_value.scalars.return_value.first.return_value = mock_so
        elif "sales_order_items" in stmt_str:
            res.scalars.return_value.all.return_value = [mock_item]
        else:
            # Company/Branch has no GSTIN or state
            res.scalars.return_value.first.return_value = None
        return res

    mock_db.execute.side_effect = mock_execute

    from app.services.documents_engine import DocumentsEngine
    mock_seq = MagicMock()
    mock_seq.document_no = "INV-2026-0001"

    with patch.object(SystemParameterService, "resolve_parameter", return_value=None), \
         patch.object(DocumentsEngine, "allocate_next_number_in_transaction", new_callable=AsyncMock, return_value=mock_seq):
        with pytest.raises(HTTPException) as exc_info:
            await service.convert_sales_order_to_invoice("so-123")
        assert exc_info.value.status_code == 400
        assert "SMRITI-JURISDICTION-001" in exc_info.value.detail


@pytest.mark.asyncio
async def test_canonical_sales_writer_fails_explicitly_when_jurisdiction_absent():
    """Verify CanonicalSalesPostingWriter FAILS explicitly and NEVER defaults to '27'."""
    from fastapi import HTTPException
    from app.schemas.canonical_posting import (
        CanonicalPostingRequest,
        CanonicalPostingContext,
        CanonicalPostingLineItem,
        CanonicalTenderItem,
    )
    from app.services.canonical_sales_writer import CanonicalSalesPostingWriter
    from app.services.system_parameter import SystemParameterService
    from app.services.transaction_integrity_engine import TransactionIntegrityEngine

    mock_db = AsyncMock()
    mock_db.add = MagicMock()

    # Company with NO GSTIN or state_code
    mock_comp = MagicMock(spec=Company)
    mock_comp.id = "COMP-EMPTY"
    mock_comp.name = "Empty Seller Co"
    mock_comp.gst_number = None
    mock_comp.state = None
    mock_comp.state_code = None

    async def mock_execute(stmt, *args, **kwargs):
        stmt_str = str(stmt).lower()
        res = MagicMock()
        if "companies" in stmt_str or "from companies" in stmt_str:
            res.scalars.return_value.first.return_value = mock_comp
        else:
            res.scalars.return_value.first.return_value = None
        return res

    mock_db.execute.side_effect = mock_execute

    req = CanonicalPostingRequest(
        context=CanonicalPostingContext(
            company_id="COMP-EMPTY",
            branch_id="BR-EMPTY",
            terminal_id="TERM-01",
            idempotency_key="IDEM-TEST-NOJUR",
            source_channel="POS_RETAIL",
        ),
        items=[
            CanonicalPostingLineItem(
                code="SKU-999",
                product_id="prod_999",
                quantity=Decimal("1.000"),
                unit_price=Decimal("100.00"),
                gst_rate=Decimal("18.00"),
            )
        ],
        tenders=[
            CanonicalTenderItem(tender_type="CASH", amount=Decimal("100.00"))
        ],
    )

    with patch.object(SystemParameterService, "resolve_parameter", return_value=None), \
         patch.object(TransactionIntegrityEngine, "try_acquire_advisory_lock", new_callable=AsyncMock, return_value=True):
        with pytest.raises(HTTPException) as exc_info:
            await CanonicalSalesPostingWriter.post_sales_transaction(session=mock_db, req=req, commit=False)
        assert exc_info.value.status_code == 400
        assert "SMRITI-JURISDICTION-001" in exc_info.value.detail
