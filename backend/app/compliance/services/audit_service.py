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

import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import TenantContext
from app.compliance.models.compliance import ComplianceAuditLog
from app.compliance.repositories.audit_log_repository import ComplianceAuditLogRepository


class AuditService:
    """
    Coordinates creation and query of compliance gateway audit logs.
    """
    def __init__(self, db: AsyncSession, tenant_ctx: TenantContext | None = None) -> None:
        self.db = db
        self.tenant_ctx = tenant_ctx
        self.repo = ComplianceAuditLogRepository(db, tenant_ctx)

    async def log_action(
        self,
        service_id: str,
        endpoint: str,
        request_payload: str | None = None,
        response_payload: str | None = None,
        status_code: int | None = None,
        duration_ms: int | None = None
    ) -> ComplianceAuditLog:
        """
        Persists a gateway communication audit record.
        """
        log_rec = ComplianceAuditLog(
            id=f"audit-{uuid.uuid4().hex[:8]}",
            service_id=service_id,
            endpoint=endpoint,
            request_payload=request_payload,
            response_payload=response_payload,
            status_code=status_code,
            duration_ms=duration_ms
        )
        created = await self.repo.create(log_rec)
        await self.db.commit()
        return created
