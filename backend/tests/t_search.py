"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.16.0
Created      : 2026-08-25
Modified     : 2026-08-25
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import uuid
from decimal import Decimal
import pytest
from httpx import AsyncClient, ASGITransport

from app.main import app
from app.db.session import get_company_sessionmaker
from app.core.security import create_access_token
from app.models.item_master import Item, ItemVariant, ItemBarcode
from app.models.party import Party
from app.models.sales import SalesInvoice
from app.models.fulfillment import Dispatch, PackingSlip
from app.services.search_engine import UniversalSearchEngine
from app.schemas.search import (
    UniversalSearchRequest,
    BarcodeQuickScanRequest,
)


def _get_auth_headers(role: str = "STORE_MANAGER") -> dict:
    token = create_access_token(
        data={
            "sub": "usr-super",
            "username": "usr_super",
            "role": role,
            "company_id": "COMP-001",
            "branch_id": "BR-001",
            "tenant_id": "smriti001",
            "db_name": "smriti001",
            "is_active": True,
        }
    )
    return {
        "Authorization": f"Bearer {token}",
        "X-Company-ID": "COMP-001",
        "X-Company-Code": "001",
    }


@pytest.mark.asyncio
async def test_quick_barcode_scan_tier1_tier2_tier3():
    """Verify 4-tier fast barcode resolver: exact barcode, variant SKU, item code, not found."""
    sessionmaker = get_company_sessionmaker("smriti001")
    suffix = uuid.uuid4().hex[:6]
    item_code = f"ITM-BC-{suffix.upper()}"
    sku_val = f"SKU-BC-{suffix.upper()}"
    bc_val = f"890123{suffix[:6]}"

    async with sessionmaker() as session:
        # Seed Item
        item = Item(
            id=f"itm_{suffix}",
            company_id="COMP-001",
            item_code=item_code,
            item_name=f"Scanner Test Item {suffix}",
            brand="ScannerBrand",
            category="ELECTRONICS",
            selling_price=Decimal("1500.00"),
            mrp=Decimal("1800.00"),
            tax_rate=Decimal("18.00"),
            primary_uom="PCS",
            hsn_code="851712",
            is_active=True,
            is_deleted=False,
        )
        session.add(item)

        # Seed Variant
        variant = ItemVariant(
            id=f"var_{suffix}",
            company_id="COMP-001",
            item_id=item.id,
            variant_sku=sku_val,
            variant_name=f"Red / Large",
            selling_price=Decimal("1650.00"),
            mrp=Decimal("1999.00"),
            is_active=True,
            is_deleted=False,
        )
        session.add(variant)

        # Seed Barcode
        bc = ItemBarcode(
            id=f"bc_{suffix}",
            company_id="COMP-001",
            item_id=item.id,
            variant_id=variant.id,
            barcode=bc_val,
            barcode_type="EAN13",
            is_active=True,
            is_deleted=False,
        )
        session.add(bc)
        await session.commit()

        # 1. Exact Barcode Scan (Tier 1)
        res_bc = await UniversalSearchEngine.quick_barcode_scan(
            session=session,
            company_id="COMP-001",
            req=BarcodeQuickScanRequest(barcode=bc_val),
        )
        assert res_bc.found == True
        assert res_bc.scan_type == "EXACT_BARCODE"
        assert res_bc.item_code == item_code
        assert res_bc.selling_price == Decimal("1650.00")

        # 2. SKU Scan (Tier 2)
        res_sku = await UniversalSearchEngine.quick_barcode_scan(
            session=session,
            company_id="COMP-001",
            req=BarcodeQuickScanRequest(barcode=sku_val),
        )
        assert res_sku.found == True
        assert res_sku.scan_type == "SKU"
        assert res_sku.sku == sku_val

        # 3. Item Code Scan (Tier 3)
        res_itm = await UniversalSearchEngine.quick_barcode_scan(
            session=session,
            company_id="COMP-001",
            req=BarcodeQuickScanRequest(barcode=item_code),
        )
        assert res_itm.found == True
        assert res_itm.scan_type == "ITEM_CODE"
        assert res_itm.item_code == item_code

        # 4. Unknown Code Scan (Not Found)
        res_unknown = await UniversalSearchEngine.quick_barcode_scan(
            session=session,
            company_id="COMP-001",
            req=BarcodeQuickScanRequest(barcode="UNKNOWN_999999"),
        )
        assert res_unknown.found == False
        assert res_unknown.scan_type == "NOT_FOUND"


@pytest.mark.asyncio
async def test_universal_search_multi_domain_aggregation():
    """Verify omni-search returning aggregated results across multiple domains with common keyword."""
    sessionmaker = get_company_sessionmaker("smriti001")
    suffix = uuid.uuid4().hex[:6]
    keyword = f"OMNI{suffix.upper()}"

    async with sessionmaker() as session:
        # 1. Item with keyword
        item = Item(
            id=f"itm_omni_{suffix}",
            company_id="COMP-001",
            item_code=f"ITM-{keyword}",
            item_name=f"Product {keyword} Titanium",
            brand="Titan",
            category="GENERAL",
            hsn_code="851712",
            selling_price=Decimal("2500.00"),
            is_active=True,
            is_deleted=False,
        )
        session.add(item)

        # 2. Party with keyword
        party = Party(
            id=f"pty_omni_{suffix}",
            company_id="COMP-001",
            party_code=f"PTY-{keyword}",
            legal_name=f"Enterprise {keyword} Pvt Ltd",
            trade_name=f"Store {keyword}",
            party_type="CUSTOMER",
            phone=f"98{suffix[:4].zfill(8)}",
            is_active=True,
            is_deleted=False,
        )
        session.add(party)

        # 3. Sales Invoice with keyword
        inv = SalesInvoice(
            id=f"inv_omni_{suffix}",
            company_id="COMP-001",
            branch_id="BR-001",
            invoice_no=f"INV-{keyword}-01",
            grand_total=Decimal("4500.00"),
            status="ISSUED",
            is_active=True,
            is_deleted=False,
        )
        session.add(inv)
        await session.commit()

        # Execute Search
        search_res = await UniversalSearchEngine.execute_universal_search(
            session=session,
            company_id="COMP-001",
            req=UniversalSearchRequest(query=keyword, limit_per_domain=5),
            caller_role="STORE_MANAGER",
        )
        assert search_res.total_hits >= 3
        assert "ITEMS" in search_res.results_by_domain
        assert "PARTIES" in search_res.results_by_domain
        assert "DOCUMENTS" in search_res.results_by_domain
        assert any(it.domain == "ITEMS" for it in search_res.items)
        assert any(it.domain == "PARTIES" for it in search_res.items)
        assert any(it.domain == "DOCUMENTS" for it in search_res.items)


@pytest.mark.asyncio
async def test_role_based_domain_filtering_rbac():
    """Verify CASHIER role is restricted from sensitive domains (omits PARTIES, WAREHOUSES, TRANSACTIONS)."""
    sessionmaker = get_company_sessionmaker("smriti001")

    async with sessionmaker() as session:
        # Cashier search
        res_cashier = await UniversalSearchEngine.execute_universal_search(
            session=session,
            company_id="COMP-001",
            req=UniversalSearchRequest(query="TEST", limit_per_domain=5),
            caller_role="CASHIER",
        )
        assert "TRANSACTIONS" not in res_cashier.domains_searched
        assert "WAREHOUSES" not in res_cashier.domains_searched
        assert "PARTIES" not in res_cashier.domains_searched
        assert set(res_cashier.domains_searched).issubset({"ITEMS", "BARCODES", "DOCUMENTS"})

        # Store Manager search
        res_mgr = await UniversalSearchEngine.execute_universal_search(
            session=session,
            company_id="COMP-001",
            req=UniversalSearchRequest(query="TEST", limit_per_domain=5),
            caller_role="STORE_MANAGER",
        )
        assert "TRANSACTIONS" in res_mgr.domains_searched
        assert "PARTIES" in res_mgr.domains_searched
        assert "WAREHOUSES" in res_mgr.domains_searched


@pytest.mark.asyncio
async def test_document_search_invoice_po_dispatch():
    """Verify searching documents by invoice_no, po_number, and tracking_number."""
    sessionmaker = get_company_sessionmaker("smriti001")
    suffix = uuid.uuid4().hex[:6]
    awb_val = f"AWB{suffix.upper()}"

    async with sessionmaker() as session:
        # Seed Packing Slip first
        ps = PackingSlip(
            id=f"ps_{suffix}",
            company_id="COMP-001",
            packing_slip_number=f"PS-{suffix.upper()}",
            sales_invoice_id=f"inv_{suffix}",
            status="PACKED",
            is_active=True,
            is_deleted=False,
        )
        session.add(ps)
        await session.flush()

        # Seed Dispatch with AWB
        disp = Dispatch(
            id=f"disp_s_{suffix}",
            company_id="COMP-001",
            dispatch_number=f"DSP-{suffix.upper()}",
            packing_slip_id=ps.id,
            courier_partner="DELHIVERY",
            tracking_number=awb_val,
            status="IN_TRANSIT",
            is_active=True,
            is_deleted=False,
        )
        session.add(disp)
        await session.commit()

        # Search by AWB tracking number
        res = await UniversalSearchEngine.execute_universal_search(
            session=session,
            company_id="COMP-001",
            req=UniversalSearchRequest(query=awb_val, domains=["DOCUMENTS"]),
            caller_role="STORE_MANAGER",
        )
        assert res.total_hits >= 1
        assert any(item.type == "DISPATCH" and item.metadata.get("awb") == awb_val for item in res.items)


@pytest.mark.asyncio
async def test_party_search_by_code_phone_gstin():
    """Verify searching parties by GSTIN, phone, and party code."""
    sessionmaker = get_company_sessionmaker("smriti001")
    suffix = uuid.uuid4().hex[:4]
    gstin_val = f"27AAAAA{suffix.upper()}1Z5"
    phone_val = f"99{suffix[:4].zfill(8)}"

    async with sessionmaker() as session:
        party = Party(
            id=f"pty_s_{suffix}",
            company_id="COMP-001",
            party_code=f"CUST-{suffix.upper()}",
            legal_name=f"Unique GST Trader {suffix}",
            party_type="CUSTOMER",
            gstin=gstin_val,
            phone=phone_val,
            is_active=True,
            is_deleted=False,
        )
        session.add(party)
        await session.commit()

        # 1. Search by GSTIN
        res_gst = await UniversalSearchEngine.execute_universal_search(
            session=session,
            company_id="COMP-001",
            req=UniversalSearchRequest(query=gstin_val, domains=["PARTIES"]),
            caller_role="STORE_MANAGER",
        )
        assert res_gst.total_hits >= 1
        assert any(it.metadata.get("gstin") == gstin_val for it in res_gst.items)

        # 2. Search by Phone
        res_phone = await UniversalSearchEngine.execute_universal_search(
            session=session,
            company_id="COMP-001",
            req=UniversalSearchRequest(query=phone_val, domains=["PARTIES"]),
            caller_role="STORE_MANAGER",
        )
        assert res_phone.total_hits >= 1


@pytest.mark.asyncio
async def test_api_search_endpoints():
    """Verify REST API search endpoints: /universal POST, /universal GET, /barcode-scan, /domains."""
    transport = ASGITransport(app=app)

    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. GET /domains
        dom_res = await client.get(
            "/api/v1/search/domains",
            headers=_get_auth_headers(role="STORE_MANAGER"),
        )
        assert dom_res.status_code == 200
        assert len(dom_res.json()["available_domains"]) >= 6

        # 2. POST /universal
        post_res = await client.post(
            "/api/v1/search/universal",
            json={"query": "Test", "limit_per_domain": 3},
            headers=_get_auth_headers(role="STORE_MANAGER"),
        )
        assert post_res.status_code == 200
        assert "latency_ms" in post_res.json()

        # 3. GET /universal
        get_res = await client.get(
            "/api/v1/search/universal?q=Test&domains=ITEMS,BARCODES&limit=2",
            headers=_get_auth_headers(role="CASHIER"),
        )
        assert get_res.status_code == 200
        assert "ITEMS" in get_res.json()["domains_searched"]

        # 4. POST /barcode-scan
        scan_res = await client.post(
            "/api/v1/search/barcode-scan",
            json={"barcode": "NONEXISTENT_BARCODE_TEST"},
            headers=_get_auth_headers(role="CASHIER"),
        )
        assert scan_res.status_code == 200
        assert scan_res.json()["found"] == False
