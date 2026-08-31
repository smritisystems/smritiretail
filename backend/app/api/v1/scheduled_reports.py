"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.72.0
Created      : 2026-08-28
Modified     : 2026-08-28
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import TenantContext, get_db, get_tenant_context
from app.schemas.scheduled_reports import (
    ReportDispatchLogOut,
    ReportScheduleCreate,
    ReportScheduleOut,
    ReportScheduleUpdate,
    TriggerScheduleResponse,
)
from app.services.reporting_distribution_svc import ReportDistributionEngine

router = APIRouter(prefix="/reporting/schedules", tags=["Reporting Schedules & Automated Distribution"])


@router.post(
    "",
    response_model=ReportScheduleOut,
    status_code=status.HTTP_201_CREATED,
    summary="Create Report Automation Schedule",
    description="Registers an unattended cron report schedule with multi-channel distribution configuration."
)
async def create_schedule(
    payload: ReportScheduleCreate,
    db: AsyncSession = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
) -> ReportScheduleOut:
    engine = ReportDistributionEngine(db, tenant_ctx)
    return await engine.create_schedule(payload)


@router.get(
    "",
    response_model=List[ReportScheduleOut],
    summary="List Scheduled Reports",
    description="Returns all active and inactive report schedules for the authenticated tenant."
)
async def list_schedules(
    db: AsyncSession = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
) -> List[ReportScheduleOut]:
    engine = ReportDistributionEngine(db, tenant_ctx)
    return await engine.list_schedules()


@router.get(
    "/{schedule_id}",
    response_model=ReportScheduleOut,
    summary="Get Schedule Details",
    description="Retrieves configuration, status, and last execution metrics for a specific schedule."
)
async def get_schedule(
    schedule_id: str,
    db: AsyncSession = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
) -> ReportScheduleOut:
    engine = ReportDistributionEngine(db, tenant_ctx)
    schedule = await engine.get_schedule(schedule_id)
    if not schedule:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Report schedule '{schedule_id}' not found."
        )
    return schedule


@router.put(
    "/{schedule_id}",
    response_model=ReportScheduleOut,
    summary="Update Schedule",
    description="Modifies cadence, export formats, distribution channels, or recipient lists for a schedule."
)
async def update_schedule(
    schedule_id: str,
    payload: ReportScheduleUpdate,
    db: AsyncSession = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
) -> ReportScheduleOut:
    engine = ReportDistributionEngine(db, tenant_ctx)
    updated = await engine.update_schedule(schedule_id, payload)
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Report schedule '{schedule_id}' not found."
        )
    return updated


@router.delete(
    "/{schedule_id}",
    status_code=status.HTTP_200_OK,
    summary="Delete / Deactivate Schedule",
    description="Soft-deletes a report schedule."
)
async def delete_schedule(
    schedule_id: str,
    db: AsyncSession = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
) -> dict:
    engine = ReportDistributionEngine(db, tenant_ctx)
    success = await engine.delete_schedule(schedule_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Report schedule '{schedule_id}' not found."
        )
    return {"status": "DELETED", "schedule_id": schedule_id}


@router.post(
    "/{schedule_id}/trigger",
    response_model=TriggerScheduleResponse,
    summary="Trigger Immediate Execution",
    description="Manually triggers immediate execution and multi-channel delivery of a report schedule."
)
async def trigger_schedule(
    schedule_id: str,
    db: AsyncSession = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
) -> TriggerScheduleResponse:
    engine = ReportDistributionEngine(db, tenant_ctx)
    try:
        return await engine.execute_schedule(schedule_id, force=True)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e)) from e
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e)) from e


@router.get(
    "/{schedule_id}/logs",
    response_model=List[ReportDispatchLogOut],
    summary="List Schedule Dispatch Logs",
    description="Returns tamper-evident forensic audit logs for all dispatch attempts under a schedule."
)
async def list_dispatch_logs(
    schedule_id: str,
    db: AsyncSession = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
) -> List[ReportDispatchLogOut]:
    engine = ReportDistributionEngine(db, tenant_ctx)
    return await engine.list_dispatch_logs(schedule_id)
