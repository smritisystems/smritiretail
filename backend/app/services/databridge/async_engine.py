"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 1.0.0
Created      : 2026-10-06
Modified     : 2026-10-06
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal — Foundation Service
"""

# smriti_capability(entity="DATABRIDGE", capability="DATABRIDGE_CORE_FOUNDATION", role="ADAPTER", canonicalOwner="backend/app/services/databridge/async_engine.py")

import hashlib
import json
import logging
import math
import uuid
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy import select, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession

from ...models.outbox import IntegrationOutboxEvent
from ...models.audit import ComplianceImmutableAuditLog
from .models import (
    DataBridgeEntityType,
    DataBridgeAsyncSubmitRequest,
    DataBridgeAsyncJobResponse,
    DataBridgeJobStatusResponse,
    DataBridgeAsyncJobStatus,
    DataBridgeClassification,
    DataBridgeResultItem,
    DataBridgeSummary,
)
from .service import DataBridgeService
from .exceptions import (
    DataBridgeError,
    DataBridgeValidationError,
    DataBridgeTenantIsolationError,
)

logger = logging.getLogger("smriti.databridge.async")


class DataBridgeAsyncEngine:
    """
    High-volume asynchronous execution engine and chunked task queue for SMRITI DataBridge.
    Stages large import files (>5,000 rows up to 50,000+ rows) into canonical tenant table
    `integration_outbox_events` with non-blocking transactional claiming, progressive
    chunk processing, real-time metrics telemetry, and tamper-evident WORM audit logging.
    """

    TARGET_CHANNEL: str = "DATABRIDGE_ASYNC_JOB"
    EVENT_TYPE: str = "DATABRIDGE_ASYNC_IMPORT"

    @classmethod
    async def submit_job(
        cls,
        company_db: AsyncSession,
        tenant_id: str,
        company_id: str,
        branch_id: Optional[str],
        actor_id: str,
        actor_role: str,
        req: DataBridgeAsyncSubmitRequest,
    ) -> DataBridgeAsyncJobResponse:
        """
        Submits and stages a high-volume import payload into integration_outbox_events.
        Enforces tenant boundary, computes SHA-256 digest, respects idempotency,
        and returns an immediate HTTP 202 Accepted response.
        """
        DataBridgeService.verify_tenant_boundary(company_db, company_id)

        if not req.rows:
            raise DataBridgeValidationError("Asynchronous import payload must contain at least 1 row.")

        total_rows = len(req.rows)
        chunk_size = max(1, min(req.chunk_size, 5000))
        total_chunks = math.ceil(total_rows / chunk_size)

        # Compute payload SHA-256 digest
        serialized_rows = json.dumps(req.rows, sort_keys=True, default=str)
        payload_sha256 = hashlib.sha256(serialized_rows.encode("utf-8")).hexdigest()

        # Idempotency check if idempotency key is supplied
        if req.idempotency_key:
            existing_stmt = (
                select(IntegrationOutboxEvent)
                .where(
                    IntegrationOutboxEvent.company_id == company_id,
                    IntegrationOutboxEvent.target_channel == cls.TARGET_CHANNEL,
                    IntegrationOutboxEvent.status.in_(["PENDING", "PROCESSING", "COMPLETED"]),
                )
                .order_by(IntegrationOutboxEvent.created_at.desc())
                .limit(20)
            )
            existing_records = (await company_db.execute(existing_stmt)).scalars().all()
            for rec in existing_records:
                payload_data = rec.payload_json or {}
                if payload_data.get("idempotency_key") == req.idempotency_key:
                    logger.info(
                        f"[DataBridgeAsync] Idempotent hit for key '{req.idempotency_key}', job '{rec.source_event_id}'."
                    )
                    return DataBridgeAsyncJobResponse(
                        job_id=rec.source_event_id,
                        status=rec.status,
                        total_rows=payload_data.get("total_rows", total_rows),
                        chunk_size=payload_data.get("chunk_size", chunk_size),
                        entity_type=payload_data.get("entity_type", req.entity_type.value),
                        created_at=rec.created_at.isoformat() if rec.created_at else datetime.now(timezone.utc).isoformat(),
                        message="Idempotent replay: Existing async import job retrieved.",
                    )

        job_id = f"dbj_{uuid.uuid4().hex[:16]}"
        outbox_id = f"obx_{uuid.uuid4().hex[:16]}"
        now_utc = datetime.now(timezone.utc)

        payload_dict: Dict[str, Any] = {
            "job_id": job_id,
            "entity_type": req.entity_type.value,
            "total_rows": total_rows,
            "chunk_size": chunk_size,
            "processed_rows": 0,
            "committed_count": 0,
            "error_count": 0,
            "current_chunk": 0,
            "total_chunks": total_chunks,
            "progress_percent": 0.0,
            "filename": req.filename or f"import_{req.entity_type.value.lower()}_{now_utc.strftime('%Y%m%d%H%M%S')}.json",
            "idempotency_key": req.idempotency_key,
            "payload_sha256": payload_sha256,
            "preview_only": req.preview_only,
            "actor_id": actor_id,
            "actor_role": actor_role,
            "company_id": company_id,
            "branch_id": branch_id,
            "tenant_id": tenant_id,
            "rows": req.rows,
            "started_at": None,
            "completed_at": None,
            "compliance_sha256": None,
            "error_message": None,
            "summary": {
                "total_rows": total_rows,
                "create_count": 0,
                "update_count": 0,
                "no_change_count": 0,
                "conflict_count": 0,
                "validation_error_count": 0,
                "dependency_error_count": 0,
            },
            "items_sample": [],
        }

        outbox_event = IntegrationOutboxEvent(
            outbox_id=outbox_id,
            source_event_id=job_id,
            correlation_id=f"corr_{uuid.uuid4().hex[:12]}",
            causation_id=f"req_{uuid.uuid4().hex[:12]}",
            event_type=cls.EVENT_TYPE,
            aggregate_type="DATABRIDGE_JOB",
            aggregate_id=job_id,
            company_id=company_id,
            branch_id=branch_id,
            event_schema_version="1.0",
            target_channel=cls.TARGET_CHANNEL,
            payload_json=payload_dict,
            status="PENDING",
            retry_count=0,
            created_at=now_utc,
        )

        company_db.add(outbox_event)
        await company_db.commit()

        logger.info(
            f"[DataBridgeAsync] Staged job '{job_id}' with {total_rows} rows in {total_chunks} chunks."
        )

        return DataBridgeAsyncJobResponse(
            job_id=job_id,
            status="PENDING",
            total_rows=total_rows,
            chunk_size=chunk_size,
            entity_type=req.entity_type.value,
            created_at=now_utc.isoformat(),
            message="DataBridge async import job submitted and queued successfully.",
        )

    @classmethod
    async def get_job_status(
        cls,
        company_db: AsyncSession,
        company_id: str,
        job_id: str,
    ) -> DataBridgeJobStatusResponse:
        """
        Retrieves real-time progress metrics and current lifecycle status for a job.
        """
        DataBridgeService.verify_tenant_boundary(company_db, company_id)

        stmt = (
            select(IntegrationOutboxEvent)
            .where(
                or_(
                    IntegrationOutboxEvent.source_event_id == job_id,
                    IntegrationOutboxEvent.outbox_id == job_id,
                ),
                IntegrationOutboxEvent.company_id == company_id,
                IntegrationOutboxEvent.target_channel == cls.TARGET_CHANNEL,
            )
            .limit(1)
        )
        record = (await company_db.execute(stmt)).scalars().first()
        if not record:
            raise DataBridgeValidationError(f"Asynchronous import job '{job_id}' not found.")

        payload = record.payload_json or {}
        summary_dict = payload.get("summary") or {}
        summary_model = DataBridgeSummary(**summary_dict) if summary_dict else None

        items_sample = [
            DataBridgeResultItem(**item) for item in payload.get("items_sample", [])
        ]

        return DataBridgeJobStatusResponse(
            job_id=record.source_event_id or job_id,
            status=record.status,
            entity_type=payload.get("entity_type", "UNKNOWN"),
            total_rows=payload.get("total_rows", 0),
            processed_rows=payload.get("processed_rows", 0),
            committed_count=payload.get("committed_count", 0),
            error_count=payload.get("error_count", 0),
            progress_percent=float(payload.get("progress_percent", 0.0)),
            current_chunk=payload.get("current_chunk", 0),
            total_chunks=payload.get("total_chunks", 0),
            started_at=payload.get("started_at"),
            completed_at=payload.get("completed_at"),
            compliance_sha256=payload.get("compliance_sha256"),
            error_message=payload.get("error_message") or record.error_message,
            summary=summary_model,
            items_sample=items_sample,
        )

    @classmethod
    async def process_job_chunks(
        cls,
        company_db: AsyncSession,
        company_id: str,
        job_id: str,
        max_chunks: Optional[int] = None,
    ) -> DataBridgeJobStatusResponse:
        """
        Executes pending chunks for a specific job within isolated transaction cycles.
        Progressively writes metrics to payload_json and completes with WORM audit log.
        """
        DataBridgeService.verify_tenant_boundary(company_db, company_id)

        stmt = (
            select(IntegrationOutboxEvent)
            .where(
                IntegrationOutboxEvent.source_event_id == job_id,
                IntegrationOutboxEvent.company_id == company_id,
                IntegrationOutboxEvent.target_channel == cls.TARGET_CHANNEL,
            )
            .with_for_update()
            .limit(1)
        )
        record = (await company_db.execute(stmt)).scalars().first()
        if not record:
            raise DataBridgeValidationError(f"Asynchronous import job '{job_id}' not found.")

        if record.status in ("COMPLETED", "CANCELLED"):
            return await cls.get_job_status(company_db, company_id, job_id)

        payload = dict(record.payload_json or {})
        now_utc = datetime.now(timezone.utc)

        if record.status == "PENDING":
            record.status = "PROCESSING"
            payload["status"] = "PROCESSING"
            payload["started_at"] = now_utc.isoformat()

        all_rows: List[Dict[str, Any]] = payload.get("rows", [])
        total_rows = payload.get("total_rows", len(all_rows))
        chunk_size = payload.get("chunk_size", 500)
        total_chunks = payload.get("total_chunks", 1)
        current_chunk = payload.get("current_chunk", 0)
        entity_type_str = payload.get("entity_type", "CATALOG_DOCUMENT")
        actor_id = payload.get("actor_id", "SYSADMIN")
        actor_role = payload.get("actor_role", "SYSADMIN")
        branch_id = payload.get("branch_id")
        preview_only = payload.get("preview_only", False)

        chunks_to_process = total_chunks - current_chunk
        if max_chunks is not None:
            chunks_to_process = min(chunks_to_process, max_chunks)

        adapter = DataBridgeService.resolve_adapter(DataBridgeEntityType(entity_type_str))
        summary_dict = payload.setdefault("summary", {
            "total_rows": total_rows,
            "create_count": 0,
            "update_count": 0,
            "no_change_count": 0,
            "conflict_count": 0,
            "validation_error_count": 0,
            "dependency_error_count": 0,
        })
        items_sample = payload.setdefault("items_sample", [])

        try:
            for _ in range(chunks_to_process):
                start_idx = current_chunk * chunk_size
                end_idx = min(start_idx + chunk_size, total_rows)
                chunk_rows = all_rows[start_idx:end_idx]

                if not chunk_rows:
                    current_chunk += 1
                    continue

                if preview_only:
                    items, _ = await adapter.preview(
                        rows=chunk_rows,
                        session=company_db,
                        company_id=company_id,
                        branch_id=branch_id,
                    )
                    committed_count = 0
                else:
                    items, committed_count = await adapter.commit(
                        rows=chunk_rows,
                        session=company_db,
                        company_id=company_id,
                        branch_id=branch_id,
                        actor_id=actor_id,
                    )

                # Update running counters
                payload["processed_rows"] = end_idx
                payload["committed_count"] = payload.get("committed_count", 0) + committed_count

                for item in items:
                    if item.classification == DataBridgeClassification.CREATE:
                        summary_dict["create_count"] = summary_dict.get("create_count", 0) + 1
                    elif item.classification == DataBridgeClassification.UPDATE:
                        summary_dict["update_count"] = summary_dict.get("update_count", 0) + 1
                    elif item.classification == DataBridgeClassification.NO_CHANGE:
                        summary_dict["no_change_count"] = summary_dict.get("no_change_count", 0) + 1
                    elif item.classification == DataBridgeClassification.EXISTING_CONFLICT:
                        summary_dict["conflict_count"] = summary_dict.get("conflict_count", 0) + 1
                        payload["error_count"] = payload.get("error_count", 0) + 1
                    elif item.classification == DataBridgeClassification.VALIDATION_ERROR:
                        summary_dict["validation_error_count"] = summary_dict.get("validation_error_count", 0) + 1
                        payload["error_count"] = payload.get("error_count", 0) + 1
                    elif item.classification == DataBridgeClassification.DEPENDENCY_ERROR:
                        summary_dict["dependency_error_count"] = summary_dict.get("dependency_error_count", 0) + 1
                        payload["error_count"] = payload.get("error_count", 0) + 1

                    if len(items_sample) < 50:
                        items_sample.append(item.model_dump())

                current_chunk += 1
                payload["current_chunk"] = current_chunk
                payload["progress_percent"] = round((end_idx / total_rows) * 100, 2)

            # Check if all chunks have finished
            if current_chunk >= total_chunks:
                record.status = "COMPLETED"
                payload["status"] = "COMPLETED"
                payload["progress_percent"] = 100.0
                payload["completed_at"] = datetime.now(timezone.utc).isoformat()
                record.dispatched_at = datetime.now(timezone.utc)

                # Write tamper-evident WORM audit entry
                audit_entry = await DataBridgeService.record_audit_entry(
                    company_db=company_db,
                    company_id=company_id,
                    event_type="DATABRIDGE_ASYNC_COMMIT",
                    entity_name=f"databridge_{entity_type_str.lower()}",
                    entity_id=job_id,
                    action_summary=(
                        f"DataBridge async import job '{job_id}' completed. "
                        f"{payload['committed_count']} committed out of {total_rows} rows."
                    ),
                    actor_id=actor_id,
                    actor_role=actor_role,
                    payload_data={
                        "job_id": job_id,
                        "entity_type": entity_type_str,
                        "total_rows": total_rows,
                        "committed_count": payload["committed_count"],
                        "error_count": payload["error_count"],
                        "payload_sha256": payload.get("payload_sha256"),
                    },
                )
                payload["compliance_sha256"] = audit_entry.payload_hash

            record.payload_json = dict(payload)
            record.last_attempt_at = datetime.now(timezone.utc)
            await company_db.commit()

        except Exception as exc:
            logger.exception(f"[DataBridgeAsync] Error executing chunk for job '{job_id}': {exc}")
            record.status = "FAILED"
            record.error_message = str(exc)
            payload["status"] = "FAILED"
            payload["error_message"] = str(exc)
            record.payload_json = dict(payload)
            record.last_attempt_at = datetime.now(timezone.utc)
            await company_db.commit()
            raise

        return await cls.get_job_status(company_db, company_id, job_id)

    @classmethod
    async def process_next_job(
        cls,
        company_db: AsyncSession,
        company_id: str,
        job_id: Optional[str] = None,
        max_chunks_per_turn: Optional[int] = None,
    ) -> Optional[DataBridgeJobStatusResponse]:
        """
        Polls and claims an eligible job in the tenant outbox queue.
        If job_id is provided, targets that specific job; otherwise claims the oldest pending job.
        Uses non-blocking SELECT FOR UPDATE SKIP LOCKED.
        """
        DataBridgeService.verify_tenant_boundary(company_db, company_id)

        stmt = (
            select(IntegrationOutboxEvent)
            .where(
                IntegrationOutboxEvent.company_id == company_id,
                IntegrationOutboxEvent.target_channel == cls.TARGET_CHANNEL,
                IntegrationOutboxEvent.status.in_(["PENDING", "PROCESSING"]),
            )
        )
        if job_id:
            stmt = stmt.where(
                or_(
                    IntegrationOutboxEvent.source_event_id == job_id,
                    IntegrationOutboxEvent.outbox_id == job_id,
                )
            )

        stmt = (
            stmt.order_by(IntegrationOutboxEvent.created_at.asc())
            .with_for_update(skip_locked=True)
            .limit(1)
        )
        record = (await company_db.execute(stmt)).scalars().first()
        if not record:
            return None

        target_job_id = record.source_event_id
        return await cls.process_job_chunks(
            company_db=company_db,
            company_id=company_id,
            job_id=target_job_id,
            max_chunks=max_chunks_per_turn,
        )

    @classmethod
    async def cancel_job(
        cls,
        company_db: AsyncSession,
        company_id: str,
        job_id: str,
    ) -> DataBridgeJobStatusResponse:
        """
        Cancels an active or pending async import job.
        """
        DataBridgeService.verify_tenant_boundary(company_db, company_id)

        stmt = (
            select(IntegrationOutboxEvent)
            .where(
                IntegrationOutboxEvent.source_event_id == job_id,
                IntegrationOutboxEvent.company_id == company_id,
                IntegrationOutboxEvent.target_channel == cls.TARGET_CHANNEL,
            )
            .with_for_update()
            .limit(1)
        )
        record = (await company_db.execute(stmt)).scalars().first()
        if not record:
            raise DataBridgeValidationError(f"Asynchronous import job '{job_id}' not found.")

        if record.status == "COMPLETED":
            raise DataBridgeValidationError(f"Cannot cancel job '{job_id}': Job has already completed.")

        payload = dict(record.payload_json or {})
        record.status = "CANCELLED"
        payload["status"] = "CANCELLED"
        record.payload_json = dict(payload)
        record.last_attempt_at = datetime.now(timezone.utc)
        await company_db.commit()

        logger.info(f"[DataBridgeAsync] Job '{job_id}' marked as CANCELLED.")
        return await cls.get_job_status(company_db, company_id, job_id)
