"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 10.0.0
Created      : 2026-07-17
Modified     : 2026-07-21
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal Architecture Standard
"""

from typing import List, Optional
from sqlalchemy.future import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..api.deps import TenantContext
from ..models.pos import PosSession, PosTransaction
from .base import BaseRepository


class PosSessionRepository(BaseRepository[PosSession]):
    def __init__(self, db: AsyncSession, tenant_ctx: Optional[TenantContext] = None):
        super().__init__(PosSession, db, tenant_ctx)

    async def get_by_session_no(self, session_no: str) -> Optional[PosSession]:
        stmt = select(PosSession).filter(
            PosSession.session_no == session_no,
            PosSession.is_deleted == False,
        )
        stmt = self._apply_tenant_filter(stmt)
        result = await self.db.execute(stmt)
        return result.scalars().first()
