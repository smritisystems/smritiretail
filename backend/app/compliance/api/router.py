"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.16.0
Created      : 2026-07-12
Modified     : 2026-07-12
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""


from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import TenantContext, get_db, get_tenant_context
from app.compliance.exceptions import PolicyViolationException
from app.compliance.schemas.compliance import ComplianceOutboxOut, DebugOutboxIn, HealthStatusOut
from app.compliance.services.compliance_service import ComplianceService
from app.compliance.services.policy_service import PolicyService
from app.compliance.services.registry_service import RegistryService
from app.compliance.vault.crypto import master_key_str
from app.core.config import settings


def get_registry_service() -> RegistryService:
    return RegistryService()

router = APIRouter(prefix="/compliance", tags=["Compliance"])

@router.get(
    "/health",
    response_model=HealthStatusOut,
    summary="Compliance System Health Check",
    description="Probes database, vault credentials state, and active connectors."
)
async def check_compliance_health(
    db: AsyncSession = Depends(get_db),
    registry_service: RegistryService = Depends(get_registry_service)
) -> HealthStatusOut:
    """
    轻量级健康检查 (Probes DB, Vault, and loaded connectors count).
    """
    # 1. Probe database
    try:
        await db.execute(text("SELECT 1"))
        db_status = "healthy"
    except Exception:
        db_status = "unhealthy"

    # 2. Probe vault master key presence
    vault_status = "healthy" if master_key_str else "unhealthy"

    # 3. Probe registry state
    try:
        connectors_count = registry_service.get_connectors_count()
        registry_status = "healthy"
    except Exception:
        connectors_count = 0
        registry_status = "unhealthy"

    overall_status = "healthy"
    if "unhealthy" in [db_status, vault_status, registry_status]:
        overall_status = "unhealthy"

    return HealthStatusOut(
        status=overall_status,
        database=db_status,
        vault=vault_status,
        registry=registry_status,
        connectors=connectors_count,
        version=settings.VERSION,
        milestone="1"
    )

@router.post(
    "/debug/outbox",
    response_model=ComplianceOutboxOut,
    summary="Insert Debug Outbox Event",
    description="Inserts outbox payload for integration testing. Admin-only, disabled in production."
)
async def insert_debug_outbox(
    payload: DebugOutboxIn,
    db: AsyncSession = Depends(get_db),
    tenant_ctx: TenantContext | None = Depends(get_tenant_context),
    registry_service: RegistryService = Depends(get_registry_service)
) -> Any:
    """
    Allows developers/integrators to manually insert an outbox event.
    Strictly disabled and hidden in production environments.
    """
    # Gated check for production environment
    if settings.ENVIRONMENT == "production":
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Not Found"
        )

    policy_service = PolicyService(registry_service)
    compliance_service = ComplianceService(db, tenant_ctx, policy_service)
    try:
        event = await compliance_service.queue_outbox_event(
            service_id=payload.service_id,
            action=payload.action,
            payload=payload.payload,
            idempotency_key=payload.idempotency_key
        )
        return event
    except PolicyViolationException as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        ) from e
