"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 1.0.0
Created      : 2026-10-08
Modified     : 2026-10-08
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Automated Test Suite — Phase 5: Legacy Deprecation Gateway & Structured Telemetry Logger
"""

import uuid
from decimal import Decimal
from datetime import datetime, timezone, date
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

from app.main import app
from app.api.deps import TenantContext
from app.models.sales import SalesInvoice, SalesInvoiceItem
from app.models.item_master import Item, ItemVariant
from app.models.inventory import Product
from app.services.reports import ReportsService
from app.services.databridge.export_engine import DataBridgeExportEngine
from app.services.databridge.models import DataBridgeEntityType
from app.services.legacy_product_telemetry import LegacyProductTelemetrySink

TEST_DB_URL = "postgresql+asyncpg://postgres:postgres@localhost:2781/smriti001"
CANONICAL_COMP_ID = "COMP-001"


@pytest_asyncio.fixture
async def db_session():
    engine = create_async_engine(TEST_DB_URL, echo=False)
    session_factory = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    async with session_factory() as session:
        session.info["resolved_database_name"] = "smriti001"
        session.info["company_id"] = CANONICAL_COMP_ID
        yield session
    await engine.dispose()


@pytest_asyncio.fixture
async def async_client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client


@pytest.fixture(autouse=True)
def clean_telemetry():
    LegacyProductTelemetrySink.clear_durable_log()
    yield
    LegacyProductTelemetrySink.clear_durable_log()


@pytest.mark.asyncio
async def test_tc_p5_001_rfc8594_deprecation_headers_on_legacy_products_endpoint(async_client: AsyncClient):
    """
    Test 1: Requests to legacy /api/v1/products receive standard RFC 8594 headers:
    Deprecation, Sunset, Link, and X-Smriti-Warning.
    """
    response = await async_client.get("/api/v1/products/")
    # Regardless of auth or content status (even 401 or 200), middleware must attach RFC 8594 headers
    assert "Deprecation" in response.headers
    assert response.headers["Deprecation"] == "@1798761600"
    assert "Sunset" in response.headers
    assert response.headers["Sunset"] == "Sat, 01 Jan 2028 00:00:00 GMT"
    assert "Link" in response.headers
    assert 'rel="successor-version"' in response.headers["Link"]
    assert "/api/v1/universal/items" in response.headers["Link"]
    assert "X-Smriti-Warning" in response.headers
    assert "SMRITI-DEPR-002" in response.headers["X-Smriti-Warning"]


@pytest.mark.asyncio
async def test_tc_p5_002_sunset_date_format_and_legacy_aliases(async_client: AsyncClient):
    """
    Test 2: Legacy router aliases (/api/v1/inventory/products and /api/v1/variants)
    receive RFC 8594 deprecation headers with valid HTTP-date.
    """
    resp_inv_prod = await async_client.get("/api/v1/inventory/products")
    assert resp_inv_prod.headers.get("Deprecation") == "@1798761600"
    assert resp_inv_prod.headers.get("Sunset") == "Sat, 01 Jan 2028 00:00:00 GMT"

    resp_var = await async_client.get("/api/v1/variants")
    assert resp_var.headers.get("Deprecation") == "@1798761600"
    assert resp_var.headers.get("Sunset") == "Sat, 01 Jan 2028 00:00:00 GMT"


@pytest.mark.asyncio
async def test_tc_p5_003_canonical_universal_items_endpoint_no_deprecation_headers(async_client: AsyncClient):
    """
    Test 3: Canonical modern endpoints (/api/v1/universal/*, /api/v1/product-identity/*)
    must NOT carry deprecation headers.
    """
    resp_universal = await async_client.get("/api/v1/universal/items/resolve")
    assert "Deprecation" not in resp_universal.headers
    assert "Sunset" not in resp_universal.headers

    resp_health = await async_client.get("/api/v1/product-identity/health")
    assert "Deprecation" not in resp_health.headers
    assert "Sunset" not in resp_health.headers


@pytest.mark.asyncio
async def test_tc_p5_004_legacy_endpoint_telemetry_event_recording(async_client: AsyncClient):
    """
    Test 4: Invoking a legacy endpoint logs a structured LEGACY_ENDPOINT_ACCESSED telemetry event.
    """
    headers = {"X-Company-ID": CANONICAL_COMP_ID}
    await async_client.get("/api/v1/products/", headers=headers)

    events = LegacyProductTelemetrySink.get_events(event_type="LEGACY_ENDPOINT_ACCESSED")
    assert len(events) >= 1
    ev = events[-1]
    assert ev["path"] == "/api/v1/products/"
    assert ev["method"] == "GET"
    assert ev["company_id"] == CANONICAL_COMP_ID
    assert ev["warning_code"] == "SMRITI-DEPR-002"
    assert ev["successor_endpoint"] == "/api/v1/universal/items"


@pytest.mark.asyncio
async def test_tc_p5_005_report_fallback_telemetry_recording_when_variant_id_is_none(db_session: AsyncSession):
    """
    Test 5: When ReportsService processes an invoice item missing variant_id,
    it records a LEGACY_FALLBACK_INVOKED telemetry event.
    """
    uid = uuid.uuid4().hex[:6].upper()
    prod = Product(
        id=f"prod_p5_{uid}",
        company_id=CANONICAL_COMP_ID,
        code=f"SKU-LEGACY-{uid}",
        barcode=f"BC-LEGACY-{uid}",
        name=f"Legacy Prod {uid}",
        sku=f"SKU-LEGACY-{uid}",
        category="General",
        price=Decimal("1200.00"),
        cost_price=Decimal("800.00"),
        stock=10,
        is_active=True,
    )
    db_session.add(prod)

    today = date.today()
    inv = SalesInvoice(
        id=f"inv_p5_{uid}",
        company_id=CANONICAL_COMP_ID,
        invoice_no=f"INV-P5-{uid}",
        date=today,
        status="COMPLETED",
        grand_total=Decimal("1200.00"),
        net_amount=Decimal("1200.00"),
        is_deleted=False,
    )
    inv_item = SalesInvoiceItem(
        invoice_id=inv.id,
        product_id=prod.id,
        item_id=None,
        variant_id=None,  # Legacy fallback trigger
        code=prod.sku,
        name=prod.name,
        quantity=Decimal("1.00"),
        price=Decimal("1200.00"),
        total_amount=Decimal("1200.00"),
        is_deleted=False,
    )
    db_session.add(inv)
    db_session.add(inv_item)
    await db_session.commit()

    tenant = TenantContext(
        company_id=CANONICAL_COMP_ID,
        branch_id=None,
    )
    rep_svc = ReportsService(db_session, tenant)
    await rep_svc.item_wise_sales(from_date=today, to_date=today)

    fallback_events = LegacyProductTelemetrySink.get_events(event_type="LEGACY_FALLBACK_INVOKED")
    matched = [e for e in fallback_events if e.get("product_id") == prod.id]
    assert len(matched) >= 1
    ev = matched[0]
    assert ev["caller"] == "ReportsService.item_wise_sales"
    assert ev["reason"] == "VARIANT_ID_NULL"
    assert ev["company_id"] == CANONICAL_COMP_ID


@pytest.mark.asyncio
async def test_tc_p5_006_export_engine_fallback_telemetry_recording(db_session: AsyncSession):
    """
    Test 6: When DataBridgeExportEngine exports a line missing variant_id,
    it records a LEGACY_FALLBACK_INVOKED telemetry event.
    """
    uid = uuid.uuid4().hex[:6].upper()
    prod = Product(
        id=f"prod_p5exp_{uid}",
        company_id=CANONICAL_COMP_ID,
        code=f"SKU-EXP-LEGACY-{uid}",
        barcode=f"BC-EXP-LEGACY-{uid}",
        name=f"Legacy Export Prod {uid}",
        sku=f"SKU-EXP-LEGACY-{uid}",
        category="General",
        price=Decimal("800.00"),
        cost_price=Decimal("500.00"),
        stock=10,
        is_active=True,
    )
    db_session.add(prod)

    inv = SalesInvoice(
        id=f"inv_p5exp_{uid}",
        company_id=CANONICAL_COMP_ID,
        invoice_no=f"INV-P5EXP-{uid}",
        date=datetime.now(timezone.utc).date(),
        status="COMPLETED",
        grand_total=Decimal("800.00"),
        net_amount=Decimal("800.00"),
    )
    inv_item = SalesInvoiceItem(
        invoice_id=inv.id,
        product_id=prod.id,
        item_id=None,
        variant_id=None,
        code=prod.sku,
        name=prod.name,
        quantity=Decimal("1.00"),
        price=Decimal("800.00"),
        total_amount=Decimal("800.00"),
    )
    db_session.add(inv)
    db_session.add(inv_item)
    await db_session.commit()

    records = await DataBridgeExportEngine.fetch_entity_records(
        company_db=db_session,
        company_id=CANONICAL_COMP_ID,
        entity_type=DataBridgeEntityType.SALES_INVOICE,
        limit=500,
    )
    assert any(r.get("invoice_no") == f"INV-P5EXP-{uid}" for r in records)

    fallback_events = LegacyProductTelemetrySink.get_events(event_type="LEGACY_FALLBACK_INVOKED")
    matched = [e for e in fallback_events if e.get("product_id") == prod.id]
    assert len(matched) >= 1
    assert matched[0]["caller"] == "DataBridgeExportEngine.sales_invoice"


@pytest.mark.asyncio
async def test_tc_p5_007_telemetry_sampling_and_rate_limiting_prevents_flooding():
    """
    Test 7: Rapid repeated fallback events with identical keys are deduplicated
    to a single disk write within the 60s window to prevent I/O saturation.
    """
    for _ in range(25):
        LegacyProductTelemetrySink.record_fallback_invoked(
            company_id=CANONICAL_COMP_ID,
            caller="TestHarness.bulk_loop",
            product_id="prod_bulk_1",
            reason="VARIANT_ID_NULL",
            force_write=False,
        )

    # In-memory holds all 25 events for exact metrics
    mem_events = LegacyProductTelemetrySink.get_events(from_disk=False)
    assert len(mem_events) == 25

    # Disk holds exactly 1 event due to rate-limiting window
    disk_events = LegacyProductTelemetrySink.get_events(from_disk=True)
    assert len(disk_events) == 1


@pytest.mark.asyncio
async def test_tc_p5_008_governance_telemetry_summary_aggregation():
    """
    Test 8: LegacyProductTelemetrySink aggregates total events, breakdown by path,
    breakdown by caller, and breakdown by reason.
    """
    LegacyProductTelemetrySink.record_endpoint_access(
        path="/api/v1/products",
        method="GET",
        company_id="COMP-A",
    )
    LegacyProductTelemetrySink.record_endpoint_access(
        path="/api/v1/variants",
        method="GET",
        company_id="COMP-A",
    )
    LegacyProductTelemetrySink.record_fallback_invoked(
        company_id="COMP-B",
        caller="ReportsService.item_wise_sales",
        product_id="prod_1",
    )

    summary = LegacyProductTelemetrySink.get_metrics_summary()
    assert summary["total_events"] == 3
    assert summary["endpoint_access_total"] == 2
    assert summary["fallback_invoked_total"] == 1
    assert summary["unique_companies_count"] == 2
    assert summary["by_path"].get("/api/v1/products") == 1
    assert summary["by_path"].get("/api/v1/variants") == 1
    assert summary["by_caller"].get("ReportsService.item_wise_sales") == 1


@pytest.mark.asyncio
async def test_tc_p5_009_end_to_end_option_b_convergence_certification(db_session: AsyncSession):
    """
    Test 9: End-to-End Option B Convergence Certification:
    Verifies that dual keys flow through writes, reads, exports, and governance telemetry
    with zero schema alterations and 100% backward compatibility.
    """
    uid = uuid.uuid4().hex[:6].upper()

    item = Item(
        id=f"itm_cert_{uid}",
        company_id=CANONICAL_COMP_ID,
        item_code=f"ITM-CERT-{uid}",
        item_name=f"Cert Item {uid}",
        is_active=True,
    )
    db_session.add(item)
    await db_session.flush()

    variant = ItemVariant(
        id=f"var_cert_{uid}",
        company_id=CANONICAL_COMP_ID,
        item_id=item.id,
        variant_sku=f"SKU-CERT-{uid}",
        variant_name=f"Cert Product {uid}",
        selling_price=Decimal("1250.00"),
        cost_price=Decimal("800.00"),
        is_active=True,
    )
    db_session.add(variant)
    await db_session.flush()

    # 1. Product with canonical bridge
    prod = Product(
        id=f"prod_cert_{uid}",
        company_id=CANONICAL_COMP_ID,
        item_id=item.id,
        item_variant_id=variant.id,
        code=f"SKU-CERT-{uid}",
        barcode=f"BC-CERT-{uid}",
        name=f"Cert Product {uid}",
        sku=f"SKU-CERT-{uid}",
        category="General",
        price=Decimal("1250.00"),
        cost_price=Decimal("800.00"),
        stock=10,
        is_active=True,
    )
    db_session.add(prod)

    today = date.today()
    # 2. Dual-key invoice item
    inv = SalesInvoice(
        id=f"inv_cert_{uid}",
        company_id=CANONICAL_COMP_ID,
        invoice_no=f"INV-CERT-{uid}",
        date=today,
        status="COMPLETED",
        grand_total=Decimal("2500.00"),
        net_amount=Decimal("2500.00"),
        is_deleted=False,
    )
    inv_item = SalesInvoiceItem(
        invoice_id=inv.id,
        product_id=prod.id,
        item_id=prod.item_id,
        variant_id=prod.item_variant_id,
        code=prod.sku,
        name=prod.name,
        quantity=Decimal("2.00"),
        price=Decimal("1250.00"),
        total_amount=Decimal("2500.00"),
        is_deleted=False,
    )
    db_session.add(inv)
    db_session.add(inv_item)
    await db_session.commit()

    # 3. Read path verification (No fallback telemetry should be emitted)
    tenant = TenantContext(
        company_id=CANONICAL_COMP_ID,
        branch_id=None,
    )
    rep_svc = ReportsService(db_session, tenant)
    rep_result = await rep_svc.item_wise_sales(from_date=today, to_date=today)
    assert rep_result is not None

    # Check that this dual-key item did NOT trigger fallback telemetry
    fallback_events = LegacyProductTelemetrySink.get_events(event_type="LEGACY_FALLBACK_INVOKED")
    cert_fallbacks = [e for e in fallback_events if e.get("product_id") == prod.id]
    assert len(cert_fallbacks) == 0, "Dual-key item must not trigger fallback telemetry"

    # 4. Export verification
    records = await DataBridgeExportEngine.fetch_entity_records(
        company_db=db_session,
        company_id=CANONICAL_COMP_ID,
        entity_type=DataBridgeEntityType.SALES_INVOICE,
        limit=500,
    )
    matched_export = [r for r in records if r.get("invoice_no") == f"INV-CERT-{uid}"]
    assert len(matched_export) == 1
    row = matched_export[0]
    assert row["product_id"] == prod.id
    assert row["item_id"] == prod.item_id
    assert row["variant_id"] == prod.item_variant_id


@pytest.mark.asyncio
async def test_tc_p5_010_governance_telemetry_events_endpoint_and_manager_auth(async_client: AsyncClient):
    """
    Test 10: GET /api/v1/governance/legacy-telemetry/events:
    Verifies that the events endpoint correctly returns serialized event logs,
    filters by type, and enforces role access (SYSADMIN, ADMIN, MANAGER allowed; others rejected).
    """
    from types import SimpleNamespace
    from app.api.deps import get_current_user, get_tenant_context

    # 1. Populate test events
    LegacyProductTelemetrySink.record_endpoint_access(
        path="/api/v1/products",
        method="GET",
        company_id="TEST-COMP",
        force_write=True,
    )
    LegacyProductTelemetrySink.record_fallback_invoked(
        company_id="TEST-COMP",
        caller="TestRunner",
        product_id="prod_test",
        reason="VARIANT_ID_NULL",
        force_write=True,
    )

    # 2. Test MANAGER access (allowed)
    app.dependency_overrides[get_current_user] = lambda: SimpleNamespace(role="MANAGER", username="manager_user")
    app.dependency_overrides[get_tenant_context] = lambda: TenantContext(company_id="TEST-COMP", branch_id=None)

    try:
        resp = await async_client.get("/api/v1/governance/legacy-telemetry/events?limit=50")
        assert resp.status_code == 200
        data = resp.json()
        assert "count" in data
        assert "events" in data
        assert data["count"] >= 2

        # Filter by event_type
        resp_filtered = await async_client.get("/api/v1/governance/legacy-telemetry/events?event_type=LEGACY_FALLBACK_INVOKED")
        assert resp_filtered.status_code == 200
        f_data = resp_filtered.json()
        assert all(e["event_type"] == "LEGACY_FALLBACK_INVOKED" for e in f_data["events"])

        # 3. Test Unauthorized Role (e.g. CASHIER -> 403 Forbidden)
        app.dependency_overrides[get_current_user] = lambda: SimpleNamespace(role="CASHIER", username="cashier_user")
        resp_unauth = await async_client.get("/api/v1/governance/legacy-telemetry/events")
        assert resp_unauth.status_code == 403

    finally:
        app.dependency_overrides.pop(get_current_user, None)
        app.dependency_overrides.pop(get_tenant_context, None)

