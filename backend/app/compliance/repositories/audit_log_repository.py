"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.16.0
Created      : 2026-07-12
Modified     : 2026-07-12
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""


from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import TenantContext
from app.compliance.models.compliance import ComplianceAuditLog
from app.repositories.base import BaseRepository


class ComplianceAuditLogRepository(BaseRepository[ComplianceAuditLog]):
    """
    Repository for managing ComplianceAuditLog persistence logic.
    """
    def __init__(self, db: AsyncSession, tenant_ctx: TenantContext | None = None):
        super().__init__(ComplianceAuditLog, db, tenant_ctx)
