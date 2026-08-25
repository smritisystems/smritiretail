"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.16.0
Created      : 2026-08-23
Modified     : 2026-08-25
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

from typing import Dict, Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from ...api.deps import get_company_db, get_current_user
from ...services.univ_party_svc import UniversalPartyService
from ...services.party_master_svc import UniversalPartyMasterService
from ...services.item_master_svc import UniversalItemMasterService
from ...services.univ_item_svc import UniversalItemService
from ...schemas.party_master import (
    PartyCreateRequest,
    PartyUpdateRequest,
    PartyResponse,
    PartyMergeRequest,
    PartyMergeResponse,
    LegacyCustomerAdapterResponse,
    LegacySupplierAdapterResponse,
)
from ...schemas.item_master import (
    ItemCreateRequest,
    ItemUpdateRequest,
    ItemResponse,
    ItemVariantItem,
    ItemBatchItem,
    ItemSerialItem,
    MatrixVariantGenRequest,
    ItemResolutionResponse,
    LegacyProductAdapterResponse,
)

router = APIRouter()


# ---------------------------------------------------------------------------
# Universal Party Master Endpoints (P1.1)
# ---------------------------------------------------------------------------

@router.get("/parties", response_model=List[PartyResponse], summary="Search and list Universal Parties")
async def list_parties(
    role: Optional[str] = Query(None, description="Filter by role: CUSTOMER, SUPPLIER, DEALER, DISTRIBUTOR, TRANSPORTER, SALESMAN, EMPLOYEE"),
    status: Optional[str] = Query(None, description="Filter by status: ACTIVE, INACTIVE, BLOCKED"),
    query: Optional[str] = Query(None, description="Search query across name, code, GSTIN, phone"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_company_db),
    current_user: dict = Depends(get_current_user),
):
    """Lists parties with polymorphic roles, address, and contact information."""
    parties = await UniversalPartyMasterService.list_parties(
        session=db,
        role_type=role,
        status=status,
        query=query,
        limit=limit,
        offset=offset,
    )
    return parties


@router.post("/parties", response_model=PartyResponse, status_code=status.HTTP_201_CREATED, summary="Create Universal Party")
async def create_party(
    req: PartyCreateRequest,
    db: AsyncSession = Depends(get_company_db),
    current_user: dict = Depends(get_current_user),
):
    """Atomically creates a Universal Party with multi-roles and operational profiles."""
    try:
        party = await UniversalPartyMasterService.create_party(session=db, req=req)
        return party
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/parties/{party_id}", response_model=PartyResponse, summary="Get Universal Party details")
async def get_party_details(
    party_id: str,
    db: AsyncSession = Depends(get_company_db),
    current_user: dict = Depends(get_current_user),
):
    """Fetches a party record with assigned roles, operational profiles, addresses, and contacts."""
    party = await UniversalPartyMasterService.get_party_by_id(db, party_id)
    if not party:
        raise HTTPException(status_code=404, detail=f"Party '{party_id}' not found.")
    return party


@router.post("/parties/{party_id}/roles", summary="Assign or toggle role on Party")
async def assign_or_toggle_party_role(
    party_id: str,
    role_type: str = Query(..., description="Role: CUSTOMER, SUPPLIER, DEALER, DISTRIBUTOR, TRANSPORTER, SALESMAN, EMPLOYEE"),
    is_active: bool = Query(True),
    db: AsyncSession = Depends(get_company_db),
    current_user: dict = Depends(get_current_user),
):
    """Assigns or activates/deactivates a polymorphic role on a Party entity."""
    party = await UniversalPartyMasterService.get_party_by_id(db, party_id)
    if not party:
        raise HTTPException(status_code=404, detail=f"Party '{party_id}' not found.")
    role = await UniversalPartyMasterService.add_or_toggle_role(db, party_id, role_type, is_active)
    return {
        "status": "SUCCESS",
        "party_id": party_id,
        "role_type": role.role_type,
        "is_active": role.is_active,
    }


@router.post("/parties/merge", response_model=PartyMergeResponse, summary="Merge two party entities")
async def merge_parties(
    req: PartyMergeRequest,
    db: AsyncSession = Depends(get_company_db),
    current_user: dict = Depends(get_current_user),
):
    """Deduplication and merge: transfers roles and profiles from secondary to primary and marks secondary as MERGED."""
    try:
        res = await UniversalPartyMasterService.merge_parties(db, req)
        return res
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/parties/{party_id}/adapter/customer", response_model=LegacyCustomerAdapterResponse, summary="Legacy Customer Adapter")
async def get_legacy_customer_view(
    party_id: str,
    db: AsyncSession = Depends(get_company_db),
    current_user: dict = Depends(get_current_user),
):
    """Compatibility adapter: Presents Universal Party as a legacy Customer object."""
    view = await UniversalPartyMasterService.get_legacy_customer_view(db, party_id)
    if not view:
        raise HTTPException(status_code=404, detail=f"Party '{party_id}' not found.")
    return view


@router.get("/parties/{party_id}/adapter/supplier", response_model=LegacySupplierAdapterResponse, summary="Legacy Supplier Adapter")
async def get_legacy_supplier_view(
    party_id: str,
    db: AsyncSession = Depends(get_company_db),
    current_user: dict = Depends(get_current_user),
):
    """Compatibility adapter: Presents Universal Party as a legacy Supplier object."""
    view = await UniversalPartyMasterService.get_legacy_supplier_view(db, party_id)
    if not view:
        raise HTTPException(status_code=404, detail=f"Party '{party_id}' not found.")
    return view


@router.post("/parties/sync", summary="Synchronize legacy customers and suppliers into Universal Party Master")
async def sync_legacy_parties(
    db: AsyncSession = Depends(get_company_db),
    current_user: dict = Depends(get_current_user),
) -> Dict[str, Any]:
    """Batch synchronizes all customers and suppliers into polymorphic Party records."""
    res = await UniversalPartyService.sync_all_legacy_parties(db)
    return {
        "status": "SUCCESS",
        "result": res,
    }


# ---------------------------------------------------------------------------
# Universal Item Master Endpoints (P1.2)
# ---------------------------------------------------------------------------

@router.get("/items", response_model=List[ItemResponse], summary="Search and list Universal Items")
async def list_items(
    category: Optional[str] = Query(None, description="Filter by category"),
    brand: Optional[str] = Query(None, description="Filter by brand"),
    query: Optional[str] = Query(None, description="Search query across name, code, brand"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_company_db),
    current_user: dict = Depends(get_current_user),
):
    """Lists items with variants, barcodes, and warehouse locations."""
    items = await UniversalItemMasterService.list_items(
        session=db,
        category=category,
        brand=brand,
        query=query,
        limit=limit,
        offset=offset,
    )
    return items


@router.post("/items", response_model=ItemResponse, status_code=status.HTTP_201_CREATED, summary="Create Universal Item")
async def create_item(
    req: ItemCreateRequest,
    db: AsyncSession = Depends(get_company_db),
    current_user: dict = Depends(get_current_user),
):
    """Atomically creates a Universal Item with variants and barcodes."""
    try:
        item = await UniversalItemMasterService.create_item(session=db, req=req)
        return item
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/items/resolve", response_model=ItemResolutionResponse, summary="Resolve canonical Item by barcode/SKU/serial")
async def resolve_item(
    query: str = Query(..., description="Barcode, Variant SKU, Item Code, or Serial Number"),
    db: AsyncSession = Depends(get_company_db),
    current_user: dict = Depends(get_current_user),
):
    """Fast 4-tier scanner resolver for POS register and WMS mobile scanners."""
    res = await UniversalItemMasterService.resolve_item_by_barcode_or_sku(db, query)
    if not res:
        raise HTTPException(status_code=404, detail=f"No item found matching '{query}'.")
    return res


@router.get("/items/{item_id}", response_model=ItemResponse, summary="Get Universal Item details")
async def get_item_details(
    item_id: str,
    db: AsyncSession = Depends(get_company_db),
    current_user: dict = Depends(get_current_user),
):
    """Fetches complete item details with variants, barcodes, batches, and locations."""
    item = await UniversalItemMasterService.get_item_by_id(db, item_id)
    if not item:
        raise HTTPException(status_code=404, detail=f"Item '{item_id}' not found.")
    return item


@router.post("/items/{item_id}/variants/matrix", summary="Generate Size x Color matrix variants")
async def generate_matrix_variants(
    item_id: str,
    req: MatrixVariantGenRequest,
    db: AsyncSession = Depends(get_company_db),
    current_user: dict = Depends(get_current_user),
):
    """Generates Cartesian product of dimensions (e.g. Size x Color) with unique SKUs and barcodes."""
    try:
        variants = await UniversalItemMasterService.generate_matrix_variants(db, item_id, req)
        return {
            "status": "SUCCESS",
            "item_id": item_id,
            "variants_created": len(variants),
            "variants": [{"id": v.id, "variant_sku": v.variant_sku, "variant_name": v.variant_name} for v in variants],
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/items/{item_id}/batches", summary="Register item inventory batch")
async def create_item_batch(
    item_id: str,
    req: ItemBatchItem,
    db: AsyncSession = Depends(get_company_db),
    current_user: dict = Depends(get_current_user),
):
    """Registers an inventory batch with manufacturing and expiration dates."""
    try:
        batch = await UniversalItemMasterService.create_batch(db, item_id, req)
        return {
            "status": "SUCCESS",
            "batch_id": batch.id,
            "batch_number": batch.batch_number,
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/items/{item_id}/serials", summary="Register serialized unit numbers")
async def register_item_serials(
    item_id: str,
    req: List[ItemSerialItem],
    db: AsyncSession = Depends(get_company_db),
    current_user: dict = Depends(get_current_user),
):
    """Registers a collection of serialized unit IDs."""
    try:
        serials = await UniversalItemMasterService.register_serial_numbers(db, item_id, req)
        return {
            "status": "SUCCESS",
            "serials_registered": len(serials),
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/items/{item_id}/adapter/product", response_model=LegacyProductAdapterResponse, summary="Legacy Product Adapter")
async def get_legacy_product_view(
    item_id: str,
    db: AsyncSession = Depends(get_company_db),
    current_user: dict = Depends(get_current_user),
):
    """Compatibility adapter: Presents Universal Item as a legacy Product object."""
    view = await UniversalItemMasterService.get_legacy_product_view(db, item_id)
    if not view:
        raise HTTPException(status_code=404, detail=f"Item '{item_id}' not found.")
    return view


@router.post("/items/sync", summary="Synchronize legacy products into Universal Item Master")
async def sync_legacy_items(
    db: AsyncSession = Depends(get_company_db),
    current_user: dict = Depends(get_current_user),
) -> Dict[str, Any]:
    """Batch synchronizes all products into Item, ItemVariant, and ItemBarcode records."""
    count = await UniversalItemService.sync_all_legacy_products(db)
    return {
        "status": "SUCCESS",
        "items_converged": count,
    }
