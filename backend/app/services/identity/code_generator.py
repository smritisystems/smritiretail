"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.34.1
Created      : 2026-09-18
Modified     : 2026-09-18
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

# smriti_capability(entity="IDENTITY", capability="UNIFIED_IDENTITY_CONTROL_PLANE", role="ADAPTER", canonicalOwner="backend/app/services/identity/engine.py")

from typing import Optional
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from ...models.identity_registry import (
    SmritiIdentityRegistry,
    SmritiNumberingRegistry,
    SmritiIdentityAllocationLog,
)
from .uuid7 import uuid7


class IdentityCodeGenerator:
    """
    Controlled, atomic sequential allocation engine for SMRITI human-friendly Identity Codes.
    Format: {GROUP}-{ENTITY}-{SEQUENCE} (e.g. MST-ITM-00001245, SAL-INV-00012548).
    Uses PostgreSQL SELECT ... FOR UPDATE row locks to prevent duplicate numbers under concurrency.
    """

    @classmethod
    async def allocate_identity_code(
        cls,
        session: AsyncSession,
        entity_type: str,
        group_code: Optional[str] = None,
        tenant_id: Optional[str] = None,
        company_id: Optional[str] = None,
        branch_id: Optional[str] = None,
        financial_year: Optional[str] = None,
        canonical_id: Optional[str] = None,
        purpose: str = "ENTITY_CREATION",
        correlation_id: Optional[str] = None,
    ) -> str:
        """
        Atomically allocate the next sequential identity code for the specified entity type.
        """
        entity_type_upper = entity_type.strip().upper()

        # 1. Lookup Identity Registry rule
        reg_stmt = select(SmritiIdentityRegistry).where(
            SmritiIdentityRegistry.entity_type == entity_type_upper,
            SmritiIdentityRegistry.status == "ACTIVE",
        )
        reg_res = await session.execute(reg_stmt)
        reg = reg_res.scalars().first()

        if reg:
            actual_group_code = reg.group_code
            actual_prefix = reg.identity_code_prefix
            scope_mode = reg.identity_code_scope
            padding = 8
        else:
            # Fallback for dynamic/unregistered types
            actual_group_code = (group_code or "SYS").upper()
            entity_short = entity_type_upper[:3]
            actual_prefix = f"{actual_group_code}-{entity_short}"
            scope_mode = "TENANT"
            padding = 8

        # 2. Scope resolution for numbering counter row
        scoped_tenant = (tenant_id or "").strip() if scope_mode in ("TENANT", "COMPANY", "BRANCH") else ""
        scoped_company = company_id if scope_mode in ("COMPANY", "BRANCH") else None
        scoped_branch = branch_id if scope_mode == "BRANCH" else None
        scoped_fy = (financial_year or "").strip() if scope_mode == "FINANCIAL_YEAR" else ""

        # 3. Acquire atomic row lock on numbering registry
        num_stmt = (
            select(SmritiNumberingRegistry)
            .where(
                SmritiNumberingRegistry.entity_type == entity_type_upper,
                SmritiNumberingRegistry.group_code == actual_group_code,
                SmritiNumberingRegistry.prefix == actual_prefix,
                SmritiNumberingRegistry.scope == scope_mode,
                SmritiNumberingRegistry.tenant_id == scoped_tenant,
                SmritiNumberingRegistry.company_id == scoped_company,
                SmritiNumberingRegistry.branch_id == scoped_branch,
                SmritiNumberingRegistry.financial_year == scoped_fy,
            )
            .with_for_update()
        )
        num_res = await session.execute(num_stmt)
        numbering_record = num_res.scalars().first()

        if not numbering_record:
            # Race-safe counter initialization: handle concurrent first allocations cleanly
            try:
                async with session.begin_nested():
                    new_rec = SmritiNumberingRegistry(
                        id=uuid7(),
                        entity_type=entity_type_upper,
                        identity_group=reg.identity_group if reg else "SYSTEM",
                        group_code=actual_group_code,
                        prefix=actual_prefix,
                        format_template=f"{actual_prefix}-{{seq:0{padding}d}}",
                        scope=scope_mode,
                        sequence_value=1,
                        padding=padding,
                        reset_policy="NEVER",
                        financial_year=scoped_fy,
                        tenant_id=scoped_tenant,
                        company_id=scoped_company,
                        branch_id=scoped_branch,
                        status="ACTIVE",
                    )
                    session.add(new_rec)
                    await session.flush()
                    numbering_record = new_rec
                    allocated_seq = 1
            except IntegrityError:
                # Concurrent worker initialized the sequence simultaneously; acquire lock and increment
                num_res = await session.execute(num_stmt)
                numbering_record = num_res.scalars().first()
                if numbering_record:
                    numbering_record.sequence_value += 1
                    allocated_seq = numbering_record.sequence_value
                    padding = numbering_record.padding or padding
                else:
                    allocated_seq = 1
        else:
            numbering_record.sequence_value += 1
            allocated_seq = numbering_record.sequence_value
            padding = numbering_record.padding or padding

        # Format human-friendly identity code
        identity_code = f"{actual_prefix}-{allocated_seq:0{padding}d}"

        # 4. Record provenance in allocation log if canonical technical ID is provided
        if canonical_id:
            alloc_log = SmritiIdentityAllocationLog(
                id=uuid7(),
                tenant_id=scoped_tenant or None,
                company_id=scoped_company,
                branch_id=scoped_branch,
                entity_type=entity_type_upper,
                group_code=actual_group_code,
                canonical_id=canonical_id,
                identity_code=identity_code,
                scope=scope_mode,
                purpose=purpose,
                correlation_id=correlation_id,
            )
            session.add(alloc_log)

        await session.flush()
        return identity_code
