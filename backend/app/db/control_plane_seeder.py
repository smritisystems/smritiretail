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

import uuid
from decimal import Decimal
from typing import Dict, Any, List
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.capability_template import PlatformCapability, WorkspaceTemplate
from ..models.ui_control_plane import SmritiTheme, SmritiThemeVariant, SmritiWorkspaceProfile
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
from ..services.capability_service import CapabilityService
from ..services.localization_service import LocalizationService


class ControlPlaneSeeder:
    """
    Idempotent Control Plane Database Seeder for SmritiSys and Tenant reference data.
    Seeds the 26 canonical capabilities, ISO countries, GST states, currencies, UOMs, and translations.
    """

    @classmethod
    async def seed_capabilities(cls, session: AsyncSession) -> int:
        """Seeds all 26 canonical capabilities into platform_capabilities table on control plane."""
        # Check if platform_capabilities table exists in this database
        tbl_check = await session.execute(text("SELECT to_regclass('public.platform_capabilities');"))
        if not tbl_check.scalar():
            return 0

        count = 0
        for code, meta in CapabilityService.CANONICAL_CAPABILITIES.items():
            stmt = select(PlatformCapability).where(PlatformCapability.code == code)
            existing = (await session.execute(stmt)).scalar_one_or_none()
            if not existing:
                cap = PlatformCapability(
                    id=f"cap_{code.lower()}",
                    code=code,
                    name=meta["name"],
                    category=meta["category"],
                    description=meta.get("description"),
                    dependencies=meta.get("dependencies", []),
                    min_version="1.0.0",
                    is_core=meta.get("is_core", False),
                    default_enabled=meta.get("default_enabled", False),
                    status="ACTIVE"
                )
                session.add(cap)
                count += 1
            else:
                # Update metadata if needed
                existing.name = meta["name"]
                existing.category = meta["category"]
                existing.description = meta.get("description")
                existing.dependencies = meta.get("dependencies", [])
                existing.is_core = meta.get("is_core", False)
                existing.default_enabled = meta.get("default_enabled", False)
        await session.flush()
        return count

    @classmethod
    async def seed_reference_data(cls, session: AsyncSession) -> Dict[str, int]:
        """Seeds standard countries, GST states, currencies, UOMs, tax slabs, and locales."""
        counts = {}

        # 1. Countries
        countries = [
            {"id": "ctry_in", "code": "IN", "iso3": "IND", "numeric_code": "356", "name": "India", "phone_code": "+91", "default_currency": "INR"},
            {"id": "ctry_us", "code": "US", "iso3": "USA", "numeric_code": "840", "name": "United States", "phone_code": "+1", "default_currency": "USD"},
            {"id": "ctry_ae", "code": "AE", "iso3": "ARE", "numeric_code": "784", "name": "United Arab Emirates", "phone_code": "+971", "default_currency": "AED"},
            {"id": "ctry_gb", "code": "GB", "iso3": "GBR", "numeric_code": "826", "name": "United Kingdom", "phone_code": "+44", "default_currency": "GBP"},
            {"id": "ctry_sg", "code": "SG", "iso3": "SGP", "numeric_code": "702", "name": "Singapore", "phone_code": "+65", "default_currency": "SGD"},
            {"id": "ctry_de", "code": "DE", "iso3": "DEU", "numeric_code": "276", "name": "Germany", "phone_code": "+49", "default_currency": "EUR"},
            {"id": "ctry_au", "code": "AU", "iso3": "AUS", "numeric_code": "036", "name": "Australia", "phone_code": "+61", "default_currency": "AUD"},
            {"id": "ctry_ca", "code": "CA", "iso3": "CAN", "numeric_code": "124", "name": "Canada", "phone_code": "+1", "default_currency": "CAD"},
        ]
        c_count = 0
        for c in countries:
            existing = (await session.execute(select(CountryRef).where(CountryRef.code == c["code"]))).scalar_one_or_none()
            if not existing:
                session.add(CountryRef(**c))
                c_count += 1
        counts["countries"] = c_count

        # 2. Currencies
        currencies = [
            {"id": "curr_inr", "code": "INR", "name": "Indian Rupee", "symbol": "₹", "subunit": "Paisa", "decimal_places": 2, "symbol_position": "BEFORE"},
            {"id": "curr_usd", "code": "USD", "name": "US Dollar", "symbol": "$", "subunit": "Cent", "decimal_places": 2, "symbol_position": "BEFORE"},
            {"id": "curr_eur", "code": "EUR", "name": "Euro", "symbol": "€", "subunit": "Cent", "decimal_places": 2, "symbol_position": "BEFORE"},
            {"id": "curr_gbp", "code": "GBP", "name": "British Pound", "symbol": "£", "subunit": "Penny", "decimal_places": 2, "symbol_position": "BEFORE"},
            {"id": "curr_aed", "code": "AED", "name": "UAE Dirham", "symbol": "د.إ", "subunit": "Fils", "decimal_places": 2, "symbol_position": "AFTER"},
            {"id": "curr_sgd", "code": "SGD", "name": "Singapore Dollar", "symbol": "S$", "subunit": "Cent", "decimal_places": 2, "symbol_position": "BEFORE"},
        ]
        curr_count = 0
        for cr in currencies:
            existing = (await session.execute(select(CurrencyRef).where(CurrencyRef.code == cr["code"]))).scalar_one_or_none()
            if not existing:
                session.add(CurrencyRef(**cr))
                curr_count += 1
        counts["currencies"] = curr_count

        # 3. Indian GST States
        states = [
            {"id": "st_mh", "country_id": "ctry_in", "country_code": "IN", "state_code": "MH", "name": "Maharashtra", "gst_state_code": "27", "state_type": "STATE"},
            {"id": "st_dl", "country_id": "ctry_in", "country_code": "IN", "state_code": "DL", "name": "Delhi", "gst_state_code": "07", "state_type": "UNION_TERRITORY"},
            {"id": "st_ka", "country_id": "ctry_in", "country_code": "IN", "state_code": "KA", "name": "Karnataka", "gst_state_code": "29", "state_type": "STATE"},
            {"id": "st_tn", "country_id": "ctry_in", "country_code": "IN", "state_code": "TN", "name": "Tamil Nadu", "gst_state_code": "33", "state_type": "STATE"},
            {"id": "st_gj", "country_id": "ctry_in", "country_code": "IN", "state_code": "GJ", "name": "Gujarat", "gst_state_code": "24", "state_type": "STATE"},
            {"id": "st_wb", "country_id": "ctry_in", "country_code": "IN", "state_code": "WB", "name": "West Bengal", "gst_state_code": "19", "state_type": "STATE"},
            {"id": "st_up", "country_id": "ctry_in", "country_code": "IN", "state_code": "UP", "name": "Uttar Pradesh", "gst_state_code": "09", "state_type": "STATE"},
            {"id": "st_ts", "country_id": "ctry_in", "country_code": "IN", "state_code": "TS", "name": "Telangana", "gst_state_code": "36", "state_type": "STATE"},
            {"id": "st_kl", "country_id": "ctry_in", "country_code": "IN", "state_code": "KL", "name": "Kerala", "gst_state_code": "32", "state_type": "STATE"},
            {"id": "st_rj", "country_id": "ctry_in", "country_code": "IN", "state_code": "RJ", "name": "Rajasthan", "gst_state_code": "08", "state_type": "STATE"},
        ]
        st_count = 0
        for s in states:
            existing = (await session.execute(select(StateRef).where(StateRef.state_code == s["state_code"]))).scalar_one_or_none()
            if not existing:
                session.add(StateRef(**s))
                st_count += 1
        counts["states"] = st_count

        # 4. Standard UOMs
        uoms = [
            {"id": "uom_pcs", "code": "PCS", "name": "Pieces", "category": "COUNT", "uqc_code": "PCS", "decimal_allowed": False},
            {"id": "uom_nos", "code": "NOS", "name": "Numbers", "category": "COUNT", "uqc_code": "NOS", "decimal_allowed": False},
            {"id": "uom_kg", "code": "KG", "name": "Kilograms", "category": "WEIGHT", "uqc_code": "KGS", "decimal_allowed": True},
            {"id": "uom_gm", "code": "GM", "name": "Grams", "category": "WEIGHT", "uqc_code": "GMS", "decimal_allowed": True},
            {"id": "uom_ltr", "code": "LTR", "name": "Litres", "category": "VOLUME", "uqc_code": "LTR", "decimal_allowed": True},
            {"id": "uom_ml", "code": "ML", "name": "Millilitres", "category": "VOLUME", "uqc_code": "MLT", "decimal_allowed": True},
            {"id": "uom_mtr", "code": "MTR", "name": "Metres", "category": "LENGTH", "uqc_code": "MTR", "decimal_allowed": True},
            {"id": "uom_box", "code": "BOX", "name": "Box", "category": "COUNT", "uqc_code": "BOX", "decimal_allowed": False},
            {"id": "uom_pac", "code": "PAC", "name": "Packets", "category": "COUNT", "uqc_code": "PAC", "decimal_allowed": False},
            {"id": "uom_doz", "code": "DOZ", "name": "Dozens", "category": "COUNT", "uqc_code": "DOZ", "decimal_allowed": False},
        ]
        uom_count = 0
        for u in uoms:
            existing = (await session.execute(select(UnitOfMeasurementRef).where(UnitOfMeasurementRef.code == u["code"]))).scalar_one_or_none()
            if not existing:
                session.add(UnitOfMeasurementRef(**u))
                uom_count += 1
        counts["uoms"] = uom_count

        # 5. Tax Slabs
        tax_slabs = [
            {"id": "tax_gst_0", "tax_type": "GST", "code": "GST_0", "name": "GST 0% (Zero Rated)", "rate": Decimal("0.00"), "cgst_rate": Decimal("0.00"), "sgst_rate": Decimal("0.00"), "igst_rate": Decimal("0.00")},
            {"id": "tax_gst_5", "tax_type": "GST", "code": "GST_5", "name": "GST 5%", "rate": Decimal("5.00"), "cgst_rate": Decimal("2.50"), "sgst_rate": Decimal("2.50"), "igst_rate": Decimal("5.00")},
            {"id": "tax_gst_12", "tax_type": "GST", "code": "GST_12", "name": "GST 12%", "rate": Decimal("12.00"), "cgst_rate": Decimal("6.00"), "sgst_rate": Decimal("6.00"), "igst_rate": Decimal("12.00")},
            {"id": "tax_gst_18", "tax_type": "GST", "code": "GST_18", "name": "GST 18%", "rate": Decimal("18.00"), "cgst_rate": Decimal("9.00"), "sgst_rate": Decimal("9.00"), "igst_rate": Decimal("18.00")},
            {"id": "tax_gst_28", "tax_type": "GST", "code": "GST_28", "name": "GST 28%", "rate": Decimal("28.00"), "cgst_rate": Decimal("14.00"), "sgst_rate": Decimal("14.00"), "igst_rate": Decimal("28.00")},
            {"id": "tax_gst_exempt", "tax_type": "GST", "code": "GST_EXEMPT", "name": "GST Exempt", "rate": Decimal("0.00"), "cgst_rate": Decimal("0.00"), "sgst_rate": Decimal("0.00"), "igst_rate": Decimal("0.00")},
        ]
        tax_count = 0
        for tx in tax_slabs:
            existing = (await session.execute(select(TaxReferenceRef).where(TaxReferenceRef.code == tx["code"]))).scalar_one_or_none()
            if not existing:
                session.add(TaxReferenceRef(**tx))
                tax_count += 1
        counts["tax_slabs"] = tax_count

        # 6. Languages & Locales
        languages = [
            {"id": "lang_en", "code": "en", "name": "English", "native_name": "English", "script": "Latin", "is_rtl": False},
            {"id": "lang_hi", "code": "hi", "name": "Hindi", "native_name": "हिन्दी", "script": "Devanagari", "is_rtl": False},
            {"id": "lang_mr", "code": "mr", "name": "Marathi", "native_name": "मराठी", "script": "Devanagari", "is_rtl": False},
            {"id": "lang_gu", "code": "gu", "name": "Gujarati", "native_name": "ગુજરાતી", "script": "Gujarati", "is_rtl": False},
        ]
        lang_count = 0
        for l in languages:
            existing = (await session.execute(select(LanguageRef).where(LanguageRef.code == l["code"]))).scalar_one_or_none()
            if not existing:
                session.add(LanguageRef(**l))
                lang_count += 1
        counts["languages"] = lang_count

        locales = [
            {"id": "loc_en_in", "code": "en-IN", "language_code": "en", "country_code": "IN", "date_format": "DD/MM/YYYY", "number_system": "INDIAN_LAKH_CRORE", "timezone": "Asia/Kolkata", "is_default": True},
            {"id": "loc_hi_in", "code": "hi-IN", "language_code": "hi", "country_code": "IN", "date_format": "DD/MM/YYYY", "number_system": "INDIAN_LAKH_CRORE", "timezone": "Asia/Kolkata", "is_default": False},
            {"id": "loc_mr_in", "code": "mr-IN", "language_code": "mr", "country_code": "IN", "date_format": "DD/MM/YYYY", "number_system": "INDIAN_LAKH_CRORE", "timezone": "Asia/Kolkata", "is_default": False},
            {"id": "loc_gu_in", "code": "gu-IN", "language_code": "gu", "country_code": "IN", "date_format": "DD/MM/YYYY", "number_system": "INDIAN_LAKH_CRORE", "timezone": "Asia/Kolkata", "is_default": False},
            {"id": "loc_en_us", "code": "en-US", "language_code": "en", "country_code": "US", "date_format": "MM/DD/YYYY", "number_system": "INTERNATIONAL_MILLION", "timezone": "America/New_York", "is_default": False},
        ]
        loc_count = 0
        for lc in locales:
            existing = (await session.execute(select(LocaleRef).where(LocaleRef.code == lc["code"]))).scalar_one_or_none()
            if not existing:
                session.add(LocaleRef(**lc))
                loc_count += 1
        counts["locales"] = loc_count

        # 7. Translation Keys and Translations
        t_count = 0
        for tkey, translations in LocalizationService._BASELINE_TRANSLATIONS.items():
            cat = tkey.split(".")[0].upper()
            existing_key = (await session.execute(select(TranslationKeyRef).where(TranslationKeyRef.key == tkey))).scalar_one_or_none()
            if not existing_key:
                key_id = f"tk_{uuid.uuid4().hex[:10]}"
                existing_key = TranslationKeyRef(
                    id=key_id,
                    key=tkey,
                    category=cat,
                    default_text=translations.get("en", tkey)
                )
                session.add(existing_key)
                await session.flush()

            for lang, trans_text in translations.items():
                existing_tr = (await session.execute(
                    select(TranslationRef).where(
                        TranslationRef.key_id == existing_key.id,
                        TranslationRef.language_code == lang
                    )
                )).scalar_one_or_none()
                if not existing_tr:
                    session.add(TranslationRef(
                        id=f"tr_{uuid.uuid4().hex[:10]}",
                        key_id=existing_key.id,
                        language_code=lang,
                        translation_text=trans_text,
                        version=1,
                        is_approved=True
                    ))
                    t_count += 1
        counts["translations"] = t_count

        await session.flush()
        return counts

    @classmethod
    async def seed_ui_metadata(cls, session: AsyncSession) -> Dict[str, int]:
        """Seeds standard themes, variants, workspace profiles, and templates on control plane."""
        counts = {"themes": 0, "variants": 0, "profiles": 0, "templates": 0}

        # Check if smriti_themes exists
        tbl_theme = await session.execute(text("SELECT to_regclass('public.smriti_themes');"))
        if not tbl_theme.scalar():
            return counts

        # 1. Themes & Variants
        theme_id = "theme_smriti_obsidian"
        existing_theme = (await session.execute(select(SmritiTheme).where(SmritiTheme.id == theme_id))).scalar_one_or_none()
        if not existing_theme:
            theme = SmritiTheme(
                id=theme_id,
                company_id="comp-default",
                theme_name="SMRITI Modern Obsidian",
                icon_pack="Material Symbols Outlined",
                illustration_set="default",
                font_heading="Space Grotesk",
                font_body="Inter",
                border_radius_px=6,
                is_active=True
            )
            session.add(theme)
            await session.flush()
            counts["themes"] += 1

            # Variants
            variants = [
                {
                    "id": "var_obsidian_dark",
                    "theme_id": theme_id,
                    "variant": "dark",
                    "primary_color": "#6366F1",
                    "secondary_color": "#4F46E5",
                    "accent_color": "#06B6D4",
                    "background_color": "#0F172A",
                    "surface_color": "#1E293B",
                    "text_primary": "#F8FAFC",
                    "text_secondary": "#94A3B8",
                    "border_color": "#334155",
                    "danger_color": "#EF4444",
                    "success_color": "#10B981",
                    "warning_color": "#F59E0B",
                    "is_default": True
                },
                {
                    "id": "var_obsidian_light",
                    "theme_id": theme_id,
                    "variant": "light",
                    "primary_color": "#4F46E5",
                    "secondary_color": "#4338CA",
                    "accent_color": "#0891B2",
                    "background_color": "#F8FAFC",
                    "surface_color": "#FFFFFF",
                    "text_primary": "#0F172A",
                    "text_secondary": "#475569",
                    "border_color": "#E2E8F0",
                    "danger_color": "#DC2626",
                    "success_color": "#16A34A",
                    "warning_color": "#D97706",
                    "is_default": False
                }
            ]
            for v in variants:
                session.add(SmritiThemeVariant(**v))
                counts["variants"] += 1

        # 2. Workspace Profiles
        tbl_prof = await session.execute(text("SELECT to_regclass('public.smriti_workspace_profiles');"))
        if tbl_prof.scalar():
            profiles = [
                {"id": "prof_sysadmin", "code": "PROF_SYSADMIN", "name": "System Administrator Console", "persona": "SYSADMIN", "default_workspace_id": "ws-admin", "theme": "theme-smriti-default", "is_default": False, "is_active": True},
                {"id": "prof_cashier", "code": "PROF_CASHIER", "name": "Cashier POS Terminal", "persona": "CASHIER", "default_workspace_id": "ws-pos", "theme": "theme-smriti-default", "is_default": False, "is_active": True},
                {"id": "prof_manager", "code": "PROF_STORE_MANAGER", "name": "Store Manager Hub", "persona": "STORE_MANAGER", "default_workspace_id": "ws-manager", "theme": "theme-smriti-default", "is_default": False, "is_active": True},
                {"id": "prof_accountant", "code": "PROF_ACCOUNTANT", "name": "Finance & Accounts Station", "persona": "ACCOUNTANT", "default_workspace_id": "ws-accounts", "theme": "theme-smriti-default", "is_default": False, "is_active": True},
                {"id": "prof_default", "code": "PROF_DEFAULT", "name": "General Enterprise Workspace", "persona": "USER", "default_workspace_id": "ws-default", "theme": "theme-smriti-default", "is_default": True, "is_active": True},
            ]
            for p in profiles:
                existing = (await session.execute(select(SmritiWorkspaceProfile).where(SmritiWorkspaceProfile.code == p["code"]))).scalar_one_or_none()
                if not existing:
                    session.add(SmritiWorkspaceProfile(**p))
                    counts["profiles"] += 1

        # 3. Workspace Templates
        tbl_tmpl = await session.execute(text("SELECT to_regclass('public.workspace_templates');"))
        if tbl_tmpl.scalar():
            templates = [
                {
                    "id": "tmpl_supermarket",
                    "code": "RETAIL_SUPERMARKET",
                    "name": "Supermarket & Grocery",
                    "vertical": "SUPERMARKET",
                    "included_capabilities": ["POS", "SALES", "PURCHASE", "INVENTORY", "BARCODE", "LABEL_PRINTING", "GST", "ACCOUNTING", "PAYMENTS", "REPORTING", "CRM", "PROMOTIONS"],
                    "is_system_template": True,
                    "status": "ACTIVE"
                },
                {
                    "id": "tmpl_apparel",
                    "code": "RETAIL_APPAREL",
                    "name": "Apparel, Footwear & Fashion",
                    "vertical": "APPAREL",
                    "included_capabilities": ["POS", "SALES", "PURCHASE", "INVENTORY", "BARCODE", "LABEL_PRINTING", "GST", "ACCOUNTING", "PAYMENTS", "REPORTING", "CRM", "PROMOTIONS", "PDT"],
                    "is_system_template": True,
                    "status": "ACTIVE"
                },
                {
                    "id": "tmpl_wms_hub",
                    "code": "WMS_DISTRIBUTION",
                    "name": "Warehouse & Distribution Hub",
                    "vertical": "WMS",
                    "included_capabilities": ["INVENTORY", "WMS", "DISTRIBUTION", "PURCHASE", "FULFILLMENT", "BARCODE", "LABEL_PRINTING", "ACCOUNTING", "REPORTING"],
                    "is_system_template": True,
                    "status": "ACTIVE"
                },
                {
                    "id": "tmpl_omnichannel",
                    "code": "ENTERPRISE_OMNICHANNEL",
                    "name": "Enterprise Omnichannel",
                    "vertical": "ENTERPRISE",
                    "included_capabilities": list(CapabilityService.CANONICAL_CAPABILITIES.keys()),
                    "is_system_template": True,
                    "status": "ACTIVE"
                }
            ]
            for t in templates:
                existing = (await session.execute(select(WorkspaceTemplate).where(WorkspaceTemplate.code == t["code"]))).scalar_one_or_none()
                if not existing:
                    session.add(WorkspaceTemplate(**t))
                    counts["templates"] += 1
                else:
                    existing.included_capabilities = t["included_capabilities"]

        await session.flush()
        return counts

    @classmethod
    async def seed_all(cls, session: AsyncSession) -> Dict[str, Any]:
        """Runs capability, reference data, and UI metadata seeders."""
        cap_count = await cls.seed_capabilities(session)
        ref_counts = await cls.seed_reference_data(session)
        ui_counts = await cls.seed_ui_metadata(session)
        await session.commit()
        return {
            "capabilities_seeded": cap_count,
            "reference_counts": ref_counts,
            "ui_counts": ui_counts
        }
