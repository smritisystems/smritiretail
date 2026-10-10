"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.40.2
Created      : 2026-09-18
Modified     : 2026-09-23
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: B2B Dispatch & Tax Invoicing Studio Router
"""

import os
import io
import json
import time
import uuid
import tempfile
from decimal import Decimal
from typing import Optional, List, Dict, Any

from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException, status
from fastapi.responses import StreamingResponse, Response
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.api.deps import get_current_user
from app.models.dispatch_batch import DispatchBatch, DispatchBatchInvoice
from app.schemas.dispatch_invoicing import (
    DispatchPreflightAuditResponse,
    DispatchBatchGenerateRequest,
    DispatchBatchResult,
    DispatchGeneratedInvoice,
)
from app.services.dispatch_invoicing_engine import DispatchInvoicingEngine, _AUDIT_CACHE
from app.services.dispatch_artifact_pipeline import DispatchArtifactPipeline
from app.services.dispatch_matrix_parser import DispatchMatrixParseError

# smriti_capability(entity="SALES", capability="B2B_DISPATCH_INVOICING_STUDIO", role="ADAPTER", canonicalOwner="backend/app/services/dispatch_invoicing_engine.py")

router = APIRouter(prefix="/dispatch-invoicing", tags=["dispatch-invoicing"])

# ---------------------------------------------------------------------------
# Temporary storage for generated ZIP packages.
# The DB record stores the path; the bytes survive the process lifetime on disk.
# ---------------------------------------------------------------------------
_DISPATCH_TEMP_DIR = os.path.join(tempfile.gettempdir(), "smriti_dispatch_zips")
os.makedirs(_DISPATCH_TEMP_DIR, exist_ok=True)


@router.post(
    "/pre-flight-audit",
    response_model=DispatchPreflightAuditResponse,
    summary="Execute dry-run pre-flight audit on uploaded dispatch matrix workbook"
)
async def preflight_audit(
    file: UploadFile = File(...),
    sheet_name: Optional[str] = Form(None),
    discount_pct: Decimal = Form(Decimal("43.76")),
    gst_rate: Decimal = Form(Decimal("5.00")),
    db: AsyncSession = Depends(get_db),
    current_user: Any = Depends(get_current_user),
):
    """
    Parses uploaded Excel dispatch workbook and performs multi-tier store master resolution,
    statutory GST calculations, and pre-flight validation.
    """
    try:
        content = await file.read()
        if not content:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Uploaded file is empty."
            )

        audit_res = await DispatchInvoicingEngine.run_preflight_audit(
            db=db,
            file_bytes=content,
            sheet_name=sheet_name,
            discount_pct=discount_pct,
            gst_rate=gst_rate
        )
        return audit_res

    except DispatchMatrixParseError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Matrix Parsing Failed: {str(exc)}"
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Pre-flight audit failed: {str(exc)}"
        )


@router.post(
    "/generate-batch",
    response_model=DispatchBatchResult,
    summary="Atomically generate invoices, eway bills, and delivery artifact package"
)
async def generate_batch(
    req: DispatchBatchGenerateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: Any = Depends(get_current_user),
):
    """
    Executes transactional database creation of SalesInvoices, SalesInvoiceItems, EWayBills,
    renders A4 PDFs, generates E-Way JSONs, stamps source Excel, and builds delivery ZIP package.
    """
    start_time = time.time()
    batch_id = f"batch-{uuid.uuid4().hex[:8]}"

    company_id = getattr(current_user, "company_id", "comp-001") or "comp-001"
    branch_id = getattr(current_user, "branch_id", "main") or "main"
    username = getattr(current_user, "username", "operations") or "operations"

    try:
        # 1. Execute DB Transactions
        records, raw_file_bytes = await DispatchInvoicingEngine.execute_batch(
            db=db,
            req=req,
            company_id=company_id,
            branch_id=branch_id,
            operator=username
        )

        # 2. Build Delivery Artifact ZIP
        audit_info = _AUDIT_CACHE.get(req.audit_token, {})
        sheet_name = audit_info.get("parsed", {}).get("sheet_name", "Sheet1")

        zip_bytes = await DispatchArtifactPipeline.build_delivery_zip(
            invoice_records=records,
            raw_file_bytes=raw_file_bytes,
            sheet_name=sheet_name,
            batch_id=batch_id
        )

        # 3. Persist ZIP to disk and record in DB
        zip_filename = f"Dispatch_Package_{batch_id}.zip"
        zip_path = os.path.join(_DISPATCH_TEMP_DIR, zip_filename)
        with open(zip_path, "wb") as f:
            f.write(zip_bytes)

        # 4. Build per-invoice DB records and summary
        gen_invoices: List[DispatchGeneratedInvoice] = []
        db_invoices: List[DispatchBatchInvoice] = []
        tot_val = Decimal("0.00")
        tot_pairs = 0

        for r in records:
            gen_invoices.append(DispatchGeneratedInvoice(
                invoice_id=r["invoice_id"],
                invoice_no=r["invoice_no"],
                identity_code=r["identity_code"],
                store_code=r["store_code"],
                site_name=r["original_site_name"],
                po_number=r["po_number"],
                pairs_count=r["pairs"],
                taxable_value=Decimal(str(r["taxable_value"])),
                tax_total=Decimal(str(r["tax_total"])),
                grand_total=Decimal(str(r["grand_total"])),
                eway_bill_id=r["eway_bill_id"],
                eway_identity_code=r["eway_identity_code"],
                pdf_filename=r["pdf_filename"]
            ))
            db_invoices.append(DispatchBatchInvoice(
                id=r["invoice_id"],
                batch_id=batch_id,
                store_code=r["store_code"],
                store_name=r["original_site_name"],
                invoice_number=r["invoice_no"],
                invoice_date=req.invoice_date,
                po_number=r["po_number"],
                taxable_value=Decimal(str(r["taxable_value"])),
                tax_amount=Decimal(str(r["tax_total"])),
                grand_total=Decimal(str(r["grand_total"])),
                pairs_count=r["pairs"],
                status="GENERATED",
            ))
            tot_val += Decimal(str(r["grand_total"]))
            tot_pairs += r["pairs"]

        # 5. Persist DispatchBatch header and child invoice rows
        db_batch = DispatchBatch(
            id=batch_id,
            batch_ref=batch_id,
            company_id=company_id,
            branch_id=branch_id,
            source_filename=req.audit_token,
            sheet_name=sheet_name,
            preflight_status="AUDITED",
            total_stores=len(records),
            ready_stores=len(records),
            batch_status="GENERATED",
            package_path=zip_path,
            created_by=username,
        )
        db.add(db_batch)
        for dbi in db_invoices:
            db.add(dbi)
        await db.commit()

        elapsed = round(time.time() - start_time, 2)

        return DispatchBatchResult(
            batch_id=batch_id,
            status="COMPLETED",
            invoice_date=req.invoice_date,
            total_invoices=len(records),
            total_pairs=tot_pairs,
            total_value=tot_val,
            generated_invoices=gen_invoices,
            zip_download_url=f"/api/v1/dispatch-invoicing/batches/{batch_id}/download-zip",
            excel_summary_url=None,
            stamped_excel_url=None,
            execution_time_seconds=elapsed,
            message=f"Successfully generated {len(records)} invoices ({tot_pairs} pairs) in {elapsed}s."
        )

    except ValueError as val_err:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(val_err)
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Batch generation failed: {str(exc)}"
        )


@router.get(
    "/batches/{batch_id}/download-zip",
    summary="Download complete ZIP delivery package for a batch"
)
async def download_batch_zip(
    batch_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: Any = Depends(get_current_user),
):
    """Streams the generated ZIP package. Reads path from DB record, falls back to temp dir scan."""
    # DB lookup
    res = await db.execute(select(DispatchBatch).where(DispatchBatch.id == batch_id))
    batch_row = res.scalar_one_or_none()

    zip_path = batch_row.package_path if batch_row else None
    if not zip_path or not os.path.exists(zip_path):
        # Graceful fallback: scan temp dir for matching filename
        candidate = os.path.join(_DISPATCH_TEMP_DIR, f"Dispatch_Package_{batch_id}.zip")
        if os.path.exists(candidate):
            zip_path = candidate
        else:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={
                    "code": "SMRITI-DATA-001",
                    "title": "Dispatch Package Not Found",
                    "explanation": f"Batch package '{batch_id}' is not available. It may have expired or was never generated.",
                    "suggested_action": "Please re-run the dispatch batch generation.",
                }
            )

    with open(zip_path, "rb") as f:
        zip_bytes = f.read()

    filename = f"Dispatch_Package_{batch_id}.zip"
    return Response(
        content=zip_bytes,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )


@router.get(
    "/batches",
    summary="List recent dispatch batches"
)
async def list_recent_batches(
    db: AsyncSession = Depends(get_db),
    current_user: Any = Depends(get_current_user),
):
    """Returns metadata for recent batches from the database, ordered by creation time."""
    res = await db.execute(
        select(DispatchBatch)
        .where(DispatchBatch.batch_status == "GENERATED")
        .order_by(desc(DispatchBatch.created_at))
        .limit(50)
    )
    batches = res.scalars().all()
    return [
        {
            "batch_id": b.id,
            "batch_ref": b.batch_ref,
            "filename": f"Dispatch_Package_{b.id}.zip",
            "invoice_date": str(b.source_filename),
            "total_invoices": b.total_stores,
            "created_at": b.created_at.isoformat() if b.created_at else None,
            "download_url": f"/api/v1/dispatch-invoicing/batches/{b.id}/download-zip"
        }
        for b in batches
    ]
