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

from typing import List, Optional, Dict, Any
from pydantic import BaseModel, ConfigDict
from decimal import Decimal
from datetime import datetime


class CountryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    code: str
    iso3: str
    numeric_code: Optional[str] = None
    name: str
    phone_code: str
    default_currency: str
    is_active: bool


class StateResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    country_code: str
    state_code: str
    name: str
    gst_state_code: Optional[str] = None
    state_type: str
    is_active: bool


class DistrictResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    state_id: str
    district_code: str
    name: str
    is_active: bool


class PostalCodeResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    country_code: str
    state_code: str
    postal_code: str
    locality: Optional[str] = None
    city: str
    is_active: bool


class LanguageResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    code: str
    name: str
    native_name: str
    script: str
    is_rtl: bool
    is_active: bool


class LocaleResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    code: str
    language_code: str
    country_code: str
    date_format: str
    time_format: str
    number_system: str
    timezone: str
    is_default: bool
    is_active: bool


class TranslationDictionaryResponse(BaseModel):
    language_code: str
    is_fallback: bool = False
    fallback_language: Optional[str] = None
    total_keys: int
    translations: Dict[str, str]


class CurrencyResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    code: str
    name: str
    symbol: str
    subunit: str
    decimal_places: int
    symbol_position: str
    is_active: bool


class FormatCurrencyRequest(BaseModel):
    amount: Decimal
    currency_code: str = "INR"
    locale_code: str = "en-IN"


class FormattedCurrencyResponse(BaseModel):
    amount: Decimal
    currency_code: str
    symbol: str
    formatted_text: str


class UOMResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    code: str
    name: str
    category: str
    uqc_code: str
    decimal_allowed: bool
    is_active: bool


class UOMConversionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    from_uom: str
    to_uom: str
    conversion_factor: Decimal
    is_system: bool


class UOMConvertRequest(BaseModel):
    from_uom: str
    to_uom: str
    quantity: Decimal


class UOMConvertResult(BaseModel):
    from_uom: str
    to_uom: str
    source_quantity: Decimal
    conversion_factor: Decimal
    converted_quantity: Decimal


class TaxReferenceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    tax_type: str
    code: str
    name: str
    rate: Decimal
    cgst_rate: Decimal
    sgst_rate: Decimal
    igst_rate: Decimal
    description: Optional[str] = None
    is_active: bool


class HsnSacCodeResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    code: str
    code_type: str
    description: str
    gst_rate: Decimal
    compensation_cess_rate: Decimal
    is_active: bool


class PlatformReferenceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    category: str
    code: str
    label: str
    data: Dict[str, Any]
    sort_order: int
    is_system: bool
    is_active: bool
