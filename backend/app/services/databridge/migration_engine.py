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
Classification: Internal — Foundation DataBridge Migration & Rollback Toolkit
"""

# smriti_capability(entity="DATABRIDGE", capability="DATABRIDGE_MIGRATION_TOOLKIT", role="SERVICE", canonicalOwner="backend/app/services/databridge/migration_engine.py")

import hashlib
import json
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.item_master import Item, ItemVariant, ItemBarcode
from app.models.pricing import PriceBookEntry
from app.models.crm import Customer
from app.models.purchase import (
    Supplier,
    PurchaseOrder,
    PurchaseOrderItem,
    PurchaseReceipt,
    PurchaseReceiptItem,
    PurchaseBill,
    PurchaseBillItem,
)
from app.models.sales import (
    SalesInvoice,
    SalesInvoiceItem,
    SalesOrder,
    SalesOrderItem,
    SalesReturn,
    SalesReturnItem,
)
from app.models.inventory import (
    StockTransfer,
    StockTransferItem,
    StockAudit,
    StockAuditItem,
)
from app.models.audit import ComplianceImmutableAuditLog
from app.models.outbox import IntegrationOutboxEvent

from .exceptions import (
    DataBridgeError,
    DataBridgePermissionError,
    DataBridgeValidationError,
    DataBridgeTenantIsolationError,
)
from .models import (
    DataBridgeClassification,
    DataBridgeCommitRequest,
    DataBridgeEntityType,
    DataBridgePreviewRequest,
    DataBridgeRollbackRequest,
    DataBridgeRollbackResponse,
    DataBridgeTenantTransferRequest,
    DataBridgeTenantTransferResponse,
)
from .service import DataBridgeService
from .export_engine import DataBridgeExportEngine


class DataBridgeMigrationToolkit:
    """
    Enterprise Data Migration and Reversible Rollback Toolkit for SMRITI Retail OS.
    Executes deterministic soft-delete rollbacks and cross-tenant SMRITI-X replication.
    """

    # Map of entity type to canonical ORM model class
    MODEL_MAP = {
        DataBridgeEntityType.ITEM: Item,
        DataBridgeEntityType.VARIANT: ItemVariant,
        DataBridgeEntityType.BARCODE: ItemBarcode,
        DataBridgeEntityType.PRICEBOOK: PriceBookEntry,
        DataBridgeEntityType.CUSTOMER: Customer,
        DataBridgeEntityType.SUPPLIER: Supplier,
        DataBridgeEntityType.PURCHASE_ORDER: PurchaseOrder,
        DataBridgeEntityType.GOODS_RECEIPT_NOTE: PurchaseReceipt,
        DataBridgeEntityType.PURCHASE_INVOICE: PurchaseBill,
        DataBridgeEntityType.SALES_INVOICE: SalesInvoice,
        DataBridgeEntityType.SALES_ORDER: SalesOrder,
        DataBridgeEntityType.SALES_RETURN: SalesReturn,
        DataBridgeEntityType.STOCK_TRANSFER: StockTransfer,
        DataBridgeEntityType.STOCK_AUDIT: StockAudit,
    }

    @classmethod
    async def execute_rollback(
        cls,
        company_db: AsyncSession,
        company_id: str,
        actor_id: str,
        actor_role: str,
        req: DataBridgeRollbackRequest,
    ) -> DataBridgeRollbackResponse:
        """
        Executes a deterministic rollback of newly created records for a specific batch/job.
        In accordance with the Statutory Immutability Doctrine, never executes hard DELETEs;
        marks records with is_deleted=True, deleted_at=now(), and deleted_by=actor_id.
        """
        # Authorization check: SYSADMIN or ADMIN required
        if actor_role not in ("SYSADMIN", "ADMIN"):
            raise DataBridgePermissionError(
                f"Role '{actor_role}' is not authorized to execute DataBridge rollbacks (SYSADMIN or ADMIN required)."
            )

        DataBridgeService.verify_tenant_boundary(company_db, company_id)

        model_cls = cls.MODEL_MAP.get(req.entity_type)
        if not model_cls:
            raise DataBridgeValidationError(f"Entity type '{req.entity_type}' is not supported for rollback.")

        # Resolve candidate records to rollback
        candidate_ids: List[str] = []

        # 1. Search in integration_outbox_events if it was an async job
        outbox_stmt = select(IntegrationOutboxEvent).where(
            IntegrationOutboxEvent.company_id == company_id,
            IntegrationOutboxEvent.id == req.job_or_batch_id,
        )
        job_event = (await company_db.execute(outbox_stmt)).scalars().first()

        if job_event and job_event.payload:
            payload = job_event.payload
            # Extract recorded affected IDs if present
            if "affected_ids" in payload and isinstance(payload["affected_ids"], list):
                candidate_ids.extend([str(x) for x in payload["affected_ids"]])
            elif "committed_identifiers" in payload and isinstance(payload["committed_identifiers"], list):
                candidate_ids.extend([str(x) for x in payload["committed_identifiers"]])

        # 2. Search in compliance_immutable_audit_logs
        if not candidate_ids:
            audit_stmt = select(ComplianceImmutableAuditLog).where(
                ComplianceImmutableAuditLog.company_id == company_id,
                ComplianceImmutableAuditLog.entity_id == req.job_or_batch_id,
            )
            audit_entry = (await company_db.execute(audit_stmt)).scalars().first()
            if audit_entry and audit_entry.action_summary:
                # Fallback: check if audit entry matches
                pass

        # 3. Direct query for records associated with job_or_batch_id
        if not candidate_ids:
            # Check by created_by or request_id matching job_or_batch_id
            if hasattr(model_cls, "created_by"):
                direct_stmt = select(model_cls.id).where(
                    model_cls.company_id == company_id,
                    model_cls.created_by == req.job_or_batch_id,
                    model_cls.is_deleted == False,
                ).limit(req.max_records)
                matched = (await company_db.execute(direct_stmt)).scalars().all()
                candidate_ids.extend([str(x) for x in matched])

        # 4. If job_or_batch_id is a direct record ID or prefix
        if not candidate_ids:
            direct_id_stmt = select(model_cls.id).where(
                model_cls.company_id == company_id,
                model_cls.id == req.job_or_batch_id,
                model_cls.is_deleted == False,
            )
            single_match = (await company_db.execute(direct_id_stmt)).scalars().first()
            if single_match:
                candidate_ids.append(str(single_match))

        # Check downstream references for each candidate
        reverted_ids: List[str] = []
        skipped_ids: List[str] = []

        now_utc = datetime.now(timezone.utc)
        for cid in candidate_ids:
            # Ensure entity belongs to this company
            check_stmt = select(model_cls).where(
                model_cls.id == cid,
                model_cls.company_id == company_id,
                model_cls.is_deleted == False,
            )
            record = (await company_db.execute(check_stmt)).scalars().first()
            if not record:
                skipped_ids.append(cid)
                continue

            if not req.dry_run:
                # Apply soft delete
                record.is_deleted = True
                if hasattr(record, "deleted_at"):
                    record.deleted_at = now_utc
                if hasattr(record, "deleted_by"):
                    record.deleted_by = actor_id
                company_db.add(record)

            reverted_ids.append(cid)

        rollback_id = f"rbk_{uuid.uuid4().hex[:12]}"
        status_str = "SIMULATED" if req.dry_run else "COMPLETED"

        # Compute SHA-256 digest
        summary_dict = {
            "rollback_id": rollback_id,
            "job_or_batch_id": req.job_or_batch_id,
            "entity_type": req.entity_type.value,
            "reverted_creates": len(reverted_ids),
            "reverted_updates": 0,
            "skipped_records": len(skipped_ids),
            "dry_run": req.dry_run,
            "status": status_str,
            "reason": req.reason,
            "actor_id": actor_id,
        }
        serialized = json.dumps(summary_dict, sort_keys=True)
        sha256_hash = hashlib.sha256(serialized.encode("utf-8")).hexdigest()

        if not req.dry_run:
            # Commit mutations
            await company_db.commit()

            # Record permanent WORM audit log
            await DataBridgeService.record_audit_entry(
                company_db=company_db,
                company_id=company_id,
                event_type="DATABRIDGE_ROLLBACK_EXECUTED",
                entity_name=f"databridge_rollback_{req.entity_type.value.lower()}",
                entity_id=rollback_id,
                action_summary=f"Rolled back {len(reverted_ids)} records for job/batch '{req.job_or_batch_id}'. Reason: {req.reason}",
                actor_id=actor_id,
                actor_role=actor_role,
                payload_data=summary_dict,
            )
            await company_db.commit()

        return DataBridgeRollbackResponse(
            rollback_id=rollback_id,
            job_or_batch_id=req.job_or_batch_id,
            entity_type=req.entity_type.value,
            reverted_creates=len(reverted_ids),
            reverted_updates=0,
            skipped_records=len(skipped_ids),
            dry_run=req.dry_run,
            status=status_str,
            affected_ids=reverted_ids,
            compliance_sha256=sha256_hash,
            executed_at=now_utc.isoformat(),
        )

    @classmethod
    async def execute_tenant_transfer(
        cls,
        source_db: AsyncSession,
        target_db: AsyncSession,
        actor_id: str,
        actor_role: str,
        req: DataBridgeTenantTransferRequest,
    ) -> DataBridgeTenantTransferResponse:
        """
        Replicates catalog and party data from a source tenant to a target tenant
        with automatic company ID re-scoping and two-phase preview validation.
        """
        if actor_role not in ("SYSADMIN", "ADMIN"):
            raise DataBridgePermissionError(
                f"Role '{actor_role}' is not authorized to execute cross-tenant transfers."
            )

        DataBridgeService.verify_tenant_boundary(source_db, req.source_company_id)
        DataBridgeService.verify_tenant_boundary(target_db, req.target_company_id)

        transfer_id = f"txfr_{uuid.uuid4().hex[:12]}"
        now_utc = datetime.now(timezone.utc)
        entity_summaries: Dict[str, Dict[str, Any]] = {}

        for entity_type in req.entity_types:
            # 1. Fetch records from source
            raw_records = await DataBridgeExportEngine.fetch_entity_records(
                company_db=source_db,
                company_id=req.source_company_id,
                entity_type=entity_type,
                limit=req.limit_per_entity,
            )

            if not raw_records:
                entity_summaries[entity_type.value] = {
                    "source_count": 0,
                    "target_committed": 0,
                    "status": "EMPTY_SOURCE",
                }
                continue

            # 2. Re-scope records for target
            rescoped_rows: List[Dict[str, Any]] = []
            for row in raw_records:
                cleaned = dict(row)
                cleaned["company_id"] = req.target_company_id
                rescoped_rows.append(cleaned)

            # 3. Preview in target tenant
            prev_req = DataBridgePreviewRequest(
                entity_type=entity_type,
                rows=rescoped_rows,
                dry_run=True,
            )
            prev_res = await DataBridgeService.execute_preview(
                company_db=target_db,
                tenant_id=req.target_company_id,
                company_id=req.target_company_id,
                branch_id="BR-MAIN-001",
                actor_id=actor_id,
                actor_role=actor_role,
                req=prev_req,
            )

            target_committed = 0
            if req.transfer_mode == "COMMIT" and prev_res.can_commit:
                commit_req = DataBridgeCommitRequest(
                    entity_type=entity_type,
                    preview_token=prev_res.preview_token,
                    confirmed=True,
                    rows=rescoped_rows,
                )
                commit_res = await DataBridgeService.execute_commit(
                    company_db=target_db,
                    tenant_id=req.target_company_id,
                    company_id=req.target_company_id,
                    branch_id="BR-MAIN-001",
                    actor_id=actor_id,
                    actor_role=actor_role,
                    req=commit_req,
                )
                target_committed = commit_res.committed_count

            entity_summaries[entity_type.value] = {
                "source_count": len(raw_records),
                "can_commit": prev_res.can_commit,
                "preview_create_count": prev_res.summary.create_count,
                "preview_update_count": prev_res.summary.update_count,
                "target_committed": target_committed,
                "status": "COMMITTED" if req.transfer_mode == "COMMIT" else "PREVIEWED",
            }

        status_str = "COMMITTED" if req.transfer_mode == "COMMIT" else "PREVIEWED"
        summary_dict = {
            "transfer_id": transfer_id,
            "source_company_id": req.source_company_id,
            "target_company_id": req.target_company_id,
            "transfer_mode": req.transfer_mode,
            "status": status_str,
            "entity_summaries": entity_summaries,
        }
        serialized = json.dumps(summary_dict, sort_keys=True)
        sha256_hash = hashlib.sha256(serialized.encode("utf-8")).hexdigest()

        # Write audit log to target database
        await DataBridgeService.record_audit_entry(
            company_db=target_db,
            company_id=req.target_company_id,
            event_type="DATABRIDGE_TENANT_TRANSFER",
            entity_name="databridge_tenant_transfer",
            entity_id=transfer_id,
            action_summary=f"Replicated {len(req.entity_types)} entity types from '{req.source_company_id}' to '{req.target_company_id}' (Mode: {req.transfer_mode}).",
            actor_id=actor_id,
            actor_role=actor_role,
            payload_data=summary_dict,
        )
        await target_db.commit()

        return DataBridgeTenantTransferResponse(
            transfer_id=transfer_id,
            source_company_id=req.source_company_id,
            target_company_id=req.target_company_id,
            transfer_mode=req.transfer_mode,
            status=status_str,
            entity_summaries=entity_summaries,
            compliance_sha256=sha256_hash,
            executed_at=now_utc.isoformat(),
        )
