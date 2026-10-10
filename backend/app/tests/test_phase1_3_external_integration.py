"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.37.0
Created      : 2026-09-18
Modified     : 2026-09-18
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal Core Architecture
"""

import pytest
from pydantic import ValidationError
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker

from app.core.config import settings
from app.services.identity.engine import IdentityEngine
from app.services.identity.validator import IdentityValidator
from app.models.party import Party
from app.models.distribution import EWayBill
from app.models.payment_ledger import PaymentTransaction
from app.models.identity_registry import SmritiIdentityAlias, SmritiIdentityAllocationLog
from app.schemas.party_master import PartyCreateRequest
from app.schemas.payments import ProcessPaymentRequest, PaymentTenderItem


@pytest.fixture
def session_factory():
    engine = create_async_engine(settings.DATABASE_URL, pool_size=5, max_overflow=5)
    return async_sessionmaker(bind=engine, expire_on_commit=False)


@pytest.mark.asyncio
async def test_external_partner_identity_codes_format_and_sequence(session_factory):
    """
    Verify that external and partner entities have validly formatted SMRITI Identity Codes:
    - MST-PRT-... for legal parties (suppliers, customers, vendors)
    - TAX-EWB-... for statutory e-way bills
    """
    async with session_factory() as session:
        # 1. Parties
        party_res = await session.execute(
            select(Party.id, Party.identity_code, Party.party_code).limit(10)
        )
        parties = party_res.fetchall()
        for pid, id_code, pcode in parties:
            if id_code is not None:
                assert id_code.startswith("MST-PRT-"), f"Unexpected Party identity code {id_code}"
                assert IdentityValidator.validate_syntax(id_code) is True
                assert await IdentityValidator.validate_identity_code(session, id_code) is True

        # 2. E-Way Bills
        ewb_res = await session.execute(
            select(EWayBill.id, EWayBill.identity_code, EWayBill.eway_bill_no).limit(10)
        )
        ewbs = ewb_res.fetchall()
        for ewb_id, id_code, ewb_no in ewbs:
            if id_code is not None:
                assert id_code.startswith("TAX-EWB-"), f"Unexpected EWayBill identity code {id_code}"
                assert IdentityValidator.validate_syntax(id_code) is True
                assert await IdentityValidator.validate_identity_code(session, id_code) is True


@pytest.mark.asyncio
async def test_ledger_boundary_payment_transactions_uses_uuidv7_without_sequential_code(session_factory):
    """
    Verify high-throughput settlement ledger boundary:
    - Payment transactions have technical primary key 'id' (UUIDv7 compatible string)
    - Payment transactions strictly do NOT have a human sequential 'identity_code' column (zero row-locking overhead)
    - IdentityEngine.generate_technical_id() generates RFC 9562 compliant UUIDv7
    """
    async with session_factory() as session:
        # Verify schema boundary
        res = await session.execute(
            text(
                "SELECT column_name FROM information_schema.columns "
                "WHERE table_name = 'payment_transactions' AND column_name IN ('id', 'identity_code')"
            )
        )
        cols = [r[0] for r in res.fetchall()]
        assert "id" in cols, "payment_transactions missing technical PK 'id'"
        assert "identity_code" not in cols, "payment_transactions must NOT have sequential 'identity_code' column"

        # Verify UUIDv7 technical generator
        tech_id = IdentityEngine.generate_technical_id()
        assert IdentityValidator.validate_technical_id(tech_id) is True, f"Generated ID {tech_id} is not valid UUIDv7"


@pytest.mark.asyncio
async def test_tier_1_external_partner_identity_resolution(session_factory):
    """
    Verify that external partner entities resolve deterministically via Tier 1 (Allocation Log / Identity Code).
    """
    async with session_factory() as session:
        # 1. Resolve Party by identity_code
        party_res = await session.execute(
            select(Party.id, Party.identity_code)
            .where(Party.identity_code.is_not(None))
            .limit(1)
        )
        party = party_res.fetchone()
        if party:
            res = await IdentityEngine.resolve_identifier(
                session=session,
                identifier=party.identity_code,
            )
            assert res.found is True, f"Failed to resolve Party by identity code {party.identity_code}"
            assert res.canonical_id == party.id
            assert res.entity_type == "PARTY"
            assert res.resolution_tier in ["TIER_1_ALLOCATION_LOG", "TIER_1_IDENTITY_CODE"]

        # 2. Resolve E-Way Bill by identity_code
        ewb_res = await session.execute(
            select(EWayBill.id, EWayBill.identity_code)
            .where(EWayBill.identity_code.is_not(None))
            .limit(1)
        )
        ewb = ewb_res.fetchone()
        if ewb:
            res = await IdentityEngine.resolve_identifier(
                session=session,
                identifier=ewb.identity_code,
            )
            assert res.found is True, f"Failed to resolve EWayBill by identity code {ewb.identity_code}"
            assert res.canonical_id == ewb.id
            assert res.entity_type == "EWAY_BILL"
            assert res.resolution_tier in ["TIER_1_ALLOCATION_LOG", "TIER_1_IDENTITY_CODE"]


@pytest.mark.asyncio
async def test_tier_2_partner_and_statutory_alias_resolution(session_factory):
    """
    Verify that partner and statutory identifiers (e.g. GSTIN, PAN, party_code, NIC EWB No, Gateway Ref)
    resolve through smriti_identity_alias to canonical entities.
    """
    async with session_factory() as session:
        # 1. Find a Party statutory or historical alias
        party_alias_res = await session.execute(
            select(SmritiIdentityAlias)
            .where(
                SmritiIdentityAlias.entity_type == "PARTY",
                SmritiIdentityAlias.notes.like("%Phase 1.3%"),
            )
            .limit(1)
        )
        party_alias = party_alias_res.scalars().first()
        if party_alias:
            res = await IdentityEngine.resolve_identifier(
                session=session,
                identifier=party_alias.alias_code,
                company_id=party_alias.company_id,
            )
            assert res.found is True, f"Failed to resolve Party alias {party_alias.alias_code}"
            assert res.canonical_id == party_alias.entity_id
            assert res.entity_type == "PARTY"
            assert res.resolution_tier in ["TIER_2_ALIAS", "TIER_2_HISTORICAL_ALIAS"]

        # 2. Find a PaymentTransaction gateway reference alias
        pt_alias_res = await session.execute(
            select(SmritiIdentityAlias)
            .where(
                SmritiIdentityAlias.entity_type == "PAYMENT_TRANSACTION",
                SmritiIdentityAlias.alias_type == "GATEWAY_REF",
            )
            .limit(1)
        )
        pt_alias = pt_alias_res.scalars().first()
        if pt_alias:
            res = await IdentityEngine.resolve_identifier(
                session=session,
                identifier=pt_alias.alias_code,
                company_id=pt_alias.company_id,
            )
            assert res.found is True, f"Failed to resolve PaymentTransaction alias {pt_alias.alias_code}"
            assert res.canonical_id == pt_alias.entity_id
            assert res.entity_type == "PAYMENT_TRANSACTION"
            assert res.resolution_tier in ["TIER_2_ALIAS", "TIER_2_HISTORICAL_ALIAS"]

        # 3. Find an E-Way Bill statutory alias
        ewb_alias_res = await session.execute(
            select(SmritiIdentityAlias)
            .where(
                SmritiIdentityAlias.entity_type == "EWAY_BILL",
                SmritiIdentityAlias.source_system == "NIC_EWAY",
            )
            .limit(1)
        )
        ewb_alias = ewb_alias_res.scalars().first()
        if ewb_alias:
            res = await IdentityEngine.resolve_identifier(
                session=session,
                identifier=ewb_alias.alias_code,
                company_id=ewb_alias.company_id,
            )
            assert res.found is True, f"Failed to resolve EWayBill alias {ewb_alias.alias_code}"
            assert res.canonical_id == ewb_alias.entity_id
            assert res.entity_type == "EWAY_BILL"
            assert res.resolution_tier in ["TIER_2_ALIAS", "TIER_2_HISTORICAL_ALIAS"]


def test_reject_client_supplied_persistent_id():
    """
    Verify that schemas prohibit frontend/client-supplied persistent technical IDs
    across PartyCreateRequest and ProcessPaymentRequest.
    """
    # 1. PartyCreateRequest rejects client id
    with pytest.raises(ValidationError) as exc_party:
        PartyCreateRequest(
            id="client-supplied-party-id",
            legal_name="Apex Global Traders Pvt Ltd",
            party_type="ORGANIZATION",
        )
    assert "Persistent technical ID cannot be supplied by client" in str(exc_party.value)

    # 2. ProcessPaymentRequest rejects client id
    with pytest.raises(ValidationError) as exc_payment:
        ProcessPaymentRequest(
            id="client-supplied-payment-id",
            reference_doc_type="SALES_INVOICE",
            reference_doc_id="INV-2026-0001",
            tenders=[
                PaymentTenderItem(
                    tender_type="CASH",
                    amount=500.00,
                )
            ],
            idempotency_key="idemp-key-test-001",
        )
    assert "Persistent technical ID cannot be supplied by client" in str(exc_payment.value)


@pytest.mark.asyncio
async def test_external_partner_creation_lifecycle_allocates_governed_identity(session_factory):
    """
    Verify that external partner services allocate UUIDv7 and governed identity codes
    strictly through IdentityEngine.allocate_internal().
    """
    async with session_factory() as session:
        try:
            async with session.begin():
                # 1. Allocate for PARTY
                tech_id_prt, code_prt = await IdentityEngine.allocate_internal(
                    session=session,
                    entity_type="PARTY",
                    purpose="PHASE_1_3_UNIT_TEST",
                    correlation_id="test_prt_alloc_1",
                )
                assert IdentityValidator.validate_technical_id(tech_id_prt) is True
                assert code_prt.startswith("MST-PRT-")
                assert IdentityValidator.validate_syntax(code_prt) is True

                # 2. Allocate for EWAY_BILL
                tech_id_ewb, code_ewb = await IdentityEngine.allocate_internal(
                    session=session,
                    entity_type="EWAY_BILL",
                    purpose="PHASE_1_3_UNIT_TEST",
                    correlation_id="test_ewb_alloc_1",
                )
                assert IdentityValidator.validate_technical_id(tech_id_ewb) is True
                assert code_ewb.startswith("TAX-EWB-")
                assert IdentityValidator.validate_syntax(code_ewb) is True

                # 3. High-throughput ledger boundary technical ID generation
                tech_id_pt = IdentityEngine.generate_technical_id()
                assert IdentityValidator.validate_technical_id(tech_id_pt) is True

                # 4. Verify allocation log audit entries
                alloc_res = await session.execute(
                    select(SmritiIdentityAllocationLog).where(
                        SmritiIdentityAllocationLog.canonical_id.in_([tech_id_prt, tech_id_ewb])
                    )
                )
                allocs = alloc_res.scalars().all()
                assert len(allocs) == 2
        finally:
            await session.rollback()


@pytest.mark.asyncio
async def test_alias_records_use_identity_engine_generated_id(session_factory):
    """
    Test A: Verify that SmritiIdentityAlias records use IdentityEngine.generate_technical_id() (UUIDv7)
    and that no locally generated uuid4() persistent IDs are used across alias creation.
    """
    async with session_factory() as session:
        trans = await session.begin()
        test_suffix = IdentityEngine.generate_technical_id()[:8]
        test_alias_code = f"razorpay_pay_test_{test_suffix}"
        try:
            # 1. Register alias via IdentityEngine
            entity_id = IdentityEngine.generate_technical_id()
            alias = await IdentityEngine.register_alias(
                session=session,
                entity_type="PAYMENT_TRANSACTION",
                entity_id=entity_id,
                alias_code=test_alias_code,
                alias_type="GATEWAY_REF",
                source_system="RAZORPAY",
                notes="Test alias id generation",
            )

            # Verify alias.id is valid RFC 9562 UUIDv7
            assert IdentityValidator.validate_technical_id(alias.id) is True, f"Alias id {alias.id} is not valid UUIDv7"
            assert alias.uuid == alias.id, "Alias uuid must match technical identity id"
            assert not alias.id.startswith("alias_"), "Alias id must not use legacy alias_ prefix"
            assert alias.source_system == "RAZORPAY"
        finally:
            await trans.rollback()


@pytest.mark.asyncio
async def test_duplicate_external_alias_is_rejected_or_reused(session_factory):
    """
    Test B: Verify external alias idempotency and collision protection:
    - Ingesting identical external alias for the SAME canonical entity reuses the alias without error or duplication.
    - Ingesting identical external alias for a DIFFERENT canonical entity raises ValueError (collision prevention).
    Tested across:
    1. Payment Gateway Reference: RAZORPAY + PAY_{test_id}
    2. Statutory NIC E-Way Bill: NIC_EWAY + EWB_{test_id}
    3. Statutory Party GSTIN: GSTN + GSTN_{test_id}
    """
    async with session_factory() as session:
        trans = await session.begin()
        test_suffix = IdentityEngine.generate_technical_id()[:8]
        code_gw = f"PAY_{test_suffix}"
        code_ewb = f"99{test_suffix}"
        code_gstn = f"27TEST{test_suffix}Z5"

        try:
            entity_id_1 = IdentityEngine.generate_technical_id()
            entity_id_2 = IdentityEngine.generate_technical_id()

            # Case 1: Payment Gateway Reference
            alias_gw_1 = await IdentityEngine.register_alias(
                session=session,
                entity_type="PAYMENT_TRANSACTION",
                entity_id=entity_id_1,
                alias_code=code_gw,
                alias_type="GATEWAY_REF",
                source_system="RAZORPAY",
            )
            assert alias_gw_1.entity_id == entity_id_1

            # Idempotent retry on same entity -> reuses existing
            alias_gw_retry = await IdentityEngine.register_alias(
                session=session,
                entity_type="PAYMENT_TRANSACTION",
                entity_id=entity_id_1,
                alias_code=code_gw,
                alias_type="GATEWAY_REF",
                source_system="RAZORPAY",
            )
            assert alias_gw_retry.id == alias_gw_1.id

            # Collision attempt on different entity -> must raise ValueError
            with pytest.raises(ValueError) as exc_collision_gw:
                await IdentityEngine.register_alias(
                    session=session,
                    entity_type="PAYMENT_TRANSACTION",
                    entity_id=entity_id_2,
                    alias_code=code_gw,
                    alias_type="GATEWAY_REF",
                    source_system="RAZORPAY",
                )
            assert "Identity alias collision" in str(exc_collision_gw.value)

            # Case 2: Statutory NIC E-Way Bill
            ewb_id_1 = IdentityEngine.generate_technical_id()
            ewb_id_2 = IdentityEngine.generate_technical_id()
            alias_ewb_1 = await IdentityEngine.register_alias(
                session=session,
                entity_type="EWAY_BILL",
                entity_id=ewb_id_1,
                alias_code=code_ewb,
                alias_type="STATUTORY_ID",
                source_system="NIC_EWAY",
            )
            assert alias_ewb_1.entity_id == ewb_id_1

            # Idempotent retry on same eway bill -> reuses existing
            alias_ewb_retry = await IdentityEngine.register_alias(
                session=session,
                entity_type="EWAY_BILL",
                entity_id=ewb_id_1,
                alias_code=code_ewb,
                alias_type="STATUTORY_ID",
                source_system="NIC_EWAY",
            )
            assert alias_ewb_retry.id == alias_ewb_1.id

            # Collision attempt on different eway bill -> must raise ValueError
            with pytest.raises(ValueError) as exc_collision_ewb:
                await IdentityEngine.register_alias(
                    session=session,
                    entity_type="EWAY_BILL",
                    entity_id=ewb_id_2,
                    alias_code=code_ewb,
                    alias_type="STATUTORY_ID",
                    source_system="NIC_EWAY",
                )
            assert "Identity alias collision" in str(exc_collision_ewb.value)

            # Case 3: Statutory Party GSTIN
            party_id_1 = IdentityEngine.generate_technical_id()
            party_id_2 = IdentityEngine.generate_technical_id()
            alias_gstn_1 = await IdentityEngine.register_alias(
                session=session,
                entity_type="PARTY",
                entity_id=party_id_1,
                alias_code=code_gstn,
                alias_type="STATUTORY_ID",
                source_system="GSTN",
            )
            assert alias_gstn_1.entity_id == party_id_1

            # Idempotent retry on same party -> reuses existing
            alias_gstn_retry = await IdentityEngine.register_alias(
                session=session,
                entity_type="PARTY",
                entity_id=party_id_1,
                alias_code=code_gstn,
                alias_type="STATUTORY_ID",
                source_system="GSTN",
            )
            assert alias_gstn_retry.id == alias_gstn_1.id

            # Collision attempt on different party -> must raise ValueError
            with pytest.raises(ValueError) as exc_collision_gstn:
                await IdentityEngine.register_alias(
                    session=session,
                    entity_type="PARTY",
                    entity_id=party_id_2,
                    alias_code=code_gstn,
                    alias_type="STATUTORY_ID",
                    source_system="GSTN",
                )
            assert "Identity alias collision" in str(exc_collision_gstn.value)
        finally:
            await trans.rollback()


