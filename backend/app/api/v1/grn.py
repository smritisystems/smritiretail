"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 1.0.0
Created      : 2026-09-23
Modified     : 2026-09-23
Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
Target Router : Goods Receipt Note (GRN) CRUD API
"""

import uuid as _uuid
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import select, desc, func
from sqlalchemy.ext.asyncio import AsyncSession

from ...api.deps import get_db, get_current_user
from ...models.auth import User, UserRole
from ...models.goods_receipt import GoodsReceiptNote, GoodsReceiptLine

# smriti_capability(entity="PROCUREMENT", capability="GOODS_RECEIPT_NOTE", role="CANONICAL")

router = APIRouter(prefix="/grn", tags=["Goods Receipt Note"])

# ---------------------------------------------------------------------------
# Pydantic Schemas (inline — move to schemas/grn.py in Sprint 3)
# ---------------------------------------------------------------------------

class GRNLineCreate(BaseModel):
    product_id: str
    product_code: Optional[str] = None
    product_name: Optional[str] = None
    variant_id: Optional[str] = None
    barcode: Optional[str] = None
    hsn_code: Optional[str] = None
    batch_no: Optional[str] = None
    lot_no: Optional[str] = None
    serial_no: Optional[str] = None
    expiry_date: Optional[date] = None
    ordered_qty: Optional[Decimal] = None
    received_qty: Decimal = Decimal("0")
    rejected_qty: Decimal = Decimal("0")
    accepted_qty: Decimal = Decimal("0")
    uom: str = "NOS"
    unit_cost: Decimal = Decimal("0")
    discount_pct: Decimal = Decimal("0")
    discount_amt: Decimal = Decimal("0")
    taxable_value: Decimal = Decimal("0")
    gst_rate: Decimal = Decimal("0")
    cgst_amt: Decimal = Decimal("0")
    sgst_amt: Decimal = Decimal("0")
    igst_amt: Decimal = Decimal("0")
    total_value: Decimal = Decimal("0")
    landed_cost: Decimal = Decimal("0")
    po_id: Optional[str] = None
    po_line_id: Optional[str] = None
    po_unit_cost: Optional[Decimal] = None
    price_variance: Optional[Decimal] = None
    qty_variance: Optional[Decimal] = None
    qc_status: Optional[str] = None
    rejection_reason: Optional[str] = None


class GRNCreate(BaseModel):
    grn_number: Optional[str] = None          # Auto-generated if not provided
    vendor_id: str
    vendor_name: Optional[str] = None
    vendor_gstin: Optional[str] = None
    primary_po_id: Optional[str] = None
    grn_date: date
    received_date: Optional[date] = None
    invoice_date: Optional[date] = None
    invoice_no: Optional[str] = None
    vehicle_no: Optional[str] = None
    lr_no: Optional[str] = None
    lr_date: Optional[date] = None
    transporter: Optional[str] = None
    remarks: Optional[str] = None
    currency_code: str = "INR"
    lines: List[GRNLineCreate] = Field(default_factory=list)


class GRNLineResponse(BaseModel):
    id: str
    grn_id: str
    product_id: str
    product_code: Optional[str]
    product_name: Optional[str]
    barcode: Optional[str]
    hsn_code: Optional[str]
    batch_no: Optional[str]
    received_qty: Decimal
    rejected_qty: Decimal
    accepted_qty: Decimal
    uom: Optional[str]
    unit_cost: Decimal
    taxable_value: Decimal
    gst_rate: Decimal
    total_value: Decimal
    landed_cost: Decimal
    qc_status: Optional[str]
    po_id: Optional[str]
    price_variance: Optional[Decimal]
    qty_variance: Optional[Decimal]

    class Config:
        from_attributes = True


class GRNResponse(BaseModel):
    id: str
    uuid: str
    grn_number: str
    company_id: str
    branch_id: str
    vendor_id: str
    vendor_name: Optional[str]
    vendor_gstin: Optional[str]
    primary_po_id: Optional[str]
    grn_date: date
    received_date: Optional[date]
    invoice_date: Optional[date]
    invoice_no: Optional[str]
    status: str
    total_quantity: Decimal
    total_taxable: Decimal
    total_tax: Decimal
    total_landed: Decimal
    currency_code: str
    vehicle_no: Optional[str]
    lr_no: Optional[str]
    transporter: Optional[str]
    remarks: Optional[str]
    match_status: Optional[str]
    created_by: str
    created_at: datetime
    modified_at: datetime
    lines: List[GRNLineResponse] = []

    class Config:
        from_attributes = True


class GRNPostRequest(BaseModel):
    posted_by: Optional[str] = "system"


class GRNCancelRequest(BaseModel):
    cancelled_by: Optional[str] = "system"
    rejection_reason: Optional[str] = None


# ---------------------------------------------------------------------------
# RBAC helpers
# ---------------------------------------------------------------------------
_WRITE_ROLES = {UserRole.SYSADMIN, UserRole.MANAGER}


def _require_write(user: User) -> None:
    if not user or user.role not in _WRITE_ROLES:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "code": "SMRITI-PERM-005",
                "title": "Access Denied",
                "explanation": "Creating or modifying Goods Receipt Notes requires Manager or System Administrator privileges.",
                "suggested_action": "Contact your system administrator.",
            },
        )


# ---------------------------------------------------------------------------
# Utility
# ---------------------------------------------------------------------------

def _next_grn_number(company_id: str) -> str:
    """Generates a GRN document number. Replace with IdentityEngine in Sprint 3."""
    prefix = f"GRN/{datetime.now(timezone.utc).strftime('%Y-%m')}"
    short = _uuid.uuid4().hex[:6].upper()
    return f"{prefix}/{short}"


def _compute_grn_totals(lines: List[GRNLineCreate]) -> Dict[str, Decimal]:
    """Recalculates header totals from line items."""
    total_qty = sum(l.received_qty for l in lines)
    total_taxable = sum(l.taxable_value for l in lines)
    total_tax = sum(l.cgst_amt + l.sgst_amt + l.igst_amt for l in lines)
    total_landed = sum(l.landed_cost or l.total_value for l in lines)
    return {
        "total_quantity": total_qty,
        "total_taxable": total_taxable,
        "total_tax": total_tax,
        "total_landed": total_landed,
    }


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("", response_model=GRNResponse, status_code=status.HTTP_201_CREATED,
             summary="Create a new GRN in DRAFT status")
async def create_grn(
    req: GRNCreate,
    company_id: Optional[str] = Header(None, alias="x-company-id"),
    branch_id: Optional[str] = Header(None, alias="x-branch-id"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Creates a Goods Receipt Note in DRAFT status.
    Requires MANAGER or SYSADMIN role.
    """
    _require_write(current_user)
    if not company_id:
        raise HTTPException(status_code=400, detail="x-company-id header is required.")
    if not branch_id:
        raise HTTPException(status_code=400, detail="x-branch-id header is required.")

    grn_number = req.grn_number or _next_grn_number(company_id)

    # Ensure number is unique
    existing = await db.execute(
        select(GoodsReceiptNote).where(GoodsReceiptNote.grn_number == grn_number)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=409,
            detail={
                "code": "SMRITI-VAL-001",
                "title": "Duplicate GRN Number",
                "explanation": f"A Goods Receipt Note with number '{grn_number}' already exists.",
                "suggested_action": "Leave the GRN Number field blank for auto-generation.",
            },
        )

    totals = _compute_grn_totals(req.lines)
    username = getattr(current_user, "username", "system") or "system"

    grn = GoodsReceiptNote(
        id=str(_uuid.uuid4())[:12],
        uuid=str(_uuid.uuid4()),
        grn_number=grn_number,
        company_id=company_id,
        branch_id=branch_id,
        vendor_id=req.vendor_id,
        vendor_name=req.vendor_name,
        vendor_gstin=req.vendor_gstin,
        primary_po_id=req.primary_po_id,
        grn_date=req.grn_date,
        received_date=req.received_date,
        invoice_date=req.invoice_date,
        invoice_no=req.invoice_no,
        vehicle_no=req.vehicle_no,
        lr_no=req.lr_no,
        lr_date=req.lr_date,
        transporter=req.transporter,
        remarks=req.remarks,
        currency_code=req.currency_code,
        status="DRAFT",
        created_by=username,
        **totals,
    )

    for ln in req.lines:
        grn.lines.append(GoodsReceiptLine(
            id=str(_uuid.uuid4())[:12],
            **ln.model_dump(),
        ))

    db.add(grn)
    await db.commit()
    await db.refresh(grn)
    return grn


@router.get("", response_model=List[GRNResponse], summary="List GRNs with filters")
async def list_grns(
    status_filter: Optional[str] = Query(None, alias="status", description="DRAFT | POSTED | CANCELLED"),
    vendor_id: Optional[str] = Query(None),
    from_date: Optional[date] = Query(None),
    to_date: Optional[date] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    company_id: Optional[str] = Header(None, alias="x-company-id"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Returns paginated list of GRNs scoped to the caller's company."""
    stmt = select(GoodsReceiptNote).order_by(desc(GoodsReceiptNote.grn_date))
    if company_id:
        stmt = stmt.where(GoodsReceiptNote.company_id == company_id)
    if status_filter:
        stmt = stmt.where(GoodsReceiptNote.status == status_filter.upper())
    if vendor_id:
        stmt = stmt.where(GoodsReceiptNote.vendor_id == vendor_id)
    if from_date:
        stmt = stmt.where(GoodsReceiptNote.grn_date >= from_date)
    if to_date:
        stmt = stmt.where(GoodsReceiptNote.grn_date <= to_date)

    stmt = stmt.offset((page - 1) * limit).limit(limit)
    res = await db.execute(stmt)
    return res.scalars().all()


@router.get("/{grn_id}", response_model=GRNResponse, summary="Get a single GRN with lines")
async def get_grn(
    grn_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Returns a GRN and all its line items."""
    res = await db.execute(
        select(GoodsReceiptNote).where(GoodsReceiptNote.id == grn_id)
    )
    grn = res.scalar_one_or_none()
    if not grn:
        raise HTTPException(
            status_code=404,
            detail={
                "code": "SMRITI-DATA-002",
                "title": "GRN Not Found",
                "explanation": f"No Goods Receipt Note found with ID '{grn_id}'.",
                "suggested_action": "Verify the GRN reference and try again.",
            },
        )
    return grn


@router.post("/{grn_id}/post", response_model=GRNResponse, summary="Post a DRAFT GRN to inventory")
async def post_grn(
    grn_id: str,
    req: GRNPostRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Posts a DRAFT GRN. This finalises the inward stock movement.
    Requires MANAGER or SYSADMIN role.
    """
    _require_write(current_user)
    res = await db.execute(select(GoodsReceiptNote).where(GoodsReceiptNote.id == grn_id))
    grn = res.scalar_one_or_none()
    if not grn:
        raise HTTPException(status_code=404, detail="GRN not found.")
    if grn.status != "DRAFT":
        raise HTTPException(
            status_code=400,
            detail={
                "code": "SMRITI-VAL-002",
                "title": "Cannot Post GRN",
                "explanation": f"Only DRAFT GRNs can be posted. This GRN is in '{grn.status}' status.",
                "suggested_action": "Check the GRN status and resubmit.",
            },
        )

    grn.status = "POSTED"
    grn.posted_by = req.posted_by or getattr(current_user, "username", "system")
    grn.posted_at = datetime.now(timezone.utc)
    grn.modified_by = grn.posted_by

    await db.commit()
    await db.refresh(grn)
    return grn


@router.post("/{grn_id}/cancel", response_model=GRNResponse, summary="Cancel a GRN")
async def cancel_grn(
    grn_id: str,
    req: GRNCancelRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Cancels a GRN. Only DRAFT GRNs can be cancelled without a stock reversal.
    POSTED GRNs require manual stock adjustment before cancellation.
    Requires MANAGER or SYSADMIN role.
    """
    _require_write(current_user)
    res = await db.execute(select(GoodsReceiptNote).where(GoodsReceiptNote.id == grn_id))
    grn = res.scalar_one_or_none()
    if not grn:
        raise HTTPException(status_code=404, detail="GRN not found.")
    if grn.status == "CANCELLED":
        raise HTTPException(
            status_code=400,
            detail={
                "code": "SMRITI-VAL-003",
                "title": "Already Cancelled",
                "explanation": "This Goods Receipt Note has already been cancelled.",
                "suggested_action": "No action required.",
            },
        )

    grn.status = "CANCELLED"
    grn.cancelled_by = req.cancelled_by or getattr(current_user, "username", "system")
    grn.cancelled_at = datetime.now(timezone.utc)
    grn.rejection_reason = req.rejection_reason
    grn.modified_by = grn.cancelled_by

    await db.commit()
    await db.refresh(grn)
    return grn
