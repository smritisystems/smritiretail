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

from typing import List, Optional
from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from decimal import Decimal

from ...api.deps import get_db, get_current_user
from ...schemas.localization import (
    CountryResponse,
    StateResponse,
    DistrictResponse,
    PostalCodeResponse,
    LanguageResponse,
    LocaleResponse,
    TranslationDictionaryResponse,
    CurrencyResponse,
    FormatCurrencyRequest,
    FormattedCurrencyResponse,
    UOMResponse,
    UOMConversionResponse,
    UOMConvertRequest,
    UOMConvertResult,
    TaxReferenceResponse,
    HsnSacCodeResponse,
    PlatformReferenceResponse,
)
from ...services.localization_svc import GlobalReferenceService, LocalizationDictionaryService

router = APIRouter(prefix="/control/reference", tags=["Control Plane Reference Data & Localization"])


@router.get("/countries", response_model=List[CountryResponse])
async def list_countries(
    active_only: bool = Query(default=True, description="Filter active countries"),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """List ISO 3166 global countries reference data."""
    return await GlobalReferenceService(db).get_countries(active_only)


@router.get("/states", response_model=List[StateResponse])
async def list_states(
    country_code: str = Query(default="IN", description="ISO 2-letter country code"),
    active_only: bool = Query(default=True, description="Filter active states"),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """List states / provinces with statutory GST state codes."""
    return await GlobalReferenceService(db).get_states(country_code, active_only)


@router.get("/states/by-gst-code/{gst_code}", response_model=StateResponse)
async def get_state_by_gst_code(
    gst_code: str,
    country_code: str = Query(default="IN", description="ISO 2-letter country code"),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Resolve state and tax jurisdiction by statutory 2-digit GST state code (01..38, 97)."""
    st = await GlobalReferenceService(db).get_state_by_gst_code(gst_code, country_code)
    if not st:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"State with GST code '{gst_code}' not found in country '{country_code}'.",
        )
    return st


@router.get("/currencies", response_model=List[CurrencyResponse])
async def list_currencies(
    active_only: bool = Query(default=True, description="Filter active currencies"),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """List ISO 4217 global currency registry."""
    return await GlobalReferenceService(db).get_currencies(active_only)


@router.get("/uoms", response_model=List[UOMResponse])
async def list_uoms(
    active_only: bool = Query(default=True, description="Filter active units"),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """List standard Units of Measurement with GST Unique Quantity Code (UQC) mappings."""
    return await GlobalReferenceService(db).get_uoms(active_only)


@router.post("/uoms/convert", response_model=UOMConvertResult)
async def convert_uom(
    req: UOMConvertRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Convert quantity between compatible Units of Measurement."""
    try:
        factor, converted = await GlobalReferenceService(db).convert_uom(req.from_uom, req.to_uom, req.quantity)
        return UOMConvertResult(
            from_uom=req.from_uom.upper(),
            to_uom=req.to_uom.upper(),
            source_quantity=req.quantity,
            conversion_factor=factor,
            converted_quantity=converted,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/tax-references", response_model=List[TaxReferenceResponse])
async def list_tax_references(
    active_only: bool = Query(default=True, description="Filter active tax references"),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """List statutory GST / tax reference slabs."""
    return await GlobalReferenceService(db).get_tax_references(active_only)


@router.get("/hsn-sac", response_model=List[HsnSacCodeResponse])
async def list_hsn_sac(
    query: Optional[str] = Query(default=None, description="Search by code or description"),
    limit: int = Query(default=50, ge=1, le=200, description="Max results"),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Search Harmonized System of Nomenclature (HSN) and Service Accounting Codes (SAC)."""
    return await GlobalReferenceService(db).get_hsn_sac(query, limit)


@router.get("/languages", response_model=List[LanguageResponse])
async def list_languages(
    active_only: bool = Query(default=True, description="Filter active languages"),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """List supported multi-lingual UI and printing languages."""
    return await LocalizationDictionaryService(db).get_languages(active_only)


@router.get("/locales", response_model=List[LocaleResponse])
async def list_locales(
    active_only: bool = Query(default=True, description="Filter active locales"),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """List supported global locales with date, time, and numbering format rules."""
    return await LocalizationDictionaryService(db).get_locales(active_only)


@router.get("/translations/{language_code}", response_model=TranslationDictionaryResponse)
async def get_translation_dictionary(
    language_code: str,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Get full localized dictionary for the specified language code (e.g. 'hi', 'mr', 'en').
    Automatically falls back to English for any untranslated keys.
    """
    return await LocalizationDictionaryService(db).get_dictionary(language_code)


@router.get("/platform/{category}", response_model=List[PlatformReferenceResponse])
async def list_platform_references(
    category: str,
    active_only: bool = Query(default=True, description="Filter active entries"),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """List platform constants and extensible reference lookups by category."""
    return await GlobalReferenceService(db).get_platform_references(category, active_only)


@router.post("/format/currency", response_model=FormattedCurrencyResponse)
async def format_currency(
    req: FormatCurrencyRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Format currency values according to locale rules and symbol placement."""
    return await LocalizationDictionaryService(db).format_currency(req.amount, req.currency_code, req.locale_code)
