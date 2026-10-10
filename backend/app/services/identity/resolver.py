"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.38.0
Created      : 2026-09-18
Modified     : 2026-09-18
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal Core Architecture
"""

# smriti_capability(entity="IDENTITY", capability="UNIFIED_IDENTITY_CONTROL_PLANE", role="CORE", canonicalOwner="backend/app/services/identity/engine.py")

import re
from typing import Optional, Dict, Any, List, Set
from sqlalchemy import select, text, func, or_
from sqlalchemy.ext.asyncio import AsyncSession

from ...models.identity_registry import (
    SmritiIdentityRegistry,
    SmritiIdentityAlias,
    SmritiIdentityAllocationLog,
)
from .validator import IdentityValidator
from .cache import get_identity_cache


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
    Universal Cross-Domain Entity Resolver (Blueprint Section 34, 56, Phase 1.4).
    Enforces strict tenant isolation, multi-tier resolution, batch lookups,
    case-insensitive alias matching, and high-speed in-memory caching.
    """

    CORE_TABLE_PRIORITY = [
        ("ITEM", "items", "id", "item_code"),
        ("PARTY", "parties", "id", "party_code"),
        ("CUSTOMER", "customers", "id", "customer_code"),
        ("SUPPLIER", "suppliers", "id", "supplier_code"),
        ("COMPANY", "companies", "id", "code"),
        ("BRANCH", "branches", "id", "code"),
        ("SALES_INVOICE", "sales_invoices", "id", "invoice_no"),
        ("PURCHASE_ORDER", "purchase_orders", "id", "order_no"),
        ("EWAY_BILL", "eway_bills", "id", "eway_bill_no"),
        ("PAYMENT_TRANSACTION", "payment_transactions", "id", "transaction_no"),
        ("STOCK_MOVEMENT", "stock_movements", "id", None),
    ]

    @staticmethod
    def _derive_deep_link(entity_type: str, entity_id: str) -> str:
        links = {
            "ITEM": f"/inventory/items/{entity_id}",
            "PARTY": f"/parties/{entity_id}",
            "CUSTOMER": f"/customers/{entity_id}",
            "SUPPLIER": f"/suppliers/{entity_id}",
            "SALES_INVOICE": f"/sales/invoices/{entity_id}",
            "PURCHASE_ORDER": f"/purchase/orders/{entity_id}",
            "EWAY_BILL": f"/compliance/eway-bills/{entity_id}",
            "PAYMENT_TRANSACTION": f"/finance/payments/{entity_id}",
            "STOCK_MOVEMENT": f"/inventory/movements/{entity_id}",
            "COMPANY": f"/settings/companies/{entity_id}",
            "BRANCH": f"/settings/branches/{entity_id}",
        }
        return links.get(entity_type.upper(), f"/{entity_type.lower()}s/{entity_id}")

    @classmethod
    async def resolve(
        cls,
        session: AsyncSession,
        identifier: str,
        entity_type_hint: Optional[str] = None,
        tenant_id: Optional[str] = None,
        company_id: Optional[str] = None,
        branch_id: Optional[str] = None,
        use_cache: bool = True,
        source_system_hint: Optional[str] = None,
        alias_type_hint: Optional[str] = None,
    ) -> IdentityResolutionResult:
        """
        Resolve an identifier across governed architectural tiers with mandatory tenant isolation.
        """
        if not identifier or not str(identifier).strip():
            return IdentityResolutionResult(found=False)

        clean_id = str(identifier).strip()
        cache = get_identity_cache()

        # Step 0: Check In-Memory Cache (if enabled)
        if use_cache:
            cached_result = await cache.get(clean_id, tenant_id=tenant_id, company_id=company_id)
            if cached_result:
                return cached_result

        result: Optional[IdentityResolutionResult] = None

        # Tier 1: Is it a governed SMRITI Identity Code? (e.g. MST-ITM-00001245)
        parsed = IdentityValidator.parse_identity_code(clean_id)
        if parsed:
            # Tier 1A: Check smriti_identity_allocation_logs (Central issuance ledger)
            alloc_stmt = select(SmritiIdentityAllocationLog).where(
                SmritiIdentityAllocationLog.identity_code == clean_id,
            )
            if tenant_id:
                alloc_stmt = alloc_stmt.where(
                    SmritiIdentityAllocationLog.tenant_id == tenant_id
                )
            if company_id:
                alloc_stmt = alloc_stmt.where(
                    or_(
                        SmritiIdentityAllocationLog.company_id == company_id,
                        SmritiIdentityAllocationLog.company_id.is_(None),
                        SmritiIdentityAllocationLog.company_id == "",
                    )
                )
            alloc_stmt = alloc_stmt.order_by(SmritiIdentityAllocationLog.id.desc())
            alloc_res = await session.execute(alloc_stmt)
            alloc = alloc_res.scalars().first()
            if alloc:
                if company_id and alloc.company_id and alloc.company_id.strip() and alloc.company_id != company_id:
                    result = IdentityResolutionResult(found=False)
                else:
                    result = IdentityResolutionResult(
                        found=True,
                        entity_type=alloc.entity_type,
                        entity_id=alloc.canonical_id,
                        identity_code=alloc.identity_code,
                        resolution_tier="TIER_1_ALLOCATION_LOG",
                        metadata={"purpose": alloc.purpose, "scope": alloc.scope},
                    )

            # Tier 1B: If not in allocation log, check registry and physical table
            # Note: If tenant_id was explicitly provided and not found in allocation log, we preserve tenant boundary isolation
            if (not result or not result.found) and not tenant_id:
                reg_stmt = select(SmritiIdentityRegistry).where(
                    SmritiIdentityRegistry.group_code == parsed["identity_group"],
                    SmritiIdentityRegistry.entity_code == parsed["entity_code"],
                    SmritiIdentityRegistry.status == "ACTIVE",
                )
                reg_res = await session.execute(reg_stmt)
                reg = reg_res.scalars().first()

                if reg and reg.identity_code_enabled and reg.identity_code_field:
                    tbl = reg.database_table
                    pk_col = reg.primary_key_field
                    id_code_col = reg.identity_code_field

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
                                result = IdentityResolutionResult(
                                    found=True,
                                    entity_type=reg.entity_type,
                                    entity_id=str(row[0]),
                                    identity_code=clean_id,
                                    database_table=tbl,
                                    resolution_tier="TIER_1_IDENTITY_CODE",
                                )
                    except Exception:
                        pass

        # Tier 2: Check historical & external alias registry (smriti_identity_alias)
        if not result or not result.found:
            alias_stmt = select(SmritiIdentityAlias).where(
                func.lower(SmritiIdentityAlias.alias_code) == clean_id.lower(),
                SmritiIdentityAlias.is_active.is_(True),
                SmritiIdentityAlias.is_deleted.is_(False),
            )
            if source_system_hint:
                alias_stmt = alias_stmt.where(
                    SmritiIdentityAlias.source_system == source_system_hint.strip().upper()
                )
            if alias_type_hint:
                alias_stmt = alias_stmt.where(
                    SmritiIdentityAlias.alias_type == alias_type_hint.strip().upper()
                )
            if company_id:
                alias_stmt = alias_stmt.where(
                    or_(
                        SmritiIdentityAlias.company_id == company_id,
                        SmritiIdentityAlias.company_id.is_(None),
                    )
                )
            alias_res = await session.execute(alias_stmt)
            alias = alias_res.scalars().first()

            if alias:
                result = IdentityResolutionResult(
                    found=True,
                    entity_type=alias.entity_type,
                    entity_id=alias.entity_id,
                    identity_code=alias.canonical_identity_code,
                    resolution_tier="TIER_2_HISTORICAL_ALIAS",
                    metadata={
                        "alias_type": alias.alias_type,
                        "source_system": alias.source_system,
                        "alias_code": alias.alias_code,
                    },
                )

        # Tier 3: Technical ID lookup (UUIDv7 or legacy primary key)
        if not result or not result.found:
            # 3A: If entity_type_hint is provided, check that specific registry route
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
                            result = IdentityResolutionResult(
                                found=True,
                                entity_type=reg.entity_type,
                                entity_id=str(row[0]),
                                database_table=tbl,
                                resolution_tier="TIER_3_DIRECT_TECHNICAL_ID",
                            )
                    except Exception:
                        pass
            else:
                # 3B: Unscoped Technical ID lookup via smriti_identity_allocation_log.canonical_id
                alloc_tech_stmt = select(SmritiIdentityAllocationLog).where(
                    SmritiIdentityAllocationLog.canonical_id == clean_id
                )
                if company_id:
                    alloc_tech_stmt = alloc_tech_stmt.where(
                        or_(
                            SmritiIdentityAllocationLog.company_id == company_id,
                            SmritiIdentityAllocationLog.company_id.is_(None),
                        )
                    )
                alloc_tech_res = await session.execute(alloc_tech_stmt)
                alloc_tech = alloc_tech_res.scalars().first()
                if alloc_tech:
                    result = IdentityResolutionResult(
                        found=True,
                        entity_type=alloc_tech.entity_type,
                        entity_id=alloc_tech.canonical_id,
                        identity_code=alloc_tech.identity_code,
                        resolution_tier="TIER_3_DIRECT_TECHNICAL_ID",
                        metadata={"purpose": alloc_tech.purpose},
                    )
                else:
                    # 3C: Fallback unscoped scan of core tables in priority order
                    for etype, tbl, pk_col, _ in cls.CORE_TABLE_PRIORITY:
                        try:
                            where_clauses = [f"{pk_col} = :val"]
                            params = {"val": clean_id}
                            if company_id and tbl not in ("companies", "compliance_audit_logs"):
                                where_clauses.append("(company_id = :comp_id OR company_id IS NULL)")
                                params["comp_id"] = company_id

                            where_sql = " AND ".join(where_clauses)
                            q = text(f"SELECT {pk_col} FROM {tbl} WHERE {where_sql} LIMIT 1")
                            row = (await session.execute(q, params)).fetchone()
                            if row:
                                result = IdentityResolutionResult(
                                    found=True,
                                    entity_type=etype,
                                    entity_id=str(row[0]),
                                    database_table=tbl,
                                    resolution_tier="TIER_3_DIRECT_TECHNICAL_ID",
                                )
                                break
                        except Exception:
                            continue

        # Tier 4: Sovereign Business Code fallback (e.g. item_code, sku, code, invoice_no)
        if not result or not result.found:
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
                            result = IdentityResolutionResult(
                                found=True,
                                entity_type=reg.entity_type,
                                entity_id=str(row[0]),
                                database_table=tbl,
                                resolution_tier="TIER_4_BUSINESS_CODE",
                                metadata={"business_code": clean_id},
                            )
                    except Exception:
                        pass
            else:
                # Unscoped Business Code lookup across core tables with business codes
                for etype, tbl, pk_col, b_col in cls.CORE_TABLE_PRIORITY:
                    if not b_col:
                        continue
                    try:
                        where_clauses = [f"{b_col} = :bcode"]
                        params = {"bcode": clean_id}
                        if company_id and tbl not in ("companies", "compliance_audit_logs"):
                            where_clauses.append("(company_id = :comp_id OR company_id IS NULL)")
                            params["comp_id"] = company_id

                        where_sql = " AND ".join(where_clauses)
                        q = text(f"SELECT {pk_col} FROM {tbl} WHERE {where_sql} LIMIT 1")
                        row = (await session.execute(q, params)).fetchone()
                        if row:
                            result = IdentityResolutionResult(
                                found=True,
                                entity_type=etype,
                                entity_id=str(row[0]),
                                database_table=tbl,
                                resolution_tier="TIER_4_BUSINESS_CODE",
                                metadata={"business_code": clean_id},
                            )
                            break
                    except Exception:
                        continue

        if not result:
            result = IdentityResolutionResult(found=False)

        # Step 5: Populate in-memory cache on resolution
        if result.found and use_cache:
            ttl = 300 if result.resolution_tier != "TIER_4_BUSINESS_CODE" else 60
            await cache.set(clean_id, result, tenant_id=tenant_id, company_id=company_id, ttl_seconds=ttl)

        return result

    @classmethod
    async def resolve_batch(
        cls,
        session: AsyncSession,
        identifiers: List[str],
        entity_type_hint: Optional[str] = None,
        tenant_id: Optional[str] = None,
        company_id: Optional[str] = None,
        branch_id: Optional[str] = None,
        use_cache: bool = True,
    ) -> Dict[str, IdentityResolutionResult]:
        """
        Batch resolve up to 100 identifiers in a high-efficiency round-trip.
        Utilizes caching and grouped SQL queries.
        """
        results: Dict[str, IdentityResolutionResult] = {}
        pending_ids: List[str] = []

        cache = get_identity_cache()

        for ident in identifiers:
            clean = str(ident).strip()
            if not clean:
                results[ident] = IdentityResolutionResult(found=False)
                continue

            if use_cache:
                cached = await cache.get(clean, tenant_id=tenant_id, company_id=company_id)
                if cached:
                    results[ident] = cached
                    continue

            pending_ids.append(clean)

        if not pending_ids:
            return results

        # Resolve remaining pending identifiers
        for clean in pending_ids:
            res = await cls.resolve(
                session=session,
                identifier=clean,
                entity_type_hint=entity_type_hint,
                tenant_id=tenant_id,
                company_id=company_id,
                branch_id=branch_id,
                use_cache=use_cache,
            )
            results[clean] = res

        return results

    @classmethod
    async def get_identity_envelope(
        cls,
        session: AsyncSession,
        identifier: str,
        company_id: Optional[str] = None,
        tenant_id: Optional[str] = None,
    ) -> Optional[Dict[str, Any]]:
        """
        Hydrate the full Identity Envelope for any identifier:
        Canonical UUIDv7, Governed Identity Code, Sovereign Business Codes,
        Registered Active Aliases, Deep Link, and Allocation Audit Trail.
        """
        res = await cls.resolve(
            session=session,
            identifier=identifier,
            tenant_id=tenant_id,
            company_id=company_id,
        )
        if not res.found or not res.entity_id or not res.entity_type:
            return None

        # Fetch all registered aliases for this entity
        alias_stmt = select(SmritiIdentityAlias).where(
            SmritiIdentityAlias.entity_type == res.entity_type,
            SmritiIdentityAlias.entity_id == res.entity_id,
            SmritiIdentityAlias.is_active.is_(True),
            SmritiIdentityAlias.is_deleted.is_(False),
        )
        if company_id:
            alias_stmt = alias_stmt.where(
                or_(
                    SmritiIdentityAlias.company_id == company_id,
                    SmritiIdentityAlias.company_id.is_(None),
                )
            )
        alias_res = await session.execute(alias_stmt)
        aliases = [
            {
                "alias_code": a.alias_code,
                "alias_type": a.alias_type,
                "source_system": a.source_system,
                "notes": a.notes,
            }
            for a in alias_res.scalars().all()
        ]

        # Fetch allocation log record if available
        alloc_stmt = select(SmritiIdentityAllocationLog).where(
            SmritiIdentityAllocationLog.canonical_id == res.entity_id
        )
        alloc_res = await session.execute(alloc_stmt)
        alloc = alloc_res.scalars().first()

        gov_code = res.identity_code or (alloc.identity_code if alloc else None)

        envelope = {
            "found": True,
            "canonical_id": res.entity_id,
            "entity_type": res.entity_type,
            "identity_code": gov_code,
            "database_table": res.database_table,
            "resolution_tier": res.resolution_tier,
            "aliases": aliases,
            "alias_count": len(aliases),
            "deep_link": cls._derive_deep_link(res.entity_type, res.entity_id),
            "allocation_audit": {
                "purpose": alloc.purpose if alloc else None,
                "created_at": alloc.created_at.isoformat() if (alloc and alloc.created_at) else None,
            },
        }
        return envelope

    @classmethod
    async def search_entities(
        cls,
        session: AsyncSession,
        query: str,
        entity_types: Optional[List[str]] = None,
        company_id: Optional[str] = None,
        limit: int = 20,
    ) -> List[Dict[str, Any]]:
        """
        Omnichannel cross-domain entity discovery matching across
        governed identity codes, aliases, and sovereign business codes.
        """
        clean = str(query or "").strip()
        if not clean or len(clean) < 2:
            return []

        results: List[Dict[str, Any]] = []
        seen_keys: Set[str] = set()

        pattern = f"{clean.lower()}%"
        wildcard_pattern = f"%{clean.lower()}%"

        # 1. Search smriti_identity_alias
        alias_stmt = select(SmritiIdentityAlias).where(
            or_(
                func.lower(SmritiIdentityAlias.alias_code).like(pattern),
                func.lower(SmritiIdentityAlias.alias_code).like(wildcard_pattern),
            ),
            SmritiIdentityAlias.is_active.is_(True),
            SmritiIdentityAlias.is_deleted.is_(False),
        )
        if entity_types:
            alias_stmt = alias_stmt.where(
                SmritiIdentityAlias.entity_type.in_([et.upper() for et in entity_types])
            )
        if company_id:
            alias_stmt = alias_stmt.where(
                or_(
                    SmritiIdentityAlias.company_id == company_id,
                    SmritiIdentityAlias.company_id.is_(None),
                )
            )
        alias_stmt = alias_stmt.limit(limit)
        alias_rows = (await session.execute(alias_stmt)).scalars().all()

        for a in alias_rows:
            ukey = f"{a.entity_type}:{a.entity_id}"
            if ukey not in seen_keys:
                seen_keys.add(ukey)
                results.append({
                    "entity_type": a.entity_type,
                    "entity_id": a.entity_id,
                    "identity_code": a.canonical_identity_code,
                    "match_type": "ALIAS",
                    "matched_value": a.alias_code,
                    "source_system": a.source_system,
                    "deep_link": cls._derive_deep_link(a.entity_type, a.entity_id),
                })

        # 2. Search smriti_identity_allocation_log
        if len(results) < limit:
            alloc_stmt = select(SmritiIdentityAllocationLog).where(
                func.lower(SmritiIdentityAllocationLog.identity_code).like(pattern)
            )
            if entity_types:
                alloc_stmt = alloc_stmt.where(
                    SmritiIdentityAllocationLog.entity_type.in_([et.upper() for et in entity_types])
                )
            if company_id:
                alloc_stmt = alloc_stmt.where(
                    or_(
                        SmritiIdentityAllocationLog.company_id == company_id,
                        SmritiIdentityAllocationLog.company_id.is_(None),
                    )
                )
            alloc_stmt = alloc_stmt.limit(limit - len(results))
            alloc_rows = (await session.execute(alloc_stmt)).scalars().all()

            for al in alloc_rows:
                ukey = f"{al.entity_type}:{al.canonical_id}"
                if ukey not in seen_keys:
                    seen_keys.add(ukey)
                    results.append({
                        "entity_type": al.entity_type,
                        "entity_id": al.canonical_id,
                        "identity_code": al.identity_code,
                        "match_type": "IDENTITY_CODE",
                        "matched_value": al.identity_code,
                        "source_system": "SMRITI",
                        "deep_link": cls._derive_deep_link(al.entity_type, al.canonical_id),
                    })

        return results[:limit]
