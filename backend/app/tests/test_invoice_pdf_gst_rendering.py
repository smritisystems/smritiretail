from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from app.services.invoice_pdf_service import (
    _resolve_delivery_gstin,
    _resolve_invoice_supply_context,
    _validate_delivery_gstin_for_reprint,
)


def test_delivery_gstin_is_resolved_separately_from_billing_gstin():
    invoice = SimpleNamespace(
        delivery_gstin="18AABCR1718E1ZO",
        delivery_location_snapshot={"gstin": "18AABCR1718E1ZO"},
    )

    assert _resolve_delivery_gstin(invoice, {}) == "18AABCR1718E1ZO"


def test_delivery_snapshot_controls_place_of_supply_over_billing_gstin():
    invoice = SimpleNamespace(
        delivery_location_snapshot={"state_code": "18", "gstin": "18AABCR1718E1ZO"},
        delivery_store_code="1888",
        place_of_supply_code="18",
        pos_state="Maharashtra",
    )

    delivery_gstin = _resolve_delivery_gstin(invoice, {})
    pos_code, is_interstate, display = _resolve_invoice_supply_context(
        invoice,
        delivery_gstin,
        billing_gstin="27AAACR1921R1Z5",
        supplier_gstin="27AABCT1234A1Z5",
    )

    assert pos_code == "18"
    assert is_interstate is True
    assert display == "Assam (18) — Inter-State"


def test_saved_tax_classification_conflict_blocks_reprint():
    invoice = SimpleNamespace(
        invoice_no="INV-1",
        delivery_location_snapshot={"state_code": "18"},
        place_of_supply_code="18",
        is_interstate=False,
    )

    with pytest.raises(HTTPException) as exc:
        _resolve_invoice_supply_context(
            invoice,
            delivery_gstin="",
            billing_gstin="27AAACR1921R1Z5",
            supplier_gstin="27AABCT1234A1Z5",
        )

    assert exc.value.status_code == 409
    assert "conflicts with its saved tax classification" in exc.value.detail


def test_submitted_delivery_invoice_without_historical_gstin_cannot_be_reprinted():
    invoice = SimpleNamespace(
        status="Submitted",
        invoice_no="TT2026-2027/18",
        delivery_store_code="1888",
    )

    with pytest.raises(HTTPException) as exc:
        _validate_delivery_gstin_for_reprint(
            invoice,
            delivery_gstin="",
            billing_gstin="27AAACR1921R1Z5",
        )

    assert exc.value.status_code == 409
    assert "historical snapshot" in exc.value.detail
