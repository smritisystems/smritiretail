"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.22.0
Created      : 2026-08-23
Modified     : 2026-08-23
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from ..deps import get_db, get_tenant_context, TenantContext
from ...services.offline_sync_service import OfflineSyncService

router = APIRouter()


class SyncBatchRequest(BaseModel):
    batch_id: str
    transactions: List[Dict[str, Any]]


@router.post("/push")
async def push_offline_sync_batch(
    req: SyncBatchRequest,
    db: AsyncSession = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """
    Ingests and processes a batch of offline transactions from a POS terminal.
    Guarantees deduplication and atomic ledger commits.
    """
    result = await OfflineSyncService.process_sync_batch(
        session=db,
        company_id=tenant_ctx.company_id,
        branch_id=tenant_ctx.branch_id,
        batch_id=req.batch_id,
        transactions=req.transactions
    )
    return result
