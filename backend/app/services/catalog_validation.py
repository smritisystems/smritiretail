"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.32.0
Created      : 2026-09-13
Modified     : 2026-09-13
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

from typing import Optional, List, Dict, Any
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException

from ..models.master_lookup import MasterType, MasterValue
from ..db.session import async_session


class CatalogDimensionValidator:
    """
    Validates and normalizes catalog dimensions (e.g. Brand, Category, Department)
    against the authoritative Master Lookup registry in the SMRITI control plane (smritisys).
    Enforces case-insensitive matching and prevents unapproved catalog values.
    """

    @classmethod
    async def _validate_brand_impl(
        cls,
        session: AsyncSession,
        brand_val: Optional[str],
        strict: bool = True
    ) -> Optional[str]:
        if brand_val is None:
            return None
        
        clean_val = str(brand_val).strip()
        if not clean_val:
            return None

        stmt = (
            select(MasterValue.code, MasterValue.name)
            .join(MasterType, MasterType.id == MasterValue.master_type_id)
            .where(
                MasterType.code == "brand",
                MasterValue.is_deleted == False,
                MasterValue.active == True,
            )
        )
        res = await session.execute(stmt)
        brand_rows = res.all()

        target_lower = clean_val.casefold()
        for row_code, row_name in brand_rows:
            if row_code.strip().casefold() == target_lower or row_name.strip().casefold() == target_lower:
                return row_code

        if strict:
            raise HTTPException(
                status_code=422,
                detail={
                    "code": "SMRITI-VAL-002",
                    "field": "brand",
                    "value": clean_val,
                    "message": (
                        f"Brand '{clean_val}' is not registered in the Master Lookup registry. "
                        f"Please add and approve this brand in Master Management before assigning it to items."
                    ),
                    "suggested_action": "Navigate to System Master Management -> Brand to approve new brands."
                }
            )

        return clean_val

    @classmethod
    async def validate_and_normalize_brand(
        cls,
        control_db: Optional[AsyncSession] = None,
        brand_val: Optional[str] = None,
        strict: bool = True,
    ) -> Optional[str]:
        """
        Validates the brand against Master Lookup in smritisys.
        Returns the canonical code if valid. Raises HTTP 422 if invalid and strict=True.
        """
        if control_db is not None:
            return await cls._validate_brand_impl(control_db, brand_val, strict)

        async with async_session() as fallback_session:
            return await cls._validate_brand_impl(fallback_session, brand_val, strict)

    @classmethod
    async def get_approved_brands(
        cls,
        control_db: Optional[AsyncSession] = None
    ) -> List[Dict[str, str]]:
        """Returns all approved active brands from Master Lookup."""
        async def _query(session: AsyncSession):
            stmt = (
                select(MasterValue.code, MasterValue.name)
                .join(MasterType, MasterType.id == MasterValue.master_type_id)
                .where(
                    MasterType.code == "brand",
                    MasterValue.is_deleted == False,
                    MasterValue.active == True,
                )
                .order_by(MasterValue.sort_order.asc(), MasterValue.name.asc())
            )
            res = await session.execute(stmt)
            return [{"code": r[0], "name": r[1]} for r in res.all()]

        if control_db is not None:
            return await _query(control_db)

        async with async_session() as fallback_session:
            return await _query(fallback_session)
