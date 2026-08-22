"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.16.0
Created      : 2026-08-22
Modified     : 2026-08-22
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import uuid
from typing import List, Optional, Any
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, Query, Header
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from ...api.deps import (
    get_company_db, get_tenant_context, TenantContext,
    require_role, require_permission
)
from ...models.auth import UserRole
from ...models.inventory import Warehouse, ProductBatchStock, StockTransfer, StockTransferItem, StockAudit, StockAuditItem
from ...schemas.wms import (
    WarehouseCreate, WarehouseUpdate, WarehouseResponse,
    ProductBatchStockResponse, BatchAllocationRequest, BatchAllocationItem,
    StockTransferCreate, StockTransferResponse, StockTransferReceiptRequest,
    StockAuditCreate, StockAuditResponse, StockAuditItemResponse,
    StockAuditCountItemRequest, StockAuditBulkCountRequest, StockAuditBarcodeScanRequest
)
from ...services.inventory_wms_service import InventoryWmsService
from ...services.eway_bill_service import EWayBillService
from ...services.stock_audit_service import StockAuditService

router = APIRouter()


# ─────────────────────────── Warehouse Masters ───────────────────────────

@router.get("/warehouses", response_model=List[WarehouseResponse])
async def list_warehouses(
    db: AsyncSession = Depends(get_company_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """List all warehouses for the active company tenant."""
    q = select(Warehouse).where(
        Warehouse.company_id == tenant_ctx.company_id,
        Warehouse.is_deleted == False
    ).order_by(Warehouse.created_at.asc())
    res = await db.execute(q)
    return [WarehouseResponse.model_validate(w) for w in res.scalars().all()]


@router.post("/warehouses", response_model=WarehouseResponse, status_code=201)
async def create_warehouse(
    req: WarehouseCreate,
    db: AsyncSession = Depends(get_company_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
    guard: Any = Depends(require_permission("inventory_workspace", "ADD")),
):
    """Create a new warehouse / godown under the active company tenant."""
    # Check scoped code uniqueness
    q_exist = select(Warehouse).where(
        Warehouse.company_id == tenant_ctx.company_id,
        Warehouse.code == req.code,
        Warehouse.is_deleted == False
    )
    res_exist = await db.execute(q_exist)
    if res_exist.scalars().first():
        raise HTTPException(status_code=400, detail=f"Warehouse code '{req.code}' already exists in this company.")

    wh = Warehouse(
        id=f"wh-{uuid.uuid4().hex[:12]}",
        uuid=str(uuid.uuid4()),
        company_id=tenant_ctx.company_id,
        branch_id=tenant_ctx.branch_id,
        code=req.code,
        name=req.name,
        is_transit=req.is_transit,
        is_central_godown=req.is_central_godown,
        address=req.address,
        city=req.city,
        state=req.state,
        pincode=req.pincode,
        contact_person=req.contact_person,
        phone=req.phone,
    )
    db.add(wh)
    await db.commit()
    await db.refresh(wh)
    return WarehouseResponse.model_validate(wh)


@router.get("/warehouses/{warehouse_id}", response_model=WarehouseResponse)
async def get_warehouse(
    warehouse_id: str,
    db: AsyncSession = Depends(get_company_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Get warehouse details by ID."""
    q = select(Warehouse).where(
        Warehouse.id == warehouse_id,
        Warehouse.company_id == tenant_ctx.company_id,
        Warehouse.is_deleted == False
    )
    res = await db.execute(q)
    wh = res.scalars().first()
    if not wh:
        raise HTTPException(status_code=404, detail="Warehouse not found.")
    return WarehouseResponse.model_validate(wh)


@router.put("/warehouses/{warehouse_id}", response_model=WarehouseResponse)
async def update_warehouse(
    warehouse_id: str,
    req: WarehouseUpdate,
    db: AsyncSession = Depends(get_company_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
    guard: Any = Depends(require_permission("inventory_workspace", "EDIT")),
):
    """Update warehouse details."""
    q = select(Warehouse).where(
        Warehouse.id == warehouse_id,
        Warehouse.company_id == tenant_ctx.company_id,
        Warehouse.is_deleted == False
    )
    res = await db.execute(q)
    wh = res.scalars().first()
    if not wh:
        raise HTTPException(status_code=404, detail="Warehouse not found.")

    update_data = req.model_dump(exclude_unset=True)
    for k, v in update_data.items():
        setattr(wh, k, v)

    await db.commit()
    await db.refresh(wh)
    return WarehouseResponse.model_validate(wh)


# ─────────────────────────── Batch Stock & FEFO ───────────────────────────

@router.get("/batch-stocks", response_model=List[ProductBatchStockResponse])
async def list_batch_stocks(
    product_id: Optional[str] = Query(None),
    warehouse_id: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_company_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """List live batch stock records for active company."""
    q = select(ProductBatchStock).where(
        ProductBatchStock.company_id == tenant_ctx.company_id,
        ProductBatchStock.is_deleted == False
    )
    if product_id:
        q = q.where(ProductBatchStock.product_id == product_id)
    if warehouse_id:
        q = q.where(ProductBatchStock.warehouse_id == warehouse_id)

    q = q.order_by(ProductBatchStock.expiry_date.asc().nulls_last())
    res = await db.execute(q)
    items = res.scalars().all()

    resp = []
    for it in items:
        avail = Decimal(str(it.quantity)) - Decimal(str(it.reserved_quantity)) - Decimal(str(it.damaged_quantity))
        dto = ProductBatchStockResponse.model_validate(it)
        dto.available_quantity = avail
        resp.append(dto)
    return resp


@router.post("/allocate-fefo", response_model=List[BatchAllocationItem])
async def allocate_batches_fefo(
    req: BatchAllocationRequest,
    db: AsyncSession = Depends(get_company_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Allocate product quantities from available batches using FEFO ordering."""
    service = InventoryWmsService(db, tenant_ctx)
    allocations = await service.allocate_stock_fefo(
        product_id=req.product_id,
        warehouse_id=req.warehouse_id,
        requested_qty=req.quantity
    )
    return [BatchAllocationItem(**a) for a in allocations]


# ─────────────────────────── Stock Transfer Orders (STO) ───────────────────────────

@router.get("/transfers", response_model=List[StockTransferResponse])
async def list_transfers(
    status: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_company_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """List all stock transfers for the company."""
    q = select(StockTransfer).where(
        StockTransfer.company_id == tenant_ctx.company_id,
        StockTransfer.is_deleted == False
    ).options(selectinload(StockTransfer.items))
    if status:
        q = q.where(StockTransfer.status == status)

    q = q.order_by(StockTransfer.created_at.desc())
    res = await db.execute(q)
    return [StockTransferResponse.model_validate(st) for st in res.scalars().all()]


@router.post("/transfers", response_model=StockTransferResponse, status_code=201)
async def create_transfer(
    req: StockTransferCreate,
    db: AsyncSession = Depends(get_company_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
    idempotency_key: Optional[str] = Header(None, alias="Idempotency-Key"),
    guard: Any = Depends(require_permission("stock_ledger", "ADD")),
):
    """Create a new Stock Transfer Order in DRAFT status."""
    service = InventoryWmsService(db, tenant_ctx)
    items_dict = [it.model_dump() for it in req.items]
    transfer = await service.create_stock_transfer(
        source_warehouse_id=req.source_warehouse_id,
        dest_warehouse_id=req.dest_warehouse_id,
        items_in=items_dict,
        transporter_name=req.transporter_name,
        lr_number=req.lr_number,
        vehicle_number=req.vehicle_number,
        e_way_bill_no=req.e_way_bill_no,
        notes=req.notes,
        idempotency_key=idempotency_key,
    )
    await db.commit()
    
    # Reload with items
    q_re = select(StockTransfer).where(StockTransfer.id == transfer.id).options(selectinload(StockTransfer.items))
    res_re = await db.execute(q_re)
    reloaded = res_re.scalars().first()
    return StockTransferResponse.model_validate(reloaded)


@router.get("/transfers/{transfer_id}", response_model=StockTransferResponse)
async def get_transfer(
    transfer_id: str,
    db: AsyncSession = Depends(get_company_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Get stock transfer details with line items."""
    q = select(StockTransfer).where(
        StockTransfer.id == transfer_id,
        StockTransfer.company_id == tenant_ctx.company_id,
        StockTransfer.is_deleted == False
    ).options(selectinload(StockTransfer.items))
    res = await db.execute(q)
    st = res.scalars().first()
    if not st:
        raise HTTPException(status_code=404, detail="Stock transfer not found.")
    return StockTransferResponse.model_validate(st)


@router.post("/transfers/{transfer_id}/dispatch", response_model=StockTransferResponse)
async def dispatch_transfer(
    transfer_id: str,
    db: AsyncSession = Depends(get_company_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
    guard: Any = Depends(require_permission("stock_ledger", "ADD")),
):
    """Dispatch a stock transfer from the source warehouse into IN_TRANSIT."""
    service = InventoryWmsService(db, tenant_ctx)
    transfer = await service.dispatch_stock_transfer(transfer_id)
    await db.commit()
    
    q_re = select(StockTransfer).where(StockTransfer.id == transfer.id).options(selectinload(StockTransfer.items))
    res_re = await db.execute(q_re)
    reloaded = res_re.scalars().first()
    return StockTransferResponse.model_validate(reloaded)


@router.post("/transfers/{transfer_id}/receive", response_model=StockTransferResponse)
async def receive_transfer(
    transfer_id: str,
    req: StockTransferReceiptRequest,
    db: AsyncSession = Depends(get_company_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
    guard: Any = Depends(require_permission("stock_ledger", "ADD")),
):
    """Receive a stock transfer at the destination warehouse with shortage/damage reconciliation."""
    service = InventoryWmsService(db, tenant_ctx)
    receipt_items = [r.model_dump() for r in req.receipt_details]
    transfer = await service.receive_stock_transfer(transfer_id, receipt_items)
    await db.commit()
    
    q_re = select(StockTransfer).where(StockTransfer.id == transfer.id).options(selectinload(StockTransfer.items))
    res_re = await db.execute(q_re)
    reloaded = res_re.scalars().first()
    return StockTransferResponse.model_validate(reloaded)


# ─────────────────────────── E-Way Bill & Delivery Challan ───────────────────────────

@router.get(
    "/transfers/{transfer_id}/eway-bill-payload",
    dependencies=[Depends(require_permission("stock_ledger", "VIEW"))],
)
async def get_transfer_eway_bill_payload(
    transfer_id: str,
    distance_km: int = Query(50, ge=1, le=4000),
    trans_mode: str = Query("1"),
    strict_validation: Optional[bool] = Query(None),
    db: AsyncSession = Depends(get_company_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Generate official GST NIC E-Way Bill JSON payload for Inter-Godown Stock Transfer."""
    service = EWayBillService(db, tenant_ctx)
    return await service.generate_transfer_eway_bill_payload(
        transfer_id=transfer_id,
        trans_distance_km=distance_km,
        trans_mode=trans_mode,
        strict_validation=strict_validation
    )


@router.get(
    "/transfers/{transfer_id}/delivery-challan",
    dependencies=[Depends(require_permission("stock_ledger", "VIEW"))],
)
async def get_transfer_delivery_challan(
    transfer_id: str,
    strict_validation: Optional[bool] = Query(None),
    db: AsyncSession = Depends(get_company_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Generate statutory Delivery Challan (Rule 55 CGST Rules 2017) for Inter-Godown Stock Transfer."""
    service = EWayBillService(db, tenant_ctx)
    return await service.generate_delivery_challan(
        transfer_id=transfer_id,
        strict_validation=strict_validation
    )


@router.post(
    "/transfers/{transfer_id}/transporter",
    dependencies=[Depends(require_permission("stock_ledger", "EDIT"))],
)
@router.put(
    "/transfers/{transfer_id}/transporter",
    dependencies=[Depends(require_permission("stock_ledger", "EDIT"))],
)
async def update_transfer_transporter(
    transfer_id: str,
    transporter_name: Optional[str] = Query(None),
    vehicle_number: Optional[str] = Query(None),
    lr_number: Optional[str] = Query(None),
    e_way_bill_no: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_company_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Update transporter logistics and E-Way Bill metadata on a stock transfer."""
    q = select(StockTransfer).where(
        StockTransfer.id == transfer_id,
        StockTransfer.company_id == tenant_ctx.company_id,
        StockTransfer.is_deleted == False
    )
    res = await db.execute(q)
    st = res.scalars().first()
    if not st:
        raise HTTPException(status_code=404, detail="Stock transfer not found.")
    
    if transporter_name is not None:
        st.transporter_name = transporter_name
    if vehicle_number is not None:
        st.vehicle_number = vehicle_number
    if lr_number is not None:
        st.lr_number = lr_number
    if e_way_bill_no is not None:
        st.e_way_bill_no = e_way_bill_no

    await db.commit()
    await db.refresh(st)
    return StockTransferResponse.model_validate(st)


# ─────────────────────────── Physical Stock Audit & Reconciliation ───────────────────────────

@router.get(
    "/audits",
    response_model=List[StockAuditResponse],
    dependencies=[Depends(require_permission("stock_ledger", "VIEW"))],
)
async def list_stock_audits(
    warehouse_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_company_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """List physical stock audits for the company."""
    service = StockAuditService(db, tenant_ctx)
    audits = await service.list_stock_audits(warehouse_id=warehouse_id, status=status, limit=limit)
    return [StockAuditResponse.model_validate(a) for a in audits]


@router.post(
    "/audits",
    response_model=StockAuditResponse,
    status_code=201,
    dependencies=[Depends(require_permission("stock_ledger", "EDIT"))],
)
async def create_stock_audit(
    req: StockAuditCreate,
    db: AsyncSession = Depends(get_company_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Initiate a new physical stock audit by snapshotting active batch balances."""
    service = StockAuditService(db, tenant_ctx)
    audit = await service.create_stock_audit(
        warehouse_id=req.warehouse_id,
        audit_type=req.audit_type,
        notes=req.notes
    )
    return StockAuditResponse.model_validate(audit)


@router.get(
    "/audits/{audit_id}",
    response_model=StockAuditResponse,
    dependencies=[Depends(require_permission("stock_ledger", "VIEW"))],
)
async def get_stock_audit(
    audit_id: str,
    db: AsyncSession = Depends(get_company_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Fetch details and item variance list for a specific stock audit."""
    service = StockAuditService(db, tenant_ctx)
    audit = await service.get_stock_audit(audit_id)
    if not audit:
        raise HTTPException(status_code=404, detail=f"Stock audit {audit_id} not found.")
    return StockAuditResponse.model_validate(audit)


@router.post(
    "/audits/{audit_id}/count",
    response_model=StockAuditItemResponse,
    dependencies=[Depends(require_permission("stock_ledger", "EDIT"))],
)
async def record_audit_item_count(
    audit_id: str,
    req: StockAuditCountItemRequest,
    db: AsyncSession = Depends(get_company_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Record physical count for a specific line item in a stock audit."""
    service = StockAuditService(db, tenant_ctx)
    item = await service.record_item_count(
        audit_id=audit_id,
        item_id=req.item_id,
        counted_qty=float(req.counted_qty),
        discrepancy_reason=req.discrepancy_reason,
        notes=req.notes
    )
    return StockAuditItemResponse.model_validate(item)


@router.post(
    "/audits/{audit_id}/scan",
    dependencies=[Depends(require_permission("stock_ledger", "EDIT"))],
)
async def scan_barcode_for_audit(
    audit_id: str,
    req: StockAuditBarcodeScanRequest,
    db: AsyncSession = Depends(get_company_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Rapid barcode scan action to increment counted quantity during physical audit."""
    service = StockAuditService(db, tenant_ctx)
    return await service.scan_barcode_increment(
        audit_id=audit_id,
        barcode_or_sku=req.barcode_or_sku,
        qty_increment=float(req.qty_increment or 1.0),
        batch_no=req.batch_no
    )


@router.post(
    "/audits/{audit_id}/reconcile",
    response_model=StockAuditResponse,
    dependencies=[Depends(require_permission("stock_ledger", "EDIT"))],
)
async def reconcile_stock_audit(
    audit_id: str,
    db: AsyncSession = Depends(get_company_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Reconcile stock audit, post batch adjustments and ledger movements, and mark COMPLETED."""
    service = StockAuditService(db, tenant_ctx)
    audit = await service.reconcile_and_post_discrepancies(audit_id=audit_id)
    return StockAuditResponse.model_validate(audit)


