"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.24.0
Created      : 2026-08-23
Modified     : 2026-08-23
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from ...api.deps import get_company_db, get_tenant_context, TenantContext
from ...schemas.sync import SyncBatchRequest, SyncBatchResponse, SyncOperationItem
from ...services.conflict_engine import OfflineConflictResolutionEngine
from ...models.sync import POSOfflineSyncQueue

router = APIRouter()


@router.post("/push", response_model=SyncBatchResponse)
async def push_offline_sync_batch(
    req: SyncBatchRequest,
    db: AsyncSession = Depends(get_company_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """
    Ingests and processes a batch of offline transactions from a POS terminal into the tenant database.
    Applies 5-tier domain-driven conflict resolution, idempotency deduplication, price-at-sale preservation,
    and automatic escalation to the Store Manager Reconciliation Queue.
    """
    result = await OfflineConflictResolutionEngine.resolve_sync_batch(
        session=db,
        company_id=tenant_ctx.company_id,
        branch_id=tenant_ctx.branch_id,
        req=req
    )
    return result


@router.get("/reconciliation-queue")
async def get_reconciliation_queue(
    status: Optional[str] = Query(None, description="Filter by sync status (PENDING, NEEDS_REVIEW, COMMITTED, FAILED)"),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_company_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """
    Retrieves unresolved and flagged offline transactions from the Store Manager Reconciliation Queue.
    """
    stmt = select(POSOfflineSyncQueue).where(
        POSOfflineSyncQueue.company_id == tenant_ctx.company_id
    )
    if status:
        stmt = stmt.where(POSOfflineSyncQueue.sync_status == status)
    else:
        stmt = stmt.where(POSOfflineSyncQueue.sync_status.in_(["NEEDS_REVIEW", "FAILED", "PENDING"]))

    stmt = stmt.order_by(desc(POSOfflineSyncQueue.submitted_at)).limit(limit)
    rows = (await db.execute(stmt)).scalars().all()

    return {
        "company_id": tenant_ctx.company_id,
        "total_count": len(rows),
        "items": [
            {
                "id": r.id,
                "batch_id": r.batch_id,
                "client_tx_uuid": r.client_tx_uuid,
                "terminal_id": r.terminal_id,
                "txn_type": r.txn_type,
                "document_number": r.document_number,
                "sync_status": r.sync_status,
                "error_message": r.error_message,
                "retry_count": r.retry_count,
                "submitted_at": r.submitted_at.isoformat() if r.submitted_at else None,
                "synced_at": r.synced_at.isoformat() if r.synced_at else None
            }
            for r in rows
        ]
    }
