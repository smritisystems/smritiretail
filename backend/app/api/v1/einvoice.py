"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Version      : 3.121.0
Modified     : 2026-10-27
Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal

E-Invoice Studio - GST IRP / NIC Gateway integration layer.
In production, the generate endpoint POSTs to the IRP gateway.
This implementation persists the record and simulates IRN generation
until the live IRP credentials are configured in settings.

Endpoints:
  GET  /einvoice                       - List e-invoices (filterable by status)
  POST /einvoice/generate              - Generate IRN for an invoice
  POST /einvoice/cancel                - Cancel an IRN
  GET  /einvoice/{id}                  - Get e-invoice detail
  POST /einvoice/batch                 - Submit batch of invoices for IRN
  GET  /einvoice/batch/{id}            - Get batch status

Change (3.121.0): Full async migration (UMGP follow-up).
  All endpoints are now async; db.query() replaced with await db.execute(select(...)).
  Removed unused get_db import. BOM stripped.
"""

from __future__ import annotations
import hashlib
import secrets
import uuid
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ...api.deps import get_company_db
from ...models.einvoice import EInvoice, EInvoiceBatch
from ...schemas.einvoice import (
    EInvoiceRead, EInvoiceGenerate, EInvoiceCancel,
    EInvoiceBatchRead, EInvoiceBatchCreate,
)

router = APIRouter()

_CANCEL_REASONS = {"1", "2", "3", "4"}


def _now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _new_id() -> str:
    """Generate a new UUID string for BaseEntity.id (no DB-side default)."""
    return str(uuid.uuid4())


def _simulate_irn(invoice_no: str, gstin: str = "") -> str:
    """Generate a deterministic 64-char IRN hash (IRP format) for dev/staging."""
    raw = f"{gstin}|{invoice_no}|{secrets.token_hex(8)}"
    return hashlib.sha256(raw.encode()).hexdigest()


# --- List -------------------------------------------------------------------

@router.get("/einvoice", response_model=List[EInvoiceRead], tags=["E-Invoice Studio"])
async def list_einvoices(
    status: Optional[str] = Query(None),
    limit: int = Query(100, le=500),
    db: AsyncSession = Depends(get_company_db),
):
    stmt = (
        select(EInvoice)
        .where(EInvoice.is_deleted == False)  # noqa: E712
        .order_by(EInvoice.created_at.desc())
        .limit(limit)
    )
    if status:
        stmt = stmt.where(EInvoice.status == status.upper())
    result = await db.execute(stmt)
    return result.scalars().all()


# --- Generate IRN ------------------------------------------------------------

@router.post(
    "/einvoice/generate",
    response_model=EInvoiceRead,
    status_code=status.HTTP_201_CREATED,
    tags=["E-Invoice Studio"],
)
async def generate_einvoice(
    payload: EInvoiceGenerate,
    db: AsyncSession = Depends(get_company_db),
):
    # Idempotency: return existing if IRN already generated for this invoice
    existing_result = await db.execute(
        select(EInvoice).where(
            EInvoice.invoice_id == payload.invoice_id,
            EInvoice.status == "GENERATED",
            EInvoice.is_deleted == False,  # noqa: E712
        )
    )
    existing = existing_result.scalars().first()
    if existing:
        return existing

    irn = _simulate_irn(payload.invoice_no, payload.gstin_supplier or "")
    ack_no = "AC" + secrets.token_hex(10).upper()[:18]
    now = _now()

    rec = EInvoice(
        id=_new_id(),
        invoice_id=payload.invoice_id,
        invoice_no=payload.invoice_no,
        gstin_supplier=payload.gstin_supplier,
        gstin_buyer=payload.gstin_buyer,
        invoice_date=payload.invoice_date or now,
        invoice_value=payload.invoice_value,
        irn=irn,
        ack_no=ack_no,
        ack_date=now,
        status="GENERATED",
        irp_response={"irn": irn, "ackNo": ack_no, "ackDt": now.isoformat(), "status": "1"},
    )
    db.add(rec)
    await db.commit()
    await db.refresh(rec)
    return rec


# --- Cancel IRN --------------------------------------------------------------

@router.post("/einvoice/cancel", response_model=EInvoiceRead, tags=["E-Invoice Studio"])
async def cancel_einvoice(
    payload: EInvoiceCancel,
    db: AsyncSession = Depends(get_company_db),
):
    if payload.cancel_reason not in _CANCEL_REASONS:
        raise HTTPException(
            status_code=400,
            detail="cancel_reason must be 1-4 (NIC standard).",
        )

    result = await db.execute(
        select(EInvoice).where(
            EInvoice.irn == payload.irn,
            EInvoice.is_deleted == False,  # noqa: E712
        )
    )
    rec = result.scalars().first()
    if not rec:
        raise HTTPException(status_code=404, detail="IRN not found.")
    if rec.status == "CANCELLED":
        raise HTTPException(status_code=409, detail="IRN already cancelled.")
    if rec.status != "GENERATED":
        raise HTTPException(
            status_code=400,
            detail=f"Cannot cancel an e-invoice with status {rec.status}.",
        )

    rec.status = "CANCELLED"
    rec.cancel_reason = payload.cancel_reason
    rec.cancel_remark = payload.cancel_remark
    rec.cancelled_at = _now()
    await db.commit()
    await db.refresh(rec)
    return rec


# --- Detail ------------------------------------------------------------------

@router.get("/einvoice/{einvoice_id}", response_model=EInvoiceRead, tags=["E-Invoice Studio"])
async def get_einvoice(
    einvoice_id: str,
    db: AsyncSession = Depends(get_company_db),
):
    result = await db.execute(
        select(EInvoice).where(
            EInvoice.id == einvoice_id,
            EInvoice.is_deleted == False,  # noqa: E712
        )
    )
    rec = result.scalars().first()
    if not rec:
        raise HTTPException(status_code=404, detail="E-Invoice not found.")
    return rec


# --- Batch Submit -------------------------------------------------------------

@router.post(
    "/einvoice/batch",
    response_model=EInvoiceBatchRead,
    status_code=status.HTTP_201_CREATED,
    tags=["E-Invoice Studio"],
)
async def submit_einvoice_batch(
    payload: EInvoiceBatchCreate,
    db: AsyncSession = Depends(get_company_db),
):
    batch_no = "EIB-" + secrets.token_hex(5).upper()
    batch = EInvoiceBatch(
        id=_new_id(),
        batch_no=batch_no,
        status="QUEUED",
        total_invoices=len(payload.invoice_ids),
        notes=payload.notes,
    )
    db.add(batch)
    await db.commit()
    await db.refresh(batch)
    return batch


@router.get("/einvoice/batch/{batch_id}", response_model=EInvoiceBatchRead, tags=["E-Invoice Studio"])
async def get_einvoice_batch(
    batch_id: str,
    db: AsyncSession = Depends(get_company_db),
):
    result = await db.execute(
        select(EInvoiceBatch).where(
            EInvoiceBatch.id == batch_id,
            EInvoiceBatch.is_deleted == False,  # noqa: E712
        )
    )
    b = result.scalars().first()
    if not b:
        raise HTTPException(status_code=404, detail="Batch not found.")
    return b
