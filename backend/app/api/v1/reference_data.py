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

from decimal import Decimal
from typing import Dict, Any, Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field

from ...services.localization_service import LocalizationService

router = APIRouter(prefix="/reference", tags=["Global Reference Data & Localization"])


class FormatPreviewResponse(BaseModel):
    locale: str
    currency_code: str
    sample_amount: float
    formatted_currency: str
    formatted_number: str
    formatted_date: str


@router.get("/countries")
async def get_countries():
    """
    Fetch authoritative list of supported countries and ISO codes.
    """
    return [
        {"code": "IN", "iso3": "IND", "numeric_code": "356", "name": "India", "phone_code": "+91", "default_currency": "INR", "is_active": True},
        {"code": "US", "iso3": "USA", "numeric_code": "840", "name": "United States", "phone_code": "+1", "default_currency": "USD", "is_active": True},
        {"code": "AE", "iso3": "ARE", "numeric_code": "784", "name": "United Arab Emirates", "phone_code": "+971", "default_currency": "AED", "is_active": True},
        {"code": "GB", "iso3": "GBR", "numeric_code": "826", "name": "United Kingdom", "phone_code": "+44", "default_currency": "GBP", "is_active": True},
        {"code": "SG", "iso3": "SGP", "numeric_code": "702", "name": "Singapore", "phone_code": "+65", "default_currency": "SGD", "is_active": True},
        {"code": "DE", "iso3": "DEU", "numeric_code": "276", "name": "Germany", "phone_code": "+49", "default_currency": "EUR", "is_active": True},
        {"code": "AU", "iso3": "AUS", "numeric_code": "036", "name": "Australia", "phone_code": "+61", "default_currency": "AUD", "is_active": True},
        {"code": "CA", "iso3": "CAN", "numeric_code": "124", "name": "Canada", "phone_code": "+1", "default_currency": "CAD", "is_active": True},
    ]


@router.get("/gst-states")
async def get_gst_states():
    """
    Fetch official 2-digit Indian GST State / Union Territory directory.
    Authoritative for CGST+SGST vs IGST determination.
    """
    return [
        {"gst_code": "01", "state_code": "JK", "name": "Jammu & Kashmir", "type": "UNION_TERRITORY"},
        {"gst_code": "02", "state_code": "HP", "name": "Himachal Pradesh", "type": "STATE"},
        {"gst_code": "03", "state_code": "PB", "name": "Punjab", "type": "STATE"},
        {"gst_code": "04", "state_code": "CH", "name": "Chandigarh", "type": "UNION_TERRITORY"},
        {"gst_code": "05", "state_code": "UK", "name": "Uttarakhand", "type": "STATE"},
        {"gst_code": "06", "state_code": "HR", "name": "Haryana", "type": "STATE"},
        {"gst_code": "07", "state_code": "DL", "name": "Delhi", "type": "UNION_TERRITORY"},
        {"gst_code": "08", "state_code": "RJ", "name": "Rajasthan", "type": "STATE"},
        {"gst_code": "09", "state_code": "UP", "name": "Uttar Pradesh", "type": "STATE"},
        {"gst_code": "10", "state_code": "BR", "name": "Bihar", "type": "STATE"},
        {"gst_code": "19", "state_code": "WB", "name": "West Bengal", "type": "STATE"},
        {"gst_code": "24", "state_code": "GJ", "name": "Gujarat", "type": "STATE"},
        {"gst_code": "27", "state_code": "MH", "name": "Maharashtra", "type": "STATE"},
        {"gst_code": "29", "state_code": "KA", "name": "Karnataka", "type": "STATE"},
        {"gst_code": "32", "state_code": "KL", "name": "Kerala", "type": "STATE"},
        {"gst_code": "33", "state_code": "TN", "name": "Tamil Nadu", "type": "STATE"},
        {"gst_code": "36", "state_code": "TS", "name": "Telangana", "type": "STATE"},
        {"gst_code": "37", "state_code": "AP", "name": "Andhra Pradesh", "type": "STATE"},
        {"gst_code": "38", "state_code": "LA", "name": "Ladakh", "type": "UNION_TERRITORY"},
        {"gst_code": "97", "state_code": "OT", "name": "Other Territory", "type": "SPECIAL_ZONE"},
    ]


@router.get("/currencies")
async def get_currencies():
    """
    Fetch ISO 4217 Currency reference directory.
    """
    return [
        {"code": "INR", "name": "Indian Rupee", "symbol": "₹", "subunit": "Paisa", "decimals": 2, "position": "BEFORE"},
        {"code": "USD", "name": "US Dollar", "symbol": "$", "subunit": "Cent", "decimals": 2, "position": "BEFORE"},
        {"code": "EUR", "name": "Euro", "symbol": "€", "subunit": "Cent", "decimals": 2, "position": "BEFORE"},
        {"code": "GBP", "name": "British Pound", "symbol": "£", "subunit": "Penny", "decimals": 2, "position": "BEFORE"},
        {"code": "AED", "name": "UAE Dirham", "symbol": "د.إ", "subunit": "Fils", "decimals": 2, "position": "AFTER"},
        {"code": "SGD", "name": "Singapore Dollar", "symbol": "S$", "subunit": "Cent", "decimals": 2, "position": "BEFORE"},
    ]


@router.get("/locales")
async def get_locales():
    """
    Fetch supported user interface and document print locales.
    """
    return [
        {"code": "en-IN", "language": "English (India)", "number_system": "INDIAN_LAKH_CRORE", "date_format": "DD/MM/YYYY", "timezone": "Asia/Kolkata", "is_default": True},
        {"code": "hi-IN", "language": "हिन्दी (Hindi)", "number_system": "INDIAN_LAKH_CRORE", "date_format": "DD/MM/YYYY", "timezone": "Asia/Kolkata", "is_default": False},
        {"code": "mr-IN", "language": "मराठी (Marathi)", "number_system": "INDIAN_LAKH_CRORE", "date_format": "DD/MM/YYYY", "timezone": "Asia/Kolkata", "is_default": False},
        {"code": "gu-IN", "language": "ગુજરાતી (Gujarati)", "number_system": "INDIAN_LAKH_CRORE", "date_format": "DD/MM/YYYY", "timezone": "Asia/Kolkata", "is_default": False},
        {"code": "en-US", "language": "English (United States)", "number_system": "INTERNATIONAL_MILLION", "date_format": "MM/DD/YYYY", "timezone": "America/New_York", "is_default": False},
        {"code": "en-GB", "language": "English (United Kingdom)", "number_system": "INTERNATIONAL_MILLION", "date_format": "DD/MM/YYYY", "timezone": "Europe/London", "is_default": False},
        {"code": "ar-AE", "language": "العربية (UAE)", "number_system": "INTERNATIONAL_MILLION", "date_format": "DD/MM/YYYY", "timezone": "Asia/Dubai", "is_default": False},
    ]


@router.get("/translations")
async def get_translations(
    locale: str = Query("en-IN", description="Target locale e.g. hi-IN, mr-IN, gu-IN, en-IN")
):
    """
    Fetch dictionary translations with automatic English fallback.
    """
    keys = list(LocalizationService._BASELINE_TRANSLATIONS.keys())
    result = {}
    for k in keys:
        result[k] = LocalizationService.translate(k, locale=locale)
    return {
        "locale": locale,
        "count": len(result),
        "translations": result
    }


@router.get("/uoms")
async def get_uoms():
    """
    Fetch standard Units of Measurement and statutory GST UQC codes.
    """
    return [
        {"code": "PCS", "name": "Pieces", "category": "COUNT", "uqc_code": "PCS", "decimal_allowed": False},
        {"code": "NOS", "name": "Numbers", "category": "COUNT", "uqc_code": "NOS", "decimal_allowed": False},
        {"code": "KG", "name": "Kilograms", "category": "WEIGHT", "uqc_code": "KGS", "decimal_allowed": True},
        {"code": "GM", "name": "Grams", "category": "WEIGHT", "uqc_code": "GMS", "decimal_allowed": True},
        {"code": "LTR", "name": "Litres", "category": "VOLUME", "uqc_code": "LTR", "decimal_allowed": True},
        {"code": "ML", "name": "Millilitres", "category": "VOLUME", "uqc_code": "MLT", "decimal_allowed": True},
        {"code": "MTR", "name": "Metres", "category": "LENGTH", "uqc_code": "MTR", "decimal_allowed": True},
        {"code": "BOX", "name": "Box", "category": "COUNT", "uqc_code": "BOX", "decimal_allowed": False},
        {"code": "PAC", "name": "Packets", "category": "COUNT", "uqc_code": "PAC", "decimal_allowed": False},
        {"code": "DOZ", "name": "Dozens", "category": "COUNT", "uqc_code": "DOZ", "decimal_allowed": False},
    ]


@router.get("/uom-convert")
async def convert_uom(
    quantity: Decimal = Query(..., gt=0),
    from_uom: str = Query(...),
    to_uom: str = Query(...)
):
    """
    Convert a quantity between compatible units of measurement.
    """
    try:
        converted = LocalizationService.convert_uom(quantity, from_uom, to_uom)
        return {
            "from_quantity": float(quantity),
            "from_uom": from_uom.upper(),
            "to_quantity": float(converted),
            "to_uom": to_uom.upper(),
            "conversion_factor": float(converted / quantity)
        }
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/tax-rates")
async def get_tax_rates():
    """
    Fetch statutory GST Tax slabs and breakdown components.
    """
    return [
        {"code": "GST_0", "name": "GST 0% (Zero Rated)", "rate": 0.00, "cgst": 0.00, "sgst": 0.00, "igst": 0.00},
        {"code": "GST_5", "name": "GST 5%", "rate": 5.00, "cgst": 2.50, "sgst": 2.50, "igst": 5.00},
        {"code": "GST_12", "name": "GST 12%", "rate": 12.00, "cgst": 6.00, "sgst": 6.00, "igst": 12.00},
        {"code": "GST_18", "name": "GST 18%", "rate": 18.00, "cgst": 9.00, "sgst": 9.00, "igst": 18.00},
        {"code": "GST_28", "name": "GST 28%", "rate": 28.00, "cgst": 14.00, "sgst": 14.00, "igst": 28.00},
        {"code": "GST_EXEMPT", "name": "GST Exempt", "rate": 0.00, "cgst": 0.00, "sgst": 0.00, "igst": 0.00},
    ]


@router.get("/format-preview", response_model=FormatPreviewResponse)
async def get_format_preview(
    amount: Decimal = Query(Decimal("12345678.50")),
    currency: str = Query("INR"),
    locale: str = Query("en-IN")
):
    """
    Preview formatted currency, number, and date for given locale.
    """
    fmt_curr = LocalizationService.format_currency(amount, currency_code=currency, locale_code=locale)
    fmt_num = LocalizationService.format_indian_number(amount) if "IN" in locale.upper() else LocalizationService.format_international_number(amount)
    fmt_dt = LocalizationService.format_date(datetime.now(), date_format="MM/DD/YYYY" if "US" in locale.upper() else "DD/MM/YYYY")

    return FormatPreviewResponse(
        locale=locale,
        currency_code=currency,
        sample_amount=float(amount),
        formatted_currency=fmt_curr,
        formatted_number=fmt_num,
        formatted_date=fmt_dt
    )
