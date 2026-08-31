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
from datetime import datetime, timezone
from sqlalchemy import (
    Column,
    String,
    Numeric,
    Boolean,
    Integer,
    ForeignKey,
    DateTime,
    Text,
    UniqueConstraint,
    Index,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship
from ..db.base import Base


class CountryRef(Base):
    """
    ISO 3166-1 standard country reference data (smritisys / control plane).
    """
    __tablename__ = "countries_ref"

    id = Column(String(50), primary_key=True, default=lambda: f"ctry_{uuid.uuid4().hex[:12]}")
    code = Column(String(3), nullable=False, unique=True, index=True)       # ISO 2/3 letter code: IN, US, AE, GB
    iso3 = Column(String(3), nullable=False, unique=True)                   # IND, USA, ARE, GBR
    numeric_code = Column(String(3), nullable=True)                         # 356, 840, 784, 826
    name = Column(String(150), nullable=False, index=True)                  # India, United States, UAE
    phone_code = Column(String(10), nullable=False)                         # +91, +1, +971, +44
    default_currency = Column(String(10), nullable=False, default="INR")   # INR, USD, AED, GBP
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    states = relationship("StateRef", back_populates="country", cascade="all, delete-orphan")


class StateRef(Base):
    """
    State / Province / Union Territory reference data with official statutory codes.
    For India: 2-digit GST state code (01-38, 97) is authoritative for CGST+SGST vs IGST.
    """
    __tablename__ = "states_ref"
    __table_args__ = (
        UniqueConstraint("country_code", "state_code", name="uq_country_state_code"),
        Index("idx_states_gst_code", "country_code", "gst_state_code"),
    )

    id = Column(String(50), primary_key=True, default=lambda: f"st_{uuid.uuid4().hex[:12]}")
    country_id = Column(String(50), ForeignKey("countries_ref.id", ondelete="CASCADE"), nullable=False)
    country_code = Column(String(3), nullable=False, default="IN", index=True)
    state_code = Column(String(10), nullable=False, index=True)             # MH, DL, KA, TN, GJ, NY, CA
    name = Column(String(150), nullable=False)                              # Maharashtra, Delhi, Karnataka
    gst_state_code = Column(String(2), nullable=True, index=True)           # 27, 07, 29, 33, 24
    state_type = Column(String(30), nullable=False, default="STATE")        # STATE, UNION_TERRITORY, PROVINCE
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    country = relationship("CountryRef", back_populates="states")
    districts = relationship("DistrictRef", back_populates="state", cascade="all, delete-orphan")


class DistrictRef(Base):
    """
    Administrative District reference data.
    """
    __tablename__ = "districts_ref"
    __table_args__ = (
        UniqueConstraint("state_id", "district_code", name="uq_state_district_code"),
    )

    id = Column(String(50), primary_key=True, default=lambda: f"dist_{uuid.uuid4().hex[:12]}")
    state_id = Column(String(50), ForeignKey("states_ref.id", ondelete="CASCADE"), nullable=False)
    district_code = Column(String(20), nullable=False)                      # MUMBAI, PUNE, BENGALURU_URBAN
    name = Column(String(150), nullable=False)                              # Mumbai City, Pune, Bengaluru Urban
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    state = relationship("StateRef", back_populates="districts")


class PostalCodeRef(Base):
    """
    Postal Code / PIN Code registry for automated address validation and tax jurisdiction resolution.
    """
    __tablename__ = "postal_codes_ref"
    __table_args__ = (
        Index("idx_postal_country_code", "country_code", "postal_code"),
    )

    id = Column(String(50), primary_key=True, default=lambda: f"pin_{uuid.uuid4().hex[:12]}")
    country_code = Column(String(3), nullable=False, default="IN", index=True)
    state_code = Column(String(10), nullable=False, index=True)
    postal_code = Column(String(20), nullable=False, index=True)            # 400001, 110001, 560001
    locality = Column(String(200), nullable=True)                           # Fort, Connaught Place, MG Road
    city = Column(String(150), nullable=False)                              # Mumbai, New Delhi, Bengaluru
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)


class LanguageRef(Base):
    """
    Global languages catalog supporting multi-lingual UI and printing.
    """
    __tablename__ = "languages_ref"

    id = Column(String(50), primary_key=True, default=lambda: f"lang_{uuid.uuid4().hex[:12]}")
    code = Column(String(10), nullable=False, unique=True, index=True)      # en, hi, mr, gu, ta, te, kn, bn, ar
    name = Column(String(100), nullable=False)                              # English, Hindi, Marathi, Gujarati
    native_name = Column(String(100), nullable=False)                       # English, हिन्दी, मराठी, ગુજરાતી
    script = Column(String(50), nullable=False, default="Latin")            # Latin, Devanagari, Gujarati, Tamil, Arabic
    is_rtl = Column(Boolean, nullable=False, default=False)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)


class LocaleRef(Base):
    """
    Locale reference configuration specifying number, date, and currency formatting rules.
    """
    __tablename__ = "locales_ref"

    id = Column(String(50), primary_key=True, default=lambda: f"loc_{uuid.uuid4().hex[:12]}")
    code = Column(String(20), nullable=False, unique=True, index=True)      # en-IN, hi-IN, mr-IN, en-US, en-GB, ar-AE
    language_code = Column(String(10), nullable=False)                      # en, hi, mr, gu, ar
    country_code = Column(String(3), nullable=False)                        # IN, US, GB, AE
    date_format = Column(String(30), nullable=False, default="DD/MM/YYYY")  # DD/MM/YYYY, MM/DD/YYYY, YYYY-MM-DD
    time_format = Column(String(30), nullable=False, default="12H")         # 12H, 24H
    number_system = Column(String(30), nullable=False, default="INDIAN_LAKH_CRORE") # INDIAN_LAKH_CRORE, INTERNATIONAL_MILLION
    timezone = Column(String(100), nullable=False, default="Asia/Kolkata")  # Asia/Kolkata, UTC, America/New_York
    is_default = Column(Boolean, nullable=False, default=False)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)


class TranslationKeyRef(Base):
    """
    Central translation dictionary keys with description and English baseline text.
    """
    __tablename__ = "translation_keys_ref"

    id = Column(String(50), primary_key=True, default=lambda: f"tkey_{uuid.uuid4().hex[:12]}")
    key = Column(String(150), nullable=False, unique=True, index=True)      # pos.shift.open, billing.tax_invoice, common.save
    category = Column(String(50), nullable=False, index=True)               # POS, BILLING, INVENTORY, COMMON, ACCOUNTING
    description = Column(Text, nullable=True)
    default_text = Column(Text, nullable=False)                             # English default
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    translations = relationship("TranslationRef", back_populates="key_ref", cascade="all, delete-orphan")


class TranslationRef(Base):
    """
    Localized translation strings with versioning and approval tracking.
    """
    __tablename__ = "translations_ref"
    __table_args__ = (
        UniqueConstraint("key_id", "language_code", name="uq_translation_key_lang"),
        Index("idx_translations_lang_key", "language_code", "key_id"),
    )

    id = Column(String(50), primary_key=True, default=lambda: f"tr_{uuid.uuid4().hex[:12]}")
    key_id = Column(String(50), ForeignKey("translation_keys_ref.id", ondelete="CASCADE"), nullable=False)
    language_code = Column(String(10), nullable=False, index=True)          # hi, mr, gu, ta, te, ar
    translation_text = Column(Text, nullable=False)                         # e.g. "शिफ्ट खोलें", "टैक्स चालान"
    version = Column(Integer, nullable=False, default=1)
    is_approved = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    modified_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    key_ref = relationship("TranslationKeyRef", back_populates="translations")


class CurrencyRef(Base):
    """
    ISO 4217 Currency reference with symbol formatting and subunit metadata.
    """
    __tablename__ = "currencies_ref"

    id = Column(String(50), primary_key=True, default=lambda: f"curr_{uuid.uuid4().hex[:12]}")
    code = Column(String(10), nullable=False, unique=True, index=True)      # INR, USD, EUR, GBP, AED, SGD, CAD
    name = Column(String(100), nullable=False)                              # Indian Rupee, US Dollar, Euro
    symbol = Column(String(10), nullable=False)                             # ₹, $, €, £, د.إ
    subunit = Column(String(30), nullable=False, default="Paisa")           # Paisa, Cent, Penny, Fils
    decimal_places = Column(Integer, nullable=False, default=2)
    symbol_position = Column(String(10), nullable=False, default="BEFORE")  # BEFORE, AFTER
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)


class UnitOfMeasurementRef(Base):
    """
    Standard Units of Measurement (UOM) with statutory GST Unique Quantity Code (UQC) mappings.
    """
    __tablename__ = "uoms_ref"

    id = Column(String(50), primary_key=True, default=lambda: f"uom_{uuid.uuid4().hex[:12]}")
    code = Column(String(20), nullable=False, unique=True, index=True)      # PCS, NOS, KG, GM, LTR, ML, MTR, BOX, PAC, DOZ
    name = Column(String(100), nullable=False)                              # Pieces, Numbers, Kilograms, Grams, Litres
    category = Column(String(30), nullable=False)                           # COUNT, WEIGHT, VOLUME, LENGTH, AREA, TIME
    uqc_code = Column(String(10), nullable=False)                           # GST standard UQC: PCS, KGS, GMS, LTR, MTR, BOX, PAC, DOZ
    decimal_allowed = Column(Boolean, nullable=False, default=False)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)


class UOMConversionRef(Base):
    """
    Standard Unit of Measurement conversion ratios.
    Formula: quantity_in_to_uom = quantity_in_from_uom * conversion_factor
    Example: 1 KG -> 1000 GM (factor = 1000), 1 DOZ -> 12 PCS (factor = 12)
    """
    __tablename__ = "uom_conversions_ref"
    __table_args__ = (
        UniqueConstraint("from_uom", "to_uom", name="uq_uom_conversion_pair"),
    )

    id = Column(String(50), primary_key=True, default=lambda: f"uconv_{uuid.uuid4().hex[:12]}")
    from_uom = Column(String(20), nullable=False, index=True)
    to_uom = Column(String(20), nullable=False, index=True)
    conversion_factor = Column(Numeric(18, 6), nullable=False)
    is_system = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)


class TaxReferenceRef(Base):
    """
    Statutory Tax Slab references (GST, VAT) for automated tax determination.
    """
    __tablename__ = "tax_references_ref"

    id = Column(String(50), primary_key=True, default=lambda: f"tax_{uuid.uuid4().hex[:12]}")
    tax_type = Column(String(20), nullable=False, default="GST")            # GST, VAT, CESS
    code = Column(String(30), nullable=False, unique=True, index=True)      # GST_0, GST_5, GST_12, GST_18, GST_28, GST_NIL, GST_EXEMPT
    name = Column(String(100), nullable=False)                              # GST 18%, GST 5%, GST Exempt
    rate = Column(Numeric(6, 2), nullable=False)                            # Total Rate: 18.00, 5.00
    cgst_rate = Column(Numeric(6, 2), nullable=False, default=0.00)         # 9.00
    sgst_rate = Column(Numeric(6, 2), nullable=False, default=0.00)         # 9.00
    igst_rate = Column(Numeric(6, 2), nullable=False, default=0.00)         # 18.00
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)


class HsnSacCodeRef(Base):
    """
    Harmonized System of Nomenclature (HSN) and Service Accounting Code (SAC) statutory master.
    """
    __tablename__ = "hsn_sac_codes_ref"

    id = Column(String(50), primary_key=True, default=lambda: f"hsn_{uuid.uuid4().hex[:12]}")
    code = Column(String(20), nullable=False, unique=True, index=True)      # 8471, 1001, 9983, 6109
    code_type = Column(String(10), nullable=False, default="HSN")           # HSN (Goods), SAC (Services)
    description = Column(Text, nullable=False, index=True)
    gst_rate = Column(Numeric(6, 2), nullable=False, default=18.00)
    compensation_cess_rate = Column(Numeric(6, 2), nullable=False, default=0.00)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)


class PlatformReferenceData(Base):
    """
    Generic platform constants and extensible system reference lookup tables.
    """
    __tablename__ = "platform_reference_data"
    __table_args__ = (
        UniqueConstraint("category", "code", name="uq_platform_ref_category_code"),
        Index("idx_platform_ref_category", "category"),
    )

    id = Column(String(50), primary_key=True, default=lambda: f"pref_{uuid.uuid4().hex[:12]}")
    category = Column(String(50), nullable=False)                           # PAYMENT_METHODS, INVOICE_STATUS, ORDER_TYPES, TILL_EXPENSE_CATEGORIES
    code = Column(String(50), nullable=False)
    label = Column(String(150), nullable=False)
    data = Column(JSONB, nullable=False, default=dict)
    sort_order = Column(Integer, nullable=False, default=0)
    is_system = Column(Boolean, nullable=False, default=True)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
