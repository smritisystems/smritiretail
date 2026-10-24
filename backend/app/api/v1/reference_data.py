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
from datetime import datetime
from typing import Dict, Any, Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from ...api.deps import get_db, get_current_user
from ...services.localization_svc import LocalizationService, GlobalReferenceService

router = APIRouter(prefix="/reference", tags=["Global Reference Data & Localization"])


class FormatPreviewResponse(BaseModel):
    locale: str
    currency_code: str
    sample_amount: float
    formatted_currency: str
    formatted_number: str
    formatted_date: str


@router.get("/countries")
async def get_countries(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Fetch authoritative list of supported countries and ISO codes.
    """
    return [
        {
            "code": country.code,
            "iso3": country.iso3,
            "numeric_code": country.numeric_code,
            "name": country.name,
            "phone_code": country.phone_code,
            "default_currency": country.default_currency,
            "is_active": country.is_active,
        }
        for country in await GlobalReferenceService(db).get_countries()
    ]


@router.get("/gst-states")
async def get_gst_states(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Fetch official 2-digit Indian GST State / Union Territory directory.
    Authoritative for CGST+SGST vs IGST determination.
    """
    return [
        {
            "gst_code": state.gst_state_code,
            "state_code": state.state_code,
            "name": state.name,
            "type": state.state_type,
        }
        for state in await GlobalReferenceService(db).get_states("IN")
        if state.gst_state_code
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
