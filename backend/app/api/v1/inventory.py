"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.16.0
Created      : 2026-07-11
Modified     : 2026-07-19
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

import os
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, Body
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from ...api.deps import TenantContext, get_db, get_tenant_context, require_permission, get_current_user, verify_internal_service_key
from ...models.auth import User
from ...models.inventory import Product, StockMovement
from ...repositories.product import ProductRepository
from ...schemas.inventory import (
    ProductCreate,
    ProductResponse,
    ProductUpdate,
    StockMovementCreate,
    StockMovementResponse,
)
from ...services.inventory import InventoryService
from ...services.spif import SpifService

router = APIRouter()


@router.post(
    "/",
    response_model=ProductResponse,
    status_code=201,
    dependencies=[Depends(require_permission("ITEM.CREATE"))],
)
async def create_product(
    product_in: ProductCreate,
    db: AsyncSession = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Create a new product. Requires MANAGER or SYSADMIN role."""
    service = InventoryService(db, tenant_ctx)
    return await service.create_product(product_in)


@router.get("/", response_model=list[ProductResponse])
async def list_products(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """List products for the authenticated user's tenant. Any role may read."""
    repo = ProductRepository(db, tenant_ctx)
    return await repo.get_all(skip=skip, limit=limit)


@router.get("/search", response_model=list[ProductResponse])
async def search_products(
    q: str | None = Query(None),
    category: str | None = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    repo = ProductRepository(db, tenant_ctx)
    return await repo.search(q=q, category=category, skip=skip, limit=limit)


@router.get("/ledger", response_model=list[StockMovementResponse])
async def list_stock_ledger(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """List stock ledger movements. Tenant-scoped."""
    stmt = select(StockMovement).filter(
        StockMovement.company_id == tenant_ctx.company_id,
        StockMovement.branch_id == tenant_ctx.branch_id,
        StockMovement.is_deleted == False
    ).order_by(StockMovement.created_at.desc()).offset(skip).limit(limit)
    
    res = await db.execute(stmt)
    return list(res.scalars().all())


@router.post(
    "/stock-movements",
    response_model=StockMovementResponse,
    status_code=201,
    dependencies=[Depends(verify_internal_service_key)],
)
async def create_stock_movement(
    movement_in: StockMovementCreate,
    db: AsyncSession = Depends(get_db),
):
    """
    Record an inventory stock movement.
    Trusted first-party call — secured by X-Internal-Service-Key.
    """
    import uuid
    
    # Check if product exists
    product_res = await db.execute(
        select(Product).filter(Product.id == movement_in.product_id, Product.is_deleted == False)
    )
    product = product_res.scalars().first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
        
    movement_id = movement_in.id or f"SM-{int(datetime.utcnow().timestamp())}-{uuid.uuid4().hex[:6]}"
    
    db_movement = StockMovement(
        id=movement_id,
        uuid=str(uuid.uuid4()),
        product_id=movement_in.product_id,
        product_name=movement_in.product_name,
        sku=movement_in.sku,
        quantity=movement_in.quantity,
        movement_type=movement_in.movement_type,
        reference_doc_type=movement_in.reference_doc_type,
        reference_doc_id=movement_in.reference_doc_id,
        warehouse=movement_in.warehouse,
        bin=movement_in.bin,
        batch=movement_in.batch,
        serial=movement_in.serial,
        unit_cost=movement_in.unit_cost,
        remarks=movement_in.remarks,
        user=movement_in.user,
        device=movement_in.device,
        branch=movement_in.branch,
        source_module=movement_in.source_module,
        approval=movement_in.approval,
        company_id=product.company_id,
        branch_id=product.branch_id,
    )
    
    db.add(db_movement)
    await db.commit()
    await db.refresh(db_movement)
    return db_movement



@router.get("/{product_id}", response_model=ProductResponse)
async def get_product(
    product_id: str,
    db: AsyncSession = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    repo = ProductRepository(db, tenant_ctx)
    product = await repo.get(product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return product


@router.put(
    "/{product_id}",
    response_model=ProductResponse,
    dependencies=[Depends(require_permission("ITEM.UPDATE"))],
)
async def update_product(
    product_id: str,
    product_in: ProductUpdate,
    db: AsyncSession = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Update a product master. Requires MANAGER or SYSADMIN role."""
    repo = ProductRepository(db, tenant_ctx)
    product = await repo.get(product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    update_data = product_in.model_dump(exclude_unset=True)
    return await repo.update(product, update_data)


@router.delete(
    "/{product_id}",
    dependencies=[Depends(require_permission("ITEM.DELETE"))],
)
async def delete_product(
    product_id: str,
    db: AsyncSession = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
    current_user: User = Depends(get_current_user),
):
    """Soft delete a product by setting its is_deleted flag."""
    repo = ProductRepository(db, tenant_ctx)
    product = await repo.get(product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    await repo.soft_delete(product, deleted_by=current_user.id)
    return {"success": True, "message": "Product deleted successfully"}


@router.post(
    "/{product_id}/barcodes",
    response_model=ProductResponse,
    dependencies=[Depends(require_permission("ITEM.UPDATE"))],
)
async def add_secondary_barcode(
    product_id: str,
    barcode_in: dict,
    db: AsyncSession = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Add a secondary barcode to a product."""
    value = barcode_in.get("value")
    if not value:
        raise HTTPException(status_code=400, detail="Barcode value required")
        
    repo = ProductRepository(db, tenant_ctx)
    product = await repo.get(product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
        
    # Check if duplicate barcode exists globally
    existing = await repo.get_by_barcode(value)
    if existing:
        raise HTTPException(status_code=400, detail="Barcode already exists globally")
        
    current_secondary = list(product.secondary_barcodes or [])
    if value not in current_secondary:
        current_secondary.append(value)
        
    return await repo.update(product, {"secondary_barcodes": current_secondary})


@router.delete(
    "/{product_id}/barcodes/{value}",
    response_model=ProductResponse,
    dependencies=[Depends(require_permission("ITEM.UPDATE"))],
)
async def delete_secondary_barcode(
    product_id: str,
    value: str,
    db: AsyncSession = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Delete a secondary barcode from a product."""
    repo = ProductRepository(db, tenant_ctx)
    product = await repo.get(product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
        
    current_secondary = list(product.secondary_barcodes or [])
    if value in current_secondary:
        current_secondary.remove(value)
        
    return await repo.update(product, {"secondary_barcodes": current_secondary})


@router.post(
    "/{product_id}/image",
    response_model=ProductResponse,
    dependencies=[Depends(require_permission("ITEM.UPDATE"))],
)
async def upload_product_image(
    product_id: str,
    payload: dict = Body(...),
    db: AsyncSession = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Upload/Replace product primary image as a base64 encoded string."""
    image_data = payload.get("image_data")
    if not image_data:
        raise HTTPException(status_code=400, detail="Base64 image_data is required")
    
    repo = ProductRepository(db, tenant_ctx)
    product = await repo.get(product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    # Delete old primary image if it exists locally
    if product.primary_image_url:
        old_filename = product.primary_image_url.split("/")[-1]
        SpifService.delete_image_file(old_filename)

    try:
        filename = SpifService.process_and_save_base64_image(image_data)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to process image: {str(e)}")

    relative_url = f"/products/images/{filename}"
    return await repo.update(product, {"primary_image_url": relative_url})


@router.delete(
    "/{product_id}/image",
    response_model=ProductResponse,
    dependencies=[Depends(require_permission("ITEM.UPDATE"))],
)
async def delete_product_image(
    product_id: str,
    db: AsyncSession = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Delete a product's primary image."""
    repo = ProductRepository(db, tenant_ctx)
    product = await repo.get(product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    if product.primary_image_url:
        filename = product.primary_image_url.split("/")[-1]
        SpifService.delete_image_file(filename)

    return await repo.update(product, {"primary_image_url": None})


@router.post(
    "/{product_id}/gallery",
    response_model=ProductResponse,
    dependencies=[Depends(require_permission("ITEM.UPDATE"))],
)
async def add_gallery_image(
    product_id: str,
    payload: dict = Body(...),
    db: AsyncSession = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Add a new image to the product's image gallery."""
    image_data = payload.get("image_data")
    if not image_data:
        raise HTTPException(status_code=400, detail="Base64 image_data is required")
    
    repo = ProductRepository(db, tenant_ctx)
    product = await repo.get(product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    try:
        filename = SpifService.process_and_save_base64_image(image_data)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to process image: {str(e)}")

    relative_url = f"/products/images/{filename}"
    current_gallery = list(product.gallery_images or [])
    current_gallery.append(relative_url)

    return await repo.update(product, {"gallery_images": current_gallery})


@router.delete(
    "/{product_id}/gallery/{filename}",
    response_model=ProductResponse,
    dependencies=[Depends(require_permission("ITEM.UPDATE"))],
)
async def delete_gallery_image(
    product_id: str,
    filename: str,
    db: AsyncSession = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Delete an image from the product's image gallery."""
    repo = ProductRepository(db, tenant_ctx)
    product = await repo.get(product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    current_gallery = list(product.gallery_images or [])
    target_url = f"/products/images/{filename}"
    if target_url in current_gallery:
        current_gallery.remove(target_url)
        SpifService.delete_image_file(filename)

    return await repo.update(product, {"gallery_images": current_gallery})


@router.get("/images/{filename}", include_in_schema=False)
async def get_product_image(filename: str):
    """Serve product image from the local SPIF static uploads folder."""
    filepath = SpifService.get_image_path(filename)
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="Image not found")
    return FileResponse(filepath, media_type="image/webp")
