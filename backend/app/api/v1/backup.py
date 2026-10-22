"""
Project      : SMRITI Retail OS
Repository   : SMRITIRetailNX
Organization : AITDL NETWORKS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 1.0.0
Created      : 2026-10-22
Modified     : 2026-10-22
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from ...api import deps
from ...models.auth import User, UserRole
from ...schemas.backup import (
    BackupStatusResponse,
    BackupItemInfo,
    BackupJobProgress,
    BackupCreateRequest,
    RestoreReviewRequest,
    RestoreReviewResponse,
    RestoreExecuteRequest,
    RestoreResultResponse,
    BackupSettingsConfig,
)
from ...services.backup_restore_service import BackupRestoreService

router = APIRouter(prefix="/backup", tags=["Backup & Restore"])


def _verify_backup_permission(user: User = Depends(deps.get_current_user)) -> User:
    """Enforce MANAGER or SYSADMIN role for backup and restore operations."""
    if not user or user.role not in [UserRole.MANAGER, UserRole.SYSADMIN, "MANAGER", "SYSADMIN"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: Backup and recovery operations require Manager or Administrator privileges.",
        )
    return user


@router.get("/status", response_model=BackupStatusResponse, summary="Get Overall Data Protection Status")
async def get_backup_status(
    db: AsyncSession = Depends(deps.get_db),
    tenant: deps.TenantContext = Depends(deps.get_tenant_context),
    current_user: User = Depends(_verify_backup_permission),
):
    service = BackupRestoreService(db, tenant.company_id)
    return await service.get_status()


@router.get("/history", response_model=List[BackupItemInfo], summary="List Available Verified Recovery Points")
async def get_backup_history(
    db: AsyncSession = Depends(deps.get_db),
    tenant: deps.TenantContext = Depends(deps.get_tenant_context),
    current_user: User = Depends(_verify_backup_permission),
):
    service = BackupRestoreService(db, tenant.company_id)
    return await service.get_history()


@router.post("/create", response_model=BackupJobProgress, summary="Trigger Multi-Stage Asynchronous Backup Job")
async def create_backup(
    payload: Optional[BackupCreateRequest] = None,
    db: AsyncSession = Depends(deps.get_db),
    tenant: deps.TenantContext = Depends(deps.get_tenant_context),
    current_user: User = Depends(_verify_backup_permission),
):
    storage = payload.storage_location if payload and payload.storage_location else "local"
    service = BackupRestoreService(db, tenant.company_id)
    return await service.start_backup_job(storage_location=storage)


@router.get("/jobs/{job_id}", response_model=BackupJobProgress, summary="Get Live Backup Job Progress")
async def get_backup_job_progress(
    job_id: str,
    db: AsyncSession = Depends(deps.get_db),
    tenant: deps.TenantContext = Depends(deps.get_tenant_context),
    current_user: User = Depends(_verify_backup_permission),
):
    service = BackupRestoreService(db, tenant.company_id)
    job = await service.get_job_progress(job_id)
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Backup job '{job_id}' not found.",
        )
    return job


@router.post("/jobs/{job_id}/cancel", summary="Cancel Active Backup Job")
async def cancel_backup_job(
    job_id: str,
    db: AsyncSession = Depends(deps.get_db),
    tenant: deps.TenantContext = Depends(deps.get_tenant_context),
    current_user: User = Depends(_verify_backup_permission),
):
    service = BackupRestoreService(db, tenant.company_id)
    cancelled = await service.cancel_job(job_id)
    if not cancelled:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unable to cancel job: Job already completed, failed, or does not exist.",
        )
    return {"success": True, "message": "Backup job cancelled."}


@router.post("/restore/review", response_model=RestoreReviewResponse, summary="Review Recovery Point Before Restoring")
async def review_restore_point(
    payload: RestoreReviewRequest,
    db: AsyncSession = Depends(deps.get_db),
    tenant: deps.TenantContext = Depends(deps.get_tenant_context),
    current_user: User = Depends(_verify_backup_permission),
):
    service = BackupRestoreService(db, tenant.company_id)
    try:
        return await service.review_restore_point(payload.backup_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.post("/restore/execute", response_model=RestoreResultResponse, summary="Execute Restoration from Recovery Point")
async def execute_restore(
    payload: RestoreExecuteRequest,
    db: AsyncSession = Depends(deps.get_db),
    tenant: deps.TenantContext = Depends(deps.get_tenant_context),
    current_user: User = Depends(_verify_backup_permission),
):
    service = BackupRestoreService(db, tenant.company_id)
    try:
        return await service.execute_restore(
            backup_id=payload.backup_id,
            confirmed=payload.confirmed_destructive_overwrite,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.get("/settings", response_model=BackupSettingsConfig, summary="Get Backup & Retention Settings")
async def get_backup_settings(
    db: AsyncSession = Depends(deps.get_db),
    tenant: deps.TenantContext = Depends(deps.get_tenant_context),
    current_user: User = Depends(_verify_backup_permission),
):
    service = BackupRestoreService(db, tenant.company_id)
    return await service.get_settings()


@router.put("/settings", response_model=BackupSettingsConfig, summary="Update Backup & Retention Settings")
async def update_backup_settings(
    payload: BackupSettingsConfig,
    db: AsyncSession = Depends(deps.get_db),
    tenant: deps.TenantContext = Depends(deps.get_tenant_context),
    current_user: User = Depends(_verify_backup_permission),
):
    service = BackupRestoreService(db, tenant.company_id)
    return await service.update_settings(payload)
