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


from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.api.deps import TenantContext
from app.compliance.models.compliance import ComplianceOutbox
from app.repositories.base import BaseRepository


class ComplianceOutboxRepository(BaseRepository[ComplianceOutbox]):
    """
    Repository for managing ComplianceOutbox persistence logic.
    """
    def __init__(self, db: AsyncSession, tenant_ctx: TenantContext | None = None):
        super().__init__(ComplianceOutbox, db, tenant_ctx)

    async def get_by_idempotency_key(self, idempotency_key: str) -> ComplianceOutbox | None:
        """
        Retrieves outbox record by unique idempotency key.
        """
        stmt = select(self.model).filter(
            self.model.idempotency_key == idempotency_key,
            self.model.is_deleted.is_(False)
        )
        stmt = self._apply_tenant_filter(stmt)
        result = await self.db.execute(stmt)
        return result.scalars().first()
