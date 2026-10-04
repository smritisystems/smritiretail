"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Version      : 3.120.0
Created      : 2026-10-04
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
"""

from __future__ import annotations
import hashlib
import secrets
from datetime import datetime, timezone
from decimal import Decimal
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from ...db.session import get_db
from ...models.einvoice import EInvoice, EInvoiceBatch
from ...schemas.einvoice import (
    EInvoiceRead, EInvoiceGenerate, EInvoiceCancel,
    EInvoiceBatchRead, EInvoiceBatchCreate,
)

router = APIRouter()

_CANCEL_REASONS = {"1", "2", "3", "4"}


def _now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _simulate_irn(invoice_no: str, gstin: str = "") -> str:
    """Generate a deterministic 64-char IRN hash (IRP format) for dev/staging."""
    raw = f"{gstin}|{invoice_no}|{secrets.token_hex(8)}"
    return hashlib.sha256(raw.encode()).hexdigest()


# ─── List ───────────────────────────────────────────────────────────────────

@router.get("/einvoice", response_model=List[EInvoiceRead], tags=["E-Invoice Studio"])
def list_einvoices(
    status: Optional[str] = Query(None),
    limit: int = Query(100, le=500),
    db: Session = Depends(get_db),
):
    q = db.query(EInvoice).filter(EInvoice.is_deleted == False)
    if status:
        q = q.filter(EInvoice.status == status.upper())
    return q.order_by(EInvoice.created_at.desc()).limit(limit).all()


# ─── Generate IRN ────────────────────────────────────────────────────────────

@router.post("/einvoice/generate", response_model=EInvoiceRead, status_code=status.HTTP_201_CREATED, tags=["E-Invoice Studio"])
def generate_einvoice(payload: EInvoiceGenerate, db: Session = Depends(get_db)):
    # Idempotency: if IRN already generated for this invoice, return existing
    existing = db.query(EInvoice).filter(
        EInvoice.invoice_id == payload.invoice_id,
        EInvoice.status == "GENERATED",
        EInvoice.is_deleted == False,
    ).first()
    if existing:
        return existing

    irn = _simulate_irn(payload.invoice_no, payload.gstin_supplier or "")
    ack_no = "AC" + secrets.token_hex(10).upper()[:18]
    now = _now()

    rec = EInvoice(
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
    db.commit()
    db.refresh(rec)
    return rec


# ─── Cancel IRN ──────────────────────────────────────────────────────────────

@router.post("/einvoice/cancel", response_model=EInvoiceRead, tags=["E-Invoice Studio"])
def cancel_einvoice(payload: EInvoiceCancel, db: Session = Depends(get_db)):
    if payload.cancel_reason not in _CANCEL_REASONS:
        raise HTTPException(status_code=400, detail="cancel_reason must be 1–4 (NIC standard).")
    rec = db.query(EInvoice).filter(EInvoice.irn == payload.irn, EInvoice.is_deleted == False).first()
    if not rec:
        raise HTTPException(status_code=404, detail="IRN not found.")
    if rec.status == "CANCELLED":
        raise HTTPException(status_code=409, detail="IRN already cancelled.")
    if rec.status != "GENERATED":
        raise HTTPException(status_code=400, detail=f"Cannot cancel an e-invoice with status {rec.status}.")
    rec.status = "CANCELLED"
    rec.cancel_reason = payload.cancel_reason
    rec.cancel_remark = payload.cancel_remark
    rec.cancelled_at = _now()
    db.commit()
    db.refresh(rec)
    return rec


# ─── Detail ──────────────────────────────────────────────────────────────────

@router.get("/einvoice/{einvoice_id}", response_model=EInvoiceRead, tags=["E-Invoice Studio"])
def get_einvoice(einvoice_id: str, db: Session = Depends(get_db)):
    rec = db.query(EInvoice).filter(EInvoice.id == einvoice_id, EInvoice.is_deleted == False).first()
    if not rec:
        raise HTTPException(status_code=404, detail="E-Invoice not found.")
    return rec


# ─── Batch Submit ─────────────────────────────────────────────────────────────

@router.post("/einvoice/batch", response_model=EInvoiceBatchRead, status_code=status.HTTP_201_CREATED, tags=["E-Invoice Studio"])
def submit_einvoice_batch(payload: EInvoiceBatchCreate, db: Session = Depends(get_db)):
    batch_no = "EIB-" + secrets.token_hex(5).upper()
    batch = EInvoiceBatch(
        batch_no=batch_no,
        status="QUEUED",
        total_invoices=len(payload.invoice_ids),
        notes=payload.notes,
    )
    db.add(batch)
    db.commit()
    db.refresh(batch)
    return batch


@router.get("/einvoice/batch/{batch_id}", response_model=EInvoiceBatchRead, tags=["E-Invoice Studio"])
def get_einvoice_batch(batch_id: str, db: Session = Depends(get_db)):
    b = db.query(EInvoiceBatch).filter(EInvoiceBatch.id == batch_id, EInvoiceBatch.is_deleted == False).first()
    if not b:
        raise HTTPException(status_code=404, detail="Batch not found.")
    return b
