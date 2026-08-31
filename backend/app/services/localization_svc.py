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

from typing import List, Optional, Dict, Any, Tuple
from decimal import Decimal
from datetime import datetime, date
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, func
from sqlalchemy.orm import selectinload

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


class GlobalReferenceService:
    """
    Control Plane Global Reference Data Registry Service.
    Operates against smritisys / control-plane connection for master reference lookup.
    """

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_countries(self, active_only: bool = True) -> List[CountryRef]:
        stmt = select(CountryRef)
        if active_only:
            stmt = stmt.where(CountryRef.is_active == True)
        result = await self.db.execute(stmt.order_by(CountryRef.name))
        return list(result.scalars().all())

    async def get_states(self, country_code: str = "IN", active_only: bool = True) -> List[StateRef]:
        stmt = select(StateRef).where(StateRef.country_code == country_code.upper())
        if active_only:
            stmt = stmt.where(StateRef.is_active == True)
        result = await self.db.execute(stmt.order_by(StateRef.name))
        return list(result.scalars().all())

    async def get_state_by_gst_code(self, gst_state_code: str, country_code: str = "IN") -> Optional[StateRef]:
        stmt = select(StateRef).where(
            StateRef.country_code == country_code.upper(),
            StateRef.gst_state_code == str(gst_state_code).zfill(2),
            StateRef.is_active == True,
        )
        result = await self.db.execute(stmt)
        return result.scalars().first()

    async def get_districts(self, state_id: Optional[str] = None) -> List[DistrictRef]:
        stmt = select(DistrictRef).where(DistrictRef.is_active == True)
        if state_id:
            stmt = stmt.where(DistrictRef.state_id == state_id)
        result = await self.db.execute(stmt.order_by(DistrictRef.name))
        return list(result.scalars().all())

    async def get_postal_code(self, postal_code: str, country_code: str = "IN") -> Optional[PostalCodeRef]:
        stmt = select(PostalCodeRef).where(
            PostalCodeRef.country_code == country_code.upper(),
            PostalCodeRef.postal_code == postal_code.strip(),
            PostalCodeRef.is_active == True,
        )
        result = await self.db.execute(stmt)
        return result.scalars().first()

    async def get_currencies(self, active_only: bool = True) -> List[CurrencyRef]:
        stmt = select(CurrencyRef)
        if active_only:
            stmt = stmt.where(CurrencyRef.is_active == True)
        result = await self.db.execute(stmt.order_by(CurrencyRef.code))
        return list(result.scalars().all())

    async def get_currency(self, code: str) -> Optional[CurrencyRef]:
        stmt = select(CurrencyRef).where(CurrencyRef.code == code.upper(), CurrencyRef.is_active == True)
        result = await self.db.execute(stmt)
        return result.scalars().first()

    async def get_uoms(self, active_only: bool = True) -> List[UnitOfMeasurementRef]:
        stmt = select(UnitOfMeasurementRef)
        if active_only:
            stmt = stmt.where(UnitOfMeasurementRef.is_active == True)
        result = await self.db.execute(stmt.order_by(UnitOfMeasurementRef.code))
        return list(result.scalars().all())

    async def convert_uom(self, from_uom: str, to_uom: str, quantity: Decimal) -> Tuple[Decimal, Decimal]:
        """
        Calculates UOM conversion.
        Returns (conversion_factor, converted_quantity).
        """
        f_uom = from_uom.strip().upper()
        t_uom = to_uom.strip().upper()

        if f_uom == t_uom:
            return Decimal("1.0"), quantity

        # Direct conversion lookup
        stmt = select(UOMConversionRef).where(
            UOMConversionRef.from_uom == f_uom,
            UOMConversionRef.to_uom == t_uom,
        )
        res = (await self.db.execute(stmt)).scalars().first()
        if res:
            factor = res.conversion_factor
            return factor, quantity * factor

        # Inverse conversion lookup
        stmt_inv = select(UOMConversionRef).where(
            UOMConversionRef.from_uom == t_uom,
            UOMConversionRef.to_uom == f_uom,
        )
        res_inv = (await self.db.execute(stmt_inv)).scalars().first()
        if res_inv and res_inv.conversion_factor != 0:
            factor = Decimal("1.0") / res_inv.conversion_factor
            return factor, quantity * factor

        raise ValueError(f"No conversion ratio configured between '{from_uom}' and '{to_uom}'")

    async def get_tax_references(self, active_only: bool = True) -> List[TaxReferenceRef]:
        stmt = select(TaxReferenceRef)
        if active_only:
            stmt = stmt.where(TaxReferenceRef.is_active == True)
        result = await self.db.execute(stmt.order_by(TaxReferenceRef.rate))
        return list(result.scalars().all())

    async def get_hsn_sac(self, query: Optional[str] = None, limit: int = 50) -> List[HsnSacCodeRef]:
        stmt = select(HsnSacCodeRef).where(HsnSacCodeRef.is_active == True)
        if query:
            q = f"%{query.strip()}%"
            stmt = stmt.where(or_(HsnSacCodeRef.code.ilike(q), HsnSacCodeRef.description.ilike(q)))
        result = await self.db.execute(stmt.order_by(HsnSacCodeRef.code).limit(limit))
        return list(result.scalars().all())

    async def get_platform_references(self, category: str, active_only: bool = True) -> List[PlatformReferenceData]:
        stmt = select(PlatformReferenceData).where(PlatformReferenceData.category == category.upper())
        if active_only:
            stmt = stmt.where(PlatformReferenceData.is_active == True)
        result = await self.db.execute(stmt.order_by(PlatformReferenceData.sort_order, PlatformReferenceData.label))
        return list(result.scalars().all())


class LocalizationDictionaryService:
    """
    Control Plane Multi-Lingual Dictionary & Locale Formatting Service.
    Resolves translations with automatic English fallback and handles number/currency/date formatting.
    """

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_languages(self, active_only: bool = True) -> List[LanguageRef]:
        stmt = select(LanguageRef)
        if active_only:
            stmt = stmt.where(LanguageRef.is_active == True)
        result = await self.db.execute(stmt.order_by(LanguageRef.name))
        return list(result.scalars().all())

    async def get_locales(self, active_only: bool = True) -> List[LocaleRef]:
        stmt = select(LocaleRef)
        if active_only:
            stmt = stmt.where(LocaleRef.is_active == True)
        result = await self.db.execute(stmt.order_by(LocaleRef.code))
        return list(result.scalars().all())

    async def get_dictionary(self, language_code: str = "en") -> Dict[str, Any]:
        """
        Loads all translation keys and resolves them for the target language.
        If a translation key is missing in the target language, falls back to the English default_text.
        """
        lang = language_code.strip().lower()

        # Fetch all baseline translation keys
        stmt_keys = select(TranslationKeyRef)
        keys = (await self.db.execute(stmt_keys)).scalars().all()

        # Fetch approved translations for the target language
        stmt_trans = select(TranslationRef).where(
            TranslationRef.language_code == lang,
            TranslationRef.is_approved == True,
        )
        trans_rows = (await self.db.execute(stmt_trans)).scalars().all()
        trans_map = {t.key_id: t.translation_text for t in trans_rows}

        dictionary: Dict[str, str] = {}
        fallback_count = 0

        for k in keys:
            if k.id in trans_map and lang != "en":
                dictionary[k.key] = trans_map[k.id]
            else:
                dictionary[k.key] = k.default_text
                if lang != "en":
                    fallback_count += 1

        return {
            "language_code": lang,
            "is_fallback": fallback_count > 0,
            "fallback_language": "en" if lang != "en" and fallback_count > 0 else None,
            "total_keys": len(dictionary),
            "translations": dictionary,
        }

    def format_indian_number(self, num: Decimal, decimal_places: int = 2) -> str:
        """
        Formats numbers in the Indian numbering system (Lakh/Crore: 12,34,567.89).
        """
        s = f"{num:.{decimal_places}f}"
        parts = s.split(".")
        integer_part = parts[0]
        dec_part = parts[1] if len(parts) > 1 else ""

        is_neg = False
        if integer_part.startswith("-"):
            is_neg = True
            integer_part = integer_part[1:]

        if len(integer_part) <= 3:
            res = integer_part
        else:
            last3 = integer_part[-3:]
            rest = integer_part[:-3]
            chunks = []
            while len(rest) > 2:
                chunks.insert(0, rest[-2:])
                rest = rest[:-2]
            if rest:
                chunks.insert(0, rest)
            chunks.append(last3)
            res = ",".join(chunks)

        if is_neg:
            res = f"-{res}"

        return f"{res}.{dec_part}" if decimal_places > 0 else res

    async def format_currency(
        self, amount: Decimal, currency_code: str = "INR", locale_code: str = "en-IN"
    ) -> Dict[str, Any]:
        """
        Formats a monetary amount based on currency symbol, position, and locale number system.
        """
        curr = await GlobalReferenceService(self.db).get_currency(currency_code)
        symbol = curr.symbol if curr else "₹"
        dec_places = curr.decimal_places if curr else 2
        position = curr.symbol_position if curr else "BEFORE"

        # Locale number system determination
        if locale_code.upper() in ["EN-IN", "HI-IN", "MR-IN", "GU-IN", "TA-IN"]:
            formatted_num = self.format_indian_number(amount, dec_places)
        else:
            # International Million format
            formatted_num = f"{amount:,.{dec_places}f}"

        if position == "BEFORE":
            formatted_text = f"{symbol} {formatted_num}"
        else:
            formatted_text = f"{formatted_num} {symbol}"

        return {
            "amount": amount,
            "currency_code": currency_code.upper(),
            "symbol": symbol,
            "formatted_text": formatted_text,
        }


class LocalizationService:
    """
    Static helper and compatibility wrapper for fast in-memory localization & conversions.
    """
    _BASELINE_TRANSLATIONS: Dict[str, Dict[str, str]] = {
        "common.save": {"en-IN": "Save", "hi-IN": "सहेजें", "mr-IN": "जतन करा", "gu-IN": "સાચવો"},
        "common.cancel": {"en-IN": "Cancel", "hi-IN": "रद्द करें", "mr-IN": "रद्द करा", "gu-IN": "રદ કરો"},
        "common.delete": {"en-IN": "Delete", "hi-IN": "हटाएं", "mr-IN": "हटवा", "gu-IN": "કાઢી નાખો"},
        "common.success": {"en-IN": "Success", "hi-IN": "सफल", "mr-IN": "यशस्वी", "gu-IN": "સફળ"},
        "pos.shift.open": {"en-IN": "Open POS Shift", "hi-IN": "पीओएस शिफ्ट खोलें", "mr-IN": "पीओएस शिफ्ट उघडा"},
        "pos.shift.close": {"en-IN": "Close POS Shift", "hi-IN": "पीओएस शिफ्ट बंद करें", "mr-IN": "पीओएस शिफ्ट बंद करा"},
        "billing.tax_invoice": {"en-IN": "Tax Invoice", "hi-IN": "टैक्स इनवॉयस", "mr-IN": "कर बीजक"},
    }

    @classmethod
    def translate(cls, key: str, locale: str = "en-IN") -> str:
        translations = cls._BASELINE_TRANSLATIONS.get(key, {})
        return translations.get(locale, translations.get("en-IN", key))

    @classmethod
    def convert_uom(cls, quantity: Decimal, from_uom: str, to_uom: str) -> Decimal:
        f = from_uom.strip().upper()
        t = to_uom.strip().upper()
        if f == t:
            return quantity
        if (f, t) in [("KG", "GM"), ("KGS", "GMS")]:
            return quantity * Decimal("1000")
        if (f, t) in [("GM", "KG"), ("GMS", "KGS")]:
            return quantity / Decimal("1000")
        if (f, t) in [("LTR", "ML"), ("LTR", "MLT")]:
            return quantity * Decimal("1000")
        if (f, t) in [("ML", "LTR"), ("MLT", "LTR")]:
            return quantity / Decimal("1000")
        if (f, t) in [("DOZ", "PCS"), ("DOZ", "NOS")]:
            return quantity * Decimal("12")
        if (f, t) in [("PCS", "DOZ"), ("NOS", "DOZ")]:
            return quantity / Decimal("12")
        raise ValueError(f"No conversion ratio configured between '{from_uom}' and '{to_uom}'")

    @classmethod
    def format_indian_number(cls, num: Decimal) -> str:
        s = f"{num:.2f}"
        parts = s.split(".")
        integer_part = parts[0]
        dec_part = parts[1] if len(parts) > 1 else "00"
        if len(integer_part) <= 3:
            res = integer_part
        else:
            last3 = integer_part[-3:]
            rest = integer_part[:-3]
            chunks = []
            while len(rest) > 2:
                chunks.insert(0, rest[-2:])
                rest = rest[:-2]
            if rest:
                chunks.insert(0, rest)
            chunks.append(last3)
            res = ",".join(chunks)
        return f"{res}.{dec_part}"

    @classmethod
    def format_international_number(cls, num: Decimal) -> str:
        return f"{num:,.2f}"

    @classmethod
    def format_currency(cls, amount: Decimal, currency_code: str = "INR", locale_code: str = "en-IN") -> str:
        symbol = "₹" if currency_code == "INR" else "$" if currency_code == "USD" else currency_code
        num_str = cls.format_indian_number(amount) if "IN" in locale_code.upper() else cls.format_international_number(amount)
        return f"{symbol} {num_str}"

    @classmethod
    def format_date(cls, dt: datetime, date_format: str = "DD/MM/YYYY") -> str:
        if date_format == "MM/DD/YYYY":
            return dt.strftime("%m/%d/%Y")
        return dt.strftime("%d/%m/%Y")
