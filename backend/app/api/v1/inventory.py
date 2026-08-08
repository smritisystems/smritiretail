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
from ...services.inventory_trace import InventoryTraceService
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
    """Update a product master. Requires MANAGER or SYSADMIN role.

    Phase E0 Authority Hardening (AUD-PhaseE / F-E0):
    - category and brand are FROZEN at product creation (SKU prefix + fingerprint depend on them).
    - style_code is FROZEN if the product is variant-engine controlled (has variant_template_id).
    - color and size updates are validated through PlatformValidationEngine and synced to JSONB mirror.
    """
    repo = ProductRepository(db, tenant_ctx)
    product = await repo.get(product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    update_data = product_in.model_dump(exclude_unset=True)

    # ── E0-A/B: Freeze category and brand (SKU prefix + fingerprint integrity) ──
    _FROZEN_FIELDS = {"category", "brand"}
    frozen_violations = _FROZEN_FIELDS & set(update_data.keys())
    if frozen_violations:
        raise HTTPException(
            status_code=422,
            detail=(
                f"Fields {sorted(frozen_violations)} cannot be changed after product creation. "
                "SKU prefix and fingerprint hash depend on these values. "
                "To recategorize, create a new product and transfer stock."
            ),
        )

    # ── E0-C: Freeze style_code if variant-engine controlled ──
    if "style_code" in update_data and product.variant_template_id:
        raise HTTPException(
            status_code=422,
            detail=(
                "style_code cannot be changed on variant-engine products. "
                "It is derived from the VariantTemplate."
            ),
        )

    # ── E0-D/E: Validate color and size through PVE if being updated ──
    color_size_fields = {"color", "size"}
    fields_to_validate = color_size_fields & set(update_data.keys())
    if fields_to_validate:
        tenant_id = getattr(tenant_ctx, "tenant_id", None) or getattr(tenant_ctx, "company_id", None)
        user_role = getattr(tenant_ctx, "role", "MANAGER")

        from ...core.validation import get_validation_engine
        pve = get_validation_engine()

        # Build a minimal data dict for PVE — only validate the fields being changed
        pve_data = {}
        for f in fields_to_validate:
            pve_data[f] = update_data[f]

        val_res = await pve.validate_entity(
            db=db,
            entity_type="product",
            data=pve_data,
            tenant_id=tenant_id,
            user_role=user_role,
        )
        # Apply PVE-normalized values back (handles Title Case / UPPER normalization)
        for f in fields_to_validate:
            if f in val_res.normalized_data:
                update_data[f] = val_res.normalized_data[f]

    # ── E0-F: Maintain JSONB mirror for Color and Size ──
    current_attrs = dict(product.attributes) if product.attributes else {}
    mirror_updated = False

    if "color" in update_data:
        normalized_color = update_data["color"]
        current_attrs["Color"] = normalized_color
        # Remove legacy lowercase key if it exists to prevent duplication
        if "color" in current_attrs and "color" != "Color":
            current_attrs.pop("color", None)
        mirror_updated = True

    if "size" in update_data:
        normalized_size = update_data["size"]
        current_attrs["Size"] = normalized_size
        # Remove legacy lowercase key if it exists to prevent duplication
        if "size" in current_attrs and "size" != "Size":
            current_attrs.pop("size", None)
        mirror_updated = True

    if mirror_updated:
        update_data["attributes"] = current_attrs

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


# ============================================================================
# INVENTORY KERNEL v1.0.0 FACADE REST ENDPOINTS
# ============================================================================

from ...services.inventory.facades import InventoryCommandFacade, InventoryQueryFacade

@router.get("/kernel/available/{product_id}")
async def get_kernel_available_stock(
    product_id: str,
    location_id: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Get Derived ATP stock (ATP = On Hand - Reserved - Locked) from InventoryQueryFacade."""
    query_facade = InventoryQueryFacade(db, tenant_ctx)
    atp = await query_facade.get_available(product_id, location_id)
    return {"product_id": product_id, "location_id": location_id, "available_to_promise": atp}


@router.get("/kernel/location-balance/{product_id}")
async def get_kernel_location_balance(
    product_id: str,
    location_id: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Get Physical On-Hand Stock from InventoryQueryFacade ILGE balance engine."""
    query_facade = InventoryQueryFacade(db, tenant_ctx)
    balance = await query_facade.get_location_balance(product_id, location_id)
    return {"product_id": product_id, "location_id": location_id, "on_hand": balance}


@router.get("/kernel/timeline")
async def get_kernel_timeline(
    product_id: str | None = Query(None),
    location_id: str | None = Query(None),
    batch_no: str | None = Query(None),
    serial_no: str | None = Query(None),
    movement_type: str | None = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Get unified inventory timeline event stream from TimelineEngine."""
    query_facade = InventoryQueryFacade(db, tenant_ctx)
    events = await query_facade.get_timeline(
        product_id=product_id,
        location_id=location_id,
        batch_no=batch_no,
        serial_no=serial_no,
        movement_type=movement_type,
        skip=skip,
        limit=limit,
    )
    return {"events": events, "count": len(events)}


@router.post("/kernel/movements", status_code=201)
async def execute_kernel_movement(
    payload: dict = Body(...),
    db: AsyncSession = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Execute atomic inventory transaction through ITEX / InventoryCommandFacade."""
    transaction_id = payload.get("transaction_id")
    if not transaction_id:
        raise HTTPException(status_code=400, detail="transaction_id is required")
    from_location_id = payload.get("from_location_id")
    to_location_id = payload.get("to_location_id")
    items = payload.get("items", [])
    movement_type = payload.get("movement_type", "TRANSFER")
    reference_doc_type = payload.get("reference_doc_type")
    reference_doc_id = payload.get("reference_doc_id")
    idempotency_key = payload.get("idempotency_key")

    command_facade = InventoryCommandFacade(db, tenant_ctx)
    return await command_facade.move_inventory(
        transaction_id=transaction_id,
        from_location_id=from_location_id,
        to_location_id=to_location_id,
        items=items,
        movement_type=movement_type,
        reference_doc_type=reference_doc_type,
        reference_doc_id=reference_doc_id,
        idempotency_key=idempotency_key,
    )


@router.post("/kernel/locks", status_code=201)
async def acquire_kernel_lock(
    payload: dict = Body(...),
    db: AsyncSession = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Acquire operational stock lock via InventoryCommandFacade."""
    lock_type = payload.get("lock_type")
    lock_scope = payload.get("lock_scope")
    target_id = payload.get("target_id")
    reason = payload.get("reason", "Operational Hold")
    product_id = payload.get("product_id")
    location_id = payload.get("location_id")
    locked_qty = payload.get("locked_qty", 0)

    if not lock_type or not lock_scope or not target_id:
        raise HTTPException(status_code=400, detail="lock_type, lock_scope, and target_id are required")

    from decimal import Decimal
    command_facade = InventoryCommandFacade(db, tenant_ctx)
    lock_rec = await command_facade.acquire_lock(
        lock_type=lock_type,
        lock_scope=lock_scope,
        target_id=target_id,
        reason=reason,
        location_id=location_id,
        product_id=product_id,
        locked_qty=Decimal(str(locked_qty)),
    )
    return {
        "lock_id": lock_rec.id,
        "lock_code": lock_rec.lock_code,
        "status": lock_rec.status,
        "lock_type": lock_rec.lock_type,
        "lock_scope": lock_rec.lock_scope,
        "target_id": lock_rec.target_id,
        "locked_qty": float(lock_rec.locked_qty),
    }


@router.post("/kernel/locks/{lock_id}/release")
async def release_kernel_lock(
    lock_id: str,
    payload: dict = Body(...),
    db: AsyncSession = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
    current_user: User = Depends(get_current_user),
):
    """Release active stock lock via InventoryCommandFacade."""
    reason = payload.get("reason", "Normal Release")
    command_facade = InventoryCommandFacade(db, tenant_ctx)
    released_rec = await command_facade.release_lock(
        lock_id=lock_id,
        released_by=current_user.id,
        reason=reason,
    )
    return {
        "lock_id": released_rec.id,
        "lock_code": released_rec.lock_code,
        "status": released_rec.status,
        "released_at": released_rec.released_at.isoformat() if released_rec.released_at else None,
    }


@router.get("/kernel/locks/{product_id}")
async def get_active_kernel_locks(
    product_id: str,
    location_id: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Get active stock locks and total locked quantity for a product."""
    query_facade = InventoryQueryFacade(db, tenant_ctx)
    locks = await query_facade.get_active_locks(product_id=product_id, location_id=location_id)
    return {"product_id": product_id, "locks": locks, "count": len(locks)}


@router.post("/kernel/checkpoints", status_code=201)
async def create_kernel_checkpoint(
    payload: dict = Body(...),
    db: AsyncSession = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
    current_user: User = Depends(get_current_user),
):
    """Create certified inventory recovery point checkpoint."""
    checkpoint_name = payload.get("checkpoint_name")
    if not checkpoint_name:
        raise HTTPException(status_code=400, detail="checkpoint_name is required")
    description = payload.get("description")

    command_facade = InventoryCommandFacade(db, tenant_ctx)
    cp = await command_facade.create_checkpoint(
        checkpoint_name=checkpoint_name,
        created_by=current_user.id,
        description=description,
    )
    return {
        "checkpoint_id": cp.id,
        "checkpoint_code": cp.checkpoint_code,
        "checkpoint_timestamp": cp.checkpoint_timestamp.isoformat(),
        "total_sku_count": cp.total_sku_count,
        "total_ledger_entries": cp.total_ledger_entries,
    }
