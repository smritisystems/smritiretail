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
from datetime import datetime, date
from typing import Dict, Any, Optional, List, Tuple
from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.localization import (
    CountryRef,
    StateRef,
    DistrictRef,
    PostalCodeRef,
    LanguageRef,
    LocaleRef,
    TranslationKeyRef,
    TranslationRef,
    CurrencyRef,
    UnitOfMeasurementRef,
    UOMConversionRef,
    TaxReferenceRef,
    HsnSacCodeRef,
    PlatformReferenceData,
)


class LocalizationService:
    """
    Authoritative Global Localization & Reference Data Engine (P1.1).
    Provides locale fallback, translation version selection, currency/number formatting,
    standard UOM conversion, and statutory GST tax reference resolution.
    """

    # Static baseline dictionary for high-throughput zero-latency caching
    _BASELINE_TRANSLATIONS: Dict[str, Dict[str, str]] = {
        "pos.shift.open": {
            "en": "Open Shift",
            "hi": "शिफ्ट खोलें",
            "mr": "शिफ्ट सुरू करा",
            "gu": "શિફ્ટ શરૂ કરો",
        },
        "pos.shift.close": {
            "en": "Close Shift",
            "hi": "शिफ्ट बंद करें",
            "mr": "शिफ्ट बंद करा",
            "gu": "શિફ્ટ બંધ કરો",
        },
        "pos.cash_drop": {
            "en": "Cash Drop (Safe Deposit)",
            "hi": "कैश ड्रॉप (तिजोरी जमा)",
            "mr": "कॅश ड्रॉप (तिजोरी जमा)",
            "gu": "કેશ ડ્રોપ (તિજોરી જમા)",
        },
        "pos.till_expense": {
            "en": "Till Expense (Petty Cash)",
            "hi": "तिजोरी खर्च (छोटा खर्च)",
            "mr": "किरकोळ खर्च",
            "gu": "પરચૂરણ ખર્ચ",
        },
        "pos.cash_in": {
            "en": "Cash In (Float Addition)",
            "hi": "कैश इन (अतिरिक्त फ्लोट)",
            "mr": "कॅश इन (अतिरिक्त रोकड)",
            "gu": "કેશ ઇન (વધારાની રોકડ)",
        },
        "billing.tax_invoice": {
            "en": "Tax Invoice",
            "hi": "टैक्स चालान / बीजक",
            "mr": "कर बीजक (Tax Invoice)",
            "gu": "ટેક્સ ઇનવોઇસ",
        },
        "billing.grand_total": {
            "en": "Grand Total",
            "hi": "कुल योग",
            "mr": "एकूण रक्कम",
            "gu": "કુલ રકમ",
        },
        "billing.payment_received": {
            "en": "Payment Received",
            "hi": "भुगतान प्राप्त हुआ",
            "mr": "पेमेंट प्राप्त झाले",
            "gu": "ચુકવણી પ્રાપ્ત થઈ",
        },
        "common.save": {
            "en": "Save",
            "hi": "सहेजें",
            "mr": "जतन करा",
            "gu": "સાચવો",
        },
        "common.cancel": {
            "en": "Cancel",
            "hi": "रद्द करें",
            "mr": "रद्द करा",
            "gu": "રદ કરો",
        },
        "common.success": {
            "en": "Operation completed successfully.",
            "hi": "कार्य सफलतापूर्वक पूरा हुआ।",
            "mr": "प्रक्रिया यशस्वीरीत्या पूर्ण झाली.",
            "gu": "કામગીરી સફળતાપૂર્વક પૂર્ણ થઈ.",
        },
    }

    # Standard UOM conversion factors
    _STATIC_UOM_FACTORS: Dict[Tuple[str, str], Decimal] = {
        ("KG", "GM"): Decimal("1000"),
        ("GM", "KG"): Decimal("0.001"),
        ("LTR", "ML"): Decimal("1000"),
        ("ML", "LTR"): Decimal("0.001"),
        ("MTR", "CM"): Decimal("100"),
        ("CM", "MTR"): Decimal("0.01"),
        ("DOZ", "PCS"): Decimal("12"),
        ("PCS", "DOZ"): Decimal("0.083333333333"),
        ("BOX", "PCS"): Decimal("10"),
    }

    @classmethod
    def format_indian_number(cls, amount: Decimal, decimals: int = 2) -> str:
        """
        Formats numbers using the Indian numbering system (Lakhs & Crores):
        Example: 12345678.50 -> "1,23,45,678.50"
        """
        amt = Decimal(str(amount))
        sign = "-" if amt < 0 else ""
        amt = abs(amt)

        # Quantize to required decimals
        fmt_spec = f".{decimals}f"
        val_str = f"{amt:{fmt_spec}}"
        parts = val_str.split(".")
        int_part = parts[0]
        dec_part = f".{parts[1]}" if len(parts) > 1 else ""

        if len(int_part) <= 3:
            return f"{sign}{int_part}{dec_part}"

        last_three = int_part[-3:]
        remaining = int_part[:-3]

        # Group remaining digits in sets of 2
        groups = []
        while len(remaining) > 2:
            groups.insert(0, remaining[-2:])
            remaining = remaining[:-2]
        if remaining:
            groups.insert(0, remaining)

        formatted_int = ",".join(groups) + "," + last_three
        return f"{sign}{formatted_int}{dec_part}"

    @classmethod
    def format_international_number(cls, amount: Decimal, decimals: int = 2) -> str:
        """
        Formats numbers using International million grouping:
        Example: 12345678.50 -> "12,345,678.50"
        """
        amt = Decimal(str(amount))
        fmt_spec = f",.{decimals}f"
        return f"{amt:{fmt_spec}}"

    @classmethod
    def format_currency(
        cls,
        amount: Decimal,
        currency_code: str = "INR",
        locale_code: str = "en-IN"
    ) -> str:
        """
        Formats currency with authoritative symbol placement and locale-specific numbering.
        """
        symbols = {
            "INR": "₹",
            "USD": "$",
            "EUR": "€",
            "GBP": "£",
            "AED": "د.إ",
            "SGD": "S$",
            "CAD": "C$",
            "AUD": "A$",
        }
        sym = symbols.get(currency_code.upper(), currency_code.upper())
        is_indian = "IN" in locale_code.upper() or currency_code.upper() == "INR"

        if is_indian:
            num_str = cls.format_indian_number(amount, decimals=2)
        else:
            num_str = cls.format_international_number(amount, decimals=2)

        if currency_code.upper() == "AED":
            return f"{num_str} {sym}"
        return f"{sym} {num_str}"

    @classmethod
    def format_date(cls, dt: Any, date_format: str = "DD/MM/YYYY") -> str:
        """
        Formats date according to locale format (DD/MM/YYYY, YYYY-MM-DD, MM/DD/YYYY).
        """
        if not dt:
            return ""
        if isinstance(dt, str):
            try:
                dt = datetime.fromisoformat(dt)
            except Exception:
                return dt

        d = dt.date() if isinstance(dt, datetime) else dt
        if date_format == "YYYY-MM-DD":
            return d.strftime("%Y-%m-%d")
        if date_format == "MM/DD/YYYY":
            return d.strftime("%m/%d/%Y")
        # Default DD/MM/YYYY
        return d.strftime("%d/%m/%Y")

    @classmethod
    def translate(
        cls,
        key: str,
        locale: str = "en-IN",
        params: Optional[Dict[str, Any]] = None
    ) -> str:
        """
        Resolves translation for dictionary key with locale fallback:
        locale (e.g. 'mr-IN') -> language ('mr') -> default English ('en').
        Supports parameter interpolation (e.g. {order_id}).
        """
        clean_key = str(key).strip()
        lang = locale.split("-")[0].lower() if "-" in locale else locale.lower()

        text = None
        if clean_key in cls._BASELINE_TRANSLATIONS:
            translations = cls._BASELINE_TRANSLATIONS[clean_key]
            text = translations.get(lang) or translations.get("en")

        if not text:
            # Fallback to humanized key name
            text = clean_key.split(".")[-1].replace("_", " ").title()

        if params:
            for k, v in params.items():
                text = text.replace(f"{{{k}}}", str(v))

        return text

    @classmethod
    def convert_uom(
        cls,
        quantity: Decimal,
        from_uom: str,
        to_uom: str
    ) -> Decimal:
        """
        Converts quantity between compatible units of measurement.
        """
        from_u = from_uom.strip().upper()
        to_u = to_uom.strip().upper()

        if from_u == to_u:
            return quantity

        pair = (from_u, to_u)
        if pair in cls._STATIC_UOM_FACTORS:
            return quantity * cls._STATIC_UOM_FACTORS[pair]

        raise ValueError(f"Direct UOM conversion from '{from_u}' to '{to_u}' is not defined.")

    @classmethod
    def determine_gst_type(
        cls,
        supplier_gst_state_code: str,
        recipient_gst_state_code: str
    ) -> Dict[str, Any]:
        """
        Statutory India GST Tax Determination Rule:
        - If Supplier State == Recipient State -> INTRASTATE (CGST + SGST applied equally)
        - If Supplier State != Recipient State -> INTERSTATE (IGST applied in full)
        """
        supp = str(supplier_gst_state_code).strip().zfill(2)
        recip = str(recipient_gst_state_code).strip().zfill(2)

        is_intrastate = (supp == recip)
        return {
            "supply_type": "INTRASTATE" if is_intrastate else "INTERSTATE",
            "is_intrastate": is_intrastate,
            "supplier_gst_state_code": supp,
            "recipient_gst_state_code": recip,
            "tax_components": ["CGST", "SGST"] if is_intrastate else ["IGST"],
        }
