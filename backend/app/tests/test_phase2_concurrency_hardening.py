"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.39.0
Created      : 2026-09-18
Modified     : 2026-09-18
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Phase 2 Concurrency & Hardening Test Suite
"""

import uuid
import asyncio
import pytest
from urllib.parse import urlparse
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.pool import NullPool

from app.core.config import settings
from app.models.tenant import Company
from app.models.identity_registry import SmritiIdentityAlias
from app.services.identity.engine import IdentityEngine
from app.services.identity.resolver import IdentityResolver


@pytest.fixture(scope="function")
def session_factory():
    engine = create_async_engine(settings.DATABASE_URL, poolclass=NullPool)
    factory = async_sessionmaker(bind=engine, expire_on_commit=False)
    yield factory


@pytest.mark.asyncio
async def test_concurrent_alias_registration_same_entity(session_factory):
    """
    Test 2.3A: 10 concurrent workers registering the exact same alias simultaneously
    must all resolve safely and idempotently without raising uncaught database IntegrityErrors.
    """
    alias_code = f"TEST-CONC-{uuid.uuid4().hex[:10]}"
    entity_type = "ITEM"
    entity_id = IdentityEngine.generate_technical_id()

    async with session_factory() as session:
        company_id = (await session.execute(select(Company.id).limit(1))).scalar()

    async def _worker():
        async with session_factory() as session:
            alias = await IdentityEngine.register_alias(
                session=session,
                entity_type=entity_type,
                entity_id=entity_id,
                alias_code=alias_code,
                company_id=company_id,
            )
            await session.commit()
            return alias.id

    # 10 workers fire simultaneously
    results = await asyncio.gather(*[_worker() for _ in range(10)])
    assert len(results) == 10
    first_id = results[0]
    # Every worker must resolve to the identical persisted alias ID
    for res_id in results:
        assert res_id == first_id

    # Verify exactly 1 record persisted in database
    async with session_factory() as session:
        count = (await session.execute(
            select(SmritiIdentityAlias).where(
                SmritiIdentityAlias.entity_type == entity_type,
                SmritiIdentityAlias.alias_code == alias_code,
            )
        )).scalars().all()
        assert len(count) == 1


@pytest.mark.asyncio
async def test_alias_collision_protection(session_factory):
    """
    Test 2.3B: Attempting to register an alias already bound to entity_a to entity_b
    must raise ValueError to protect against competing entity bindings.
    """
    alias_code = f"TEST-COLL-{uuid.uuid4().hex[:10]}"
    entity_type = "PARTY"
    entity_a = IdentityEngine.generate_technical_id()
    entity_b = IdentityEngine.generate_technical_id()

    async with session_factory() as session:
        company_id = (await session.execute(select(Company.id).limit(1))).scalar()

        # Register for entity_a
        alias_a = await IdentityEngine.register_alias(
            session=session,
            entity_type=entity_type,
            entity_id=entity_a,
            alias_code=alias_code,
            company_id=company_id,
        )
        await session.commit()
        assert alias_a.entity_id == entity_a

        # Attempt to register same alias for entity_b -> must raise ValueError
        with pytest.raises(ValueError) as excinfo:
            await IdentityEngine.register_alias(
                session=session,
                entity_type=entity_type,
                entity_id=entity_b,
                alias_code=alias_code,
                company_id=company_id,
            )
        assert "collision" in str(excinfo.value).lower()


@pytest.mark.asyncio
async def test_alias_case_insensitive_lookup_and_registration(session_factory):
    """
    Test 2.3C: Alias codes must be matched and registered case-insensitively.
    """
    raw_code = f"EWB-UpPer-{uuid.uuid4().hex[:10]}"
    entity_type = "TAX_INVOICE"
    entity_id = IdentityEngine.generate_technical_id()

    async with session_factory() as session:
        company_id = (await session.execute(select(Company.id).limit(1))).scalar()

        # Register uppercase
        alias = await IdentityEngine.register_alias(
            session=session,
            entity_type=entity_type,
            entity_id=entity_id,
            alias_code=raw_code.upper(),
            company_id=company_id,
        )
        await session.commit()
        alias_id = alias.id

        # Register lowercase for same entity -> must return existing alias
        alias_lower = await IdentityEngine.register_alias(
            session=session,
            entity_type=entity_type,
            entity_id=entity_id,
            alias_code=raw_code.lower(),
            company_id=company_id,
        )
        await session.commit()
        assert alias_lower.id == alias_id

        # Resolve lowercase -> must find entity_id
        resolved = await IdentityResolver.resolve(
            session=session,
            identifier=raw_code.lower(),
            company_id=company_id,
        )
        assert resolved.found is True
        assert resolved.entity_id == entity_id


@pytest.mark.asyncio
async def test_schema_parity_rule12_items_table():
    """
    Test 2.3D: Rule 12 verification - ensure 100% column parity for the canonical
    items table across smritisys, smriti001, and smriti002.
    """
    parsed = urlparse(settings.DATABASE_URL)
    base_url = f"{parsed.scheme}://{parsed.username}:{parsed.password}@{parsed.hostname}:{parsed.port}"
    e_sys = create_async_engine(f"{base_url}/smritisys", poolclass=NullPool)
    e_001 = create_async_engine(f"{base_url}/smriti001", poolclass=NullPool)
    e_002 = create_async_engine(f"{base_url}/smriti002", poolclass=NullPool)

    async with e_sys.connect() as c_sys, e_001.connect() as c_001, e_002.connect() as c_002:
        cols_sys = set((await c_sys.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name = 'items'"))).scalars().all())
        cols_001 = set((await c_001.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name = 'items'"))).scalars().all())
        cols_002 = set((await c_002.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name = 'items'"))).scalars().all())

        assert cols_001 == cols_sys, f"Drift between smriti001 and smritisys: {cols_001 ^ cols_sys}"
        assert cols_001 == cols_002, f"Drift between smriti001 and smriti002: {cols_001 ^ cols_002}"
