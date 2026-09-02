"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.25.0
Created      : 2026-07-11
Modified     : 2026-08-20
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

import os
from decimal import Decimal
from datetime import datetime, date, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Body
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import or_, cast, String

from ...api.deps import (
    TenantContext, get_company_db, get_tenant_context,
    get_current_user, require_role, require_permission, verify_internal_service_key
)
from ...models.auth import User, UserRole
from ...models.inventory import Product, StockMovement
from ...models.sales import SalesInvoice
from ...repositories.product import ProductRepository
from ...schemas.pagination import PaginatedResponse
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
    "",
    response_model=ProductResponse,
    status_code=201,
    dependencies=[Depends(require_permission("item_master", "ADD"))],
    include_in_schema=False,
)
@router.post(
    "/",
    response_model=ProductResponse,
    status_code=201,
    dependencies=[Depends(require_permission("item_master", "ADD"))],
)
async def create_product(
    product_in: ProductCreate,
    db: AsyncSession = Depends(get_company_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Create a new product. Requires MANAGER or SYSADMIN role."""
    service = InventoryService(db, tenant_ctx)
    return await service.create_product(product_in)


@router.get("", response_model=PaginatedResponse[ProductResponse], include_in_schema=False)
@router.get("/", response_model=PaginatedResponse[ProductResponse])
async def list_products(
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=500),
    q: str | None = Query(None),
    category: str | None = Query(None),
    sort: str = Query("name"),
    order: str = Query("asc"),
    db: AsyncSession = Depends(get_company_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """List products with server-side pagination, search, category filter, and sorting."""
    repo = ProductRepository(db, tenant_ctx)
    items, total = await repo.get_paginated(
        page=page,
        page_size=page_size,
        q=q,
        category=category,
        sort=sort,
        order=order
    )
    total_pages = (total + page_size - 1) // page_size if total > 0 else 0
    return PaginatedResponse(
        items=items,
        page=page,
        page_size=page_size,
        total=total,
        total_pages=total_pages,
        has_next=page < total_pages,
        has_prev=page > 1,
    )


@router.get("/search", response_model=list[ProductResponse])
async def search_products(
    q: str | None = Query(None),
    category: str | None = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_company_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    repo = ProductRepository(db, tenant_ctx)
    return await repo.search(q=q, category=category, skip=skip, limit=limit)


@router.get("/ledger", response_model=list[StockMovementResponse])
@router.get("/stock-movements", response_model=list[StockMovementResponse])
async def list_stock_ledger(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    from_date: Optional[date] = Query(None),
    to_date: Optional[date] = Query(None),
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    movement_type: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    q: Optional[str] = Query(None),
    product_id: Optional[str] = Query(None),
    sku: Optional[str] = Query(None),
    reference_doc_id: Optional[str] = Query(None),
    reference_doc_no: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_company_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """List stock ledger movements. Exact tenant and branch scoped with date, type, and search filters."""
    eff_from_date = from_date or start_date
    eff_to_date = to_date or end_date

    stmt = (
        select(
            StockMovement,
            Product.barcode.label("prod_barcode"),
            Product.style_code.label("prod_style_code"),
            Product.color.label("prod_color"),
            Product.size.label("prod_size"),
            Product.brand.label("prod_brand"),
            Product.mrp.label("prod_mrp"),
            Product.buying_price.label("prod_buying_price"),
            Product.cost_price.label("prod_cost_price"),
            Product.price.label("prod_price"),
            SalesInvoice.invoice_no.label("inv_invoice_no"),
        )
        .outerjoin(Product, Product.id == StockMovement.product_id)
        .outerjoin(
            SalesInvoice,
            or_(
                SalesInvoice.id == StockMovement.reference_doc_id,
                SalesInvoice.invoice_no == StockMovement.reference_doc_id,
            ),
        )
        .filter(
            StockMovement.company_id == tenant_ctx.company_id,
            StockMovement.branch_id == tenant_ctx.branch_id,
            StockMovement.is_deleted == False
        )
    )

    if eff_from_date:
        stmt = stmt.where(StockMovement.created_at >= eff_from_date)
    if eff_to_date:
        next_day = date(eff_to_date.year, eff_to_date.month, eff_to_date.day) + timedelta(days=1)
        stmt = stmt.where(StockMovement.created_at < next_day)

    if movement_type and movement_type.upper() != "ALL":
        stmt = stmt.where(StockMovement.movement_type == movement_type.upper())

    if product_id:
        stmt = stmt.where(StockMovement.product_id == product_id)
    if sku:
        stmt = stmt.where(StockMovement.sku == sku)
    
    target_ref = reference_doc_id or reference_doc_no
    if target_ref:
        stmt = stmt.where(
            or_(
                StockMovement.reference_doc_id == target_ref,
                SalesInvoice.invoice_no == target_ref,
            )
        )

    search_term = search or q
    if search_term:
        term = f"%{search_term.strip()}%"
        stmt = stmt.where(
            or_(
                StockMovement.sku.ilike(term),
                StockMovement.product_name.ilike(term),
                StockMovement.reference_doc_id.ilike(term),
                SalesInvoice.invoice_no.ilike(term),
                StockMovement.movement_type.ilike(term),
                StockMovement.reference_doc_type.ilike(term),
                StockMovement.warehouse.ilike(term),
                StockMovement.remarks.ilike(term),
                StockMovement.batch.ilike(term),
                Product.barcode.ilike(term),
                Product.style_code.ilike(term),
                Product.brand.ilike(term),
                Product.color.ilike(term),
                Product.size.ilike(term),
                cast(StockMovement.created_at, String).ilike(term),
            )
        )

    stmt = stmt.order_by(StockMovement.created_at.desc()).offset(skip).limit(limit)

    res = await db.execute(stmt)
    rows = res.all()
    items = []
    for row in rows:
        mv = row[0]
        cost_val = mv.unit_cost or row.prod_cost_price or row.prod_buying_price or row.prod_price or Decimal("0.00")
        raw_qty = mv.quantity if mv.quantity is not None else Decimal("0.00")
        qty_abs = abs(raw_qty)
        tot_val = qty_abs * cost_val
        doc_no = row.inv_invoice_no or mv.reference_doc_id or "—"

        m_type = (mv.movement_type or "").upper()
        if m_type in ("OUTWARD_SALE", "SALE", "ADJUSTMENT_OUT", "TRANSFER_OUT", "DAMAGE", "WRITE_OFF", "OUT"):
            is_inward = False
        elif m_type in ("IN", "RETURN", "RETURN_INWARD", "INWARD_GRN", "ADJUSTMENT_IN", "TRANSFER_IN", "PURCHASE"):
            is_inward = True
        else:
            is_inward = raw_qty > 0

        in_qty = qty_abs if is_inward else Decimal("0.00")
        out_qty = qty_abs if not is_inward else Decimal("0.00")
        in_val = in_qty * cost_val
        out_val = out_qty * cost_val

        item_dict = {
            "id": mv.id,
            "uuid": mv.uuid,
            "product_id": mv.product_id,
            "product_name": mv.product_name,
            "sku": mv.sku,
            "quantity": mv.quantity,
            "movement_type": mv.movement_type,
            "reference_doc_type": mv.reference_doc_type,
            "reference_doc_id": mv.reference_doc_id,
            "reference_doc_no": doc_no,
            "warehouse": mv.warehouse,
            "bin": mv.bin,
            "batch": mv.batch,
            "serial": mv.serial,
            "unit_cost": cost_val,
            "remarks": mv.remarks,
            "user": mv.user,
            "device": mv.device,
            "branch": mv.branch,
            "source_module": mv.source_module,
            "approval": mv.approval,
            "company_id": mv.company_id,
            "branch_id": mv.branch_id,
            "created_at": mv.created_at,
            "modified_at": mv.modified_at,
            "barcode": row.prod_barcode,
            "style_code": row.prod_style_code,
            "color": row.prod_color,
            "size": row.prod_size,
            "brand": row.prod_brand,
            "mrp": row.prod_mrp or row.prod_price or Decimal("0.00"),
            "selling_price": row.prod_price or Decimal("0.00"),
            "buying_price": row.prod_buying_price or Decimal("0.00"),
            "cost_price": cost_val,
            "total_value": tot_val,
            "in_qty": in_qty,
            "out_qty": out_qty,
            "in_value": in_val,
            "out_value": out_val,
        }
        items.append(StockMovementResponse(**item_dict))
    return items


@router.post(
    "/stock-movements",
    response_model=StockMovementResponse,
    status_code=201,
    dependencies=[Depends(verify_internal_service_key)],
)
async def create_stock_movement(
    movement_in: StockMovementCreate,
    db: AsyncSession = Depends(get_company_db),
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
    db: AsyncSession = Depends(get_company_db),
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
    dependencies=[Depends(require_permission("item_master", "EDIT"))],
)
async def update_product(
    product_id: str,
    product_in: ProductUpdate,
    db: AsyncSession = Depends(get_company_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Update a product master."""
    repo = ProductRepository(db, tenant_ctx)
    product = await repo.get(product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    update_data = product_in.model_dump(exclude_unset=True)

    # Enforce Stock No / Code uniqueness across other products
    if update_data.get("code") and update_data["code"] != product.code:
        existing_code = await db.execute(
            select(Product).filter(
                Product.code == update_data["code"],
                Product.id != product_id,
                Product.is_deleted == False,
                Product.company_id == tenant_ctx.company_id,
                Product.branch_id == tenant_ctx.branch_id
            )
        )
        if existing_code.scalars().first():
            raise HTTPException(status_code=400, detail=f"Stock No / SKU '{update_data['code']}' is already in use by another product")

    # Enforce Barcode uniqueness across other products
    if update_data.get("barcode") and update_data["barcode"] != product.barcode:
        existing_barcode = await db.execute(
            select(Product).filter(
                Product.barcode == update_data["barcode"],
                Product.id != product_id,
                Product.is_deleted == False,
                Product.company_id == tenant_ctx.company_id,
                Product.branch_id == tenant_ctx.branch_id
            )
        )
        if existing_barcode.scalars().first():
            raise HTTPException(status_code=400, detail=f"Barcode '{update_data['barcode']}' is already in use by another product")

    return await repo.update(product, update_data)


@router.delete(
    "/{product_id}",
    dependencies=[Depends(require_permission("item_master", "DELETE"))],
)
async def delete_product(
    product_id: str,
    db: AsyncSession = Depends(get_company_db),
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
    dependencies=[Depends(require_role(UserRole.MANAGER, UserRole.SYSADMIN))],
)
async def add_secondary_barcode(
    product_id: str,
    barcode_in: dict,
    db: AsyncSession = Depends(get_company_db),
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
    dependencies=[Depends(require_role(UserRole.MANAGER, UserRole.SYSADMIN))],
)
async def delete_secondary_barcode(
    product_id: str,
    value: str,
    db: AsyncSession = Depends(get_company_db),
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
    dependencies=[Depends(require_role(UserRole.MANAGER, UserRole.SYSADMIN))],
)
async def upload_product_image(
    product_id: str,
    payload: dict = Body(...),
    db: AsyncSession = Depends(get_company_db),
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
    dependencies=[Depends(require_role(UserRole.MANAGER, UserRole.SYSADMIN))],
)
async def delete_product_image(
    product_id: str,
    db: AsyncSession = Depends(get_company_db),
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
    dependencies=[Depends(require_role(UserRole.MANAGER, UserRole.SYSADMIN))],
)
async def add_gallery_image(
    product_id: str,
    payload: dict = Body(...),
    db: AsyncSession = Depends(get_company_db),
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
    dependencies=[Depends(require_role(UserRole.MANAGER, UserRole.SYSADMIN))],
)
async def delete_gallery_image(
    product_id: str,
    filename: str,
    db: AsyncSession = Depends(get_company_db),
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
