"""
Project      : SMRITI Retail OS
Organization : SmritiSys
Module       : SCDM — SMRITI Channel Distribution Management REST API (v1.0)
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 1.0.0
Created      : 2026-07-30
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software

REST API Endpoints for SCDM:
  - Channel Locations (Customer DC/Store/Dept hierarchy)
  - Channel Dispatches (view & filter dispatches auto-created from SalesInvoices)
  - Stock Projection (derived from immutable ChannelStockMovement ledger)
  - Visibility KPIs (Days of cover, sell-through %, ageing buckets)
  - Reconciliation (Opening + Dispatch - Sellout - Returns = Closing)
  - Replenishment Suggestions
  - Sell-Out Import Engine (Upload, list, & process import jobs)
"""

from typing import List, Optional
from datetime import date, datetime
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Form, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.db.session import get_db
from app.api.deps import get_tenant_context, TenantContext
from app.services.scdm_service import SCDMService
from app.models.scdm import (
    ChannelLocation,
    ChannelDispatch,
    SellOutImport,
    SellOutImportLine,
    SellOutSource,
    ImportStatus,
)

router = APIRouter(prefix="/scdm", tags=["scdm"])


# ─────────────────────────────────────────────────────────────────────────────
# Pydantic Schemas for SCDM
# ─────────────────────────────────────────────────────────────────────────────

class ChannelLocationCreate(BaseModel):
    customer_id: str
    parent_id: Optional[str] = None
    code: str
    name: str
    location_type: str = "Store"  # Store | DC | Department | Region
    address_line1: Optional[str] = None
    address_city: Optional[str] = None
    address_state: Optional[str] = None
    address_pin: Optional[str] = None
    gst_number: Optional[str] = None
    notes: Optional[str] = None


class SellOutImportLineCreate(BaseModel):
    source_barcode: Optional[str] = None
    source_sku: Optional[str] = None
    source_item_name: Optional[str] = None
    batch_no: Optional[str] = None
    qty_sold: float
    mrp: Optional[float] = None
    selling_price: Optional[float] = None
    sales_value: Optional[float] = None
    transaction_date: Optional[date] = None


class SellOutImportCreate(BaseModel):
    customer_id: str
    channel_location_id: Optional[str] = None
    import_source: str = "Manual"  # Manual | Excel | CSV | API | EDI | POSFeed
    period_from: Optional[date] = None
    period_to: Optional[date] = None
    notes: Optional[str] = None
    lines: List[SellOutImportLineCreate] = []


# ─────────────────────────────────────────────────────────────────────────────
# Endpoints
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/locations", summary="List channel locations for a customer")
async def list_channel_locations(
    customer_id: str = Query(...),
    db: AsyncSession = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    stmt = (
        select(ChannelLocation)
        .where(
            ChannelLocation.customer_id == customer_id,
            ChannelLocation.is_deleted == False,
        )
        .order_by(ChannelLocation.code)
    )
    res = await db.execute(stmt)
    locations = res.scalars().all()
    return locations


@router.post("/locations", summary="Create a new channel location (DC/Store/Dept)")
async def create_channel_location(
    loc_in: ChannelLocationCreate,
    db: AsyncSession = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    loc_id = f"scdm-loc-{loc_in.code.lower()}"
    location = ChannelLocation(
        id=loc_id,
        customer_id=loc_in.customer_id,
        parent_id=loc_in.parent_id,
        code=loc_in.code,
        name=loc_in.name,
        location_type=loc_in.location_type,
        address_line1=loc_in.address_line1,
        address_city=loc_in.address_city,
        address_state=loc_in.address_state,
        address_pin=loc_in.address_pin,
        gst_number=loc_in.gst_number,
        notes=loc_in.notes,
        tenant_id=getattr(tenant_ctx, "tenant_id", None),
        company_id=getattr(tenant_ctx, "company_id", None),
        branch_id=getattr(tenant_ctx, "branch_id", None),
    )
    db.add(location)
    await db.commit()
    await db.refresh(location)
    return location


@router.get("/dispatches", summary="List channel dispatches")
async def list_channel_dispatches(
    customer_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    limit: int = Query(50, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    stmt = select(ChannelDispatch).where(ChannelDispatch.is_deleted == False)
    if customer_id:
        stmt = stmt.where(ChannelDispatch.customer_id == customer_id)
    if status:
        stmt = stmt.where(ChannelDispatch.status == status)
    stmt = stmt.order_by(ChannelDispatch.dispatch_date.desc()).limit(limit).offset(offset)

    res = await db.execute(stmt)
    dispatches = res.scalars().all()
    return dispatches


@router.get("/dispatches/{dispatch_id}", summary="Get channel dispatch details")
async def get_channel_dispatch(
    dispatch_id: str,
    db: AsyncSession = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    stmt = select(ChannelDispatch).where(
        ChannelDispatch.id == dispatch_id,
        ChannelDispatch.is_deleted == False,
    )
    res = await db.execute(stmt)
    dispatch = res.scalars().first()
    if not dispatch:
        raise HTTPException(status_code=404, detail="Channel dispatch not found")
    return dispatch


@router.get("/projection/{customer_id}", summary="Get current channel stock projection")
async def get_channel_stock_projection(
    customer_id: str,
    product_id: Optional[str] = Query(None),
    location_id: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    svc = SCDMService(db, tenant_ctx)
    return await svc.get_stock_projection(
        customer_id=customer_id,
        product_id=product_id,
        channel_location_id=location_id,
    )


@router.get("/kpis/{customer_id}", summary="Get SCDM visibility KPIs")
async def get_channel_visibility_kpis(
    customer_id: str,
    db: AsyncSession = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    svc = SCDMService(db, tenant_ctx)
    return await svc.get_visibility_kpis(customer_id)


@router.get("/reconciliation/{customer_id}", summary="Get quantity and value reconciliation")
async def get_channel_reconciliation(
    customer_id: str,
    product_id: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    svc = SCDMService(db, tenant_ctx)
    return await svc.reconcile(customer_id, product_id=product_id)


@router.get("/replenishment/{customer_id}", summary="Get replenishment suggestions")
async def get_replenishment_suggestions(
    customer_id: str,
    db: AsyncSession = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    svc = SCDMService(db, tenant_ctx)
    return await svc.get_replenishment_suggestions(customer_id)


@router.post("/sellout-imports", summary="Create a sell-out import job")
async def create_sellout_import(
    import_in: SellOutImportCreate,
    db: AsyncSession = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    import_no = f"SO-IMP-{int(datetime.now().timestamp())}"
    import_id = f"scdm-soi-{import_no}"

    import_job = SellOutImport(
        id=import_id,
        import_no=import_no,
        customer_id=import_in.customer_id,
        channel_location_id=import_in.channel_location_id,
        import_source=import_in.import_source,
        import_date=date.today(),
        period_from=import_in.period_from,
        period_to=import_in.period_to,
        status=ImportStatus.PENDING.value,
        total_lines=len(import_in.lines),
        notes=import_in.notes,
        tenant_id=getattr(tenant_ctx, "tenant_id", None),
        company_id=getattr(tenant_ctx, "company_id", None),
        branch_id=getattr(tenant_ctx, "branch_id", None),
    )

    db.add(import_job)

    for line_in in import_in.lines:
        line_id = f"scdm-soil-{import_no}-{len(import_job.lines)}"
        line = SellOutImportLine(
            id=line_id,
            import_id=import_id,
            source_barcode=line_in.source_barcode,
            source_sku=line_in.source_sku,
            source_item_name=line_in.source_item_name,
            batch_no=line_in.batch_no,
            qty_sold=Decimal(str(line_in.qty_sold)),
            mrp=Decimal(str(line_in.mrp)) if line_in.mrp is not None else None,
            selling_price=Decimal(str(line_in.selling_price)) if line_in.selling_price is not None else None,
            sales_value=Decimal(str(line_in.sales_value)) if line_in.sales_value is not None else None,
            transaction_date=line_in.transaction_date or date.today(),
            line_status="Pending",
            tenant_id=getattr(tenant_ctx, "tenant_id", None),
        )
        db.add(line)

    await db.commit()
    await db.refresh(import_job)
    return import_job


@router.get("/sellout-imports", summary="List sell-out import jobs")
async def list_sellout_imports(
    customer_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    stmt = select(SellOutImport).where(SellOutImport.is_deleted == False)
    if customer_id:
        stmt = stmt.where(SellOutImport.customer_id == customer_id)
    if status:
        stmt = stmt.where(SellOutImport.status == status)
    stmt = stmt.order_by(SellOutImport.created_at.desc())

    res = await db.execute(stmt)
    return res.scalars().all()


@router.post("/sellout-imports/{import_id}/process", summary="Process pending sell-out import job")
async def process_sellout_import(
    import_id: str,
    db: AsyncSession = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    svc = SCDMService(db, tenant_ctx)
    res = await svc.process_sellout_import(import_id)
    await db.commit()
    return res



# ─────────────────────────────────────────────────────────────────────────────
# Claims & Settlement Endpoints (SCDM v1.1 — ADR-0016)
# ─────────────────────────────────────────────────────────────────────────────

class ClaimSubmitRequest(BaseModel):
    customer_id: str
    claim_category: str
    claimed_amount: Decimal
    dispatch_id: Optional[str] = None
    claim_type_id: Optional[str] = None
    reference_doc_no: Optional[str] = None
    reason: Optional[str] = None
    attachments_json: Optional[dict] = None


class ClaimApproveRequest(BaseModel):
    approved_amount: Decimal
    approved_by: str = "Admin"


class ClaimRejectRequest(BaseModel):
    rejection_reason: str
    reviewed_by: str = "Admin"


class SettlementCreateRequest(BaseModel):
    customer_id: str
    remittance_ref: str
    gross_dispatch_value: Decimal
    total_deductions: Decimal
    net_received_amount: Decimal
    lines_data: Optional[list[dict]] = None


@router.get("/claim-types", summary="List active claim types")
async def list_claim_types(
    db: AsyncSession = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    svc = SCDMService(db, tenant_ctx)
    return await svc.list_claim_types()


@router.get("/claims", summary="List retailer claims")
async def list_claims(
    customer_id: Optional[str] = Query(None),
    dispatch_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    svc = SCDMService(db, tenant_ctx)
    return await svc.list_claims(customer_id, dispatch_id, status)


@router.post("/claims", summary="Submit a retailer claim")
async def submit_claim(
    req: ClaimSubmitRequest,
    db: AsyncSession = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    svc = SCDMService(db, tenant_ctx)
    claim = await svc.submit_retailer_claim(
        customer_id=req.customer_id,
        claim_category=req.claim_category,
        claimed_amount=req.claimed_amount,
        dispatch_id=req.dispatch_id,
        claim_type_id=req.claim_type_id,
        reference_doc_no=req.reference_doc_no,
        reason=req.reason,
        attachments_json=req.attachments_json,
        created_by=getattr(tenant_ctx, "user_id", "system"),
    )
    await db.commit()
    return claim


@router.post("/claims/{claim_id}/approve", summary="Approve a claim")
async def approve_claim(
    claim_id: str,
    req: ClaimApproveRequest,
    db: AsyncSession = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    svc = SCDMService(db, tenant_ctx)
    claim = await svc.approve_claim(claim_id, req.approved_amount, req.approved_by)
    await db.commit()
    return claim


@router.post("/claims/{claim_id}/reject", summary="Reject a claim")
async def reject_claim(
    claim_id: str,
    req: ClaimRejectRequest,
    db: AsyncSession = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    svc = SCDMService(db, tenant_ctx)
    claim = await svc.reject_claim(claim_id, req.rejection_reason, req.reviewed_by)
    await db.commit()
    return claim


@router.get("/settlements", summary="List settlements")
async def list_settlements(
    customer_id: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    svc = SCDMService(db, tenant_ctx)
    return await svc.list_settlements(customer_id)


@router.post("/settlements", summary="Create a remittance settlement")
async def create_settlement(
    req: SettlementCreateRequest,
    db: AsyncSession = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    svc = SCDMService(db, tenant_ctx)
    stl = await svc.create_settlement(
        customer_id=req.customer_id,
        remittance_ref=req.remittance_ref,
        gross_dispatch_value=req.gross_dispatch_value,
        total_deductions=req.total_deductions,
        net_received_amount=req.net_received_amount,
        lines_data=req.lines_data,
        created_by=getattr(tenant_ctx, "user_id", "system"),
    )
    await db.commit()
    return stl


@router.post("/settlements/{settlement_id}/reconcile", summary="Reconcile settlement")
async def reconcile_settlement(
    settlement_id: str,
    db: AsyncSession = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    svc = SCDMService(db, tenant_ctx)
    stl = await svc.reconcile_settlement(settlement_id)
    await db.commit()
    return stl

