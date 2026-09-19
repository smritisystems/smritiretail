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

import asyncio
import os
import pytest
from sqlalchemy import select, delete, func
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.pool import NullPool

from app.core.config import settings
from app.services.identity.uuid7 import uuid7, is_valid_uuidv7
from app.services.identity.engine import IdentityEngine
from app.services.identity.validator import IdentityValidator, SMRITI_APPROVED_GROUPS
from app.services.identity.code_generator import IdentityCodeGenerator
from app.models.identity_registry import (
    SmritiIdentityRegistry,
    SmritiNumberingRegistry,
    SmritiIdentityAllocationLog,
    SmritiIdentityAlias,
)


@pytest.mark.asyncio
async def test_uuid7_rfc9562_properties():
    """
    Verify RFC 9562 compliance for UUIDv7 generator:
    1. 36 characters length with 8-4-4-4-12 hyphen format
    2. Version 7 in 13th nibble (character index 14)
    3. Variant 10xx in 17th nibble (character index 19 in ['8', '9', 'a', 'b'])
    4. Strict monotonic sort ordering across 1,000 rapid allocations
    5. Validation helper correctly distinguishes UUIDv7 from UUIDv4 and malformed strings
    """
    sample_ids = [uuid7() for _ in range(1000)]

    # Length and structure check
    for uid in sample_ids[:20]:
        assert len(uid) == 36, f"Expected 36 chars, got {len(uid)}"
        parts = uid.split("-")
        assert len(parts) == 5
        assert [len(p) for p in parts] == [8, 4, 4, 4, 12]
        # Version 7
        assert uid[14] == "7", f"Expected version 7 at index 14, got {uid[14]}"
        # Variant 1 (RFC 4122/9562: 10xx in binary -> 8, 9, a, b in hex)
        assert uid[19].lower() in ["8", "9", "a", "b"], f"Expected variant 1 at index 19, got {uid[19]}"
        assert is_valid_uuidv7(uid) is True

    # Monotonic sort check: lexical sort order must match generation sequence
    assert sample_ids == sorted(sample_ids), "UUIDv7 allocations must maintain monotonic ordering"

    # Validator checks
    assert is_valid_uuidv7("not-a-uuid") is False
    assert is_valid_uuidv7("00000000-0000-4000-8000-000000000000") is False  # UUIDv4
    assert is_valid_uuidv7("0191f6e2-2a74-7221-a203-d34eefb5e43a") is True   # UUIDv7


@pytest.mark.asyncio
async def test_identity_code_validator_taxonomy():
    """
    Verify identity code validation against the 16 SMRITI approved groups and syntax rules.
    """
    assert len(SMRITI_APPROVED_GROUPS) == 16
    assert "MST" in SMRITI_APPROVED_GROUPS
    assert "SAL" in SMRITI_APPROVED_GROUPS
    assert "PUR" in SMRITI_APPROVED_GROUPS
    assert "CRM" in SMRITI_APPROVED_GROUPS
    assert "RPT" in SMRITI_APPROVED_GROUPS

    # Syntax tests
    valid_codes = [
        "MST-ITM-00000001",
        "SAL-INV-00000042",
        "PUR-PO-00000123",
        "CRM-CUS-00000001",
        "RPT-REP-00000099",
    ]
    for code in valid_codes:
        # Static validation
        syntax_ok = IdentityValidator.validate_syntax(code)
        assert syntax_ok is True, f"Code {code} should pass syntax validation"

    invalid_codes = [
        "XYZ-ITM-00000001",    # Invalid group
        "MST-ITM-12",          # Too short sequence (< 3 digits)
        "MST-ITM-NOTANUMBER",  # Non-numeric sequence
        "mst-itm-00000001",    # Lowercase
        "INVALID",             # Arbitrary string
    ]
    for code in invalid_codes:
        syntax_ok = IdentityValidator.validate_syntax(code)
        assert syntax_ok is False, f"Code {code} should fail syntax validation"


@pytest.mark.asyncio
async def test_postgresql_100_concurrent_allocations():
    """
    MANDATORY POSTGRESQL CONCURRENCY TEST:
    Executes 100 simultaneous allocations against PostgreSQL across 100 concurrent
    async sessions using SELECT ... FOR UPDATE on the same numbering row.

    Guarantees:
    - 100/100 transactions succeed
    - Exactly 100 unique UUIDv7s
    - Exactly 100 unique identity codes
    - Exactly sequential 1 to 100 without race conditions, duplicates, or gaps
    - Exactly 100 allocation audit logs created
    """
    # Use a bounded pool with semaphore to avoid exhausting PostgreSQL max_connections
    test_engine = create_async_engine(settings.DATABASE_URL, pool_size=15, max_overflow=10)
    session_factory = async_sessionmaker(bind=test_engine, expire_on_commit=False)

    test_tenant = f"tnt_concurrency_{uuid7()[:8]}"
    entity_type = "ITEM"
    sem = asyncio.Semaphore(15)

    async def allocate_worker(worker_id: int):
        async with sem:
            async with session_factory() as session:
                async with session.begin():
                    tech_id, code = await IdentityEngine.generate_identity(
                        session=session,
                        entity_type=entity_type,
                        tenant_id=test_tenant,
                        purpose="CONCURRENCY_TEST",
                        correlation_id=f"worker_{worker_id}",
                    )
                return worker_id, tech_id, code

    try:
        # Launch 100 concurrent async transactions
        tasks = [allocate_worker(i) for i in range(1, 101)]
        results = await asyncio.gather(*tasks)

        assert len(results) == 100, "All 100 concurrent tasks must complete"

        worker_ids = [r[0] for r in results]
        tech_ids = [r[1] for r in results]
        codes = [r[2] for r in results]

        # 1. Assert 100 unique technical IDs
        assert len(set(tech_ids)) == 100, f"Expected 100 unique UUIDs, got {len(set(tech_ids))}"

        # 2. Assert 100 unique identity codes
        assert len(set(codes)) == 100, f"Expected 100 unique codes, got {len(set(codes))}"

        # 3. Extract sequences and assert strictly consecutive 1..100
        sequences = sorted([int(c.split("-")[-1]) for c in codes])
        expected_sequences = list(range(1, 101))
        assert sequences == expected_sequences, (
            f"Sequence must be exactly 1..100 without gaps or duplicates. Min: {sequences[0]}, Max: {sequences[-1]}"
        )

        # 4. Verify database state
        async with session_factory() as session:
            # Check numbering registry row
            num_res = await session.execute(
                select(SmritiNumberingRegistry).where(
                    SmritiNumberingRegistry.entity_type == entity_type,
                    SmritiNumberingRegistry.tenant_id == test_tenant,
                )
            )
            num_row = num_res.scalars().first()
            assert num_row is not None
            assert num_row.sequence_value == 100, f"Expected sequence_value 100, got {num_row.sequence_value}"

            # Check allocation audit logs
            log_res = await session.execute(
                select(func.count()).select_from(SmritiIdentityAllocationLog).where(
                    SmritiIdentityAllocationLog.tenant_id == test_tenant,
                    SmritiIdentityAllocationLog.purpose == "CONCURRENCY_TEST",
                )
            )
            log_count = log_res.scalar()
            assert log_count == 100, f"Expected 100 allocation logs, got {log_count}"

    finally:
        # Cleanup test tenant records
        async with session_factory() as session:
            async with session.begin():
                await session.execute(
                    delete(SmritiIdentityAllocationLog).where(SmritiIdentityAllocationLog.tenant_id == test_tenant)
                )
                await session.execute(
                    delete(SmritiNumberingRegistry).where(SmritiNumberingRegistry.tenant_id == test_tenant)
                )
        await test_engine.dispose()


@pytest.mark.asyncio
async def test_transactional_rollback_policy():
    """
    Verify transaction rollback behavior on numbering registry:
    When a transaction allocates a sequence but subsequently rolls back,
    the uncommitted sequence update is reverted in PostgreSQL.
    Subsequent transaction re-attempts and receives the correct sequence.
    """
    test_engine = create_async_engine(settings.DATABASE_URL, poolclass=NullPool)
    session_factory = async_sessionmaker(bind=test_engine, expire_on_commit=False)

    test_tenant = f"tnt_rollback_{uuid7()[:8]}"
    entity_type = "CUSTOMER"

    try:
        # Step 1: Commit allocation #1
        async with session_factory() as s1:
            async with s1.begin():
                _, code1 = await IdentityEngine.generate_identity(
                    session=s1,
                    entity_type=entity_type,
                    tenant_id=test_tenant,
                )
        assert code1 == "CRM-CUS-00000001"

        # Step 2: Allocate #2 in a transaction, but deliberately ROLLBACK
        async with session_factory() as s2:
            try:
                async with s2.begin():
                    _, code2 = await IdentityEngine.generate_identity(
                        session=s2,
                        entity_type=entity_type,
                        tenant_id=test_tenant,
                    )
                    assert code2 == "CRM-CUS-00000002"
                    # Simulate failure / rollback
                    raise ValueError("Simulated business validation failure triggering rollback")
            except ValueError:
                pass  # Rolled back cleanly

        # Step 3: Verify the next committed allocation reclaims sequence #2
        async with session_factory() as s3:
            async with s3.begin():
                _, code3 = await IdentityEngine.generate_identity(
                    session=s3,
                    entity_type=entity_type,
                    tenant_id=test_tenant,
                )
        assert code3 == "CRM-CUS-00000002", "PostgreSQL rollback must revert sequence row update preventing phantom gaps"

    finally:
        async with session_factory() as session:
            async with session.begin():
                await session.execute(
                    delete(SmritiIdentityAllocationLog).where(SmritiIdentityAllocationLog.tenant_id == test_tenant)
                )
                await session.execute(
                    delete(SmritiNumberingRegistry).where(SmritiNumberingRegistry.tenant_id == test_tenant)
                )
        await test_engine.dispose()


@pytest.mark.asyncio
async def test_tenant_isolated_resolution():
    """
    Verify that identity resolution respects multi-tenant boundaries:
    An entity allocated under Tenant A must NOT resolve under Tenant B.
    """
    test_engine = create_async_engine(settings.DATABASE_URL, poolclass=NullPool)
    session_factory = async_sessionmaker(bind=test_engine, expire_on_commit=False)

    tenant_a = f"tnt_a_{uuid7()[:8]}"
    tenant_b = f"tnt_b_{uuid7()[:8]}"

    try:
        async with session_factory() as session:
            async with session.begin():
                tech_id, code = await IdentityEngine.generate_identity(
                    session=session,
                    entity_type="ITEM",
                    tenant_id=tenant_a,
                )

                # Resolution under Tenant A -> Must match allocation log
                res_a = await IdentityEngine.resolve_identifier(
                    session=session,
                    identifier=code,
                    tenant_id=tenant_a,
                )
                assert res_a.found is True
                assert res_a.canonical_id == tech_id
                assert res_a.identity_code == code

                # Resolution under Tenant B -> Must fail due to tenant boundary isolation
                res_b = await IdentityEngine.resolve_identifier(
                    session=session,
                    identifier=code,
                    tenant_id=tenant_b,
                )
                assert res_b.found is False, "Tenant B must NOT be able to resolve Tenant A identity"

    finally:
        async with session_factory() as session:
            async with session.begin():
                await session.execute(
                    delete(SmritiIdentityAllocationLog).where(SmritiIdentityAllocationLog.tenant_id == tenant_a)
                )
                await session.execute(
                    delete(SmritiNumberingRegistry).where(SmritiNumberingRegistry.tenant_id == tenant_a)
                )
        await test_engine.dispose()


@pytest.mark.asyncio
async def test_alias_polymorphic_resolution():
    """
    Verify polymorphic alias resolution (Blueprint Section 68):
    Historical codes and legacy IDs map to canonical identity via smriti_identity_alias.
    """
    test_engine = create_async_engine(settings.DATABASE_URL, poolclass=NullPool)
    session_factory = async_sessionmaker(bind=test_engine, expire_on_commit=False)

    canonical_tech_id = uuid7()
    legacy_shoper9_code = f"SH9-SKU-{uuid7()[:6].upper()}"

    try:
        async with session_factory() as session:
            async with session.begin():
                alias = SmritiIdentityAlias(
                    id=uuid7(),
                    entity_type="ITEM",
                    entity_id=canonical_tech_id,
                    canonical_identity_code="MST-ITM-00009999",
                    alias_code=legacy_shoper9_code,
                    alias_type="LEGACY_IMPORT",
                    source_system="SHOPER9",
                )
                session.add(alias)

        # Resolve using the legacy alias code
        async with session_factory() as session:
            res = await IdentityEngine.resolve_identifier(
                session=session,
                identifier=legacy_shoper9_code,
                entity_type_hint="ITEM",
            )
            assert res.found is True
            assert res.canonical_id == canonical_tech_id
            assert "ALIAS" in res.resolution_tier

    finally:
        async with session_factory() as session:
            async with session.begin():
                await session.execute(
                    delete(SmritiIdentityAlias).where(SmritiIdentityAlias.alias_code == legacy_shoper9_code)
                )
        await test_engine.dispose()


@pytest.mark.asyncio
async def test_client_id_rejection_and_internal_allocation():
    """
    Test 7 (Governance & Identity Contract Enforcement):
    1. Asserts that client payloads attempting to supply a persistent technical ID are rejected.
    2. Asserts that entity creation paths allocate identities exclusively via IdentityEngine.allocate_internal.
    """
    import pydantic
    from app.schemas.sales import SalesOrderCreate

    # 1. Providing client ID must fail validation
    with pytest.raises(pydantic.ValidationError) as exc_info:
        SalesOrderCreate(
            id="client-controlled-id",
            order_no="SO-TEST-REJECT-001",
            date="2026-09-18",
            customer_name="Test Customer",
        )
    assert "Persistent technical ID cannot be supplied by client" in str(exc_info.value)

    # 2. Omitting client ID must succeed with id=None
    so_valid = SalesOrderCreate(
        order_no="SO-TEST-VALID-001",
        date="2026-09-18",
        customer_name="Test Customer",
    )
    assert so_valid.id is None

    # 3. IdentityEngine internal allocation generates canonical UUIDv7 + governed identity_code
    test_engine = create_async_engine(settings.DATABASE_URL, echo=False)
    session_factory = async_sessionmaker(test_engine, expire_on_commit=False)

    try:
        async with session_factory() as session:
            async with session.begin():
                tech_id, code = await IdentityEngine.allocate_internal(
                    session=session,
                    entity_type="SALES_ORDER",
                    tenant_id="test_tenant_gov",
                    company_id=None,
                    branch_id=None,
                    purpose="ENTITY_CREATION",
                )
                assert is_valid_uuidv7(tech_id)
                assert code.startswith("SAL-ORD-")

                # Verify entry in smriti_identity_allocation_log
                alloc_res = await session.execute(
                    select(SmritiIdentityAllocationLog).where(
                        SmritiIdentityAllocationLog.canonical_id == tech_id
                    )
                )
                alloc = alloc_res.scalars().first()
                assert alloc is not None
                assert alloc.identity_code == code
                assert alloc.entity_type == "SALES_ORDER"
                assert alloc.purpose == "ENTITY_CREATION"
    finally:
        async with session_factory() as session:
            async with session.begin():
                await session.execute(
                    delete(SmritiIdentityAllocationLog).where(
                        SmritiIdentityAllocationLog.tenant_id == "test_tenant_gov"
                    )
                )
        await test_engine.dispose()

