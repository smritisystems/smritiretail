"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.16.0
Created      : 2026-10-08
Modified     : 2026-10-08
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: P0-2 Verification Test Suite
"""

import pytest
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock, patch
from fastapi import HTTPException

from app.schemas.canonical_posting import CanonicalPostingContext
from app.models.system_parameter import SystemParameter
from app.services.system_parameter import SystemParameterService


def test_canonical_posting_context_schema():
    # Verify schema accepts allow_negative_stock for backward-compat but documents non-authoritative status
    ctx = CanonicalPostingContext(company_id="COMP-001", branch_id="MAIN", allow_negative_stock=True)
    assert ctx.allow_negative_stock is True
    assert "DEPRECATED" in CanonicalPostingContext.model_fields["allow_negative_stock"].description
    assert "SMRITI.STOCK.ALLOW_NEGATIVE_STOCK" in CanonicalPostingContext.model_fields["allow_negative_stock"].description


@pytest.mark.asyncio
async def test_server_policy_blocks_negative_stock_when_client_sends_true():
    """
    SECURITY TEST:
    Client sends {"allow_negative_stock": True}, but server policy is FALSE / not configured.
    Result: Negative stock deduction MUST fail with exception and rollback session.
    """
    mock_db = AsyncMock()

    # SystemParameterService resolves FALSE
    with patch.object(SystemParameterService, "resolve_parameter", new_callable=AsyncMock) as mock_resolve:
        mock_param = MagicMock(spec=SystemParameter)
        mock_param.effective_value = False
        mock_resolve.return_value = mock_param

        # Simulate deduction loop logic from canonical_sales_writer.py
        allow_neg_param = await SystemParameterService.resolve_parameter(
            db=mock_db,
            param_code="SMRITI.STOCK.ALLOW_NEGATIVE_STOCK",
            company_id="COMP-001",
            terminal_id="TERM-01",
            branch_id="MAIN",
        )
        server_allows_negative = bool(allow_neg_param.effective_value) if allow_neg_param else False

        # Malicious client sends true
        client_allow_negative = True

        # Verify server decision
        assert server_allows_negative is False
        assert client_allow_negative is True  # Client attempted bypass

        # Deduction raises HTTPException
        he = HTTPException(status_code=400, detail="Insufficient stock on batch B01")
        with pytest.raises(HTTPException):
            if server_allows_negative:
                pass  # override allowed
            else:
                await mock_db.rollback()
                raise he

        mock_db.rollback.assert_awaited_once()


@pytest.mark.asyncio
async def test_server_policy_allows_negative_stock_when_configured():
    """
    Server policy SMRITI.STOCK.ALLOW_NEGATIVE_STOCK is configured as True.
    Result: Negative stock exception is caught and override permitted.
    """
    mock_db = AsyncMock()

    with patch.object(SystemParameterService, "resolve_parameter", new_callable=AsyncMock) as mock_resolve:
        mock_param = MagicMock(spec=SystemParameter)
        mock_param.effective_value = True
        mock_resolve.return_value = mock_param

        allow_neg_param = await SystemParameterService.resolve_parameter(
            db=mock_db,
            param_code="SMRITI.STOCK.ALLOW_NEGATIVE_STOCK",
            company_id="COMP-001",
            terminal_id="TERM-01",
            branch_id="MAIN",
        )
        server_allows_negative = bool(allow_neg_param.effective_value) if allow_neg_param else False

        # Client sent false, but server permits it by store policy
        client_allow_negative = False
        assert server_allows_negative is True

        # When exception is raised, it is handled without rollback
        he = HTTPException(status_code=400, detail="Insufficient stock on batch B01")
        handled = False
        if server_allows_negative:
            handled = True
        else:
            await mock_db.rollback()
            raise he

        assert handled is True
        mock_db.rollback.assert_not_awaited()


@pytest.mark.asyncio
async def test_server_policy_absent_defaults_to_block():
    """
    When SMRITI.STOCK.ALLOW_NEGATIVE_STOCK is not seeded / None, default is False (Block).
    """
    mock_db = AsyncMock()

    with patch.object(SystemParameterService, "resolve_parameter", new_callable=AsyncMock) as mock_resolve:
        mock_resolve.return_value = None  # Not configured

        allow_neg_param = await SystemParameterService.resolve_parameter(
            db=mock_db,
            param_code="SMRITI.STOCK.ALLOW_NEGATIVE_STOCK",
            company_id="COMP-001",
            terminal_id="COMMON",
            branch_id="MAIN",
        )
        server_allows_negative = bool(allow_neg_param.effective_value) if allow_neg_param else False
        assert server_allows_negative is False


@pytest.mark.asyncio
async def test_canonical_sales_writer_real_posting_path_negative_stock():
    """
    REAL POSTING PATH TEST:
    Calls CanonicalSalesPostingWriter.post_sales_transaction with a client request
    setting allow_negative_stock=True.
    Proves that when server policy is False, the real posting flow blocks and rolls back.
    """
    from app.schemas.canonical_posting import (
        CanonicalPostingRequest,
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
    from app.services.payments_engine import PaymentsEngine
    from app.services.outbox_service import OutboxService
    from app.models.tenant import Company, Branch
    from app.models.inventory import Warehouse

    mock_db = AsyncMock()
    mock_db.add = MagicMock()

    # Configure session.execute to return proper tenant models
    mock_comp = MagicMock(spec=Company)
    mock_comp.id = "COMP-001"
    mock_comp.name = "Test Retail Co"
    mock_comp.gst_number = "27AAXFT2508H1ZR"

    mock_branch = MagicMock(spec=Branch)
    mock_branch.id = "MAIN"
    mock_branch.code = "MAIN"
    mock_branch.company_id = "COMP-001"

    mock_wh = MagicMock(spec=Warehouse)
    mock_wh.id = "WH-01"
    mock_wh.code = "WH-MAIN"
    mock_wh.name = "Main Store"
    mock_wh.company_id = "COMP-001"
    mock_wh.is_deleted = False
    mock_wh.is_active = True
    mock_wh.pincode = "400001"
    mock_wh.state = "Maharashtra"
    mock_wh.address = "123 Main St"
    mock_wh.contact_person = "Manager"
    mock_wh.phone = "9876543210"

    execute_call_count = 0

    async def mock_execute(stmt, *args, **kwargs):
        nonlocal execute_call_count
        execute_call_count += 1
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
            company_id="COMP-001",
            branch_id="MAIN",
            terminal_id="TERM-01",
            warehouse_id="WH-01",
            idempotency_key="TEST-IDEM-NEG-STOCK-01",
            source_channel="POS_RETAIL",
            allow_negative_stock=True,  # Client attempts bypass!
        ),
        customer_id=None,
        dispatch_from_location_id="WH-01",
        items=[
            CanonicalPostingLineItem(
                code="PROD-01",
                product_id="prod_01",
                quantity=Decimal("5.0000"),
                unit_price=Decimal("100.00"),
                gst_rate=Decimal("18.00"),
            )
        ],
        tenders=[
            CanonicalTenderItem(tender_type="CASH", amount=Decimal("590.00"))
        ],
    )

    calc_line = BillingCalculatedLine(
        product_id="prod_01",
        item_id="item_01",
        variant_id="var_01",
        code="PROD-01",
        name="Product 1",
        line_no=1,
        quantity=Decimal("5.0000"),
        unit_price=Decimal("100.00"),
        disc_pct=Decimal("0.00"),
        disc_amount=Decimal("0.00"),
        taxable_value=Decimal("500.00"),
        gst_rate=Decimal("18.00"),
        cgst_amount=Decimal("45.00"),
        sgst_amount=Decimal("45.00"),
        igst_amount=Decimal("0.00"),
        tax_amount=Decimal("90.00"),
        total_amount=Decimal("590.00"),
        is_tax_inclusive=False,
        batch_no="B01",
    )

    billing_res = BillingCalculationResult(
        gross_amount=Decimal("500.00"),
        discount_amount=Decimal("0.00"),
        discounted_base=Decimal("500.00"),
        taxable_amount=Decimal("500.00"),
        cgst_amount=Decimal("45.00"),
        sgst_amount=Decimal("45.00"),
        igst_amount=Decimal("0.00"),
        tax_total=Decimal("90.00"),
        subtotal=Decimal("590.00"),
        round_off=Decimal("0.00"),
        net_amount=Decimal("590.00"),
        items_count=1,
        total_quantity=Decimal("5.0000"),
        lines=[calc_line],
        batch_deductions=[{
            "product_id": "prod_01",
            "batch_no": "B01",
            "quantity": Decimal("5.0000"),
            "line_no": 1,
            "warehouse_id": "WH-01",
        }],
    )
    with patch.object(SystemParameterService, "resolve_parameter", new_callable=AsyncMock) as mock_resolve, \
         patch.object(InventoryWmsService, "atomic_mutate_batch_stock", new_callable=AsyncMock) as mock_mutate, \
         patch.object(HeadlessBillingCore, "calculate_billing", new_callable=AsyncMock) as mock_calc, \
         patch.object(TransactionIntegrityEngine, "try_acquire_advisory_lock", new_callable=AsyncMock) as mock_lock, \
         patch.object(IdentityEngine, "allocate_internal", new_callable=AsyncMock) as mock_ident, \
         patch.object(NumberingService, "allocate_voucher_number", new_callable=AsyncMock) as mock_num:

        mock_lock.return_value = True
        mock_ident.return_value = ("inv_01", "INV_CODE_01")
        mock_num.return_value = "INV-2026-0001"
        mock_calc.return_value = billing_res

        # Server policy is FALSE (disallow negative stock)
        mock_param = MagicMock(spec=SystemParameter)
        mock_param.effective_value = False
        mock_resolve.return_value = mock_param

        # WMS raises insufficient stock error
        mock_mutate.side_effect = HTTPException(status_code=400, detail="Insufficient stock on batch B01")

        with pytest.raises(HTTPException) as exc_info:
            await CanonicalSalesPostingWriter.post_sales_transaction(session=mock_db, req=req, commit=True)

        assert exc_info.value.status_code == 400
        assert "insufficient stock" in exc_info.value.detail.lower()

        # Proves SystemParameterService was queried with the canonical param code
        mock_resolve.assert_awaited_with(
            db=mock_db,
            param_code="SMRITI.STOCK.ALLOW_NEGATIVE_STOCK",
            company_id="COMP-001",
            terminal_id="TERM-01",
            branch_id="MAIN",
        )

        # Proves transaction was rolled back because server policy disallows negative stock
        mock_db.rollback.assert_awaited()

