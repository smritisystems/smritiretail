"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 4.3.0
Created      : 2026-07-20
Modified     : 2026-07-20
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

from typing import Dict, Any, List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, get_current_user
from app.models.auth import User
from app.services.offline_sync_service import OfflineSyncService

router = APIRouter(prefix="/pos", tags=["Offline POS Queue Sync Engine"])


@router.post(
    "/offline-sync",
    summary="Batch Sync Offline POS Invoices",
    description="Processes batch array of client-side offline queued invoices with idempotent deduplication."
)
async def batch_sync_offline_pos(
    payload: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    invoices = payload.get("invoices", [])
    shift_id = payload.get("shift_id", "SHIFT-OFFLINE-01")

    if not invoices:
        return {
            "status": "NO_OP",
            "message": "No offline invoices submitted in batch payload.",
            "processed_count": 0,
        }

    svc = OfflineSyncService(db)
    result = await svc.sync_offline_invoices(invoices=invoices, shift_id=shift_id)
    return {
        "success": True,
        **result,
    }
