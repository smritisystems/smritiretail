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
    PreflightCheckResponse,
    BackupLogsResponse,
    PruneBackupsRequest,
    PruneBackupsResponse,
)
from ...services.backup_restore_service import BackupRestoreService
from ...core.backup_engine import MasterBackupEngine

router = APIRouter(prefix="/backup", tags=["Backup & Restore"])


def _verify_backup_permission(user: User = Depends(deps.get_current_user)) -> User:
    """Enforce MANAGER or SYSADMIN role for backup and restore operations."""
    if not user or user.role not in [UserRole.MANAGER, UserRole.SYSADMIN, "MANAGER", "SYSADMIN"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: Backup and recovery operations require Manager or Administrator privileges.",
        )
    return user


@router.get("/preflight", response_model=PreflightCheckResponse, summary="Perform System & Storage Preflight Checks")
async def get_preflight_checks(
    current_user: User = Depends(_verify_backup_permission),
):
    return MasterBackupEngine.get_preflight_check()


@router.get("/active-job", response_model=Optional[BackupJobProgress], summary="Get Current Running Job If Any")
async def get_active_job(
    current_user: User = Depends(_verify_backup_permission),
):
    return MasterBackupEngine.get_active_running_job()


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
    backup_mode = payload.backup_mode if payload and payload.backup_mode else "full"
    user_name = current_user.username if hasattr(current_user, "username") and current_user.username else "System Administrator"
    service = BackupRestoreService(db, tenant.company_id)
    try:
        return await service.start_backup_job(
            storage_location=storage,
            initiating_user=user_name,
            backup_mode=backup_mode,
        )
    except ValueError as val_err:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(val_err))


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


@router.get("/jobs/{job_id}/logs", response_model=BackupLogsResponse, summary="Get Live Structured Logs for Job")
async def get_backup_job_logs(
    job_id: str,
    tail: int = Query(100, ge=1, le=1000),
    current_user: User = Depends(_verify_backup_permission),
):
    return MasterBackupEngine.get_logs(job_id, tail=tail)


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


@router.post("/jobs/{job_id}/retry", response_model=BackupJobProgress, summary="Retry a Failed Backup Job")
async def retry_backup_job(
    job_id: str,
    db: AsyncSession = Depends(deps.get_db),
    tenant: deps.TenantContext = Depends(deps.get_tenant_context),
    current_user: User = Depends(_verify_backup_permission),
):
    service = BackupRestoreService(db, tenant.company_id)
    prev_job = await service.get_job_progress(job_id)
    storage = prev_job.storage_location_type if prev_job else "local"
    user_name = current_user.username if hasattr(current_user, "username") and current_user.username else "System Administrator"
    try:
        return await service.start_backup_job(storage_location=storage, initiating_user=user_name)
    except ValueError as val_err:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(val_err))


@router.post("/prune", response_model=PruneBackupsResponse, summary="Manually Trigger Retention Pruning")
async def prune_backups(
    payload: Optional[PruneBackupsRequest] = None,
    db: AsyncSession = Depends(deps.get_db),
    tenant: deps.TenantContext = Depends(deps.get_tenant_context),
    current_user: User = Depends(_verify_backup_permission),
):
    service = BackupRestoreService(db, tenant.company_id)
    override = payload.retention_override if payload else None
    return await service.prune_expired_backups(retention_override=override)



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
