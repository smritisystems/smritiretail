"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.40.0
Created      : 2026-08-25
Modified     : 2026-08-25
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import pytest
from decimal import Decimal
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.core.security import create_access_token


def _get_auth_headers():
    token = create_access_token(data={
        "sub": "usr-super",
        "role": "SYSADMIN",
        "company_id": "COMP-001",
        "branch_id": "BR-001",
        "tenant_id": "smriti001",
        "db_name": "smriti001",
        "is_active": True,
    })
    return {
        "Authorization": f"Bearer {token}",
        "X-Company-ID": "COMP-001",
        "X-Company-Code": "001",
        "X-Branch-ID": "BR-001"
    }


@pytest.mark.asyncio
async def test_countries_endpoint():
    """Verify ISO countries registry."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/api/v1/control/reference/countries", headers=_get_auth_headers())
        assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
        countries = res.json()
        assert len(countries) >= 8
        codes = [c["code"] for c in countries]
        assert "IN" in codes
        assert "US" in codes
        assert "AE" in codes


@pytest.mark.asyncio
async def test_all_36_indian_states_and_gst_codes():
    """Verify all 36 Indian states & UTs with statutory GST state codes."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/api/v1/control/reference/states?country_code=IN", headers=_get_auth_headers())
        assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
        states = res.json()
        assert len(states) >= 36
        
        # Test GST state code lookup (27 = Maharashtra, 29 = Karnataka, 07 = Delhi)
        gst_codes = {s["gst_state_code"]: s["name"] for s in states if s.get("gst_state_code")}
        assert "27" in gst_codes and "Maharashtra" in gst_codes["27"]
        assert "29" in gst_codes and "Karnataka" in gst_codes["29"]
        assert "07" in gst_codes and "Delhi" in gst_codes["07"]
        assert "97" in gst_codes and "Other Territory" in gst_codes["97"]


@pytest.mark.asyncio
async def test_state_by_gst_code_resolution():
    """Verify single state lookup by GST 2-digit code."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/api/v1/control/reference/states/by-gst-code/27", headers=_get_auth_headers())
        assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
        st = res.json()
        assert st["state_code"] == "MH"
        assert st["name"] == "Maharashtra"
        assert st["gst_state_code"] == "27"


@pytest.mark.asyncio
async def test_currencies_registry():
    """Verify ISO 4217 currency registry."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/api/v1/control/reference/currencies", headers=_get_auth_headers())
        assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
        currencies = res.json()
        curr_map = {c["code"]: c for c in currencies}
        assert "INR" in curr_map and curr_map["INR"]["symbol"] == "₹"
        assert "USD" in curr_map and curr_map["USD"]["symbol"] == "$"
        assert "AED" in curr_map and curr_map["AED"]["symbol"] == "د.إ"


@pytest.mark.asyncio
async def test_uoms_and_conversions():
    """Verify UOMs and conversion ratio calculations."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # List UOMs
        res = await client.get("/api/v1/control/reference/uoms", headers=_get_auth_headers())
        assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
        uoms = res.json()
        codes = [u["code"] for u in uoms]
        assert "KG" in codes or "KGS" in codes
        assert "PCS" in codes
        assert "DOZ" in codes

        # Convert 2.5 KG -> 2500 GM
        res_conv = await client.post(
            "/api/v1/control/reference/uoms/convert",
            json={"from_uom": "KG", "to_uom": "GM", "quantity": 2.5},
            headers=_get_auth_headers()
        )
        assert res_conv.status_code == 200, f"Expected 200, got {res_conv.status_code}: {res_conv.text}"
        conv_data = res_conv.json()
        assert float(conv_data["converted_quantity"]) == 2500.0
        assert float(conv_data["conversion_factor"]) == 1000.0

        # Convert 3 DOZ -> 36 PCS
        res_doz = await client.post(
            "/api/v1/control/reference/uoms/convert",
            json={"from_uom": "DOZ", "to_uom": "PCS", "quantity": 3},
            headers=_get_auth_headers()
        )
        assert res_doz.status_code == 200
        assert float(res_doz.json()["converted_quantity"]) == 36.0


@pytest.mark.asyncio
async def test_tax_references_and_hsn_sac():
    """Verify GST statutory tax references and HSN/SAC search."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Tax References
        res_tax = await client.get("/api/v1/control/reference/tax-references", headers=_get_auth_headers())
        assert res_tax.status_code == 200, f"Expected 200, got {res_tax.status_code}: {res_tax.text}"
        taxes = {t["code"]: t for t in res_tax.json()}
        assert "GST_18" in taxes
        assert float(taxes["GST_18"]["rate"]) == 18.00
        assert float(taxes["GST_18"]["cgst_rate"]) == 9.00
        assert float(taxes["GST_18"]["sgst_rate"]) == 9.00

        # HSN / SAC Search
        res_hsn = await client.get("/api/v1/control/reference/hsn-sac?query=6109", headers=_get_auth_headers())
        assert res_hsn.status_code == 200
        hsn_list = res_hsn.json()
        assert len(hsn_list) >= 1
        assert hsn_list[0]["code"] == "6109"


@pytest.mark.asyncio
async def test_languages_and_locales():
    """Verify languages and locales registry."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res_lang = await client.get("/api/v1/control/reference/languages", headers=_get_auth_headers())
        assert res_lang.status_code == 200
        langs = {l["code"]: l for l in res_lang.json()}
        assert "en" in langs
        assert "hi" in langs and langs["hi"]["native_name"] == "हिन्दी"
        assert "mr" in langs and langs["mr"]["native_name"] == "मराठी"
        assert "ar" in langs and langs["ar"]["is_rtl"] is True

        res_loc = await client.get("/api/v1/control/reference/locales", headers=_get_auth_headers())
        assert res_loc.status_code == 200
        locs = {l["code"]: l for l in res_loc.json()}
        assert "en-IN" in locs and locs["en-IN"]["number_system"] == "INDIAN_LAKH_CRORE"
        assert "en-US" in locs and locs["en-US"]["number_system"] == "INTERNATIONAL_MILLION"


@pytest.mark.asyncio
async def test_translation_dictionary_with_fallback():
    """Verify multi-lingual dictionary with automatic English fallback."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Hindi
        res_hi = await client.get("/api/v1/control/reference/translations/hi", headers=_get_auth_headers())
        assert res_hi.status_code == 200
        hi_dict = res_hi.json()["translations"]
        assert hi_dict.get("common.save") == "सहेजें"
        assert hi_dict.get("pos.shift.open") == "पीओएस शिफ्ट खोलें"

        # Marathi
        res_mr = await client.get("/api/v1/control/reference/translations/mr", headers=_get_auth_headers())
        assert res_mr.status_code == 200
        mr_dict = res_mr.json()["translations"]
        assert mr_dict.get("common.save") == "जतन करा"
        assert mr_dict.get("pos.shift.open") == "पीओएस शिफ्ट उघडा"

        # Non-existent language should fall back to English baseline
        res_xx = await client.get("/api/v1/control/reference/translations/fr", headers=_get_auth_headers())
        assert res_xx.status_code == 200
        fr_dict = res_xx.json()["translations"]
        assert fr_dict.get("common.save") == "Save"
        assert res_xx.json()["is_fallback"] is True


@pytest.mark.asyncio
async def test_currency_and_number_formatting():
    """Verify Indian Lakh/Crore vs International Million number formatting."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Indian Lakh/Crore format (₹ 12,34,567.89)
        res_in = await client.post(
            "/api/v1/control/reference/format/currency",
            json={"amount": 1234567.89, "currency_code": "INR", "locale_code": "en-IN"},
            headers=_get_auth_headers()
        )
        assert res_in.status_code == 200
        assert res_in.json()["formatted_text"] == "₹ 12,34,567.89"

        # International Million format ($ 1,234,567.89)
        res_us = await client.post(
            "/api/v1/control/reference/format/currency",
            json={"amount": 1234567.89, "currency_code": "USD", "locale_code": "en-US"},
            headers=_get_auth_headers()
        )
        assert res_us.status_code == 200
        assert res_us.json()["formatted_text"] == "$ 1,234,567.89"


@pytest.mark.asyncio
async def test_platform_reference_constants():
    """Verify platform reference constants by category."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/api/v1/control/reference/platform/PAYMENT_METHODS", headers=_get_auth_headers())
        assert res.status_code == 200
        prefs = res.json()
        codes = [p["code"] for p in prefs]
        assert "CASH" in codes
        assert "UPI" in codes
        assert "CARD" in codes
