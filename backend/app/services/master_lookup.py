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
import logging

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID

from ..models.master_lookup import MasterType, MasterValue
from ..repositories.master_lookup import LookupRepository
from ..schemas.master_lookup import MasterValueCreate, MasterValueReplace, MasterValueUpdate

logger = logging.getLogger("smriti.master_lookup")

# Event signal listener registry for real-time broadcast and cache invalidation
_EVENT_LISTENERS: list[callable] = []


def register_lookup_event_listener(listener: callable):
    if listener not in _EVENT_LISTENERS:
        _EVENT_LISTENERS.append(listener)


async def _emit_lookup_event(event_type: str, payload: dict):
    logger.info(f"[LOOKUP EVENT] Emitting '{event_type}': {payload}")
    for listener in _EVENT_LISTENERS:
        try:
            if callable(listener):
                res = listener(event_type, payload)
                if hasattr(res, "__await__"):
                    await res
        except Exception as e:
            logger.warning(f"Error executing lookup event listener: {e}")


class LookupService:
    """
    LookupService enforces domain rules, tree hierarchy integrity, atomic replacement
    versioning, system category guards, and cache invalidation signals.
    """

    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = LookupRepository(db)

    async def get_value(self, id_or_code: str, type_code: str | None = None) -> MasterValue:
        val: MasterValue | None = None
        try:
            val_id = UUID(id_or_code)
            val = await self.repo.get_value_by_id(val_id)
        except ValueError:
            if not type_code:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="type_code is required when requesting lookup value by code."
                )
            mtype = await self.repo.get_type_by_code(type_code)
            if not mtype:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Master lookup type '{type_code}' not found."
                )
            val = await self.repo.get_value_by_code(mtype.id, id_or_code)

        if not val or not val.active:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Master value '{id_or_code}' not found or deactivated."
            )
        return val

    async def search_values(self, type_code: str, active_only: bool = True) -> list[MasterValue]:
        mtype = await self.repo.get_type_by_code(type_code)
        if not mtype:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Master lookup type '{type_code}' not found."
            )
        values = await self.repo.get_values_by_type_code(type_code, active_only=active_only)
        return list(values)

    async def validate_value(self, type_code: str, code: str) -> bool:
        mtype = await self.repo.get_type_by_code(type_code)
        if not mtype:
            return False
        val = await self.repo.get_value_by_code(mtype.id, code)
        return bool(val and val.active)

    async def _validate_hierarchy(self, master_type_id: UUID, parent_value_id: UUID | None, target_val_id: UUID | None = None):
        if not parent_value_id:
            return

        parent = await self.repo.get_value_by_id(parent_value_id)
        if not parent:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Parent lookup value '{parent_value_id}' does not exist."
            )

        # 1. Same Category Constraint
        if parent.master_type_id != master_type_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Parent lookup record MUST belong to the same master category."
            )

        # 2. Acyclic Tree & Max Depth Constraint
        depth = 1
        curr = parent
        visited = {target_val_id} if target_val_id else set()

        while curr:
            if curr.id in visited:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Cyclic parent-child relationship detected in lookup tree."
                )
            visited.add(curr.id)
            depth += 1
            if depth > 3:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Hierarchy depth exceeds maximum allowed limit of 3 levels."
                )
            if curr.parent_value_id:
                curr = await self.repo.get_value_by_id(curr.parent_value_id)
            else:
                break

    async def create_value(self, type_code: str, value_in: MasterValueCreate) -> MasterValue:
        mtype = await self.repo.get_type_by_code(type_code)
        if not mtype:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Master lookup type '{type_code}' not found."
            )

        # Code Uniqueness Check under category
        existing = await self.repo.get_value_by_code(mtype.id, value_in.code)
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Lookup code '{value_in.code}' already exists under '{type_code}'."
            )

        # Hierarchy validation
        await self._validate_hierarchy(mtype.id, value_in.parent_value_id)

        val_obj = MasterValue(
            master_type_id=mtype.id,
            code=value_in.code.upper(),
            name=value_in.name,
            parent_value_id=value_in.parent_value_id,
            data=value_in.data or {},
            active=value_in.active if value_in.active is not None else True,
            sort_order=value_in.sort_order or 0,
            effective_from=datetime.now(timezone.utc),
            effective_to=None
        )

        created = await self.repo.create_value(val_obj)
        await _emit_lookup_event("lookup.created", {
            "id": str(created.id),
            "type_code": type_code,
            "code": created.code,
            "name": created.name
        })
        return created

    async def update_value(self, value_id: str, value_in: MasterValueUpdate) -> MasterValue:
        val = await self.repo.get_value_by_id(value_id)
        if not val:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Master lookup value '{value_id}' not found."
            )

        if value_in.parent_value_id is not None:
            await self._validate_hierarchy(val.master_type_id, value_in.parent_value_id, target_val_id=val.id)

        update_dict = value_in.model_dump(exclude_unset=True)
        updated = await self.repo.update_value(val, update_dict)
        await _emit_lookup_event("lookup.updated", {
            "id": str(updated.id),
            "code": updated.code,
            "name": updated.name
        })
        return updated

    async def replace_value(self, value_id: str, replace_in: MasterValueReplace) -> MasterValue:
        old_val = await self.repo.get_value_by_id(value_id)
        if not old_val:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Master lookup value '{value_id}' not found."
            )

        new_data = replace_in.new_data if replace_in.new_data is not None else old_val.data

        new_val = MasterValue(
            master_type_id=old_val.master_type_id,
            code=old_val.code,  # Code is immutable per v5.1.0 Architecture Specification
            name=replace_in.new_name,
            parent_value_id=old_val.parent_value_id,
            data=new_data,
            active=True,
            sort_order=old_val.sort_order
        )

        replaced = await self.repo.atomic_replace_value(old_val, new_val)
        await _emit_lookup_event("lookup.replaced", {
            "old_id": str(old_val.id),
            "new_id": str(replaced.id),
            "code": replaced.code,
            "new_name": replaced.name
        })
        return replaced

    async def deactivate_value(self, value_id: str) -> MasterValue:
        val = await self.repo.get_value_by_id(value_id)
        if not val:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Master lookup value '{value_id}' not found."
            )

        mtype = await self.repo.get_type_by_id(val.master_type_id)
        if mtype and mtype.is_system:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"System category lookup code '{val.code}' is protected and cannot be deactivated."
            )

        deactivated = await self.repo.deactivate_value(val)
        await _emit_lookup_event("lookup.deactivated", {
            "id": str(deactivated.id),
            "code": deactivated.code
        })
        return deactivated

    async def get_audit_history(self, value_id: str) -> list[MasterValue]:
        history = await self.repo.get_history(value_id)
        return list(history)
