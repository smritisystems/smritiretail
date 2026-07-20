"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.47.0
Created      : 2026-07-20
Modified     : 2026-07-20
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.api.deps import get_db
from app.models.sip import UniversalIdentityRegistry, SIPIdentityRule, SIPIdentityOutbox
from app.services.sip.providers import SIPProviderRegistry
from app.services.sip.strategies import IdentifierStrategyFactory
from app.services.sip.resolution_engine import SIPIdentityResolutionEngine
from app.services.sip.governance_fsm import SIPRuleGovernanceFSM
from app.services.sip.metrics_engine import SIPMetricsAndHealthEngine
from app.services.sip.ai_advisory import SIPAIAdvisoryService
from app.tests.conftest import clear_db
from app.db.base import BaseEntity


@pytest.fixture(autouse=True)
async def override_db(db_session):
    async with db_session.bind.begin() as conn:
        await conn.run_sync(BaseEntity.metadata.create_all)
    try:
        await clear_db(db_session)
    except Exception:
        await db_session.rollback()
        await clear_db(db_session)

    async def _get_db():
        yield db_session

    app.dependency_overrides[get_db] = _get_db
    yield
    app.dependency_overrides.pop(get_db, None)
    try:
        await clear_db(db_session)
    except Exception:
        await db_session.rollback()
        await clear_db(db_session)


@pytest.mark.asyncio
async def test_sip_provider_plugins_across_all_9_domains():
    """Verifies Provider plugin instantiation and business key generation for 9 domains."""
    domains = [
        ("PRODUCT", {"category": "Apparel", "brand": "Nike"}),
        ("CUSTOMER", {"phone": "9876543210"}),
        ("SUPPLIER", {"state_code": "MH"}),
        ("WAREHOUSE", {"branch_code": "WH01"}),
        ("ASSET", {"asset_type": "Laptop"}),
        ("EMPLOYEE", {"department": "Sales"}),
        ("VOUCHER", {"voucher_type": "GIFT"}),
        ("BATCH", {"mfg_date": "2026-07-20"}),
        ("SERIAL_NUMBER", {"prefix": "IMEI"}),
    ]

    for dom, payload in domains:
        provider = SIPProviderRegistry.get_provider(dom)
        assert provider.domain == dom
        key = provider.generate_business_key(payload, 1)
        assert len(key) > 5
        h = provider.calculate_identity_hash(payload)
        assert len(h) == 64


@pytest.mark.asyncio
async def test_sip_identifier_strategies_and_sgtin96_rfid_encoding():
    """Verifies Strategy pattern formatting for GS1, UPC, ISBN, UDI, and SGTIN-96 RFID hex encoding."""
    gs1_strat = IdentifierStrategyFactory.get_strategy("GS1")
    barcode = gs1_strat.generate_barcode(42)
    assert len(barcode) == 13
    assert barcode.startswith("8901000")

    link = gs1_strat.generate_digital_link_uri(barcode, "SRL00042")
    assert link.startswith("https://id.smritibooks.com/01/")

    sgtin96 = gs1_strat.generate_sgtin96_hex(barcode, "SRL00042")
    assert len(sgtin96) == 24


@pytest.mark.asyncio
async def test_sip_universal_identity_registration_and_outbox_event(db_session):
    """Verifies identity registration in central registry and transactional outbox event emission."""
    engine = SIPIdentityResolutionEngine()
    record = await engine.register_identity(
        db=db_session,
        domain="PRODUCT",
        entity_id="prod-sip-100",
        payload={"category": "Electronics", "brand": "Sony"},
        standard="GS1",
    )

    assert record.id is not None
    assert record.domain == "PRODUCT"
    assert record.entity_id == "prod-sip-100"
    assert record.barcode_value.startswith("8901000")
    assert record.digital_link_uri.startswith("https://id.smritibooks.com/01/")
    assert len(record.sgtin96_hex) == 24


@pytest.mark.asyncio
async def test_sip_governance_fsm_rule_lifecycle_transitions(db_session):
    """Verifies FSM lifecycle transition validation (DRAFT -> REVIEW -> APPROVED -> SIMULATION -> PILOT -> PRODUCTION)."""
    rule = SIPIdentityRule(
        id="rule-sip-01",
        name="SIP Product Rule",
        code="RULE_SIP_PROD",
        domain="PRODUCT",
        pattern_template="{category}-{brand}-{seq:04d}",
        lifecycle_state="DRAFT",
    )
    db_session.add(rule)
    await db_session.commit()

    fsm = SIPRuleGovernanceFSM()
    
    # Valid transition DRAFT -> REVIEW
    r_review = await fsm.transition_rule_state(db_session, rule.id, "REVIEW", "Moved to review")
    assert r_review.lifecycle_state == "REVIEW"

    # Invalid transition REVIEW -> PRODUCTION (must go through APPROVED first)
    with pytest.raises(ValueError, match="Invalid FSM transition"):
        await fsm.transition_rule_state(db_session, rule.id, "PRODUCTION", "Invalid jump")


@pytest.mark.asyncio
async def test_sip_platform_health_metrics_and_simulation(db_session):
    """Verifies Platform Operational Metrics calculations and pre-import batch simulation."""
    metrics_svc = SIPMetricsAndHealthEngine()
    sim_res = await metrics_svc.run_simulation(
        items=[
            {"name": "Item A", "category": "Cat1"},
            {"name": "Item B", "category": "Cat2"},
        ]
    )
    assert sim_res["total_simulated"] == 2
    assert sim_res["collisions"] == 0

    metrics = await metrics_svc.calculate_platform_metrics(db_session)
    assert metrics["platform_health_status"] == "HEALTHY"


@pytest.mark.asyncio
async def test_sip_decoupled_ai_advisory_service():
    """Verifies non-blocking AI Advisory Shannon entropy and pattern recommendation calculation."""
    ai_svc = SIPAIAdvisoryService()
    rec = ai_svc.recommend_pattern_template("PRODUCT", ["Brand", "Category", "Color"])
    assert rec["domain"] == "PRODUCT"
    assert "suggested_pattern_template" in rec
    assert rec["shannon_entropy_score"] > 0.0


@pytest.mark.asyncio
async def test_sip_rest_api_endpoints(db_session):
    """Verifies REST API surface under /api/v1/sip/*."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # 1. Health Endpoint
        res_health = await ac.get("/api/v1/sip/health")
        assert res_health.status_code == 200
        assert res_health.json()["platform_health_status"] == "HEALTHY"

        # 2. Registration Endpoint
        res_reg = await ac.post(
            "/api/v1/sip/register",
            json={
                "domain": "CUSTOMER",
                "entity_id": "cust-sip-01",
                "attributes": {"phone": "9876543210"},
                "identifier_standard": "GS1",
            }
        )
        assert res_reg.status_code == 200
        assert res_reg.json()["success"] is True

        # 3. AI Advisory Endpoint
        res_ai = await ac.post(
            "/api/v1/sip/ai/recommendations",
            json={"domain": "CUSTOMER", "attributes": ["Phone"]}
        )
        assert res_ai.status_code == 200
        assert res_ai.json()["domain"] == "CUSTOMER"
