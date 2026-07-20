"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.43.0
Created      : 2026-07-20
Modified     : 2026-07-20
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.api.deps import get_db
from app.models.product_identity import ProductIdentity
from app.services.identity_service import ProductIdentityService
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
async def test_ean13_mod10_check_digit_calculation():
    """Verifies GS1 official EAN-13 Mod-10 check digit math against test vectors."""
    # Test Vector 1: GS1 India sample payload '890100000001' -> Check digit 5
    cd1 = ProductIdentityService.calculate_ean13_check_digit("890100000001")
    assert cd1 == "5"

    # Test Vector 2: '629104150021' -> Check digit 3
    cd2 = ProductIdentityService.calculate_ean13_check_digit("629104150021")
    assert cd2 == "3"


@pytest.mark.asyncio
async def test_generate_fingerprint_and_sku_key():
    """Verifies SHA-256 fingerprint hash and SKU business key pattern generation."""
    svc = ProductIdentityService()
    fp = svc.generate_fingerprint_hash("Basmati Rice 5kg", "Grains", "India Gate")
    assert len(fp) == 64

    sku_key = await svc.generate_sku_business_key("Electronics", "Samsung", 42)
    assert sku_key == "SKU-ELE-SAM-00042"


@pytest.mark.asyncio
async def test_assign_gs1_barcode_service(db_session):
    """Verifies ProductIdentity record creation and GS1 barcode assignment."""
    svc = ProductIdentityService()
    identity = await svc.assign_gs1_barcode(
        db=db_session,
        product_id="prod-test-001",
        sku_business_key="SKU-APP-AMZ-00001",
        name="Wireless Earbuds",
        category="Audio",
        brand="Amzotech",
    )

    assert identity.id is not None
    assert identity.product_id == "prod-test-001"
    assert identity.business_key == "SKU-APP-AMZ-00001"
    assert len(identity.barcode) == 13
    assert identity.barcode.startswith("8901000")
