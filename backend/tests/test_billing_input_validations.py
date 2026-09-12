"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.16.0
Created      : 2026-09-11
Modified     : 2026-09-11
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import pytest
from decimal import Decimal
from pydantic import ValidationError
from fastapi import HTTPException

from app.schemas.sales import SalesInvoiceItemCreate, SalesInvoiceCreate
from app.schemas.pos import POSCheckoutItem, POSCheckoutRequest
from app.schemas.canonical_posting import (
    CanonicalPostingRequest,
    CanonicalPostingContext,
    CanonicalPostingLineItem,
    CanonicalTenderItem,
)
from app.services.canonical_sales_writer import CanonicalSalesPostingWriter


def test_sales_invoice_item_validation():
    # Valid item
    item = SalesInvoiceItemCreate(
        code="SKU001",
        name="Test Item",
        quantity=Decimal("2.5"),
        price=Decimal("150.00"),
        gst_rate=Decimal("18.00"),
        mrp=Decimal("200.00"),
        disc_pct=Decimal("10.00"),
    )
    assert item.quantity == Decimal("2.5")
    assert item.price == Decimal("150.00")

    # Reject zero quantity
    with pytest.raises(ValidationError):
        SalesInvoiceItemCreate(
            code="SKU001",
            name="Test Item",
            quantity=Decimal("0.0"),
            price=Decimal("100.00"),
        )

    # Reject negative quantity
    with pytest.raises(ValidationError):
        SalesInvoiceItemCreate(
            code="SKU001",
            name="Test Item",
            quantity=Decimal("-1.0"),
            price=Decimal("100.00"),
        )

    # Reject negative price
    with pytest.raises(ValidationError):
        SalesInvoiceItemCreate(
            code="SKU001",
            name="Test Item",
            quantity=Decimal("1.0"),
            price=Decimal("-50.00"),
        )

    # Reject discount percent > 100
    with pytest.raises(ValidationError):
        SalesInvoiceItemCreate(
            code="SKU001",
            name="Test Item",
            quantity=Decimal("1.0"),
            price=Decimal("100.00"),
            disc_pct=Decimal("105.00"),
        )


def test_sales_invoice_create_requires_items():
    # Valid with items
    valid_inv = SalesInvoiceCreate(
        invoice_no="INV-VALID-01",
        items=[
            SalesInvoiceItemCreate(
                code="SKU001",
                name="Test Item",
                quantity=Decimal("1.0"),
                price=Decimal("100.00"),
            )
        ],
    )
    assert len(valid_inv.items) == 1

    # Reject empty items list
    with pytest.raises(ValidationError):
        SalesInvoiceCreate(
            invoice_no="INV-EMPTY-01",
            items=[],
        )


def test_pos_checkout_schema_validation():
    # Valid POS item
    pos_item = POSCheckoutItem(
        product_id="PROD-01",
        code="SKU001",
        name="Retail Widget",
        quantity=Decimal("1.0"),
        price=Decimal("250.00"),
        mrp=Decimal("300.00"),
    )
    assert pos_item.quantity == Decimal("1.0")

    # Reject zero quantity
    with pytest.raises(ValidationError):
        POSCheckoutItem(
            product_id="PROD-01",
            code="SKU001",
            name="Retail Widget",
            quantity=Decimal("0.0"),
            price=Decimal("250.00"),
        )

    # Reject negative price
    with pytest.raises(ValidationError):
        POSCheckoutItem(
            product_id="PROD-01",
            code="SKU001",
            name="Retail Widget",
            quantity=Decimal("1.0"),
            price=Decimal("-10.00"),
        )

    # POS checkout request requires at least 1 item
    with pytest.raises(ValidationError):
        POSCheckoutRequest(
            invoice_no="POS-EMPTY-01",
            shift_id="SHIFT-01",
            items=[],
            grand_total=Decimal("0.00"),
        )


from unittest.mock import AsyncMock, MagicMock


@pytest.mark.asyncio
async def test_canonical_sales_writer_rejects_empty_items():
    # Mock session
    mock_session = AsyncMock()

    ctx = CanonicalPostingContext(
        company_id="COMP-01",
        branch_id="BR-01",
        idempotency_key="IDEM-TEST-12345",
    )

    req = CanonicalPostingRequest(
        context=ctx,
        items=[
            CanonicalPostingLineItem(
                code="SKU001",
                quantity=Decimal("1.0"),
                unit_price=Decimal("100.00"),
            )
        ],
    )

    # Manually bypass Pydantic min_length to test writer guard
    object.__setattr__(req, "items", [])

    with pytest.raises(HTTPException) as exc_info:
        await CanonicalSalesPostingWriter.post_sales_transaction(mock_session, req)
    assert exc_info.value.status_code == 400
    assert "SMRITI-VAL-001" in exc_info.value.detail


@pytest.mark.asyncio
async def test_canonical_sales_writer_rejects_negative_tender():
    mock_session = AsyncMock()

    ctx = CanonicalPostingContext(
        company_id="COMP-01",
        branch_id="BR-01",
        idempotency_key="IDEM-TEST-99999",
    )

    req = CanonicalPostingRequest(
        context=ctx,
        items=[
            CanonicalPostingLineItem(
                code="SKU001",
                quantity=Decimal("1.0"),
                unit_price=Decimal("100.00"),
            )
        ],
        tenders=[
            CanonicalTenderItem(
                tender_type="CASH",
                amount=Decimal("100.00"),
            )
        ],
    )

    # Manually bypass Pydantic gt=0 to test writer guard
    bad_tender = MagicMock()
    bad_tender.tender_type = "CASH"
    bad_tender.amount = Decimal("-10.00")
    object.__setattr__(req, "tenders", [bad_tender])

    with pytest.raises(HTTPException) as exc_info:
        await CanonicalSalesPostingWriter.post_sales_transaction(mock_session, req)
    assert exc_info.value.status_code == 400
    assert "SMRITI-VAL-004" in exc_info.value.detail


@pytest.mark.asyncio
async def test_canonical_sales_writer_rejects_cash_over_2_lakh():
    mock_session = AsyncMock()

    ctx = CanonicalPostingContext(
        company_id="COMP-01",
        branch_id="BR-01",
        idempotency_key="IDEM-TEST-269ST",
    )

    req = CanonicalPostingRequest(
        context=ctx,
        items=[
            CanonicalPostingLineItem(
                code="SKU001",
                quantity=Decimal("1.0"),
                unit_price=Decimal("200000.00"),
            )
        ],
        tenders=[
            CanonicalTenderItem(
                tender_type="CASH",
                amount=Decimal("200000.00"),
            )
        ],
    )

    with pytest.raises(HTTPException) as exc_info:
        await CanonicalSalesPostingWriter.post_sales_transaction(mock_session, req)
    assert exc_info.value.status_code == 400
    assert "SMRITI-TAX-269ST" in exc_info.value.detail

