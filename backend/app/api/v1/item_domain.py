"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.70.0
Created      : 2026-09-28
Modified     : 2026-10-05
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Domain API Gateway
"""

from typing import Dict, Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from ...api.deps import get_company_db, get_db, get_current_user
from ...services.item_domain_svc import ItemDomainService, BusinessLogicError
from ...schemas.item_master import (
    ItemStyleCreateRequest,
    ItemStyleUpdateRequest,
    ItemStyleResponse,
    ItemVariantCreateRequest,
    ItemVariantResponse,
    ItemBarcodeCreateRequest,
    ItemBarcodeResponse,
    ItemLookupsResponse,
    ItemReadinessResponse,
)

router = APIRouter()


# ---------------------------------------------------------------------------
# 1. ItemStyle Domain Endpoints
# ---------------------------------------------------------------------------

@router.get("/item-styles", response_model=List[ItemStyleResponse], summary="List Item Styles")
async def list_item_styles(
    category: Optional[str] = Query(None, description="Filter by category"),
    brand: Optional[str] = Query(None, description="Filter by brand"),
    query: Optional[str] = Query(None, description="Search across style code, name, brand"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_company_db),
    current_user: dict = Depends(get_current_user),
):
    """Lists parent ItemStyles with variant and barcode count telemetry."""
    company_id = getattr(current_user, "company_id", "COMP-001")
    styles = await ItemDomainService.list_styles(
        session=db,
        category=category,
        brand=brand,
        query=query,
        limit=limit,
        offset=offset,
        company_id=company_id,
    )
    return styles


@router.post(
    "/item-styles",
    deprecated=True,
    status_code=status.HTTP_410_GONE,
    summary="Create Item Style (Deprecated)",
)
async def create_item_style(
    req: Optional[ItemStyleCreateRequest] = None,
    db: AsyncSession = Depends(get_company_db),
    current_user: dict = Depends(get_current_user),
):
    """Deprecated endpoint. Returns HTTP 410 Gone."""
    raise HTTPException(
        status_code=status.HTTP_410_GONE,
        detail="This endpoint is deprecated. Use POST /api/v1/inventory/ or POST /api/v1/universal/items.",
    )


@router.get("/item-styles/{style_id}", response_model=ItemStyleResponse, summary="Get Item Style by ID or Code")
async def get_item_style_details(
    style_id: str,
    db: AsyncSession = Depends(get_company_db),
    current_user: dict = Depends(get_current_user),
):
    """Fetches ItemStyle by surrogate ID or style_code."""
    company_id = getattr(current_user, "company_id", "COMP-001")
    style = await ItemDomainService.get_style(db, style_id, company_id=company_id)
    if not style:
        raise HTTPException(status_code=404, detail=f"Item style '{style_id}' not found.")
    
    v_count = len([v for v in style.variants if not v.is_deleted])
    b_count = sum(len([b for b in v.barcodes if not b.is_deleted]) for v in style.variants)

    return ItemStyleResponse(
        id=style.id,
        style_code=style.item_code,
        style_name=style.item_name,
        item_type=style.item_type,
        category=style.category,
        department=style.department,
        brand=style.brand,
        vendor_code=style.vendor_code,
        hsn_code=style.hsn_code,
        tax_rate=float(style.tax_rate or 18.0),
        primary_uom=style.primary_uom,
        gender=style.gender,
        product_type=style.product_type,
        heel_type=style.heel_type,
        upper_material=style.upper_material,
        outsole_material=style.outsole_material,
        collection_type=style.collection_type,
        status=style.status or "ACTIVE",
        is_inventory_yn=style.is_inventory_yn,
        is_billable_yn=style.is_billable_yn,
        is_service_yn=style.is_service_yn,
        variant_count=v_count,
        barcode_count=b_count,
    )


# ---------------------------------------------------------------------------
# 2. ItemVariant Domain Endpoints (Physical Variant Identity)
# ---------------------------------------------------------------------------

@router.get("/item-variants", response_model=List[ItemVariantResponse], summary="List Item Variants")
async def list_item_variants(
    style_id: Optional[str] = Query(None, description="Filter by parent style ID"),
    color: Optional[str] = Query(None, description="Filter by color"),
    size: Optional[str] = Query(None, description="Filter by size"),
    query: Optional[str] = Query(None, description="Search by variant SKU or name"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_company_db),
    current_user: dict = Depends(get_current_user),
):
    """Lists physical variants strictly governed by Style + Color + Size."""
    company_id = getattr(current_user, "company_id", "COMP-001")
    variants = await ItemDomainService.list_variants(
        session=db,
        style_id=style_id,
        color=color,
        size=size,
        query=query,
        limit=limit,
        offset=offset,
        company_id=company_id,
    )
    return variants


@router.post(
    "/item-variants",
    response_model=ItemVariantResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create Physical Item Variant",
)
async def create_item_variant(
    req: ItemVariantCreateRequest,
    db: AsyncSession = Depends(get_company_db),
    current_user: dict = Depends(get_current_user),
):
    """
    Creates or resolves physical ItemVariant strictly governed by Style + Color + Size.
    MRP does NOT participate in variant identity. Pricing is recorded in the Pricing Domain.
    Persists Phase 2 domain configurations (UOM, Pricing, Tax, Purchasing, Sales, Inventory Policy).
    """
    company_id = getattr(current_user, "company_id", "COMP-001")
    branch_id = getattr(current_user, "branch_id", None)
    try:
        variant, pbe, barcode = await ItemDomainService.create_variant(
            session=db,
            req=req,
            company_id=company_id,
            branch_id=branch_id,
        )
        loaded = await ItemDomainService.get_variant(db, variant.id, company_id=company_id)
        return ItemVariantResponse(**ItemDomainService._serialize_variant_response(loaded or variant))
    except BusinessLogicError as ble:
        raise HTTPException(status_code=400, detail=ble.message)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.get("/item-variants/{variant_id}", response_model=ItemVariantResponse, summary="Get Item Variant by ID or SKU")
async def get_item_variant_details(
    variant_id: str,
    db: AsyncSession = Depends(get_company_db),
    current_user: dict = Depends(get_current_user),
):
    """Fetches physical variant with all Phase 2 policies, barcodes, and readiness telemetry."""
    company_id = getattr(current_user, "company_id", "COMP-001")
    variant = await ItemDomainService.get_variant(db, variant_id, company_id=company_id)
    if not variant:
        raise HTTPException(status_code=404, detail=f"Item variant '{variant_id}' not found.")
    return ItemVariantResponse(**ItemDomainService._serialize_variant_response(variant))


@router.get("/item-variants/{variant_id}/readiness", response_model=ItemReadinessResponse, summary="Get Item Variant Readiness Evaluation")
async def get_item_variant_readiness(
    variant_id: str,
    require_barcode: bool = Query(False, description="Whether active primary barcode is mandatory for sale"),
    db: AsyncSession = Depends(get_company_db),
    current_user: dict = Depends(get_current_user),
):
    """Evaluates readiness of an ItemVariant, returning structured blocking reasons."""
    company_id = getattr(current_user, "company_id", "COMP-001")
    try:
        readiness = await ItemDomainService.get_variant_readiness(
            session=db,
            variant_id=variant_id,
            company_id=company_id,
            require_barcode=require_barcode,
        )
        return ItemReadinessResponse(**readiness)
    except BusinessLogicError as ble:
        raise HTTPException(status_code=404, detail=ble.message)


@router.put("/item-variants/{variant_id}/settings", response_model=ItemVariantResponse, summary="Update Item Variant Phase 2 Settings")
async def update_item_variant_settings(
    variant_id: str,
    settings: Dict[str, Any],
    db: AsyncSession = Depends(get_company_db),
    current_user: dict = Depends(get_current_user),
):
    """Updates Phase 2 domain settings (UOM, Pricing, Tax, Purchasing, Sales, Inventory Policy) for a variant."""
    company_id = getattr(current_user, "company_id", "COMP-001")
    branch_id = getattr(current_user, "branch_id", None)
    try:
        updated = await ItemDomainService.save_variant_phase2_settings(
            session=db,
            variant_id=variant_id,
            data=settings,
            company_id=company_id,
            branch_id=branch_id,
        )
        return ItemVariantResponse(**ItemDomainService._serialize_variant_response(updated))
    except BusinessLogicError as ble:
        raise HTTPException(status_code=400, detail=ble.message)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))


# ---------------------------------------------------------------------------
# 3. ItemBarcode Domain Endpoints (Physical Optical Identity)
# ---------------------------------------------------------------------------

@router.get("/item-barcodes", response_model=List[ItemBarcodeResponse], summary="List Item Barcodes")
async def list_item_barcodes(
    variant_id: Optional[str] = Query(None, description="Filter by physical variant ID"),
    barcode: Optional[str] = Query(None, description="Filter by exact barcode"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_company_db),
    current_user: dict = Depends(get_current_user),
):
    """Lists registered barcodes with multi-MRP price linkages."""
    company_id = getattr(current_user, "company_id", "COMP-001")
    barcodes = await ItemDomainService.list_barcodes(
        session=db,
        variant_id=variant_id,
        barcode=barcode,
        limit=limit,
        offset=offset,
        company_id=company_id,
    )
    return barcodes


@router.post(
    "/item-barcodes",
    response_model=ItemBarcodeResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create Item Barcode",
)
async def create_item_barcode(
    req: ItemBarcodeCreateRequest,
    db: AsyncSession = Depends(get_company_db),
    current_user: dict = Depends(get_current_user),
):
    """Registers a physical barcode linked to a specific physical variant and price point."""
    company_id = getattr(current_user, "company_id", "COMP-001")
    branch_id = getattr(current_user, "branch_id", None)
    try:
        b_obj = await ItemDomainService.create_barcode(
            session=db,
            req=req,
            company_id=company_id,
            branch_id=branch_id,
        )
        return ItemBarcodeResponse(
            id=b_obj.id,
            style_id=b_obj.item_id,
            variant_id=b_obj.variant_id,
            barcode=b_obj.barcode,
            barcode_type=b_obj.barcode_type,
            barcode_purpose=b_obj.barcode_purpose,
            is_primary=b_obj.is_primary,
            is_tax_inclusive=b_obj.is_tax_inclusive,
            least_saleable_qty=float(b_obj.least_saleable_qty or 1.0),
            price_book_entry_id=b_obj.price_book_entry_id,
            status=b_obj.status or "ASSIGNED",
        )
    except BusinessLogicError as ble:
        raise HTTPException(status_code=409, detail=ble.message)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))


# ---------------------------------------------------------------------------
# 4. Governed Master Lookups Domain Endpoint
# ---------------------------------------------------------------------------

@router.get("/item-domain/lookups", response_model=ItemLookupsResponse, summary="Get Governed Catalog Lookups")
async def get_item_governed_lookups(
    control_db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """
    Fetches approved lookup values across all 14 governed dimensions from the System Master
    (master_values) for Brand, Color, Size, Gender, Department, Category, Product Type,
    Heel Type, Upper Material, Outsole Material, Collection, Subcategory, UOM, and GST Rates.
    """
    company_id = getattr(current_user, "company_id", None)
    lookups = await ItemDomainService.get_governed_lookups(control_db, company_id=company_id)
    return ItemLookupsResponse(dimensions=lookups)
