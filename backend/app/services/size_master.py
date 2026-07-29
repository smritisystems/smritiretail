"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 5.5.0
Created      : 2026-07-21
Modified     : 2026-07-21
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal Architecture Standard
"""

import uuid
import logging
from typing import Optional, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from fastapi import HTTPException

logger = logging.getLogger(__name__)

from ..models.size_master import SizeScale, SizeValue, SizeConversion
from ..repositories.size_master import SizeMasterRepository
from ..api.deps import TenantContext
from ..schemas.size_master import SizeScaleCreate, SizeScaleUpdate, SizeScaleResponse


class SizeMasterService:
    def __init__(self, db: AsyncSession, tenant_ctx: Optional[TenantContext] = None):
        self.db = db
        self.tenant_ctx = tenant_ctx
        self.repo = SizeMasterRepository(db, tenant_ctx)

    async def generate_scale_code(self) -> str:
        """
        Generates auto-incremented size scale code per company.
        Format: SCALE-100001, SCALE-100002, etc.
        """
        stmt = select(func.count(SizeScale.id))
        if self.tenant_ctx and self.tenant_ctx.company_id:
            stmt = stmt.filter(SizeScale.company_id == self.tenant_ctx.company_id)
        res = await self.db.execute(stmt)
        count = res.scalar() or 0
        return f"SCALE-{100001 + count}"

    async def create_size_scale(self, scale_in: SizeScaleCreate) -> SizeScale:
        """
        Creates SizeScale aggregate root with child SizeValues and SizeConversions inside an atomic transaction.
        """
        # Generate Code if not provided
        code = scale_in.code
        if not code:
            code = await self.generate_scale_code()

        # Check duplicate code per company
        stmt = select(SizeScale).filter(SizeScale.code == code, SizeScale.is_deleted == False)
        if self.tenant_ctx and self.tenant_ctx.company_id:
            stmt = stmt.filter(SizeScale.company_id == self.tenant_ctx.company_id)
        existing = await self.db.execute(stmt)
        if existing.scalars().first():
            raise HTTPException(status_code=400, detail=f"Size scale with code '{code}' already exists for this company.")

        scale_id = f"sc-{uuid.uuid4().hex[:12]}"
        company_id = self.tenant_ctx.company_id if self.tenant_ctx else None
        branch_id = self.tenant_ctx.branch_id if self.tenant_ctx else None
        tenant_id = self.tenant_ctx.tenant_id if self.tenant_ctx else None

        scale = SizeScale(
            id=scale_id,
            uuid=str(uuid.uuid4()),
            tenant_id=tenant_id,
            company_id=company_id,
            branch_id=branch_id,
            code=code,
            name=scale_in.name,
            scale_type_id=scale_in.scale_type_id,
            category_id=scale_in.category_id,
            gender_id=scale_in.gender_id,
            base_region_id=scale_in.base_region_id,
            description=scale_in.description,
            workflow_status="Approved",
        )

        if scale_in.size_values:
            seen_sizes = set()
            for idx, sval_in in enumerate(scale_in.size_values):
                if sval_in.display_size in seen_sizes:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Duplicate size value '{sval_in.display_size}' within scale."
                    )
                seen_sizes.add(sval_in.display_size)

                val_id = f"sv-{uuid.uuid4().hex[:12]}"
                val_obj = SizeValue(
                    id=val_id,
                    uuid=str(uuid.uuid4()),
                    tenant_id=tenant_id,
                    company_id=company_id,
                    branch_id=branch_id,
                    display_size=sval_in.display_size,
                    sort_order=sval_in.sort_order if sval_in.sort_order else (idx + 1),
                    workflow_status="Approved",
                )

                if sval_in.conversions:
                    for conv_in in sval_in.conversions:
                        val_obj.conversions.append(
                            SizeConversion(
                                id=f"scv-{uuid.uuid4().hex[:12]}",
                                uuid=str(uuid.uuid4()),
                                tenant_id=tenant_id,
                                company_id=company_id,
                                branch_id=branch_id,
                                region_code=conv_in.region_code.upper(),
                                converted_size_label=conv_in.converted_size_label,
                                workflow_status="Approved",
                            )
                        )
                scale.size_values.append(val_obj)

        self.db.add(scale)

        try:
            await self.db.commit()
        except IntegrityError as exc:
            await self.db.rollback()
            logger.warning("SizeScale creation constraint violation: %s", exc)
            raise HTTPException(
                status_code=400,
                detail="Size scale creation failed due to database constraint violation (duplicate code or size value)."
            )
        except Exception as exc:
            await self.db.rollback()
            logger.exception("Unexpected error during size scale creation")
            raise HTTPException(
                status_code=500,
                detail="An unexpected internal error occurred while saving size scale record."
            )

        return await self.repo.get(scale_id)

    async def get_scale(self, id: str) -> Optional[SizeScale]:
        scale = await self.repo.get(id)
        if not scale:
            raise HTTPException(status_code=404, detail="Size scale not found")
        return scale

    async def resolve_size_conversion(self, scale_id: str, display_size: str, target_region: str) -> Optional[str]:
        """
        Resolves normalized size conversion for a target region (e.g. UK 8 -> EU 42).
        """
        scale = await self.get_scale(scale_id)
        for sval in scale.size_values:
            if sval.display_size.upper() == display_size.upper():
                for conv in sval.conversions:
                    if conv.region_code.upper() == target_region.upper():
                        return conv.converted_size_label
                return sval.display_size
        return display_size

    async def delete_size_scale(self, id: str) -> bool:
        scale = await self.repo.get(id)
        if not scale:
            raise HTTPException(status_code=404, detail="Size scale not found")
        await self.repo.soft_delete(scale)
        return True
