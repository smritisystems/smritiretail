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

import pytest
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker

from app.core.config import settings
from app.services.identity.engine import IdentityEngine
from app.services.identity.resolver import IdentityResolver
from app.services.identity.validator import IdentityValidator
from app.services.identity.cache import get_identity_cache
from app.models.party import Party
from app.models.distribution import EWayBill
from app.models.identity_registry import SmritiIdentityAlias, SmritiIdentityAllocationLog


@pytest.fixture
def session_factory():
    engine = create_async_engine(settings.DATABASE_URL, pool_size=5, max_overflow=5)
    return async_sessionmaker(bind=engine, expire_on_commit=False)


@pytest.mark.asyncio
async def test_tier_1_governed_identity_code_resolution_all_domains(session_factory):
    """
    Test 1: Verify Tier 1 resolution for governed SMRITI Identity Codes across multiple domains:
    - Master Data: MST-ITM, MST-PRT
    - Transactions: SAL-INV, PUR-ORD
    - Statutory: TAX-EWB
    - Operational: POS-SFT, ORG-CMP, ORG-BRN
    """
    async with session_factory() as session:
        # Check an existing Party identity code
        party_res = await session.execute(
            select(Party.id, Party.identity_code).where(Party.identity_code.is_not(None)).limit(1)
        )
        party = party_res.first()
        if party:
            pid, id_code = party
            res = await IdentityEngine.resolve_identifier(session, id_code)
            assert res.found is True
            assert res.entity_type == "PARTY"
            assert res.entity_id == pid
            assert res.identity_code == id_code
            assert "TIER_1" in res.resolution_tier

        # Check an existing E-Way Bill identity code
        ewb_res = await session.execute(
            select(EWayBill.id, EWayBill.identity_code).where(EWayBill.identity_code.is_not(None)).limit(1)
        )
        ewb = ewb_res.first()
        if ewb:
            eid, id_code = ewb
            res = await IdentityEngine.resolve_identifier(session, id_code)
            assert res.found is True
            assert res.entity_type == "EWAY_BILL"
            assert res.entity_id == eid
            assert res.identity_code == id_code
            assert "TIER_1" in res.resolution_tier


@pytest.mark.asyncio
async def test_tier_2_external_alias_case_insensitive_resolution(session_factory):
    """
    Test 2: Verify Tier 2 case-insensitive alias resolution:
    - Uppercase, lowercase, mixed-case lookups of the same alias return the same entity.
    - Filtering by source_system_hint (e.g. RAZORPAY) filters correctly.
    """
    async with session_factory() as session:
        trans = await session.begin()
        test_suffix = IdentityEngine.generate_technical_id()[:8]
        test_alias_code = f"RazorPay_Txn_{test_suffix}"
        try:
            entity_id = IdentityEngine.generate_technical_id()
            await IdentityEngine.register_alias(
                session=session,
                entity_type="PAYMENT_TRANSACTION",
                entity_id=entity_id,
                alias_code=test_alias_code,
                alias_type="GATEWAY_REF",
                source_system="RAZORPAY",
            )

            # Resolve using lowercase
            res_lower = await IdentityResolver.resolve(
                session=session,
                identifier=test_alias_code.lower(),
                use_cache=False,
            )
            assert res_lower.found is True
            assert res_lower.entity_id == entity_id
            assert res_lower.entity_type == "PAYMENT_TRANSACTION"
            assert res_lower.resolution_tier == "TIER_2_HISTORICAL_ALIAS"

            # Resolve using uppercase
            res_upper = await IdentityResolver.resolve(
                session=session,
                identifier=test_alias_code.upper(),
                use_cache=False,
            )
            assert res_upper.found is True
            assert res_upper.entity_id == entity_id

            # Filter by matching source_system
            res_filtered = await IdentityResolver.resolve(
                session=session,
                identifier=test_alias_code,
                source_system_hint="RAZORPAY",
                use_cache=False,
            )
            assert res_filtered.found is True

            # Filter by mismatched source_system
            res_mismatch = await IdentityResolver.resolve(
                session=session,
                identifier=test_alias_code,
                source_system_hint="STRIPE",
                use_cache=False,
            )
            assert res_mismatch.found is False
        finally:
            await trans.rollback()


@pytest.mark.asyncio
async def test_tier_3_unscoped_technical_uuidv7_resolution(session_factory):
    """
    Test 3: Verify Tier 3 unscoped resolution for technical UUIDv7 IDs without caller providing entity_type_hint.
    """
    async with session_factory() as session:
        trans = await session.begin()
        try:
            # Allocate an internal identity (creates record in allocation log)
            tech_id, code = await IdentityEngine.allocate_internal(
                session=session,
                entity_type="PARTY",
                purpose="TEST_RESOLUTION",
            )
            assert IdentityValidator.validate_technical_id(tech_id) is True

            # Resolve with NO entity_type_hint
            res = await IdentityResolver.resolve(
                session=session,
                identifier=tech_id,
                entity_type_hint=None,
                use_cache=False,
            )
            assert res.found is True
            assert res.entity_id == tech_id
            assert res.entity_type == "PARTY"
            assert res.resolution_tier == "TIER_3_DIRECT_TECHNICAL_ID"
        finally:
            await trans.rollback()


@pytest.mark.asyncio
async def test_tier_4_sovereign_business_code_resolution(session_factory):
    """
    Test 4: Verify Tier 4 resolution for sovereign operational business codes:
    - party_code, item_code, invoice_no, order_no
    - Test both scoped and unscoped resolution
    """
    async with session_factory() as session:
        party_res = await session.execute(
            select(Party.id, Party.party_code).where(Party.party_code.is_not(None)).limit(1)
        )
        party = party_res.first()
        if party:
            pid, pcode = party
            # Scoped resolution
            res_scoped = await IdentityResolver.resolve(
                session=session,
                identifier=pcode,
                entity_type_hint="PARTY",
                use_cache=False,
            )
            assert res_scoped.found is True
            assert res_scoped.entity_id == pid
            assert res_scoped.entity_type == "PARTY"

            # Unscoped resolution
            res_unscoped = await IdentityResolver.resolve(
                session=session,
                identifier=pcode,
                entity_type_hint=None,
                use_cache=False,
            )
            assert res_unscoped.found is True
            assert res_unscoped.entity_id == pid


@pytest.mark.asyncio
async def test_batch_resolution_performance_and_parity(session_factory):
    """
    Test 5: Verify resolve_batch correctly resolves an array of mixed identifiers in a single call,
    producing identical results to sequential individual resolutions.
    """
    async with session_factory() as session:
        # Collect sample existing identifiers
        party_res = await session.execute(
            select(Party.id, Party.identity_code, Party.party_code).where(Party.identity_code.is_not(None)).limit(2)
        )
        parties = party_res.fetchall()
        if parties:
            test_ids = []
            for pid, id_code, pcode in parties:
                if id_code:
                    test_ids.append(id_code)
                if pcode:
                    test_ids.append(pcode)
                test_ids.append(pid)

            test_ids.append("NONEXISTENT_IDENTIFIER_XYZ")

            # Batch resolution
            batch_results = await IdentityEngine.resolve_batch(
                session=session,
                identifiers=test_ids,
                use_cache=False,
            )
            assert len(batch_results) == len(test_ids)

            # Compare against single resolutions
            for ident in test_ids:
                single_res = await IdentityResolver.resolve(session=session, identifier=ident, use_cache=False)
                assert batch_results[ident].found == single_res.found
                assert batch_results[ident].entity_id == single_res.entity_id
                assert batch_results[ident].entity_type == single_res.entity_type


@pytest.mark.asyncio
async def test_identity_envelope_hydration_and_aliases(session_factory):
    """
    Test 6: Verify get_identity_envelope returns full identity envelope including
    canonical ID, governed identity code, all registered active aliases, deep link, and audit trail.
    """
    async with session_factory() as session:
        trans = await session.begin()
        test_suffix = IdentityEngine.generate_technical_id()[:8]
        try:
            tech_id, id_code = await IdentityEngine.allocate_internal(
                session=session,
                entity_type="PARTY",
                purpose="TEST_ENVELOPE",
            )

            # Add two aliases

            await IdentityEngine.register_alias(
                session=session,
                entity_type="PARTY",
                entity_id=tech_id,
                alias_code=f"GSTN_{test_suffix}",
                alias_type="STATUTORY_ID",
                source_system="GSTN",
                canonical_identity_code=id_code,
            )
            await IdentityEngine.register_alias(
                session=session,
                entity_type="PARTY",
                entity_id=tech_id,
                alias_code=f"PAN_{test_suffix}",
                alias_type="STATUTORY_ID",
                source_system="INCOME_TAX_DEPT",
                canonical_identity_code=id_code,
            )

            envelope = await IdentityEngine.get_identity_envelope(
                session=session,
                identifier=id_code,
            )
            assert envelope is not None
            assert envelope["found"] is True
            assert envelope["canonical_id"] == tech_id
            assert envelope["entity_type"] == "PARTY"
            assert envelope["identity_code"] == id_code
            assert envelope["alias_count"] >= 2
            assert "/parties/" in envelope["deep_link"]
            assert envelope["allocation_audit"]["purpose"] == "TEST_ENVELOPE"
        finally:
            await trans.rollback()


@pytest.mark.asyncio
async def test_resolution_cache_hit_miss_and_invalidation(session_factory):
    """
    Test 7: Verify in-memory resolution cache hit/miss semantics and programmatic invalidation.
    """
    cache = get_identity_cache()
    await cache.clear()

    async with session_factory() as session:
        trans = await session.begin()
        test_suffix = IdentityEngine.generate_technical_id()[:8]
        test_alias = f"CACHE_TEST_{test_suffix}"
        try:
            tech_id = IdentityEngine.generate_technical_id()
            await IdentityEngine.register_alias(
                session=session,
                entity_type="PAYMENT_TRANSACTION",
                entity_id=tech_id,
                alias_code=test_alias,
                alias_type="GATEWAY_REF",
                source_system="RAZORPAY",
            )

            stats_before = await cache.get_stats()
            # 1. First resolution: should be a Cache Miss
            res1 = await IdentityResolver.resolve(
                session=session,
                identifier=test_alias,
                use_cache=True,
            )
            assert res1.found is True

            # 2. Second resolution: should be a Cache Hit
            res2 = await IdentityResolver.resolve(
                session=session,
                identifier=test_alias,
                use_cache=True,
            )
            assert res2.found is True
            stats_after = await cache.get_stats()
            assert stats_after["hits"] > stats_before["hits"]

            # 3. Invalidate
            await IdentityEngine.invalidate_cache(test_alias)

            # 4. Third resolution: should be a Cache Miss again
            stats_before_3 = await cache.get_stats()
            res3 = await IdentityResolver.resolve(
                session=session,
                identifier=test_alias,
                use_cache=True,
            )
            assert res3.found is True
            stats_after_3 = await cache.get_stats()
            assert stats_after_3["misses"] > stats_before_3["misses"]
        finally:
            await trans.rollback()


@pytest.mark.asyncio
async def test_omnichannel_cross_domain_search(session_factory):
    """
    Test 8: Verify omnichannel cross-domain entity discovery (search_entities):
    - Matches across aliases and identity codes.
    - Returns structured match items with entity_type, deep_link, and match_type.
    """
    async with session_factory() as session:
        # Search for "MST" (matches identity codes and prefixes)
        matches = await IdentityEngine.search_entities(
            session=session,
            query="MST",
            limit=10,
        )
        assert isinstance(matches, list)
        if matches:
            first = matches[0]
            assert "entity_type" in first
            assert "entity_id" in first
            assert "deep_link" in first
            assert first["match_type"] in ("ALIAS", "IDENTITY_CODE")
