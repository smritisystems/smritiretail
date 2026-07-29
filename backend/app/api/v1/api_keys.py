"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.35.0
Created      : 2026-07-20
Modified     : 2026-07-20
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

from datetime import datetime
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Security, Request, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from ...api.deps import get_db, get_current_user, require_permission, get_tenant_context, TenantContext
from ...models.auth import User
from ...models.api_key import SMRITIServiceAccount, SMRITIAPIKey, SMRITIAPIKeyLog
from ...services.api_key_service import APIKeyService

router = APIRouter()


class ServiceAccountCreateRequest(BaseModel):
    code: str = Field(..., json_schema_extra={"example": "SA-WMS-SYNC"})
    name: str = Field(..., json_schema_extra={"example": "Warehouse Management Sync Agent"})
    description: Optional[str] = Field(None, json_schema_extra={"example": "Background integration agent for WMS barcode sync"})


class APIKeyGenerateRequest(BaseModel):
    service_account_id: str = Field(..., json_schema_extra={"example": "sa-uuid-101"})
    name: str = Field(..., json_schema_extra={"example": "WMS Production Primary Key"})
    permission_set_ids: List[str] = Field(..., json_schema_extra={"example": ["pol-inventory-mgmt"]})
    allowed_ip_cidrs: Optional[List[str]] = Field(None, json_schema_extra={"example": ["192.168.1.0/24"]})
    rate_limit_per_minute: int = Field(600, json_schema_extra={"example": 600})
    expires_at: Optional[datetime] = None


@router.post("/service-accounts", dependencies=[Depends(require_permission("API.MANAGE"))])
async def create_service_account(
    req: ServiceAccountCreateRequest,
    db: AsyncSession = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    svc = APIKeyService()
    sa = await svc.create_service_account(
        db=db,
        code=req.code,
        name=req.name,
        description=req.description,
        company_id=tenant_ctx.company_id,
        branch_id=tenant_ctx.branch_id,
    )
    return {
        "id": sa.id,
        "code": sa.code,
        "name": sa.name,
        "company_id": sa.company_id,
        "branch_id": sa.branch_id,
    }


@router.post("/generate", dependencies=[Depends(require_permission("API.MANAGE"))])
async def generate_api_key(
    req: APIKeyGenerateRequest,
    db: AsyncSession = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    svc = APIKeyService()
    res = await svc.generate_api_key(
        db=db,
        service_account_id=req.service_account_id,
        name=req.name,
        permission_set_ids=req.permission_set_ids,
        company_id=tenant_ctx.company_id,
        branch_id=tenant_ctx.branch_id,
        allowed_ip_cidrs=req.allowed_ip_cidrs,
        rate_limit_per_minute=req.rate_limit_per_minute,
        expires_at=req.expires_at,
    )
    return res


@router.get("", dependencies=[Depends(require_permission("API.MANAGE"))])
async def list_api_keys(
    db: AsyncSession = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    stmt = select(SMRITIAPIKey).where(
        SMRITIAPIKey.is_deleted == False
    )
    if tenant_ctx.company_id:
        stmt = stmt.where(SMRITIAPIKey.company_id == tenant_ctx.company_id)
    res = await db.execute(stmt)
    keys = res.scalars().all()
    return [
        {
            "id": k.id,
            "name": k.name,
            "key_prefix": k.key_prefix,
            "service_account_id": k.service_account_id,
            "rate_limit_per_minute": k.rate_limit_per_minute,
            "allowed_ip_cidrs": k.allowed_ip_cidrs,
            "is_active": k.is_active,
            "expires_at": k.expires_at.isoformat() if k.expires_at else None,
            "last_used_at": k.last_used_at.isoformat() if k.last_used_at else None,
        }
        for k in keys
    ]


@router.delete("/{key_id}", dependencies=[Depends(require_permission("API.MANAGE"))])
async def revoke_api_key(
    key_id: str,
    db: AsyncSession = Depends(get_db),
):
    stmt = select(SMRITIAPIKey).where(SMRITIAPIKey.id == key_id)
    res = await db.execute(stmt)
    api_key = res.scalars().first()
    if not api_key:
        raise HTTPException(status_code=404, detail="API key not found")

    api_key.is_active = False
    api_key.is_deleted = True
    await db.commit()
    return {"message": f"API key {key_id} successfully revoked."}


@router.get("/{key_id}/logs", dependencies=[Depends(require_permission("API.MANAGE"))])
async def get_api_key_logs(
    key_id: str,
    db: AsyncSession = Depends(get_db),
    limit: int = 50,
):
    stmt = select(SMRITIAPIKeyLog).where(
        SMRITIAPIKeyLog.api_key_id == key_id
    ).order_by(SMRITIAPIKeyLog.created_at.desc()).limit(limit)
    res = await db.execute(stmt)
    logs = res.scalars().all()
    return [
        {
            "id": l.id,
            "ip_address": l.ip_address,
            "endpoint": l.endpoint,
            "http_method": l.http_method,
            "status_code": l.status_code,
            "response_time_ms": l.response_time_ms,
            "timestamp": l.created_at.isoformat() if l.created_at else None,
        }
        for l in logs
    ]
