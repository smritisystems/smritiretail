"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.22.0
Created      : 2026-08-23
Modified     : 2026-08-23
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.services.capability_service import CapabilityService


@pytest.fixture
def client():
    return TestClient(app)


def test_frozen_capability_map_completeness():
    """Verify all 26 frozen canonical SMRITI capabilities are registered."""
    catalog = CapabilityService.get_all_capabilities()
    assert len(catalog) == 26

    expected_codes = {
        "POS", "SALES", "PURCHASE", "INVENTORY", "WMS", "DISTRIBUTION", "ECOM",
        "PSV", "PDT", "CGE", "CRM", "ACCOUNTING", "GST", "PAYMENTS", "PRICING",
        "PROMOTIONS", "FULFILLMENT", "BARCODE", "LABEL_PRINTING", "REPORTING",
        "COMMUNICATOR", "DOCUMENT", "APPROVAL", "SEARCH", "INTEGRATION", "AUDIT"
    }
    actual_codes = {c["code"] for c in catalog}
    assert actual_codes == expected_codes


def test_strict_dependency_validation_success():
    """Verify successful validation when all capability prerequisites are satisfied."""
    valid_pos_stack = ["INVENTORY", "SALES", "ACCOUNTING", "POS"]
    is_valid, errors = CapabilityService.validate_capability_dependencies(valid_pos_stack)
    assert is_valid is True
    assert len(errors) == 0

    valid_wms_stack = ["INVENTORY", "WMS"]
    is_valid, errors = CapabilityService.validate_capability_dependencies(valid_wms_stack)
    assert is_valid is True
    assert len(errors) == 0


def test_strict_dependency_validation_fails_closed():
    """Verify that missing dependencies fail closed and identify exact missing prerequisites."""
    # POS without prerequisites
    is_valid, errors = CapabilityService.validate_capability_dependencies(["POS"])
    assert is_valid is False
    assert any("INVENTORY" in err for err in errors)
    assert any("SALES" in err for err in errors)
    assert any("ACCOUNTING" in err for err in errors)

    # WMS without INVENTORY
    is_valid, errors = CapabilityService.validate_capability_dependencies(["WMS"])
    assert is_valid is False
    assert any("INVENTORY" in err for err in errors)

    # DISTRIBUTION without WMS / INVENTORY
    is_valid, errors = CapabilityService.validate_capability_dependencies(["DISTRIBUTION"])
    assert is_valid is False
    assert any("INVENTORY" in err for err in errors)
    assert any("WMS" in err for err in errors)

    # PROMOTIONS without PRICING / SALES
    is_valid, errors = CapabilityService.validate_capability_dependencies(["PROMOTIONS"])
    assert is_valid is False
    assert any("PRICING" in err for err in errors)
    assert any("SALES" in err for err in errors)


def test_plan_tier_resolution():
    """Verify capability bundle resolution by subscription tier."""
    basic = CapabilityService.resolve_effective_capabilities(plan_tier="BASIC")
    assert basic["is_valid"] is True
    assert "SALES" in basic["active_capabilities"]
    assert "INVENTORY" in basic["active_capabilities"]
    assert "POS" not in basic["active_capabilities"]

    pro = CapabilityService.resolve_effective_capabilities(plan_tier="PROFESSIONAL")
    assert pro["is_valid"] is True
    assert "POS" in pro["active_capabilities"]
    assert "GST" in pro["active_capabilities"]
    assert "PSV" not in pro["active_capabilities"]

    ent = CapabilityService.resolve_effective_capabilities(plan_tier="ENTERPRISE")
    assert ent["is_valid"] is True
    assert ent["active_count"] == 26


def test_api_capability_endpoints(client):
    """Verify public capability registry API endpoints."""
    # Catalog
    cat_res = client.get("/api/v1/capabilities/catalog")
    assert cat_res.status_code == 200
    cat_data = cat_res.json()
    assert cat_data["count"] == 26

    # Plans
    plan_res = client.get("/api/v1/capabilities/plans")
    assert plan_res.status_code == 200
    plans = plan_res.json()["plans"]
    assert "BASIC" in plans
    assert "PROFESSIONAL" in plans
    assert "ENTERPRISE" in plans

    # Validate valid stack
    val_res = client.post("/api/v1/capabilities/validate", json={"capabilities": ["INVENTORY", "SALES", "ACCOUNTING", "POS"]})
    assert val_res.status_code == 200
    assert val_res.json()["is_valid"] is True

    # Validate invalid stack (missing dependencies)
    inval_res = client.post("/api/v1/capabilities/validate", json={"capabilities": ["POS"]})
    assert inval_res.status_code == 200
    assert inval_res.json()["is_valid"] is False
    assert len(inval_res.json()["dependency_errors"]) > 0

    # Resolve plan
    res_res = client.post("/api/v1/capabilities/resolve", json={"plan_tier": "BASIC", "tenant_overrides": {"POS": True, "ACCOUNTING": True}})
    assert res_res.status_code == 200
    rdata = res_res.json()
    assert "POS" in rdata["active_capabilities"]
    assert rdata["is_valid"] is True


@pytest.mark.asyncio
async def test_database_backed_capability_and_reference_seeding():
    """Verify that SmritiSys database contains all 26 seeded capabilities with dependency metadata."""
    from sqlalchemy import select
    from app.db.session import get_company_sessionmaker
    from app.models.capability_template import PlatformCapability
    from app.models.localization import CountryRef, StateRef, CurrencyRef, UnitOfMeasurementRef

    sessionmaker = get_company_sessionmaker("smritisys")
    async with sessionmaker() as session:
        # Verify 26 capabilities present in DB
        res = await session.execute(select(PlatformCapability))
        caps = res.scalars().all()
        assert len(caps) >= 26

        pos_cap = next((c for c in caps if c.code == "POS"), None)
        assert pos_cap is not None
        assert "INVENTORY" in pos_cap.dependencies
        assert "SALES" in pos_cap.dependencies
        assert "ACCOUNTING" in pos_cap.dependencies

        # Verify countries, states, currencies, UOMs present in DB
        countries = (await session.execute(select(CountryRef))).scalars().all()
        assert len(countries) >= 8

        states = (await session.execute(select(StateRef))).scalars().all()
        assert len(states) >= 10

        currencies = (await session.execute(select(CurrencyRef))).scalars().all()
        assert len(currencies) >= 6

        uoms = (await session.execute(select(UnitOfMeasurementRef))).scalars().all()
        assert len(uoms) >= 10
