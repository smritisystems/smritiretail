"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 5.1.0
Created      : 2026-07-21
Modified     : 2026-07-21
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import uuid
from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.api.deps import get_db, get_tenant_context, TenantContext, require_permission
from app.models.exchange import DataExchangeTask, DataExchangeFieldMapping


router = APIRouter(tags=["Data Exchange Integration"])


class ExchangeTaskCreate(BaseModel):
    name: str
    direction: str  # 'Import' | 'Export'
    entity_type: str
    file_type: Optional[str] = "CSV"
    mapping_id: Optional[str] = None


class ExchangeTaskResponse(BaseModel):
    id: str
    name: str
    direction: str
    entity_type: str
    file_type: str
    mapping_id: Optional[str] = None
    status: str
    last_run: Optional[datetime] = None
    last_log: Optional[str] = None

    model_config = {"from_attributes": True}


@router.get("/tasks", response_model=List[ExchangeTaskResponse], dependencies=[Depends(require_permission("SYSTEM.CONFIG"))])
async def list_exchange_tasks(
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(DataExchangeTask).filter(DataExchangeTask.is_deleted == False)
    res = await db.execute(stmt)
    return res.scalars().all()


@router.post("/tasks", response_model=ExchangeTaskResponse, status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_permission("SYSTEM.CONFIG"))])
async def create_exchange_task(
    payload: ExchangeTaskCreate,
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_db),
):
    task = DataExchangeTask(
        id=f"ex-{uuid.uuid4().hex[:8]}",
        name=payload.name,
        direction=payload.direction,
        entity_type=payload.entity_type,
        file_type=payload.file_type or "CSV",
        mapping_id=payload.mapping_id,
        status="Idle"
    )
    db.add(task)
    await db.commit()
    await db.refresh(task)
    return task
