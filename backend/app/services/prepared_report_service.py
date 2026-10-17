"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.80.0
Created      : 2026-09-11
Modified     : 2026-09-11
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal

SMRITI Asynchronous Prepared Report Queue, Cache & Statutory Sealing Service.
Inspired by Frappe / ERPNext Prepared Reports Architecture:
- Eliminates HTTP 504 reverse proxy timeouts on massive datasets (50k+ rows)
- Prevents database worker starvation during peak POS billing hours
- Deterministic parameter SHA-256 hash caching for instant artifact reuse
- Tamper-evident forensic SHA-256 integrity digest stored in Statutory Vault
"""

import os
import io
import csv
import json
import time
import uuid
import hashlib
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy import select, update, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import TenantContext
from app.models.reporting import PreparedReport
from app.schemas.reports import (
    PreparedReportEnqueueRequest,
    PreparedReportStatusResponse,
)
from app.services.reports import ReportsService
from app.core.governance import smriti_capability


@smriti_capability(
    entity="report",
    capability="report.prepared_service",
    role="CANONICAL",
    description="Canonical Asynchronous Prepared Report Queue and Cache Service",
    decision_id="ADR-RPT-02",
)
class PreparedReportService:
    """
    Central Asynchronous Service managing the lifecycle of heavy background reports:
    Enqueue -> Background Execution -> Serialization -> Vault Storage -> Hash Sealing -> Download
    """

    VAULT_DIR = os.path.join(os.getcwd(), "artifacts", "statutory_vault")

    @classmethod
    def compute_parameters_hash(cls, report_code: str, parameters: Dict[str, Any], export_format: str) -> str:
        """
        Computes a deterministic SHA-256 hash of normalized parameters for caching and deduplication.
        """
        # Recursively serialize parameters with sorted keys
        normalized_str = json.dumps(parameters, sort_keys=True, default=str)
        raw_key = f"{report_code.strip().upper()}:{export_format.strip().upper()}:{normalized_str}"
        return hashlib.sha256(raw_key.encode("utf-8")).hexdigest()

    @classmethod
    async def enqueue_prepared_report(
        cls,
        db: AsyncSession,
        tenant_ctx: Optional[TenantContext],
        payload: PreparedReportEnqueueRequest,
        requested_by_id: Optional[str] = None,
    ) -> Tuple[PreparedReport, bool]:
        """
        Registers a report task or returns an existing valid cached artifact if parameters match.
        Returns: (PreparedReport, is_cached_hit: bool)
        """
        now = datetime.now(timezone.utc)
        param_hash = cls.compute_parameters_hash(payload.report_code, payload.parameters, payload.export_format)

        # 1. Check for Active Cache Hit
        stmt = (
            select(PreparedReport)
            .where(
                and_(
                    PreparedReport.report_code == payload.report_code,
                    PreparedReport.parameters_hash == param_hash,
                    PreparedReport.export_format == payload.export_format.upper(),
                    PreparedReport.status == "COMPLETED",
                    PreparedReport.is_deleted == False,
                    PreparedReport.expires_at > now,
                )
            )
            .order_by(PreparedReport.created_at.desc())
        )
        res = await db.execute(stmt)
        cached = res.scalars().first()

        if cached and cached.output_file_path and os.path.exists(cached.output_file_path):
            return cached, True

        # 2. Cache Miss: Register New Task in QUEUED state
        task_id = f"prep-{uuid.uuid4().hex[:12]}"
        report_name = payload.parameters.get("report_name") or f"{payload.report_code} Prepared Report"

        company_id = tenant_ctx.company_id if tenant_ctx else "COMP-001"
        branch_id = tenant_ctx.branch_id if tenant_ctx else "BR-MAIN-001"

        prepared_doc = PreparedReport(
            id=task_id,
            company_id=company_id,
            branch_id=branch_id,
            report_code=payload.report_code,
            report_name=report_name,
            parameters=payload.parameters,
            parameters_hash=param_hash,
            status="QUEUED",
            execution_mode="ASYNC_BACKGROUND",
            export_format=payload.export_format.upper(),
            file_size_bytes=0,
            row_count=0,
            execution_time_ms=0,
            requested_by_id=requested_by_id,
            expires_at=now + timedelta(hours=24),
        )

        db.add(prepared_doc)
        await db.commit()
        await db.refresh(prepared_doc)
        return prepared_doc, False

    @classmethod
    async def execute_task_background(
        cls,
        task_id: str,
        db: AsyncSession,
        tenant_ctx: Optional[TenantContext] = None,
    ) -> None:
        """
        Background worker that processes the report query, renders binary artifact,
        seals with SHA-256 hash, and saves to the statutory vault.
        """
        start_time = time.perf_counter()

        stmt = select(PreparedReport).where(PreparedReport.id == task_id)
        res = await db.execute(stmt)
        task = res.scalar_one_or_none()
        if not task:
            return

        task.status = "PROCESSING"
        await db.commit()

        try:
            os.makedirs(cls.VAULT_DIR, exist_ok=True)
            report_svc = ReportsService(db, tenant_ctx)
            params = task.parameters or {}
            export_format = (task.export_format or "XLSX").upper()
            code = task.report_code.upper()

            payload_bytes: bytes = b""
            row_count = 0

            # Route to specialized multi-sheet generators or fallback universal generator
            if code in ("RPT-TAX-001", "RPT-TAX-006") and export_format == "XLSX":
                payload_bytes = await report_svc.export_tax_invoices_master_excel(
                    from_date=params.get("from_date"),
                    to_date=params.get("to_date"),
                    bill_from=params.get("bill_from"),
                    bill_to=params.get("bill_to"),
                    status=params.get("status"),
                    include_archived=params.get("include_archived", True),
                )
                row_count = 100 # Represents master register sheets
            elif code == "RPT-SO-008" and export_format == "XLSX":
                payload_bytes = await report_svc.export_sales_orders_master_excel(
                    from_date=params.get("from_date"),
                    to_date=params.get("to_date"),
                    customer_id=params.get("customer_id"),
                    status=params.get("status"),
                )
                row_count = 500 # Multi-sheet master workbook
            elif code == "RPT-SO-008" and export_format == "CSV":
                csv_str = await report_svc.export_sales_orders_csv(
                    from_date=params.get("from_date"),
                    to_date=params.get("to_date"),
                    customer_id=params.get("customer_id"),
                    status=params.get("status"),
                )
                payload_bytes = csv_str.encode("utf-8")
                row_count = csv_str.count("\n")
            else:
                # Universal generic exporter: Fetch universal envelope and serialize
                envelope = await report_svc.get_universal_report_envelope(
                    report_id=code,
                    from_date=params.get("from_date"),
                    to_date=params.get("to_date"),
                    branch_id=params.get("branch_id"),
                )
                row_count = len(envelope.rows)
                if export_format == "CSV":
                    output = io.StringIO()
                    fieldnames = [c.key for c in envelope.columns]
                    writer = csv.DictWriter(output, fieldnames=fieldnames)
                    writer.writeheader()
                    for r in envelope.rows:
                        writer.writerow({k: r.get(k, "") for k in fieldnames})
                    payload_bytes = output.getvalue().encode("utf-8")
                elif export_format == "JSON":
                    payload_bytes = json.dumps(envelope.model_dump(), indent=2, default=str).encode("utf-8")
                else: # Default XLSX via openpyxl
                    import openpyxl
                    wb = openpyxl.Workbook()
                    ws = wb.active
                    ws.title = code[:30]
                    # Header
                    ws.append([c.label for c in envelope.columns])
                    # Data
                    for r in envelope.rows:
                        ws.append([r.get(c.key, "") for c in envelope.columns])
                    out_io = io.BytesIO()
                    wb.save(out_io)
                    payload_bytes = out_io.getvalue()

            # Forensic Sealing: SHA-256 of output artifact
            forensic_hash = hashlib.sha256(payload_bytes).hexdigest()

            # Write file to statutory vault
            filename = f"{code}_{task.id}.{export_format.lower()}"
            file_path = os.path.join(cls.VAULT_DIR, filename)
            with open(file_path, "wb") as f:
                f.write(payload_bytes)

            latency_ms = int((time.perf_counter() - start_time) * 1000)

            # Update task record
            task.status = "COMPLETED"
            task.output_file_path = file_path
            task.file_size_bytes = len(payload_bytes)
            task.row_count = row_count
            task.execution_time_ms = max(latency_ms, 1)
            task.forensic_hash = forensic_hash
            task.expires_at = datetime.now(timezone.utc) + timedelta(hours=24)
            await db.commit()

        except Exception as exc:
            task.status = "FAILED"
            task.error_message = str(exc)
            task.execution_time_ms = int((time.perf_counter() - start_time) * 1000)
            await db.commit()

    @classmethod
    async def get_task_status(cls, db: AsyncSession, task_id: str) -> Optional[PreparedReportStatusResponse]:
        """Fetches status and metadata for an ongoing or completed prepared report task."""
        stmt = select(PreparedReport).where(PreparedReport.id == task_id)
        res = await db.execute(stmt)
        task = res.scalar_one_or_none()
        if not task:
            return None

        progress = 10 if task.status == "QUEUED" else (50 if task.status == "PROCESSING" else (100 if task.status == "COMPLETED" else 0))
        download_url = f"/api/v1/reports/prepared/{task.id}/download" if task.status == "COMPLETED" else None

        return PreparedReportStatusResponse(
            task_id=task.id,
            report_code=task.report_code,
            report_name=task.report_name,
            status=task.status,
            progress_percent=progress,
            row_count=task.row_count or 0,
            file_size_bytes=task.file_size_bytes or 0,
            execution_time_ms=task.execution_time_ms or 0,
            download_url=download_url,
            error_message=task.error_message,
            forensic_hash=task.forensic_hash,
            is_cached_hit=False,
        )

    @classmethod
    async def get_artifact_stream(cls, db: AsyncSession, task_id: str) -> Tuple[bytes, str, str]:
        """
        Retrieves binary bytes, filename, and media-type for a completed report.
        Raises FileNotFoundError if file is missing.
        """
        stmt = select(PreparedReport).where(PreparedReport.id == task_id)
        res = await db.execute(stmt)
        task = res.scalar_one_or_none()
        if not task or task.status != "COMPLETED" or not task.output_file_path:
            raise ValueError(f"Prepared report '{task_id}' is not in COMPLETED state.")

        if not os.path.exists(task.output_file_path):
            raise FileNotFoundError(f"Sealed artifact file not found on disk: {task.output_file_path}")

        with open(task.output_file_path, "rb") as f:
            content = f.read()

        ext = (task.export_format or "XLSX").lower()
        filename = f"{task.report_code}_{task.id}.{ext}"

        if ext == "xlsx":
            media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        elif ext == "csv":
            media_type = "text/csv; charset=utf-8"
        elif ext == "json":
            media_type = "application/json"
        elif ext == "pdf":
            media_type = "application/pdf"
        else:
            media_type = "application/octet-stream"

        return content, filename, media_type
