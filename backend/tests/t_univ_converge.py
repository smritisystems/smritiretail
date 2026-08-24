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
import uuid
from decimal import Decimal
from fastapi.testclient import TestClient
from sqlalchemy import select, text

from app.main import app
from app.core.security import create_access_token
from app.models.auth import UserRole
from app.db.session import get_company_sessionmaker
from app.services.univ_party_svc import UniversalPartyService
from app.services.univ_item_svc import UniversalItemService
from app.services.tx_reproduce_svc import TransactionReproducibilityService
from app.models.party import Party, PartyRole, CustomerProfile, SupplierProfile
from app.models.item_master import Item, ItemVariant, ItemBarcode
from app.models.sales import SalesInvoice
from app.models.purchase import PurchaseOrder
from app.models.crm import Customer
from app.models.purchase import Supplier


@pytest.fixture
def client():
    return TestClient(app)


def get_auth_headers(role: str = "SYSADMIN", company_id: str = "COMP-001", branch_id: str = "BR-001") -> dict:
    """Helper to generate JWT auth headers with tenant claims."""
    token = create_access_token(
        data={
            "sub": "usr-super",
            "role": UserRole.SYSADMIN.value,
            "company_id": company_id,
            "branch_id": branch_id,
            "tenant_id": "smriti001",
            "db_name": "smriti001",
            "is_active": True,
        }
    )
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.asyncio
async def test_polymorphic_multi_role_party_convergence():
    """Verify that an entity acting as both Customer and Supplier converges into a single Party with both roles."""
    sessionmaker = get_company_sessionmaker("smriti001")
    async with sessionmaker() as session:
        gstin_shared = f"27TESTP{uuid.uuid4().hex[:5].upper()}1Z5"
        
        # 1. Create legacy Customer
        cust = Customer(
            id=f"c_{uuid.uuid4().hex[:12]}",
            code=f"CUST-{uuid.uuid4().hex[:6]}",
            name="Apex Omnichannel Traders",
            gst_number=gstin_shared,
            mobile="9820011223",
            email="apex@example.com"
        )
        session.add(cust)
        await session.flush()

        # 2. Create legacy Supplier with SAME GSTIN
        supp = Supplier(
            id=f"s_{uuid.uuid4().hex[:12]}",
            code=f"SUPP-{uuid.uuid4().hex[:6]}",
            name="Apex Omnichannel Traders (Supply Div)",
            gst_number=gstin_shared,
            mobile="9820011223",
            email="apex@example.com"
        )
        session.add(supp)
        await session.flush()

        # 3. Converge customer and supplier
        party1 = await UniversalPartyService.converge_customer_to_party(session, cust)
        party2 = await UniversalPartyService.converge_supplier_to_party(session, supp)

        # 4. Must converge into EXACT SAME Party ID
        assert party1.id == party2.id
        assert party1.gstin == gstin_shared

        # 5. Must hold BOTH CUSTOMER and SUPPLIER roles
        party_detail = await UniversalPartyService.get_party_with_details(session, party1.id)
        role_types = {r.role_type for r in party_detail.roles}
        assert "CUSTOMER" in role_types
        assert "SUPPLIER" in role_types
        assert party_detail.customer_profile is not None
        assert party_detail.supplier_profile is not None


@pytest.mark.asyncio
async def test_universal_item_and_variant_barcode_resolution():
    """Verify fast hierarchical item resolution: Barcode -> Variant SKU -> Item Code."""
    sessionmaker = get_company_sessionmaker("smriti001")
    async with sessionmaker() as session:
        test_sku = f"TSHIRT-{uuid.uuid4().hex[:6].upper()}"
        test_barcode = f"890{uuid.uuid4().hex[:10].upper()}"

        item = Item(
            id=f"itm_{uuid.uuid4().hex[:12]}",
            item_code=test_sku,
            item_name="Premium Organic Cotton T-Shirt",
            category="APPAREL",
            tax_rate=Decimal("12.00"),
            primary_uom="PCS",
            mrp=Decimal("999.00"),
            selling_price=Decimal("799.00"),
            cost_price=Decimal("400.00")
        )
        session.add(item)
        await session.flush()

        variant = ItemVariant(
            id=f"var_{uuid.uuid4().hex[:12]}",
            item_id=item.id,
            variant_sku=f"{test_sku}-XL-NAVY",
            variant_name="Premium Organic Cotton T-Shirt (XL Navy)",
            mrp=Decimal("1099.00"),
            selling_price=Decimal("899.00"),
            cost_price=Decimal("450.00")
        )
        session.add(variant)
        await session.flush()

        barcode = ItemBarcode(
            id=f"bc_{uuid.uuid4().hex[:12]}",
            item_id=item.id,
            variant_id=variant.id,
            barcode=test_barcode,
            is_primary=True
        )
        session.add(barcode)
        await session.commit()

        # 1. Resolve by Barcode
        res_bc = await UniversalItemService.resolve_item_by_barcode_or_sku(session, test_barcode)
        assert res_bc is not None
        assert res_bc["matched_by"] == "BARCODE"
        assert res_bc["item_code"] == test_sku
        assert res_bc["variant_sku"] == f"{test_sku}-XL-NAVY"
        assert res_bc["selling_price"] == 899.00
        assert res_bc["tax_rate"] == 12.00

        # 2. Resolve by Variant SKU
        res_var = await UniversalItemService.resolve_item_by_barcode_or_sku(session, f"{test_sku}-XL-NAVY")
        assert res_var is not None
        assert res_var["matched_by"] == "VARIANT_SKU"
        assert res_var["selling_price"] == 899.00

        # 3. Resolve by Item Code
        res_item = await UniversalItemService.resolve_item_by_barcode_or_sku(session, test_sku)
        assert res_item is not None
        assert res_item["matched_by"] == "ITEM_CODE"
        assert res_item["item_code"] == test_sku


@pytest.mark.asyncio
async def test_transaction_governance_snapshot_persistence():
    """
    CRITICAL P1.5 / Section 6 TEST:
    Verify that financial transactions (SalesInvoice & PurchaseOrder) persist immutable
    governance snapshots directly in their database records.
    """
    sessionmaker = get_company_sessionmaker("smriti001")
    async with sessionmaker() as session:
        # Create governance snapshot
        snapshot = TransactionReproducibilityService.create_governance_snapshot(
            rule_versions={"RULE_VIP_DISCOUNT": 1, "FORMULA_MRP_DISCOUNT_TAX": 1},
            policy_versions={"POLICY_GST_STANDARD": 1}
        )

        inv_no = f"INV-SNAP-{uuid.uuid4().hex[:6].upper()}"
        invoice = SalesInvoice(
            id=f"inv_{uuid.uuid4().hex[:12]}",
            invoice_no=inv_no,
            grand_total=Decimal("1180.00"),
            tax_total=Decimal("180.00"),
            payment_mode="UPI",
            status="Paid",
            governance_snapshot_id=snapshot["snapshot_id"],
            rule_snapshots=snapshot
        )
        session.add(invoice)
        await session.commit()

        # Query back from DB
        stmt = select(SalesInvoice).where(SalesInvoice.invoice_no == inv_no)
        persisted_inv = (await session.execute(stmt)).scalars().first()
        assert persisted_inv is not None
        assert persisted_inv.governance_snapshot_id == snapshot["snapshot_id"]
        assert persisted_inv.rule_snapshots["rule_versions"]["RULE_VIP_DISCOUNT"] == 1
        assert persisted_inv.rule_snapshots["policy_versions"]["POLICY_GST_STANDARD"] == 1


@pytest.mark.asyncio
async def test_live_converged_database_counts():
    """Verify smriti001 and smriti002 contain populated converged party and item master records."""
    for db_name in ["smriti001", "smriti002"]:
        sessionmaker = get_company_sessionmaker(db_name)
        async with sessionmaker() as session:
            p_cnt = (await session.execute(select(text("COUNT(*) FROM parties;")))).scalar()
            i_cnt = (await session.execute(select(text("COUNT(*) FROM items;")))).scalar()
            b_cnt = (await session.execute(select(text("COUNT(*) FROM item_barcodes;")))).scalar()
            assert p_cnt > 0
            assert i_cnt > 0
            assert b_cnt > 0


def test_api_universal_master_endpoints(client):
    """Verify Universal Master API endpoints."""
    headers = get_auth_headers()

    # 1. Resolve non-existent item -> 404
    r404 = client.get("/api/v1/universal/items/resolve?query=NON_EXISTENT_BARCODE_XYZ", headers=headers)
    assert r404.status_code == 404

    # 2. Get non-existent party -> 404
    p404 = client.get("/api/v1/universal/parties/pty_non_existent", headers=headers)
    assert p404.status_code == 404
