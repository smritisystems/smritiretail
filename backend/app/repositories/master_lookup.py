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
Classification: Internal Architecture Standard
"""

from datetime import datetime, timezone
from typing import Sequence
from uuid import UUID

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.master_lookup import MasterType, MasterValue


class LookupRepository:
    """
    LookupRepository handles persistence queries for MasterType and MasterValue.
    It isolates raw database access from business rules per the SMRITI Architecture Standard.
    """

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_type_by_code(self, code: str) -> MasterType | None:
        stmt = select(MasterType).filter(MasterType.code == code)
        result = await self.db.execute(stmt)
        return result.scalars().first()

    async def get_type_by_id(self, type_id: UUID | str) -> MasterType | None:
        if isinstance(type_id, str):
            type_id = UUID(type_id)
        stmt = select(MasterType).filter(MasterType.id == type_id)
        result = await self.db.execute(stmt)
        return result.scalars().first()

    async def get_all_types(self) -> Sequence[MasterType]:
        stmt = select(MasterType).order_by(MasterType.code)
        result = await self.db.execute(stmt)
        return result.scalars().all()

    async def create_type(self, master_type: MasterType) -> MasterType:
        self.db.add(master_type)
        await self.db.commit()
        await self.db.refresh(master_type)
        return master_type

    async def get_value_by_id(self, value_id: UUID | str) -> MasterValue | None:
        if isinstance(value_id, str):
            value_id = UUID(value_id)
        stmt = select(MasterValue).filter(
            MasterValue.id == value_id,
            MasterValue.is_deleted == False
        )
        result = await self.db.execute(stmt)
        return result.scalars().first()

    async def get_value_by_code(self, master_type_id: UUID | str, code: str) -> MasterValue | None:
        if isinstance(master_type_id, str):
            master_type_id = UUID(master_type_id)
        stmt = select(MasterValue).filter(
            MasterValue.master_type_id == master_type_id,
            MasterValue.code == code,
            MasterValue.active == True,
            MasterValue.effective_to.is_(None),
            MasterValue.is_deleted == False
        )
        result = await self.db.execute(stmt)
        return result.scalars().first()

    async def get_values_by_type_code(
        self,
        type_code: str,
        active_only: bool = True,
        tenant_id: str | None = None
    ) -> Sequence[MasterValue]:
        stmt = (
            select(MasterValue)
            .join(MasterType, MasterValue.master_type_id == MasterType.id)
            .filter(
                MasterType.code == type_code,
                MasterValue.is_deleted == False,
                MasterValue.effective_to.is_(None)
            )
        )
        if tenant_id is not None:
            stmt = stmt.filter(
                or_(
                    MasterValue.is_system.is_(True),
                    MasterValue.tenant_id == tenant_id
                )
            )
        if active_only:
            stmt = stmt.filter(MasterValue.active == True)
        stmt = stmt.order_by(MasterValue.sort_order, MasterValue.name)
        result = await self.db.execute(stmt)
        return result.scalars().all()

    async def create_value(self, master_value: MasterValue) -> MasterValue:
        self.db.add(master_value)
        await self.db.commit()
        await self.db.refresh(master_value)
        return master_value

    async def update_value(self, master_value: MasterValue, update_data: dict) -> MasterValue:
        for key, value in update_data.items():
            if value is not None and hasattr(master_value, key):
                setattr(master_value, key, value)
        master_value.updated_at = datetime.now(timezone.utc)
        self.db.add(master_value)
        await self.db.commit()
        await self.db.refresh(master_value)
        return master_value

    async def deactivate_value(self, master_value: MasterValue) -> MasterValue:
        master_value.active = False
        master_value.updated_at = datetime.now(timezone.utc)
        self.db.add(master_value)
        await self.db.commit()
        await self.db.refresh(master_value)
        return master_value

    async def atomic_replace_value(self, old_value: MasterValue, new_value: MasterValue) -> MasterValue:
        now = datetime.now(timezone.utc)
        old_value.effective_to = now
        old_value.active = False
        old_value.updated_at = now
        
        new_value.supersedes_id = old_value.id
        new_value.effective_from = now
        new_value.effective_to = None
        new_value.active = True

        self.db.add(old_value)
        self.db.add(new_value)
        await self.db.commit()
        await self.db.refresh(new_value)
        return new_value

    async def get_history(self, value_id: UUID | str) -> Sequence[MasterValue]:
        target = await self.get_value_by_id(value_id)
        if not target:
            return []
        
        # Traverse history chain using code & master_type_id
        stmt = (
            select(MasterValue)
            .filter(
                MasterValue.master_type_id == target.master_type_id,
                MasterValue.code == target.code
            )
            .order_by(MasterValue.effective_from.desc())
        )
        result = await self.db.execute(stmt)
        return result.scalars().all()
