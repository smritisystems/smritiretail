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

from typing import Dict, Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from ...api.deps import get_company_db, get_current_user
from ...services.universal_party_service import UniversalPartyService
from ...services.universal_item_service import UniversalItemService

router = APIRouter()


@router.post("/parties/sync", summary="Synchronize legacy customers and suppliers into Universal Party Master")
async def sync_legacy_parties(
    db: AsyncSession = Depends(get_company_db),
    current_user: dict = Depends(get_current_user)
) -> Dict[str, Any]:
    """Batch synchronizes all customers and suppliers into polymorphic Party records."""
    res = await UniversalPartyService.sync_all_legacy_parties(db)
    return {
        "status": "SUCCESS",
        "result": res
    }


@router.get("/parties/{party_id}", summary="Get Universal Party details with polymorphic roles")
async def get_party_details(
    party_id: str,
    db: AsyncSession = Depends(get_company_db),
    current_user: dict = Depends(get_current_user)
) -> Dict[str, Any]:
    """Fetches a party record with assigned roles and operational profiles."""
    party = await UniversalPartyService.get_party_with_details(db, party_id)
    if not party:
        raise HTTPException(status_code=404, detail=f"Party '{party_id}' not found.")
    
    return {
        "id": party.id,
        "party_code": party.party_code,
        "party_type": party.party_type,
        "legal_name": party.legal_name,
        "trade_name": party.trade_name,
        "gstin": party.gstin,
        "phone": party.phone,
        "email": party.email,
        "city": party.city,
        "state": party.state,
        "status": party.status,
        "roles": [{"role_type": r.role_type, "is_active": r.is_active} for r in (party.roles or [])],
        "customer_profile": {
            "category": party.customer_profile.customer_category,
            "credit_limit": float(party.customer_profile.credit_limit),
            "tax_category": party.customer_profile.tax_category
        } if party.customer_profile else None,
        "supplier_profile": {
            "supplier_type": party.supplier_profile.supplier_type,
            "payment_terms_days": party.supplier_profile.payment_terms_days,
            "tax_treatment": party.supplier_profile.tax_treatment
        } if party.supplier_profile else None
    }


@router.post("/items/sync", summary="Synchronize legacy products into Universal Item Master")
async def sync_legacy_items(
    db: AsyncSession = Depends(get_company_db),
    current_user: dict = Depends(get_current_user)
) -> Dict[str, Any]:
    """Batch synchronizes all products into Item, ItemVariant, and ItemBarcode records."""
    count = await UniversalItemService.sync_all_legacy_products(db)
    return {
        "status": "SUCCESS",
        "items_converged": count
    }


@router.get("/items/resolve", summary="Resolve canonical Item by barcode or SKU")
async def resolve_item(
    query: str = Query(..., description="Barcode, Variant SKU, or Item Code"),
    db: AsyncSession = Depends(get_company_db),
    current_user: dict = Depends(get_current_user)
) -> Dict[str, Any]:
    """Fast resolver for POS scanner and order line typeahead."""
    res = await UniversalItemService.resolve_item_by_barcode_or_sku(db, query)
    if not res:
        raise HTTPException(status_code=404, detail=f"No item found matching '{query}'.")
    return res
