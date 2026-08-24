"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.26.0
Created      : 2026-08-23
Modified     : 2026-08-24
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import uuid
from decimal import Decimal
from typing import Dict, Any, List
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.capability_template import PlatformCapability, WorkspaceTemplate, FeatureFlag
from ..models.governed_logic import (
    FormulaDefinition,
    BusinessRuleDefinition,
    PolicyDefinition,
    WorkflowDefinition,
)
from ..models.ui_control_plane import (
    SmritiTheme, SmritiThemeVariant, SmritiWorkspaceProfile,
    IconRegistry, ScreenDefinition, FieldDefinition, ActionDefinition, LayoutDefinition,
)
from ..models.integration_hub import ProviderRegistry, IntegrationRegistry
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
    async def seed_feature_flags(cls, session: AsyncSession) -> int:
        """Seeds canonical platform feature flags on control plane."""
        tbl_check = await session.execute(text("SELECT to_regclass('public.feature_flags');"))
        if not tbl_check.scalar():
            return 0

        flags = [
            {"id": "ff_multi_currency", "key": "ENABLE_MULTI_CURRENCY", "name": "Multi-Currency & FX Processing", "category": "FINANCE", "is_global_enabled": True, "description": "Enables multi-currency transaction entry and real-time forex conversions."},
            {"id": "ff_adv_pricing", "key": "ENABLE_ADVANCED_PRICING", "name": "Dynamic & Volume Tier Pricing", "category": "PRICING", "is_global_enabled": True, "description": "Enables customer tier pricing, volume break tables, and promotional rules."},
            {"id": "ff_ecom_sync", "key": "ENABLE_ECOM_SYNC", "name": "Omnichannel eCommerce Connector", "category": "INTEGRATION", "is_global_enabled": True, "description": "Enables Shopify, WooCommerce, and custom webhook synchronization."},
            {"id": "ff_rule55_challan", "key": "ENABLE_RULE55_CHALLAN", "name": "Statutory Rule 55 Delivery Challan", "category": "COMPLIANCE", "is_global_enabled": True, "description": "Generates GST Rule 55 compliant Delivery Challans for stock transfers."},
            {"id": "ff_serial_imei", "key": "ENABLE_SERIAL_IMEI_TRACKING", "name": "Serial & IMEI Number Tracking", "category": "INVENTORY", "is_global_enabled": True, "description": "Enforces piece-level serialized stock tracking at point of sale."},
            {"id": "ff_offline_sync", "key": "ENABLE_OFFLINE_SYNC", "name": "Edge Offline POS Synchronization", "category": "OPERATIONS", "is_global_enabled": False, "description": "Allows POS terminals to continue offline with idempotent outbox replay."},
        ]
        count = 0
        for f in flags:
            existing = (await session.execute(select(FeatureFlag).where(FeatureFlag.key == f["key"]))).scalar_one_or_none()
            if not existing:
                session.add(FeatureFlag(**f))
                count += 1
        await session.flush()
        return count

    @classmethod
    async def seed_governed_logic(cls, session: AsyncSession) -> Dict[str, int]:
        """Seeds standard formulas, business rules, policies, and workflows on control plane."""
        counts = {"formulas": 0, "rules": 0, "policies": 0, "workflows": 0}

        # 1. Formulas
        tbl_form = await session.execute(text("SELECT to_regclass('public.formula_definitions');"))
        if tbl_form.scalar():
            formulas = [
                {
                    "id": "form_mrp_disc_tax_v1",
                    "code": "FORMULA_MRP_DISCOUNT_TAX",
                    "version": 1,
                    "name": "MRP with Discount and Tax Addition",
                    "category": "PRICING",
                    "description": "Calculates final item price: ((mrp * (1 - discount_pct / 100)) + tax_amount)",
                    "expression_ast": {
                        "type": "binary_op",
                        "op": "+",
                        "left": {
                            "type": "binary_op",
                            "op": "*",
                            "left": {"type": "param", "name": "mrp"},
                            "right": {
                                "type": "binary_op",
                                "op": "-",
                                "left": {"type": "literal", "value": 1},
                                "right": {
                                    "type": "binary_op",
                                    "op": "/",
                                    "left": {"type": "param", "name": "discount_pct"},
                                    "right": {"type": "literal", "value": 100}
                                }
                            }
                        },
                        "right": {"type": "param", "name": "tax_amount"}
                    },
                    "status": "ACTIVE"
                },
                {
                    "id": "form_profit_margin_v1",
                    "code": "FORMULA_PROFIT_MARGIN",
                    "version": 1,
                    "name": "Gross Profit Margin Percentage",
                    "category": "PROFITABILITY",
                    "description": "Calculates gross margin: (((selling_price - cost_price) / selling_price) * 100)",
                    "expression_ast": {
                        "type": "binary_op",
                        "op": "*",
                        "left": {
                            "type": "binary_op",
                            "op": "/",
                            "left": {
                                "type": "binary_op",
                                "op": "-",
                                "left": {"type": "param", "name": "selling_price"},
                                "right": {"type": "param", "name": "cost_price"}
                            },
                            "right": {"type": "param", "name": "selling_price"}
                        },
                        "right": {"type": "literal", "value": 100}
                    },
                    "status": "ACTIVE"
                }
            ]
            for f in formulas:
                existing = (await session.execute(
                    select(FormulaDefinition).where(
                        FormulaDefinition.code == f["code"],
                        FormulaDefinition.version == f["version"]
                    )
                )).scalar_one_or_none()
                if not existing:
                    session.add(FormulaDefinition(**f))
                    counts["formulas"] += 1

        # 2. Business Rules (v1: 10% VIP discount, v2: 15% VIP discount)
        tbl_brule = await session.execute(text("SELECT to_regclass('public.business_rule_definitions');"))
        if tbl_brule.scalar():
            rules = [
                {
                    "id": "brule_vip_disc_v1",
                    "code": "RULE_VIP_DISCOUNT",
                    "version": 1,
                    "name": "VIP Customer 10% Discount Rule",
                    "rule_type": "DISCOUNT_RULE",
                    "priority": 10,
                    "conditions": {"field": "customer_tier", "op": "==", "value": "VIP"},
                    "actions": [{"type": "PERCENT_DISCOUNT", "value": 10}],
                    "status": "ACTIVE"
                },
                {
                    "id": "brule_vip_disc_v2",
                    "code": "RULE_VIP_DISCOUNT",
                    "version": 2,
                    "name": "VIP Customer 15% Discount Rule (Enhanced)",
                    "rule_type": "DISCOUNT_RULE",
                    "priority": 10,
                    "conditions": {"field": "customer_tier", "op": "==", "value": "VIP"},
                    "actions": [{"type": "PERCENT_DISCOUNT", "value": 15}],
                    "status": "ACTIVE"
                }
            ]
            for r in rules:
                existing = (await session.execute(
                    select(BusinessRuleDefinition).where(
                        BusinessRuleDefinition.code == r["code"],
                        BusinessRuleDefinition.version == r["version"]
                    )
                )).scalar_one_or_none()
                if not existing:
                    session.add(BusinessRuleDefinition(**r))
                    counts["rules"] += 1

        # 3. Policies
        tbl_pol = await session.execute(text("SELECT to_regclass('public.policy_definitions');"))
        if tbl_pol.scalar():
            policies = [
                {
                    "id": "pol_gst_std_v1",
                    "code": "POLICY_GST_STANDARD",
                    "version": 1,
                    "name": "Standard GST Tax Calculation Policy",
                    "policy_type": "GST_TAX_POLICY",
                    "parameters": {"rounding_mode": "ROUND_HALF_UP", "precision": 2, "rcm_applicable": False},
                    "status": "ACTIVE"
                }
            ]
            for p in policies:
                existing = (await session.execute(
                    select(PolicyDefinition).where(
                        PolicyDefinition.code == p["code"],
                        PolicyDefinition.version == p["version"]
                    )
                )).scalar_one_or_none()
                if not existing:
                    session.add(PolicyDefinition(**p))
                    counts["policies"] += 1

        # 4. Workflows
        tbl_wf = await session.execute(text("SELECT to_regclass('public.workflow_definitions');"))
        if tbl_wf.scalar():
            workflows = [
                {
                    "id": "wf_sales_inv_v1",
                    "code": "WF_SALES_INVOICE",
                    "version": 1,
                    "doc_type": "SalesInvoice",
                    "name": "Standard Sales Invoice Approval Workflow",
                    "initial_state": "DRAFT",
                    "states": ["DRAFT", "PENDING_APPROVAL", "APPROVED", "CANCELLED"],
                    "transitions": [
                        {"from": "DRAFT", "to": "APPROVED", "action": "APPROVE", "required_roles": ["MANAGER", "SYSADMIN"]},
                        {"from": "DRAFT", "to": "PENDING_APPROVAL", "action": "SUBMIT_FOR_APPROVAL", "required_roles": ["CASHIER", "MANAGER", "SYSADMIN"]},
                        {"from": "PENDING_APPROVAL", "to": "APPROVED", "action": "APPROVE", "required_roles": ["MANAGER", "SYSADMIN"]},
                        {"from": "PENDING_APPROVAL", "to": "DRAFT", "action": "REJECT", "required_roles": ["MANAGER", "SYSADMIN"]},
                    ],
                    "status": "ACTIVE"
                }
            ]
            for w in workflows:
                existing = (await session.execute(
                    select(WorkflowDefinition).where(
                        WorkflowDefinition.code == w["code"],
                        WorkflowDefinition.version == w["version"]
                    )
                )).scalar_one_or_none()
                if not existing:
                    session.add(WorkflowDefinition(**w))
                    counts["workflows"] += 1

        await session.flush()
        return counts

    @classmethod
    async def seed_icon_registry(cls, session: AsyncSession) -> int:
        """Seeds canonical platform icon catalogue into smritisys.icon_registry."""
        tbl_check = await session.execute(text("SELECT to_regclass('public.icon_registry');"))
        if not tbl_check.scalar():
            return 0

        icons = [
            # --- Global / Navigation
            {"id": "icn_home", "key": "icon.global.home", "name": "Home", "icon_pack": "Material Symbols Outlined", "icon_identifier": "home", "icon_category": "NAVIGATION", "module_scope": "GLOBAL", "tags": ["home", "dashboard"]},
            {"id": "icn_dashboard", "key": "icon.global.dashboard", "name": "Dashboard", "icon_pack": "Material Symbols Outlined", "icon_identifier": "dashboard", "icon_category": "NAVIGATION", "module_scope": "GLOBAL", "tags": ["dashboard"]},
            {"id": "icn_settings", "key": "icon.global.settings", "name": "Settings", "icon_pack": "Material Symbols Outlined", "icon_identifier": "settings", "icon_category": "ACTION", "module_scope": "GLOBAL", "tags": ["settings", "configuration"]},
            {"id": "icn_search", "key": "icon.global.search", "name": "Search", "icon_pack": "Material Symbols Outlined", "icon_identifier": "search", "icon_category": "ACTION", "module_scope": "GLOBAL", "tags": ["search", "lookup"]},
            {"id": "icn_notifications", "key": "icon.global.notifications", "name": "Notifications", "icon_pack": "Material Symbols Outlined", "icon_identifier": "notifications", "icon_category": "NAVIGATION", "module_scope": "GLOBAL", "tags": ["notifications", "alerts"]},
            # --- POS
            {"id": "icn_pos_checkout", "key": "icon.pos.checkout", "name": "POS Checkout", "icon_pack": "Material Symbols Outlined", "icon_identifier": "point_of_sale", "icon_category": "MODULE", "module_scope": "POS", "tags": ["pos", "checkout", "billing"]},
            {"id": "icn_pos_shift", "key": "icon.pos.shift", "name": "POS Shift", "icon_pack": "Material Symbols Outlined", "icon_identifier": "work_history", "icon_category": "MODULE", "module_scope": "POS", "tags": ["pos", "shift"]},
            {"id": "icn_pos_drawer", "key": "icon.pos.cash_drawer", "name": "Cash Drawer", "icon_pack": "Material Symbols Outlined", "icon_identifier": "local_atm", "icon_category": "MODULE", "module_scope": "POS", "tags": ["cash", "drawer"]},
            # --- Sales
            {"id": "icn_sales", "key": "icon.sales.module", "name": "Sales", "icon_pack": "Material Symbols Outlined", "icon_identifier": "receipt_long", "icon_category": "MODULE", "module_scope": "SALES", "tags": ["sales", "invoice"]},
            {"id": "icn_sales_invoice", "key": "icon.sales.invoice", "name": "Sales Invoice", "icon_pack": "Material Symbols Outlined", "icon_identifier": "description", "icon_category": "ENTITY", "module_scope": "SALES", "tags": ["invoice"]},
            {"id": "icn_sales_order", "key": "icon.sales.order", "name": "Sales Order", "icon_pack": "Material Symbols Outlined", "icon_identifier": "shopping_cart", "icon_category": "ENTITY", "module_scope": "SALES", "tags": ["order"]},
            {"id": "icn_sales_return", "key": "icon.sales.return", "name": "Sales Return", "icon_pack": "Material Symbols Outlined", "icon_identifier": "assignment_return", "icon_category": "ENTITY", "module_scope": "SALES", "tags": ["return", "credit note"]},
            # --- Purchase
            {"id": "icn_purchase", "key": "icon.purchase.module", "name": "Purchase", "icon_pack": "Material Symbols Outlined", "icon_identifier": "shopping_bag", "icon_category": "MODULE", "module_scope": "PURCHASE", "tags": ["purchase", "procurement"]},
            {"id": "icn_purchase_order", "key": "icon.purchase.order", "name": "Purchase Order", "icon_pack": "Material Symbols Outlined", "icon_identifier": "order_approve", "icon_category": "ENTITY", "module_scope": "PURCHASE", "tags": ["po", "order"]},
            {"id": "icn_grn", "key": "icon.purchase.grn", "name": "Goods Receipt Note", "icon_pack": "Material Symbols Outlined", "icon_identifier": "inventory_2", "icon_category": "ENTITY", "module_scope": "PURCHASE", "tags": ["grn", "receipt"]},
            # --- Inventory
            {"id": "icn_inventory", "key": "icon.inventory.module", "name": "Inventory", "icon_pack": "Material Symbols Outlined", "icon_identifier": "inventory", "icon_category": "MODULE", "module_scope": "INVENTORY", "tags": ["inventory", "stock"]},
            {"id": "icn_stock_adj", "key": "icon.inventory.adjustment", "name": "Stock Adjustment", "icon_pack": "Material Symbols Outlined", "icon_identifier": "tune", "icon_category": "ACTION", "module_scope": "INVENTORY", "tags": ["adjustment"]},
            {"id": "icn_stock_transfer", "key": "icon.inventory.transfer", "name": "Stock Transfer", "icon_pack": "Material Symbols Outlined", "icon_identifier": "swap_horiz", "icon_category": "ACTION", "module_scope": "INVENTORY", "tags": ["transfer"]},
            # --- Accounting
            {"id": "icn_accounting", "key": "icon.accounting.module", "name": "Accounting", "icon_pack": "Material Symbols Outlined", "icon_identifier": "account_balance", "icon_category": "MODULE", "module_scope": "ACCOUNTING", "tags": ["accounting", "ledger"]},
            {"id": "icn_journal", "key": "icon.accounting.journal", "name": "Journal Voucher", "icon_pack": "Material Symbols Outlined", "icon_identifier": "edit_note", "icon_category": "ENTITY", "module_scope": "ACCOUNTING", "tags": ["journal", "voucher"]},
            # --- CRM & Party
            {"id": "icn_party", "key": "icon.party.module", "name": "Party / Customer", "icon_pack": "Material Symbols Outlined", "icon_identifier": "people", "icon_category": "MODULE", "module_scope": "CRM", "tags": ["customer", "party", "supplier"]},
            {"id": "icn_customer", "key": "icon.party.customer", "name": "Customer", "icon_pack": "Material Symbols Outlined", "icon_identifier": "person", "icon_category": "ENTITY", "module_scope": "CRM", "tags": ["customer"]},
            {"id": "icn_supplier", "key": "icon.party.supplier", "name": "Supplier", "icon_pack": "Material Symbols Outlined", "icon_identifier": "factory", "icon_category": "ENTITY", "module_scope": "CRM", "tags": ["supplier", "vendor"]},
            # --- Items
            {"id": "icn_item", "key": "icon.item.module", "name": "Items / Products", "icon_pack": "Material Symbols Outlined", "icon_identifier": "category", "icon_category": "MODULE", "module_scope": "INVENTORY", "tags": ["product", "item"]},
            {"id": "icn_barcode", "key": "icon.item.barcode", "name": "Barcode", "icon_pack": "Material Symbols Outlined", "icon_identifier": "barcode", "icon_category": "ACTION", "module_scope": "BARCODE", "tags": ["barcode", "scan"]},
            # --- GST
            {"id": "icn_gst", "key": "icon.gst.module", "name": "GST Compliance", "icon_pack": "Material Symbols Outlined", "icon_identifier": "gavel", "icon_category": "MODULE", "module_scope": "GST", "tags": ["gst", "tax", "compliance"]},
            {"id": "icn_einvoice", "key": "icon.gst.einvoice", "name": "E-Invoice", "icon_pack": "Material Symbols Outlined", "icon_identifier": "receipt", "icon_category": "ENTITY", "module_scope": "GST", "tags": ["irn", "einvoice"]},
            # --- Reports
            {"id": "icn_reports", "key": "icon.reporting.module", "name": "Reports", "icon_pack": "Material Symbols Outlined", "icon_identifier": "bar_chart", "icon_category": "MODULE", "module_scope": "REPORTING", "tags": ["reports", "analytics"]},
            # --- Common Actions
            {"id": "icn_add", "key": "icon.action.add", "name": "Add / New", "icon_pack": "Material Symbols Outlined", "icon_identifier": "add", "icon_category": "ACTION", "module_scope": "GLOBAL", "tags": ["add", "create", "new"]},
            {"id": "icn_edit", "key": "icon.action.edit", "name": "Edit", "icon_pack": "Material Symbols Outlined", "icon_identifier": "edit", "icon_category": "ACTION", "module_scope": "GLOBAL", "tags": ["edit", "modify"]},
            {"id": "icn_delete", "key": "icon.action.delete", "name": "Delete", "icon_pack": "Material Symbols Outlined", "icon_identifier": "delete", "icon_category": "ACTION", "module_scope": "GLOBAL", "tags": ["delete", "remove"]},
            {"id": "icn_print", "key": "icon.action.print", "name": "Print", "icon_pack": "Material Symbols Outlined", "icon_identifier": "print", "icon_category": "ACTION", "module_scope": "GLOBAL", "tags": ["print"]},
            {"id": "icn_download", "key": "icon.action.download", "name": "Download / Export", "icon_pack": "Material Symbols Outlined", "icon_identifier": "download", "icon_category": "ACTION", "module_scope": "GLOBAL", "tags": ["download", "export"]},
            {"id": "icn_filter", "key": "icon.action.filter", "name": "Filter", "icon_pack": "Material Symbols Outlined", "icon_identifier": "filter_list", "icon_category": "ACTION", "module_scope": "GLOBAL", "tags": ["filter"]},
            {"id": "icn_approve", "key": "icon.action.approve", "name": "Approve", "icon_pack": "Material Symbols Outlined", "icon_identifier": "check_circle", "icon_category": "ACTION", "module_scope": "GLOBAL", "tags": ["approve", "confirm"]},
            {"id": "icn_reject", "key": "icon.action.reject", "name": "Reject", "icon_pack": "Material Symbols Outlined", "icon_identifier": "cancel", "icon_category": "ACTION", "module_scope": "GLOBAL", "tags": ["reject", "decline"]},
        ]

        count = 0
        for icon in icons:
            icon.setdefault("aliases", [])
            icon.setdefault("tags", [])
            existing = (await session.execute(
                select(IconRegistry).where(IconRegistry.key == icon["key"])
            )).scalar_one_or_none()
            if not existing:
                session.add(IconRegistry(**icon))
                count += 1
        await session.flush()
        return count

    @classmethod
    async def seed_integration_providers(cls, session: AsyncSession) -> int:
        """Seeds canonical integration provider and registry definitions into smritisys."""
        tbl_check = await session.execute(text("SELECT to_regclass('public.provider_registry');"))
        if not tbl_check.scalar():
            return 0

        providers = [
            {
                "id": "prov_gstn", "code": "GSTN", "name": "GSTN / NIC E-Invoice Portal",
                "provider_category": "GOVERNMENT", "provider_type": "GST",
                "homepage_url": "https://einvoice1.gst.gov.in",
                "supported_auth_types": ["API_KEY", "CERTIFICATE"],
                "supported_environments": ["SANDBOX", "PRODUCTION"],
                "capabilities_required": ["GST"], "status": "ACTIVE",
            },
            {
                "id": "prov_nic_eway", "code": "NIC_EWAY_BILL", "name": "NIC E-Way Bill Portal",
                "provider_category": "GOVERNMENT", "provider_type": "GST",
                "homepage_url": "https://ewaybillgst.gov.in",
                "supported_auth_types": ["API_KEY"],
                "supported_environments": ["SANDBOX", "PRODUCTION"],
                "capabilities_required": ["GST"], "status": "ACTIVE",
            },
            {
                "id": "prov_tally", "code": "TALLY_PRIME", "name": "TallyPrime",
                "provider_category": "ACCOUNTING", "provider_type": "ERP",
                "homepage_url": "https://tallysolutions.com",
                "supported_auth_types": ["BASIC_AUTH"],
                "supported_environments": ["PRODUCTION"],
                "capabilities_required": ["ACCOUNTING", "INTEGRATION"], "status": "ACTIVE",
            },
            {
                "id": "prov_shopify", "code": "SHOPIFY", "name": "Shopify",
                "provider_category": "ECOMMERCE", "provider_type": "MARKETPLACE",
                "homepage_url": "https://shopify.com",
                "supported_auth_types": ["OAUTH2", "API_KEY"],
                "supported_environments": ["SANDBOX", "PRODUCTION"],
                "capabilities_required": ["ECOM"], "status": "ACTIVE",
            },
            {
                "id": "prov_woocommerce", "code": "WOOCOMMERCE", "name": "WooCommerce",
                "provider_category": "ECOMMERCE", "provider_type": "MARKETPLACE",
                "homepage_url": "https://woocommerce.com",
                "supported_auth_types": ["API_KEY"],
                "supported_environments": ["PRODUCTION"],
                "capabilities_required": ["ECOM"], "status": "ACTIVE",
            },
            {
                "id": "prov_twilio", "code": "TWILIO", "name": "Twilio (SMS/WhatsApp)",
                "provider_category": "COMMUNICATION", "provider_type": "SMS",
                "homepage_url": "https://twilio.com",
                "supported_auth_types": ["API_KEY"],
                "supported_environments": ["SANDBOX", "PRODUCTION"],
                "capabilities_required": ["COMMUNICATOR"], "status": "SCAFFOLDING",
            },
        ]

        count = 0
        for p in providers:
            p.setdefault("metadata_schema", {})
            existing = (await session.execute(
                select(ProviderRegistry).where(ProviderRegistry.code == p["code"])
            )).scalar_one_or_none()
            if not existing:
                session.add(ProviderRegistry(**p))
                count += 1

        await session.flush()
        return count

    @classmethod
    async def seed_layout_definitions(cls, session: AsyncSession) -> int:
        """Seeds canonical SMRITI layout templates into smritisys.layout_definitions."""
        tbl_check = await session.execute(text("SELECT to_regclass('public.layout_definitions');"))
        if not tbl_check.scalar():
            return 0

        import uuid as _uuid
        layouts = [
            {
                "id": "lay_full_width", "uuid": str(_uuid.uuid4()),
                "code": "LAY_FULL_WIDTH", "version": 1, "name": "Full Width",
                "description": "Single-column full-width layout. Used for list screens.",
                "layout_type": "FULL_WIDTH", "is_responsive": True,
                "breakpoints": {"xs": "100%", "sm": "100%", "md": "100%", "lg": "100%"},
                "regions": [{"id": "main", "flex": 1, "label": "Main Content"}],
                "css_overrides": {}, "persona_modes": ["SIMPLE", "HYBRID", "ADVANCED"],
                "status": "ACTIVE",
            },
            {
                "id": "lay_sidebar_left", "uuid": str(_uuid.uuid4()),
                "code": "LAY_SIDEBAR_LEFT", "version": 1, "name": "Sidebar Left",
                "description": "Two-column layout: fixed sidebar on the left, main content on the right.",
                "layout_type": "SIDEBAR_LEFT", "is_responsive": True,
                "breakpoints": {"xs": "100%", "sm": "100%", "md": "30%/70%", "lg": "25%/75%"},
                "regions": [
                    {"id": "sidebar", "width": "25%", "label": "Sidebar"},
                    {"id": "main", "flex": 1, "label": "Main Content"},
                ],
                "css_overrides": {}, "persona_modes": ["HYBRID", "ADVANCED"],
                "status": "ACTIVE",
            },
            {
                "id": "lay_split", "uuid": str(_uuid.uuid4()),
                "code": "LAY_SPLIT", "version": 1, "name": "Split Pane",
                "description": "50/50 split layout. Used for POS billing.",
                "layout_type": "SPLIT", "is_responsive": True,
                "breakpoints": {"xs": "100%", "md": "50%/50%"},
                "regions": [
                    {"id": "left", "width": "50%", "label": "Left Pane"},
                    {"id": "right", "width": "50%", "label": "Right Pane"},
                ],
                "css_overrides": {}, "persona_modes": ["SIMPLE", "HYBRID", "ADVANCED"],
                "status": "ACTIVE",
            },
            {
                "id": "lay_detail", "uuid": str(_uuid.uuid4()),
                "code": "LAY_DETAIL", "version": 1, "name": "Detail Form",
                "description": "Single document detail view with header, line items, and footer sections.",
                "layout_type": "FULL_WIDTH", "is_responsive": True,
                "breakpoints": {"xs": "100%", "md": "100%"},
                "regions": [
                    {"id": "header", "label": "Document Header"},
                    {"id": "lines", "label": "Line Items"},
                    {"id": "footer", "label": "Totals & Actions"},
                ],
                "css_overrides": {}, "persona_modes": ["HYBRID", "ADVANCED"],
                "status": "ACTIVE",
            },
            {
                "id": "lay_dashboard", "uuid": str(_uuid.uuid4()),
                "code": "LAY_DASHBOARD", "version": 1, "name": "Dashboard Grid",
                "description": "Responsive card grid layout for dashboard and analytics screens.",
                "layout_type": "CARD_GRID", "is_responsive": True,
                "breakpoints": {"xs": "1col", "sm": "2col", "md": "3col", "lg": "4col"},
                "regions": [{"id": "grid", "label": "Card Grid"}],
                "css_overrides": {}, "persona_modes": ["SIMPLE", "HYBRID", "ADVANCED"],
                "status": "ACTIVE",
            },
            {
                "id": "lay_wizard", "uuid": str(_uuid.uuid4()),
                "code": "LAY_WIZARD", "version": 1, "name": "Wizard Steps",
                "description": "Multi-step wizard layout for onboarding and setup flows.",
                "layout_type": "WIZARD_STEPS", "is_responsive": True,
                "breakpoints": {"xs": "100%", "md": "100%"},
                "regions": [{"id": "steps", "label": "Step Content"}, {"id": "nav", "label": "Navigation"}],
                "css_overrides": {}, "persona_modes": ["SIMPLE", "HYBRID", "ADVANCED"],
                "status": "ACTIVE",
            },
        ]
        count = 0
        for lay in layouts:
            existing = (await session.execute(
                select(LayoutDefinition).where(LayoutDefinition.code == lay["code"])
            )).scalar_one_or_none()
            if not existing:
                session.add(LayoutDefinition(**lay))
                count += 1
        await session.flush()
        return count

    @classmethod
    async def seed_screen_definitions(cls, session: AsyncSession) -> int:
        """Seeds the top 5 canonical business flow screen definitions into smritisys."""
        tbl_check = await session.execute(text("SELECT to_regclass('public.screen_definitions');"))
        if not tbl_check.scalar():
            return 0

        import uuid as _uuid
        screens = [
            {
                "id": "scr_pos_billing", "uuid": str(_uuid.uuid4()),
                "code": "SCR_POS_BILLING", "version": 1,
                "name": "POS Billing Terminal",
                "description": "Real-time point-of-sale billing screen with item search, cart, and payment.",
                "module_code": "POS", "workspace_code": "BILLING",
                "screen_type": "FORM", "persona_mode": "SIMPLE",
                "capability_code": "POS",
                "layout_config": {"layout": "LAY_SPLIT", "left": "item_search", "right": "cart_and_payment"},
                "default_filters": [], "default_sort": {},
                "pagination_default": 20, "searchable": True, "exportable": False, "printable": True,
                "route_path": "/pos/billing", "icon_key": "icon.pos.checkout", "status": "ACTIVE",
            },
            {
                "id": "scr_sales_invoice_list", "uuid": str(_uuid.uuid4()),
                "code": "SCR_SALES_INVOICE_LIST", "version": 1,
                "name": "Sales Invoice List",
                "description": "Searchable, filterable list of all sales invoices with bulk actions.",
                "module_code": "SALES", "workspace_code": "SALES",
                "screen_type": "LIST", "persona_mode": "HYBRID",
                "capability_code": "SALES",
                "layout_config": {"layout": "LAY_FULL_WIDTH", "toolbar": True, "filters": True},
                "default_filters": [{"field": "status", "op": "in", "value": ["APPROVED", "DRAFT"]}],
                "default_sort": {"field": "invoice_date", "direction": "DESC"},
                "pagination_default": 25, "searchable": True, "exportable": True, "printable": True,
                "route_path": "/sales/invoices", "icon_key": "icon.sales.invoice", "status": "ACTIVE",
            },
            {
                "id": "scr_purchase_order_list", "uuid": str(_uuid.uuid4()),
                "code": "SCR_PURCHASE_ORDER_LIST", "version": 1,
                "name": "Purchase Order List",
                "description": "Searchable list of all purchase orders with supplier filter and approval status.",
                "module_code": "PURCHASE", "workspace_code": "PURCHASE",
                "screen_type": "LIST", "persona_mode": "HYBRID",
                "capability_code": "PURCHASE",
                "layout_config": {"layout": "LAY_FULL_WIDTH", "toolbar": True, "filters": True},
                "default_filters": [{"field": "status", "op": "in", "value": ["DRAFT", "SENT", "PARTIAL"]}],
                "default_sort": {"field": "order_date", "direction": "DESC"},
                "pagination_default": 25, "searchable": True, "exportable": True, "printable": True,
                "route_path": "/purchase/orders", "icon_key": "icon.purchase.order", "status": "ACTIVE",
            },
            {
                "id": "scr_inventory_dashboard", "uuid": str(_uuid.uuid4()),
                "code": "SCR_INVENTORY_DASHBOARD", "version": 1,
                "name": "Inventory Dashboard",
                "description": "Live stock levels, low-stock alerts, and movement summary dashboard.",
                "module_code": "INVENTORY", "workspace_code": "INVENTORY",
                "screen_type": "DASHBOARD", "persona_mode": "HYBRID",
                "capability_code": "INVENTORY",
                "layout_config": {"layout": "LAY_DASHBOARD", "cards": ["total_sku", "low_stock", "stock_value", "movements_today"]},
                "default_filters": [], "default_sort": {},
                "pagination_default": 0, "searchable": False, "exportable": False, "printable": False,
                "route_path": "/inventory/dashboard", "icon_key": "icon.inventory.module", "status": "ACTIVE",
            },
            {
                "id": "scr_party_list", "uuid": str(_uuid.uuid4()),
                "code": "SCR_PARTY_LIST", "version": 1,
                "name": "Party Master List",
                "description": "Universal party master list covering customers, suppliers, and agents.",
                "module_code": "PARTY", "workspace_code": "CRM",
                "screen_type": "LIST", "persona_mode": "ADVANCED",
                "capability_code": "CRM",
                "layout_config": {"layout": "LAY_FULL_WIDTH", "toolbar": True, "filters": True},
                "default_filters": [{"field": "is_active", "op": "eq", "value": True}],
                "default_sort": {"field": "name", "direction": "ASC"},
                "pagination_default": 50, "searchable": True, "exportable": True, "printable": False,
                "route_path": "/party/list", "icon_key": "icon.party.module", "status": "ACTIVE",
            },
        ]
        count = 0
        for s in screens:
            existing = (await session.execute(
                select(ScreenDefinition).where(
                    ScreenDefinition.code == s["code"],
                    ScreenDefinition.version == s["version"]
                )
            )).scalar_one_or_none()
            if not existing:
                session.add(ScreenDefinition(**s))
                count += 1
        await session.flush()
        return count

    @classmethod
    async def seed_action_definitions(cls, session: AsyncSession) -> int:
        """Seeds canonical toolbar and row actions for the top 5 business flow screens."""
        tbl_check = await session.execute(text("SELECT to_regclass('public.action_definitions');"))
        if not tbl_check.scalar():
            return 0

        import uuid as _uuid
        actions = [
            # --- POS Billing actions
            {"id": "act_pos_new_sale", "uuid": str(_uuid.uuid4()), "code": "ACT_POS_NEW_SALE", "version": 1,
             "name": "New Sale", "label_key": "pos.action.new_sale",
             "action_type": "API_CALL", "screen_code": "SCR_POS_BILLING", "placement": "TOOLBAR",
             "icon_key": "icon.action.add", "variant": "PRIMARY", "order_index": 1,
             "required_capability": "POS", "required_roles": ["CASHIER", "STORE_MANAGER", "SYSADMIN"],
             "api_endpoint": "/api/v1/pos/sessions", "api_method": "POST", "status": "ACTIVE"},
            {"id": "act_pos_hold_bill", "uuid": str(_uuid.uuid4()), "code": "ACT_POS_HOLD_BILL", "version": 1,
             "name": "Hold Bill", "label_key": "pos.action.hold_bill",
             "action_type": "API_CALL", "screen_code": "SCR_POS_BILLING", "placement": "TOOLBAR",
             "icon_key": "icon.action.filter", "variant": "SECONDARY", "order_index": 2,
             "required_capability": "POS", "required_roles": ["CASHIER", "STORE_MANAGER", "SYSADMIN"],
             "api_endpoint": "/api/v1/pos/bills/hold", "api_method": "POST", "status": "ACTIVE"},
            {"id": "act_pos_print_receipt", "uuid": str(_uuid.uuid4()), "code": "ACT_POS_PRINT_RECEIPT", "version": 1,
             "name": "Print Receipt", "label_key": "pos.action.print_receipt",
             "action_type": "PRINT", "screen_code": "SCR_POS_BILLING", "placement": "TOOLBAR",
             "icon_key": "icon.action.print", "variant": "SECONDARY", "order_index": 3,
             "required_capability": "POS", "required_roles": ["CASHIER", "STORE_MANAGER", "SYSADMIN"],
             "status": "ACTIVE"},
            # --- Sales Invoice List actions
            {"id": "act_sales_new_invoice", "uuid": str(_uuid.uuid4()), "code": "ACT_SALES_NEW_INVOICE", "version": 1,
             "name": "New Invoice", "label_key": "sales.action.new_invoice",
             "action_type": "NAVIGATE", "screen_code": "SCR_SALES_INVOICE_LIST", "placement": "TOOLBAR",
             "icon_key": "icon.action.add", "variant": "PRIMARY", "order_index": 1,
             "required_capability": "SALES", "required_roles": ["CASHIER", "STORE_MANAGER", "SYSADMIN"],
             "target_route": "/sales/invoices/new", "status": "ACTIVE"},
            {"id": "act_sales_export", "uuid": str(_uuid.uuid4()), "code": "ACT_SALES_EXPORT", "version": 1,
             "name": "Export", "label_key": "sales.action.export",
             "action_type": "DOWNLOAD", "screen_code": "SCR_SALES_INVOICE_LIST", "placement": "TOOLBAR",
             "icon_key": "icon.action.download", "variant": "SECONDARY", "order_index": 2,
             "required_capability": "SALES", "required_roles": ["STORE_MANAGER", "ACCOUNTANT", "SYSADMIN"],
             "api_endpoint": "/api/v1/sales/invoices/export", "api_method": "GET", "status": "ACTIVE"},
            {"id": "act_sales_view_inv", "uuid": str(_uuid.uuid4()), "code": "ACT_SALES_VIEW_INVOICE", "version": 1,
             "name": "View", "label_key": "sales.action.view",
             "action_type": "NAVIGATE", "screen_code": "SCR_SALES_INVOICE_LIST", "placement": "ROW",
             "icon_key": "icon.action.edit", "variant": "GHOST", "order_index": 1,
             "required_capability": "SALES", "required_roles": ["CASHIER", "STORE_MANAGER", "ACCOUNTANT", "SYSADMIN"],
             "target_route": "/sales/invoices/{id}", "status": "ACTIVE"},
            {"id": "act_sales_print_inv", "uuid": str(_uuid.uuid4()), "code": "ACT_SALES_PRINT_INVOICE", "version": 1,
             "name": "Print", "label_key": "sales.action.print",
             "action_type": "PRINT", "screen_code": "SCR_SALES_INVOICE_LIST", "placement": "ROW",
             "icon_key": "icon.action.print", "variant": "GHOST", "order_index": 2,
             "required_capability": "SALES", "required_roles": ["CASHIER", "STORE_MANAGER", "SYSADMIN"],
             "status": "ACTIVE"},
            {"id": "act_sales_approve_inv", "uuid": str(_uuid.uuid4()), "code": "ACT_SALES_APPROVE_INVOICE", "version": 1,
             "name": "Approve", "label_key": "sales.action.approve",
             "action_type": "WORKFLOW_TRANSITION", "screen_code": "SCR_SALES_INVOICE_LIST", "placement": "ROW",
             "icon_key": "icon.action.approve", "variant": "PRIMARY", "order_index": 3,
             "required_capability": "SALES", "required_roles": ["STORE_MANAGER", "SYSADMIN"],
             "visibility_condition": {"field": "status", "op": "eq", "value": "DRAFT"},
             "confirmation_required": True, "confirmation_message_key": "sales.confirm.approve_invoice",
             "workflow_action": "APPROVE", "status": "ACTIVE"},
            # --- Purchase Order List actions
            {"id": "act_po_new", "uuid": str(_uuid.uuid4()), "code": "ACT_PO_NEW", "version": 1,
             "name": "New Purchase Order", "label_key": "purchase.action.new_po",
             "action_type": "NAVIGATE", "screen_code": "SCR_PURCHASE_ORDER_LIST", "placement": "TOOLBAR",
             "icon_key": "icon.action.add", "variant": "PRIMARY", "order_index": 1,
             "required_capability": "PURCHASE", "required_roles": ["STORE_MANAGER", "SYSADMIN"],
             "target_route": "/purchase/orders/new", "status": "ACTIVE"},
            {"id": "act_po_export", "uuid": str(_uuid.uuid4()), "code": "ACT_PO_EXPORT", "version": 1,
             "name": "Export", "label_key": "purchase.action.export",
             "action_type": "DOWNLOAD", "screen_code": "SCR_PURCHASE_ORDER_LIST", "placement": "TOOLBAR",
             "icon_key": "icon.action.download", "variant": "SECONDARY", "order_index": 2,
             "required_capability": "PURCHASE", "required_roles": ["STORE_MANAGER", "ACCOUNTANT", "SYSADMIN"],
             "api_endpoint": "/api/v1/purchase/orders/export", "api_method": "GET", "status": "ACTIVE"},
            {"id": "act_po_view", "uuid": str(_uuid.uuid4()), "code": "ACT_PO_VIEW", "version": 1,
             "name": "View", "label_key": "purchase.action.view_po",
             "action_type": "NAVIGATE", "screen_code": "SCR_PURCHASE_ORDER_LIST", "placement": "ROW",
             "icon_key": "icon.action.edit", "variant": "GHOST", "order_index": 1,
             "required_capability": "PURCHASE", "required_roles": ["STORE_MANAGER", "ACCOUNTANT", "SYSADMIN"],
             "target_route": "/purchase/orders/{id}", "status": "ACTIVE"},
            {"id": "act_po_approve", "uuid": str(_uuid.uuid4()), "code": "ACT_PO_APPROVE", "version": 1,
             "name": "Approve PO", "label_key": "purchase.action.approve_po",
             "action_type": "WORKFLOW_TRANSITION", "screen_code": "SCR_PURCHASE_ORDER_LIST", "placement": "ROW",
             "icon_key": "icon.action.approve", "variant": "PRIMARY", "order_index": 2,
             "required_capability": "PURCHASE", "required_roles": ["STORE_MANAGER", "SYSADMIN"],
             "visibility_condition": {"field": "status", "op": "eq", "value": "DRAFT"},
             "confirmation_required": True, "confirmation_message_key": "purchase.confirm.approve_po",
             "workflow_action": "APPROVE", "status": "ACTIVE"},
            # --- Inventory Dashboard actions
            {"id": "act_inv_adj", "uuid": str(_uuid.uuid4()), "code": "ACT_INV_ADJUSTMENT", "version": 1,
             "name": "Stock Adjustment", "label_key": "inventory.action.adjustment",
             "action_type": "NAVIGATE", "screen_code": "SCR_INVENTORY_DASHBOARD", "placement": "TOOLBAR",
             "icon_key": "icon.inventory.adjustment", "variant": "SECONDARY", "order_index": 1,
             "required_capability": "INVENTORY", "required_roles": ["STORE_MANAGER", "SYSADMIN"],
             "target_route": "/inventory/adjustments/new", "status": "ACTIVE"},
            {"id": "act_inv_transfer", "uuid": str(_uuid.uuid4()), "code": "ACT_INV_TRANSFER", "version": 1,
             "name": "Stock Transfer", "label_key": "inventory.action.transfer",
             "action_type": "NAVIGATE", "screen_code": "SCR_INVENTORY_DASHBOARD", "placement": "TOOLBAR",
             "icon_key": "icon.inventory.transfer", "variant": "SECONDARY", "order_index": 2,
             "required_capability": "INVENTORY", "required_roles": ["STORE_MANAGER", "SYSADMIN"],
             "target_route": "/inventory/transfers/new", "status": "ACTIVE"},
            # --- Party List actions
            {"id": "act_party_new", "uuid": str(_uuid.uuid4()), "code": "ACT_PARTY_NEW", "version": 1,
             "name": "New Party", "label_key": "party.action.new",
             "action_type": "NAVIGATE", "screen_code": "SCR_PARTY_LIST", "placement": "TOOLBAR",
             "icon_key": "icon.action.add", "variant": "PRIMARY", "order_index": 1,
             "required_capability": "CRM", "required_roles": ["STORE_MANAGER", "SYSADMIN"],
             "target_route": "/party/new", "status": "ACTIVE"},
            {"id": "act_party_export", "uuid": str(_uuid.uuid4()), "code": "ACT_PARTY_EXPORT", "version": 1,
             "name": "Export", "label_key": "party.action.export",
             "action_type": "DOWNLOAD", "screen_code": "SCR_PARTY_LIST", "placement": "TOOLBAR",
             "icon_key": "icon.action.download", "variant": "SECONDARY", "order_index": 2,
             "required_capability": "CRM", "required_roles": ["STORE_MANAGER", "SYSADMIN"],
             "api_endpoint": "/api/v1/party/export", "api_method": "GET", "status": "ACTIVE"},
            {"id": "act_party_view", "uuid": str(_uuid.uuid4()), "code": "ACT_PARTY_VIEW", "version": 1,
             "name": "View", "label_key": "party.action.view",
             "action_type": "NAVIGATE", "screen_code": "SCR_PARTY_LIST", "placement": "ROW",
             "icon_key": "icon.action.edit", "variant": "GHOST", "order_index": 1,
             "required_capability": "CRM", "required_roles": ["STORE_MANAGER", "ACCOUNTANT", "SYSADMIN"],
             "target_route": "/party/{id}", "status": "ACTIVE"},
            {"id": "act_party_delete", "uuid": str(_uuid.uuid4()), "code": "ACT_PARTY_DELETE", "version": 1,
             "name": "Deactivate", "label_key": "party.action.deactivate",
             "action_type": "API_CALL", "screen_code": "SCR_PARTY_LIST", "placement": "ROW",
             "icon_key": "icon.action.delete", "variant": "DANGER", "order_index": 2,
             "required_capability": "CRM", "required_roles": ["STORE_MANAGER", "SYSADMIN"],
             "confirmation_required": True, "confirmation_message_key": "party.confirm.deactivate",
             "api_endpoint": "/api/v1/party/{id}/deactivate", "api_method": "POST", "status": "ACTIVE"},
        ]
        count = 0
        for a in actions:
            a.setdefault("description", None)
            a.setdefault("required_roles", [])
            a.setdefault("visibility_condition", {})
            a.setdefault("confirmation_required", False)
            a.setdefault("confirmation_message_key", None)
            a.setdefault("target_route", None)
            a.setdefault("api_endpoint", None)
            a.setdefault("api_method", "POST")
            a.setdefault("workflow_action", None)
            a.setdefault("label_key", None)
            existing = (await session.execute(
                select(ActionDefinition).where(ActionDefinition.code == a["code"])
            )).scalar_one_or_none()
            if not existing:
                session.add(ActionDefinition(**a))
                count += 1
        await session.flush()
        return count

    @classmethod
    async def seed_all(cls, session: AsyncSession) -> Dict[str, Any]:
        """Runs capability, reference data, UI metadata, feature flags, governed logic,
        icon registry, integration provider, layout, screen and action definition seeders."""
        cap_count = await cls.seed_capabilities(session)
        ref_counts = await cls.seed_reference_data(session)
        ui_counts = await cls.seed_ui_metadata(session)
        ff_count = await cls.seed_feature_flags(session)
        gov_counts = await cls.seed_governed_logic(session)
        icon_count = await cls.seed_icon_registry(session)
        integration_count = await cls.seed_integration_providers(session)
        layout_count = await cls.seed_layout_definitions(session)
        screen_count = await cls.seed_screen_definitions(session)
        action_count = await cls.seed_action_definitions(session)
        await session.commit()
        return {
            "capabilities_seeded": cap_count,
            "reference_counts": ref_counts,
            "ui_counts": ui_counts,
            "feature_flags_seeded": ff_count,
            "governed_logic_counts": gov_counts,
            "icons_seeded": icon_count,
            "integration_providers_seeded": integration_count,
            "layouts_seeded": layout_count,
            "screens_seeded": screen_count,
            "actions_seeded": action_count,
        }
