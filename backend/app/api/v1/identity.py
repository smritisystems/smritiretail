"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.43.0
Created      : 2026-07-20
Modified     : 2026-07-20
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

from typing import Dict, Any
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from ...api.deps import get_db, get_current_user
from ...models.auth import User
from ...services.identity_service import ProductIdentityService

router = APIRouter(prefix="/identity", tags=["Product Identity Engine"])


@router.post(
    "/evaluate",
    summary="Evaluate Product Identity Rules & Business Key",
    description="Generates canonical SKU business key and fingerprint hash for product attributes."
)
async def evaluate_identity(
    payload: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    svc = ProductIdentityService()
    name = payload.get("name", "Product")
    category = payload.get("category", "General")
    brand = payload.get("brand", "General")
    seq = payload.get("sequence", 1)

    sku_key = await svc.generate_sku_business_key(category, brand, seq)
    fingerprint = svc.generate_fingerprint_hash(name, category, brand)

    return {
        "success": True,
        "sku_business_key": sku_key,
        "fingerprint_hash": fingerprint,
    }


@router.post(
    "/barcode/assign",
    summary="Assign GS1 EAN-13 Barcode",
    description="Assigns GS1 EAN-13 barcode with Mod-10 check digit calculation and registers ProductIdentity."
)
async def assign_barcode(
    payload: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    svc = ProductIdentityService()
    product_id = payload.get("product_id")
    if not product_id:
        raise HTTPException(status_code=400, detail="product_id is required.")

    name = payload.get("name", "Product")
    category = payload.get("category", "General")
    brand = payload.get("brand", "General")
    sku_key = payload.get("sku_business_key", f"SKU-{product_id[:8].upper()}")

    identity = await svc.assign_gs1_barcode(
        db=db,
        product_id=product_id,
        sku_business_key=sku_key,
        name=name,
        category=category,
        brand=brand,
    )

    return {
        "success": True,
        "identity_id": identity.id,
        "assigned_barcode": identity.barcode,
        "barcode_format": "EAN-13",
        "sku_business_key": identity.business_key,
    }


@router.post(
    "/simulate",
    summary="Simulate Identity Rule Expression Across Catalogue",
    description="Evaluates SKU key expression templates across a batch of product items and calculates collision rate."
)
async def simulate_identity_rule(
    payload: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    svc = ProductIdentityService()
    items = payload.get("items", [])
    pattern = payload.get("pattern_template", "{category}-{brand}-{seq:04d}")
    return await svc.simulate_identity_rules(payload_items=items, pattern_template=pattern)


@router.post(
    "/variants/resolve",
    summary="Generate Matrix Variant SKUs & Barcodes",
    description="Generates child matrix variant SKUs and Mod-10 EAN-13 barcodes for size/color dimensions."
)
async def resolve_variants(
    payload: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    svc = ProductIdentityService()
    parent_id = payload.get("parent_product_id", "prod-parent-001")
    parent_sku = payload.get("parent_sku", "SKU-PARENT-001")
    variants = payload.get("variants", [])

    created = await svc.generate_variant_skus(
        db=db,
        parent_product_id=parent_id,
        parent_sku=parent_sku,
        variants=variants,
    )
    return {"success": True, "total_variants": len(created), "variants": created}


@router.post(
    "/duplicates/score",
    summary="Score Product Master Duplicate Confidence",
    description="Calculates similarity confidence score (0.00 - 1.00) between two product master items."
)
async def score_duplicate_confidence(
    payload: Dict[str, Any],
    current_user: User = Depends(get_current_user),
):
    svc = ProductIdentityService()
    item_a = payload.get("item_a", {})
    item_b = payload.get("item_b", {})
    return svc.calculate_duplicate_confidence(item_a=item_a, item_b=item_b)

