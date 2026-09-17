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

from typing import Optional, Dict, Any
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession
from ...models.identity_registry import (
    SmritiIdentityRegistry,
    SmritiIdentityAlias,
    SmritiIdentityAllocationLog,
)
from .validator import IdentityValidator


class IdentityResolutionResult:
    def __init__(
        self,
        found: bool,
        entity_type: Optional[str] = None,
        entity_id: Optional[str] = None,
        identity_code: Optional[str] = None,
        database_table: Optional[str] = None,
        resolution_tier: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ):
        self.found = found
        self.entity_type = entity_type
        self.entity_id = entity_id
        self.identity_code = identity_code
        self.database_table = database_table
        self.resolution_tier = resolution_tier
        self.metadata = metadata or {}

    @property
    def canonical_id(self) -> Optional[str]:
        return self.entity_id

    def to_dict(self) -> Dict[str, Any]:
        return {
            "found": self.found,
            "entity_type": self.entity_type,
            "entity_id": self.entity_id,
            "identity_code": self.identity_code,
            "database_table": self.database_table,
            "resolution_tier": self.resolution_tier,
            "metadata": self.metadata,
        }


class IdentityResolver:
    """
    Tenant-Scoped, Registry-Driven Universal Identity Resolver (Blueprint Section 34, 56).
    Enforces strict tenant isolation and routes queries strictly through SmritiIdentityRegistry metadata.
    """

    @classmethod
    async def resolve(
        cls,
        session: AsyncSession,
        identifier: str,
        entity_type_hint: Optional[str] = None,
        tenant_id: Optional[str] = None,
        company_id: Optional[str] = None,
        branch_id: Optional[str] = None,
    ) -> IdentityResolutionResult:
        """
        Resolve an identifier across governed architectural tiers with mandatory tenant isolation.
        """
        if not identifier or not str(identifier).strip():
            return IdentityResolutionResult(found=False)

        clean_id = str(identifier).strip()

        # Tier 1: Is it a governed SMRITI Identity Code? (e.g. MST-ITM-00001245)
        parsed = IdentityValidator.parse_identity_code(clean_id)
        if parsed:
            # Tier 1A: Check smriti_identity_allocation_logs (Central issuance ledger)
            if tenant_id:
                alloc_stmt = select(SmritiIdentityAllocationLog).where(
                    SmritiIdentityAllocationLog.identity_code == clean_id,
                    SmritiIdentityAllocationLog.tenant_id == tenant_id,
                )
                alloc_res = await session.execute(alloc_stmt)
                alloc = alloc_res.scalars().first()
                if alloc:
                    if company_id and alloc.company_id and alloc.company_id.strip() and alloc.company_id != company_id:
                        return IdentityResolutionResult(found=False)
                    return IdentityResolutionResult(
                        found=True,
                        entity_type=alloc.entity_type,
                        entity_id=alloc.canonical_id,
                        identity_code=alloc.identity_code,
                        resolution_tier="TIER_1_ALLOCATION_LOG",
                        metadata={"purpose": alloc.purpose, "scope": alloc.scope},
                    )

                # Check if this identity code was allocated to another tenant (Tenant Isolation Guard)
                other_tenant_stmt = select(SmritiIdentityAllocationLog).where(
                    SmritiIdentityAllocationLog.identity_code == clean_id,
                    SmritiIdentityAllocationLog.tenant_id.is_not(None),
                    SmritiIdentityAllocationLog.tenant_id != "",
                    SmritiIdentityAllocationLog.tenant_id != tenant_id,
                )
                other_res = await session.execute(other_tenant_stmt)
                if other_res.scalars().first():
                    return IdentityResolutionResult(found=False)
            else:
                alloc_stmt = select(SmritiIdentityAllocationLog).where(
                    SmritiIdentityAllocationLog.identity_code == clean_id,
                )
                alloc_res = await session.execute(alloc_stmt)
                alloc = alloc_res.scalars().first()
                if alloc:
                    if company_id and alloc.company_id and alloc.company_id.strip() and alloc.company_id != company_id:
                        return IdentityResolutionResult(found=False)
                    return IdentityResolutionResult(
                        found=True,
                        entity_type=alloc.entity_type,
                        entity_id=alloc.canonical_id,
                        identity_code=alloc.identity_code,
                        resolution_tier="TIER_1_ALLOCATION_LOG",
                        metadata={"purpose": alloc.purpose, "scope": alloc.scope},
                    )

            # Tier 1B: If not in allocation log, check registry and physical table
            reg_stmt = select(SmritiIdentityRegistry).where(
                SmritiIdentityRegistry.group_code == parsed["identity_group"],
                SmritiIdentityRegistry.entity_code == parsed["entity_code"],
                SmritiIdentityRegistry.status == "ACTIVE",
            )
            reg_res = await session.execute(reg_stmt)
            reg = reg_res.scalars().first()

            if reg:
                tbl = reg.database_table
                pk_col = reg.primary_key_field
                id_code_col = reg.identity_code_field

                # Enforce tenant / company scoping if table is company-scoped
                where_clauses = [f"{id_code_col} = :code"]
                params = {"code": clean_id}

                if reg.company_scoped and company_id:
                    where_clauses.append("(company_id = :comp_id OR company_id IS NULL)")
                    params["comp_id"] = company_id

                try:
                    async with session.begin_nested():
                        where_sql = " AND ".join(where_clauses)
                        q = text(f"SELECT {pk_col} FROM {tbl} WHERE {where_sql} LIMIT 1")
                        row = (await session.execute(q, params)).fetchone()
                        if row:
                            return IdentityResolutionResult(
                                found=True,
                                entity_type=reg.entity_type,
                                entity_id=str(row[0]),
                                identity_code=clean_id,
                                database_table=tbl,
                                resolution_tier="TIER_1_IDENTITY_CODE",
                            )
                except Exception:
                    pass

        # Tier 2: Check historical alias registry (smriti_identity_alias)
        alias_stmt = select(SmritiIdentityAlias).where(
            SmritiIdentityAlias.alias_code == clean_id,
        )
        if company_id:
            alias_stmt = alias_stmt.where(
                (SmritiIdentityAlias.company_id == company_id) | (SmritiIdentityAlias.company_id.is_(None))
            )
        alias_res = await session.execute(alias_stmt)
        alias = alias_res.scalars().first()

        if alias:
            return IdentityResolutionResult(
                found=True,
                entity_type=alias.entity_type,
                entity_id=alias.entity_id,
                identity_code=alias.canonical_identity_code,
                resolution_tier="TIER_2_HISTORICAL_ALIAS",
                metadata={"alias_type": alias.alias_type, "source_system": alias.source_system},
            )

        # Tier 3: Direct Technical ID lookup (requires entity_type_hint or explicit registry route)
        if entity_type_hint:
            reg_stmt = select(SmritiIdentityRegistry).where(
                SmritiIdentityRegistry.entity_type == entity_type_hint.strip().upper(),
                SmritiIdentityRegistry.status == "ACTIVE",
            )
            reg_res = await session.execute(reg_stmt)
            reg = reg_res.scalars().first()
            if reg:
                tbl = reg.database_table
                pk_col = reg.primary_key_field
                where_clauses = [f"{pk_col} = :val"]
                params = {"val": clean_id}

                if reg.company_scoped and company_id:
                    where_clauses.append("(company_id = :comp_id OR company_id IS NULL)")
                    params["comp_id"] = company_id

                try:
                    where_sql = " AND ".join(where_clauses)
                    q = text(f"SELECT {pk_col} FROM {tbl} WHERE {where_sql} LIMIT 1")
                    row = (await session.execute(q, params)).fetchone()
                    if row:
                        return IdentityResolutionResult(
                            found=True,
                            entity_type=reg.entity_type,
                            entity_id=str(row[0]),
                            database_table=tbl,
                            resolution_tier="TIER_3_DIRECT_TECHNICAL_ID",
                        )
                except Exception:
                    pass

        # Tier 4: Business Code fallback (e.g. item_code, sku, code) with tenant boundary
        if entity_type_hint:
            reg_stmt = select(SmritiIdentityRegistry).where(
                SmritiIdentityRegistry.entity_type == entity_type_hint.strip().upper(),
                SmritiIdentityRegistry.status == "ACTIVE",
            )
            reg_res = await session.execute(reg_stmt)
            reg = reg_res.scalars().first()
            if reg and reg.business_code_field:
                tbl = reg.database_table
                pk_col = reg.primary_key_field
                b_col = reg.business_code_field
                where_clauses = [f"{b_col} = :bcode"]
                params = {"bcode": clean_id}

                if reg.company_scoped and company_id:
                    where_clauses.append("(company_id = :comp_id OR company_id IS NULL)")
                    params["comp_id"] = company_id

                try:
                    where_sql = " AND ".join(where_clauses)
                    q = text(f"SELECT {pk_col} FROM {tbl} WHERE {where_sql} LIMIT 1")
                    row = (await session.execute(q, params)).fetchone()
                    if row:
                        return IdentityResolutionResult(
                            found=True,
                            entity_type=reg.entity_type,
                            entity_id=str(row[0]),
                            database_table=tbl,
                            resolution_tier="TIER_4_BUSINESS_CODE",
                            metadata={"business_code": clean_id},
                        )
                except Exception:
                    pass

        return IdentityResolutionResult(found=False)
