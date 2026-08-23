"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.22.0
Created      : 2026-08-23
Modified     : 2026-08-23
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import pytest
from decimal import Decimal
from fastapi.testclient import TestClient
from app.main import app
from app.services.localization_service import LocalizationService


@pytest.fixture
def client():
    return TestClient(app)


def test_indian_number_formatting_lakh_crore():
    """Verify Indian numbering system (Lakhs and Crores) grouping."""
    assert LocalizationService.format_indian_number(Decimal("0")) == "0.00"
    assert LocalizationService.format_indian_number(Decimal("500")) == "500.00"
    assert LocalizationService.format_indian_number(Decimal("1500.50")) == "1,500.50"
    assert LocalizationService.format_indian_number(Decimal("125000.75")) == "1,25,000.75"
    assert LocalizationService.format_indian_number(Decimal("12345678.90")) == "1,23,45,678.90"
    assert LocalizationService.format_indian_number(Decimal("-9876543.21")) == "-98,76,543.21"


def test_international_number_formatting_millions():
    """Verify International numbering system (thousands and millions) grouping."""
    assert LocalizationService.format_international_number(Decimal("12345678.90")) == "12,345,678.90"
    assert LocalizationService.format_international_number(Decimal("1000000.00")) == "1,000,000.00"


def test_currency_formatting_with_locale():
    """Verify currency formatting with symbol placement and locale rules."""
    inr_formatted = LocalizationService.format_currency(Decimal("125000.50"), currency_code="INR", locale_code="en-IN")
    assert inr_formatted == "₹ 1,25,000.50"

    usd_formatted = LocalizationService.format_currency(Decimal("125000.50"), currency_code="USD", locale_code="en-US")
    assert usd_formatted == "$ 125,000.50"

    aed_formatted = LocalizationService.format_currency(Decimal("125000.50"), currency_code="AED", locale_code="ar-AE")
    assert aed_formatted == "125,000.50 د.إ"


def test_non_english_translations_hindi():
    """Verify Hindi (hi-IN) translation resolution and fallback behavior."""
    shift_open = LocalizationService.translate("pos.shift.open", locale="hi-IN")
    assert shift_open == "शिफ्ट खोलें"

    cash_drop = LocalizationService.translate("pos.cash_drop", locale="hi-IN")
    assert "तिजोरी" in cash_drop

    tax_inv = LocalizationService.translate("billing.tax_invoice", locale="hi-IN")
    assert "टैक्स चालान" in tax_inv

    grand_total = LocalizationService.translate("billing.grand_total", locale="hi-IN")
    assert grand_total == "कुल योग"


def test_non_english_translations_marathi():
    """Verify Marathi (mr-IN) translation resolution."""
    shift_open = LocalizationService.translate("pos.shift.open", locale="mr-IN")
    assert shift_open == "शिफ्ट सुरू करा"

    shift_close = LocalizationService.translate("pos.shift.close", locale="mr-IN")
    assert shift_close == "शिफ्ट बंद करा"

    grand_total = LocalizationService.translate("billing.grand_total", locale="mr-IN")
    assert grand_total == "एकूण रक्कम"

    save_btn = LocalizationService.translate("common.save", locale="mr-IN")
    assert save_btn == "जतन करा"


def test_non_english_translations_gujarati():
    """Verify Gujarati (gu-IN) translation resolution."""
    shift_open = LocalizationService.translate("pos.shift.open", locale="gu-IN")
    assert shift_open == "શિફ્ટ શરૂ કરો"

    shift_close = LocalizationService.translate("pos.shift.close", locale="gu-IN")
    assert shift_close == "શિફ્ટ બંધ કરો"

    grand_total = LocalizationService.translate("billing.grand_total", locale="gu-IN")
    assert grand_total == "કુલ રકમ"


def test_translation_fallback_to_english():
    """Verify graceful fallback to English when translation key is missing in target language."""
    # Unknown locale falls back to English
    res = LocalizationService.translate("pos.shift.open", locale="fr-FR")
    assert res == "Open Shift"


def test_uom_conversions():
    """Verify standard UOM conversion factors and error handling."""
    # 2.5 KG -> 2500 GM
    assert LocalizationService.convert_uom(Decimal("2.5"), "KG", "GM") == Decimal("2500.0")

    # 500 GM -> 0.5 KG
    assert LocalizationService.convert_uom(Decimal("500"), "GM", "KG") == Decimal("0.5")

    # 3 LTR -> 3000 ML
    assert LocalizationService.convert_uom(Decimal("3"), "LTR", "ML") == Decimal("3000.0")

    # 2 DOZ -> 24 PCS
    assert LocalizationService.convert_uom(Decimal("2"), "DOZ", "PCS") == Decimal("24")

    # Incompatible conversion raises ValueError
    with pytest.raises(ValueError) as exc:
        LocalizationService.convert_uom(Decimal("10"), "KG", "LTR")
    assert "Direct UOM conversion" in str(exc.value)


def test_gst_tax_determination_intrastate_vs_interstate():
    """Verify statutory Indian GST determination (Intrastate vs Interstate)."""
    # Maharashtra to Maharashtra -> Intrastate (CGST + SGST)
    intra = LocalizationService.determine_gst_type("27", "27")
    assert intra["is_intrastate"] is True
    assert intra["supply_type"] == "INTRASTATE"
    assert "CGST" in intra["tax_components"]
    assert "SGST" in intra["tax_components"]

    # Maharashtra (27) to Karnataka (29) -> Interstate (IGST)
    inter = LocalizationService.determine_gst_type("27", "29")
    assert inter["is_intrastate"] is False
    assert inter["supply_type"] == "INTERSTATE"
    assert "IGST" in inter["tax_components"]


def test_api_reference_endpoints(client):
    """Verify public Reference Data and Localization API endpoints."""
    # Countries
    c_res = client.get("/api/v1/reference/countries")
    assert c_res.status_code == 200
    countries = c_res.json()
    assert any(c["code"] == "IN" for c in countries)

    # GST States
    s_res = client.get("/api/v1/reference/gst-states")
    assert s_res.status_code == 200
    states = s_res.json()
    assert any(s["gst_code"] == "27" and s["state_code"] == "MH" for s in states)
    assert any(s["gst_code"] == "29" and s["state_code"] == "KA" for s in states)

    # Currencies
    curr_res = client.get("/api/v1/reference/currencies")
    assert curr_res.status_code == 200
    currs = curr_res.json()
    assert any(c["code"] == "INR" and c["symbol"] == "₹" for c in currs)

    # Locales
    loc_res = client.get("/api/v1/reference/locales")
    assert loc_res.status_code == 200
    locales = loc_res.json()
    assert any(l["code"] == "hi-IN" for l in locales)
    assert any(l["code"] == "mr-IN" for l in locales)

    # Hindi Translations API
    tr_res = client.get("/api/v1/reference/translations?locale=hi-IN")
    assert tr_res.status_code == 200
    tr_data = tr_res.json()
    assert tr_data["locale"] == "hi-IN"
    assert tr_data["translations"]["pos.shift.open"] == "शिफ्ट खोलें"

    # UOM convert API
    uom_res = client.get("/api/v1/reference/uom-convert?quantity=5&from_uom=KG&to_uom=GM")
    assert uom_res.status_code == 200
    assert uom_res.json()["to_quantity"] == 5000.0

    # Tax Rates
    tax_res = client.get("/api/v1/reference/tax-rates")
    assert tax_res.status_code == 200
    assert any(t["code"] == "GST_18" and t["rate"] == 18.0 for t in tax_res.json())

    # Format Preview
    prev_res = client.get("/api/v1/reference/format-preview?amount=98765432.10&currency=INR&locale=en-IN")
    assert prev_res.status_code == 200
    pdata = prev_res.json()
    assert "₹ 9,87,65,432.10" in pdata["formatted_currency"]
