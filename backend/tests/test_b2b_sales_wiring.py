"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.25.0
Created      : 2026-09-04
Modified     : 2026-09-04
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
Source Module: Phase 2C Corporate B2B Billing Workspace & Sales Invoice Verification
"""

import os
import sys
import uuid
import pytest
from decimal import Decimal
from datetime import date, datetime, timezone
from pathlib import Path

# Ensure backend path is on sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

# Ensure required runtime security environment keys
os.environ["JWT_SECRET_KEY"] = "test-jwt-secret-key-smriti"
os.environ["INTERNAL_SERVICE_KEY"] = "test-internal-key-smriti"
os.environ["SGIP_VAULT_MASTER_KEY"] = "test-vault-master-key-smriti-32chars"

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy import select, text

from app.api.deps import TenantContext
from app.models.tenant import Company, Branch
from app.models.auth import User, UserRole
from app.models.crm import Customer, CustomerGroup, CustomerGSTRegistration, CustomerDeliveryLocation
from app.models.inventory import Product, Warehouse
from app.models.sales import SalesInvoice, SalesInvoiceItem
from app.schemas.sales import SalesInvoiceCreate, SalesInvoiceItemCreate
from app.services.sales import SalesService
from app.core.gst_engine import GST_STATE_CODES

from sqlalchemy.pool import NullPool

TEST_DB_URL = "postgresql+asyncpg://postgres:postgres@localhost:5432/smriti_test_phase2c"

test_engine = create_async_engine(TEST_DB_URL, echo=False, poolclass=NullPool)
TestSessionLocal = async_sessionmaker(test_engine, expire_on_commit=False, class_=AsyncSession)


@pytest.fixture
def tenant_ctx() -> TenantContext:
    return TenantContext(
        company_id="COMP-001",
        branch_id="MAIN"
    )


@pytest.fixture
def other_tenant_ctx() -> TenantContext:
    return TenantContext(
        company_id="COMP-OTHER",
        branch_id="OTHER-BR"
    )


@pytest.fixture
async def setup_seed_data(tenant_ctx, other_tenant_ctx):
    """Seed companies, warehouses, products, and customers into PostgreSQL smriti_test_phase2c."""
    suffix = uuid.uuid4().hex[:6]

    async with TestSessionLocal() as session:
        # Pre-cleanup any leftover registrations/customers from prior tests
        for stmt in [
            "DELETE FROM sales_invoice_items WHERE invoice_id IN (SELECT id FROM sales_invoices WHERE customer_id IN (SELECT id FROM customers WHERE code LIKE 'CUST-RIL-%' OR code LIKE 'CUST-TATA-%' OR code LIKE 'CUST-FOREIGN-%'))",
            "DELETE FROM sales_invoices WHERE customer_id IN (SELECT id FROM customers WHERE code LIKE 'CUST-RIL-%' OR code LIKE 'CUST-TATA-%' OR code LIKE 'CUST-FOREIGN-%')",
            "DELETE FROM customer_delivery_locations WHERE customer_id IN (SELECT id FROM customers WHERE code LIKE 'CUST-RIL-%' OR code LIKE 'CUST-TATA-%' OR code LIKE 'CUST-FOREIGN-%')",
            "DELETE FROM customer_billing_locations WHERE customer_id IN (SELECT id FROM customers WHERE code LIKE 'CUST-RIL-%' OR code LIKE 'CUST-TATA-%' OR code LIKE 'CUST-FOREIGN-%')",
            "DELETE FROM customer_gst_registrations WHERE customer_id IN (SELECT id FROM customers WHERE code LIKE 'CUST-RIL-%' OR code LIKE 'CUST-TATA-%' OR code LIKE 'CUST-FOREIGN-%')",
            "DELETE FROM customer_gst_registrations WHERE gstin IN ('27AAACR7015K1Z0', '07AAACR7015K1Z2', '06AAACR7015K1Z1', '27AAACT9999P1Z8', '29AAACE1111Q1Z9')",
            "DELETE FROM customers WHERE code LIKE 'CUST-RIL-%' OR code LIKE 'CUST-TATA-%' OR code LIKE 'CUST-FOREIGN-%'",
        ]:
            await session.execute(text(stmt))
        await session.commit()

        # 1. Companies
        comp1 = await session.get(Company, "COMP-001")
        if not comp1:
            comp1 = Company(
                id="COMP-001",
                name="SMRITI Retail Corp",
                gst_number="27AAAAA0000A1Z5",
                company_code="COMP-001",
                is_active=True,
                is_deleted=False
            )
            session.add(comp1)
        comp2 = await session.get(Company, "COMP-OTHER")
        if not comp2:
            comp2 = Company(
                id="COMP-OTHER",
                name="Unrelated Retail Ltd",
                gst_number="29BBBBB0000B1Z6",
                company_code="COMP-OTHER",
                is_active=True,
                is_deleted=False
            )
            session.add(comp2)
        await session.flush()

        # 2. Warehouses & Branches
        wh = Warehouse(
            id=f"wh-{suffix}",
            code=f"WH-{suffix}",
            name=f"Central Warehouse {suffix}",
            company_id="COMP-001",
            is_active=True,
            is_deleted=False
        )
        session.add(wh)
        br = await session.get(Branch, "MAIN")
        if not br:
            br = Branch(
                id="MAIN",
                code="MAIN",
                name="Main Branch",
                company_id="COMP-001",
                is_active=True,
                is_deleted=False
            )
            session.add(br)
        await session.flush()

        # 3. Product & Customer Group
        prod = Product(
            id=f"prod-{suffix}",
            code=f"SKU-{suffix}",
            name=f"Corporate B2B Sample Product {suffix}",
            price=Decimal("1000.00"),
            mrp=Decimal("1200.00"),
            gst_percentage=Decimal("18.00"),
            hsn_code="8471",
            category="Electronics",
            barcode=f"BAR-{suffix}",
            tracking_mode="No-stock",
            company_id="COMP-001",
            is_active=True,
            is_deleted=False
        )
        cg = CustomerGroup(
            id=f"cg-{suffix}",
            company_id="COMP-001",
            name=f"Corporate B2B Group {suffix}",
            credit_limit=Decimal("1000000.00"),
            credit_days=45,
            is_active=True,
            is_deleted=False
        )
        session.add_all([prod, cg])
        await session.flush()

        # 5. Primary Corporate Customer (e.g. Reliance Retail Limited)
        cust1 = Customer(
            id=f"cust-ril-{suffix}",
            company_id="COMP-001",
            customer_group_id=cg.id,
            code=f"CUST-RIL-{suffix}",
            name="Reliance Retail Limited",
            mobile="9820098200",
            gst_number="27AAACR7015K1Z0",  # Legacy/default Maharashtra
            outstanding=Decimal("0.00"),
            is_active=True,
            is_deleted=False
        )
        # 6. Secondary Customer (Cross-customer boundary check)
        cust2 = Customer(
            id=f"cust-tata-{suffix}",
            company_id="COMP-001",
            customer_group_id=cg.id,
            code=f"CUST-TATA-{suffix}",
            name="Trent Limited",
            mobile="9820011223",
            gst_number="27AAACT9999P1Z8",
            outstanding=Decimal("0.00"),
            is_active=True,
            is_deleted=False
        )
        # 7. Foreign Company Customer (Cross-company boundary check)
        cust_foreign = Customer(
            id=f"cust-foreign-{suffix}",
            company_id="COMP-OTHER",
            code=f"CUST-FOREIGN-{suffix}",
            name="External Corp",
            mobile="9820055555",
            gst_number="29AAACE1111Q1Z9",
            outstanding=Decimal("0.00"),
            is_active=True,
            is_deleted=False
        )
        session.add_all([cust1, cust2, cust_foreign])
        await session.flush()

        # 8. GST Registrations for Reliance
        reg_mh = CustomerGSTRegistration(
            id=f"gst-mh-{suffix}",
            company_id="COMP-001",
            customer_id=cust1.id,
            gstin="27AAACR7015K1Z0",
            state_code="27",
            state_name="Maharashtra",
            registration_type="Regular",
            is_primary=True,
            metadata_json={"trade_name": "Reliance Retail - Maharashtra", "legal_name": "Reliance Retail Limited"},
            is_active=True,
            is_deleted=False
        )
        reg_dl = CustomerGSTRegistration(
            id=f"gst-dl-{suffix}",
            company_id="COMP-001",
            customer_id=cust1.id,
            gstin="07AAACR7015K1Z2",
            state_code="07",
            state_name="Delhi",
            registration_type="Regular",
            is_primary=False,
            metadata_json={"trade_name": "Reliance Retail - Delhi", "legal_name": "Reliance Retail Limited"},
            is_active=True,
            is_deleted=False
        )
        reg_hr = CustomerGSTRegistration(
            id=f"gst-hr-{suffix}",
            company_id="COMP-001",
            customer_id=cust1.id,
            gstin="06AAACR7015K1Z1",
            state_code="06",
            state_name="Haryana",
            registration_type="Regular",
            is_primary=False,
            metadata_json={"trade_name": "Reliance Retail - Haryana", "legal_name": "Reliance Retail Limited"},
            is_active=True,
            is_deleted=False
        )
        # GST registration for Customer 2 (Cross-customer target)
        reg_tata = CustomerGSTRegistration(
            id=f"gst-tata-{suffix}",
            company_id="COMP-001",
            customer_id=cust2.id,
            gstin="27AAACT9999P1Z8",
            state_code="27",
            state_name="Maharashtra",
            registration_type="Regular",
            is_primary=True,
            metadata_json={"trade_name": "Westside Mumbai", "legal_name": "Trent Limited"},
            is_active=True,
            is_deleted=False
        )
        # GST registration for Foreign Company (Cross-company target)
        reg_foreign = CustomerGSTRegistration(
            id=f"gst-foreign-{suffix}",
            company_id="COMP-OTHER",
            customer_id=cust_foreign.id,
            gstin="29AAACE1111Q1Z9",
            state_code="29",
            state_name="Karnataka",
            registration_type="Regular",
            is_primary=True,
            metadata_json={"trade_name": "External Karnataka", "legal_name": "External Corp"},
            is_active=True,
            is_deleted=False
        )
        session.add_all([reg_mh, reg_dl, reg_hr, reg_tata, reg_foreign])
        await session.flush()

        # 9. Delivery Locations for Reliance
        loc_gurgaon = CustomerDeliveryLocation(
            id=f"loc-gurgaon-{suffix}",
            company_id="COMP-001",
            customer_id=cust1.id,
            store_code="T97D",
            location_name="Reliance Trends - Gurgaon Mall",
            address_line1="Sector 29, Leisure Valley Road",
            city="Gurgaon",
            state_code="06",
            state="Haryana",
            pincode="122001",
            gst_registration_id=reg_hr.id,
            gstin="06AAACR7015K1Z1",
            contact_person="Rajesh Kumar",
            phone="9811122233",
            metadata_json={"site_type": "Store", "district": "Gurugram"},
            is_active=True,
            is_deleted=False
        )
        loc_mumbai = CustomerDeliveryLocation(
            id=f"loc-mumbai-{suffix}",
            company_id="COMP-001",
            customer_id=cust1.id,
            store_code="1888",
            location_name="Reliance Smart Bazaar - Kurla",
            address_line1="Phoenix Marketcity, LBS Marg",
            city="Mumbai",
            state_code="27",
            state="Maharashtra",
            pincode="400070",
            gst_registration_id=reg_mh.id,
            gstin="27AAACR7015K1Z0",
            contact_person="Sunil Patil",
            phone="9820033344",
            metadata_json={"site_type": "Hypermarket", "district": "Mumbai Suburban"},
            is_active=True,
            is_deleted=False
        )
        # Delivery location for Customer 2 (Cross-customer target)
        loc_tata = CustomerDeliveryLocation(
            id=f"loc-tata-{suffix}",
            company_id="COMP-001",
            customer_id=cust2.id,
            store_code="W042",
            location_name="Westside Bandra",
            address_line1="Hill Road",
            city="Mumbai",
            state_code="27",
            state="Maharashtra",
            pincode="400050",
            metadata_json={"site_type": "Store", "district": "Mumbai"},
            is_active=True,
            is_deleted=False
        )
        # Delivery location for Foreign Company (Cross-company target)
        loc_foreign = CustomerDeliveryLocation(
            id=f"loc-foreign-{suffix}",
            company_id="COMP-OTHER",
            customer_id=cust_foreign.id,
            store_code="EXT1",
            location_name="External Site Bangalore",
            address_line1="Whitefield",
            city="Bangalore",
            state_code="29",
            state="Karnataka",
            pincode="560066",
            metadata_json={"site_type": "Warehouse", "district": "Bangalore Urban"},
            is_active=True,
            is_deleted=False
        )
        session.add_all([loc_gurgaon, loc_mumbai, loc_tata, loc_foreign])

        await session.commit()

        seed_data = {
            "suffix": suffix,
            "warehouse_id": wh.id,
            "product_id": prod.id,
            "product_code": prod.code,
            "customer_group_id": cg.id,
            "cust_ril": cust1,
            "cust_tata": cust2,
            "cust_foreign": cust_foreign,
            "reg_mh": reg_mh,
            "reg_dl": reg_dl,
            "reg_hr": reg_hr,
            "reg_tata": reg_tata,
            "reg_foreign": reg_foreign,
            "loc_gurgaon": loc_gurgaon,
            "loc_mumbai": loc_mumbai,
            "loc_tata": loc_tata,
            "loc_foreign": loc_foreign,
        }

    yield seed_data

    async with TestSessionLocal() as session:
        for stmt in [
            "DELETE FROM sales_invoice_items WHERE invoice_id IN (SELECT id FROM sales_invoices WHERE customer_id IN (SELECT id FROM customers WHERE code LIKE 'CUST-RIL-%' OR code LIKE 'CUST-TATA-%' OR code LIKE 'CUST-FOREIGN-%'))",
            "DELETE FROM sales_invoices WHERE customer_id IN (SELECT id FROM customers WHERE code LIKE 'CUST-RIL-%' OR code LIKE 'CUST-TATA-%' OR code LIKE 'CUST-FOREIGN-%')",
            "DELETE FROM customer_delivery_locations WHERE customer_id IN (SELECT id FROM customers WHERE code LIKE 'CUST-RIL-%' OR code LIKE 'CUST-TATA-%' OR code LIKE 'CUST-FOREIGN-%')",
            "DELETE FROM customer_billing_locations WHERE customer_id IN (SELECT id FROM customers WHERE code LIKE 'CUST-RIL-%' OR code LIKE 'CUST-TATA-%' OR code LIKE 'CUST-FOREIGN-%')",
            "DELETE FROM customer_gst_registrations WHERE customer_id IN (SELECT id FROM customers WHERE code LIKE 'CUST-RIL-%' OR code LIKE 'CUST-TATA-%' OR code LIKE 'CUST-FOREIGN-%')",
            "DELETE FROM customer_gst_registrations WHERE gstin IN ('27AAACR7015K1Z0', '07AAACR7015K1Z2', '06AAACR7015K1Z1', '27AAACT9999P1Z8', '29AAACE1111Q1Z9')",
            "DELETE FROM customers WHERE code LIKE 'CUST-RIL-%' OR code LIKE 'CUST-TATA-%' OR code LIKE 'CUST-FOREIGN-%'",
        ]:
            await session.execute(text(stmt))
        await session.commit()


# ─────────────────────────────────────────────────────────────────────────────
# TESTS — SECTION O (1 to 18) + SECTION Q (Direct PostgreSQL Assertions)
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.anyio
async def test_01_corporate_customer_with_single_gst_registration(setup_seed_data, tenant_ctx):
    """Requirement 1: Corporate customer with one GST registration populates billed_party_gstin_id & customer_gstin."""
    data = setup_seed_data
    async with TestSessionLocal() as session:
        service = SalesService(session, tenant_ctx)
        inv_in = SalesInvoiceCreate(
            customer_id=data["cust_ril"].id,
            billed_party_gstin_id=data["reg_mh"].id,
            warehouse_id=data["warehouse_id"],
            payment_mode="CASH",
            status="Draft",
            items=[
                SalesInvoiceItemCreate(
                    product_id=data["product_id"],
                    code=data["product_code"],
                    name="Test Item",
                    price=Decimal("1000.00"),
                    quantity=Decimal("2.0000"),
                    gst_rate=Decimal("18.00")
                )
            ]
        )
        inv = await service.create_sales_invoice(inv_in)
        await session.commit()

        assert inv.customer_id == data["cust_ril"].id
        assert inv.billed_party_gstin_id == data["reg_mh"].id
        assert inv.customer_gstin == "27AAACR7015K1Z0"


@pytest.mark.anyio
async def test_02_corporate_customer_with_multiple_gst_registrations(setup_seed_data, tenant_ctx):
    """Requirement 2: Corporate customer with multiple GST registrations persists explicitly selected registration."""
    data = setup_seed_data
    async with TestSessionLocal() as session:
        service = SalesService(session, tenant_ctx)
        # Select Delhi GST registration explicitly
        inv_in = SalesInvoiceCreate(
            customer_id=data["cust_ril"].id,
            billed_party_gstin_id=data["reg_dl"].id,
            warehouse_id=data["warehouse_id"],
            payment_mode="CASH",
            status="Draft",
            items=[
                SalesInvoiceItemCreate(
                    product_id=data["product_id"],
                    code=data["product_code"],
                    name="Test Item",
                    price=Decimal("500.00"),
                    quantity=Decimal("1.0000"),
                    gst_rate=Decimal("18.00")
                )
            ]
        )
        inv = await service.create_sales_invoice(inv_in)
        await session.commit()

        assert inv.billed_party_gstin_id == data["reg_dl"].id
        assert inv.customer_gstin == "07AAACR7015K1Z2"


@pytest.mark.anyio
async def test_03_to_06_delivery_location_store_code_gstin_pos_derivation(setup_seed_data, tenant_ctx):
    """Requirements 3, 4, 5, 6: Delivery location selection populates store code, delivery GSTIN, and POS."""
    data = setup_seed_data
    async with TestSessionLocal() as session:
        service = SalesService(session, tenant_ctx)
        # Bill to Maharashtra GSTIN, Ship to Haryana Gurgaon Store
        inv_in = SalesInvoiceCreate(
            customer_id=data["cust_ril"].id,
            billed_party_gstin_id=data["reg_mh"].id,
            delivery_location_id=data["loc_gurgaon"].id,
            warehouse_id=data["warehouse_id"],
            payment_mode="CASH",
            status="Draft",
            items=[
                SalesInvoiceItemCreate(
                    product_id=data["product_id"],
                    code=data["product_code"],
                    name="Test Item",
                    price=Decimal("1000.00"),
                    quantity=Decimal("1.0000"),
                    gst_rate=Decimal("18.00")
                )
            ]
        )
        inv = await service.create_sales_invoice(inv_in)
        await session.commit()

        # Requirement 3: Delivery location ID persisted
        assert inv.delivery_location_id == data["loc_gurgaon"].id
        # Requirement 4: Store Code populated
        assert inv.delivery_store_code == "T97D"
        # Legacy compatibility check (Section I)
        assert inv.sis_code == "T97D"
        # Requirement 5: Delivery GSTIN populated
        assert inv.delivery_gstin == "06AAACR7015K1Z1"
        # Requirement 6: Authoritative transaction POS derived from delivery state (Haryana 06)
        assert inv.place_of_supply_code == "06"
        assert "Haryana" in (inv.pos_state or "")
        # Inter-state flag derived: Store MH (27) -> Delivery HR (06) => True
        assert inv.is_interstate is True


@pytest.mark.anyio
async def test_07_invoice_request_contains_all_phase2c_fields(setup_seed_data, tenant_ctx):
    """Requirement 7: Invoice create request maps and validates all Phase 2C fields."""
    data = setup_seed_data
    async with TestSessionLocal() as session:
        service = SalesService(session, tenant_ctx)
        custom_snapshot = {
            "id": data["loc_gurgaon"].id,
            "store_code": "T97D",
            "city": "Gurgaon",
            "state_code": "06"
        }
        inv_in = SalesInvoiceCreate(
            customer_id=data["cust_ril"].id,
            billed_party_gstin_id=data["reg_mh"].id,
            delivery_location_id=data["loc_gurgaon"].id,
            delivery_store_code="T97D",
            delivery_gstin="06AAACR7015K1Z1",
            delivery_location_snapshot=custom_snapshot,
            place_of_supply_code="06",
            po_reference="PO-RIL-2026-9988",
            warehouse_id=data["warehouse_id"],
            payment_mode="CASH",
            status="Draft",
            items=[
                SalesInvoiceItemCreate(
                    product_id=data["product_id"],
                    code=data["product_code"],
                    name="Test Item",
                    price=Decimal("100.00"),
                    quantity=Decimal("1.0000"),
                    gst_rate=Decimal("18.00")
                )
            ]
        )
        inv = await service.create_sales_invoice(inv_in)
        await session.commit()

        assert inv.customer_id == data["cust_ril"].id
        assert inv.billed_party_gstin_id == data["reg_mh"].id
        assert inv.delivery_location_id == data["loc_gurgaon"].id
        assert inv.delivery_store_code == "T97D"
        assert inv.delivery_gstin == "06AAACR7015K1Z1"
        assert inv.place_of_supply_code == "06"
        assert inv.po_reference == "PO-RIL-2026-9988"
        assert inv.delivery_location_snapshot is not None
        assert inv.delivery_location_snapshot["store_code"] == "T97D"


@pytest.mark.anyio
async def test_08_and_09_invoice_snapshot_persistence_and_immutability(setup_seed_data, tenant_ctx):
    """Requirements 8 & 9: Snapshot persisted and remains immutable even after customer master changes."""
    data = setup_seed_data
    invoice_id = None

    async with TestSessionLocal() as session:
        service = SalesService(session, tenant_ctx)
        inv_in = SalesInvoiceCreate(
            customer_id=data["cust_ril"].id,
            billed_party_gstin_id=data["reg_mh"].id,
            delivery_location_id=data["loc_mumbai"].id,
            warehouse_id=data["warehouse_id"],
            payment_mode="CASH",
            status="Completed",
            items=[
                SalesInvoiceItemCreate(
                    product_id=data["product_id"],
                    code=data["product_code"],
                    name="Test Item",
                    price=Decimal("200.00"),
                    quantity=Decimal("1.0000"),
                    gst_rate=Decimal("18.00")
                )
            ]
        )
        inv = await service.create_sales_invoice(inv_in)
        await session.commit()
        invoice_id = inv.id

        assert inv.delivery_store_code == "1888"
        assert inv.delivery_location_snapshot["location_name"] == "Reliance Smart Bazaar - Kurla"

    # Now simulate future edit to Customer Delivery Location in Customer Master
    async with TestSessionLocal() as session:
        loc_stmt = select(CustomerDeliveryLocation).where(CustomerDeliveryLocation.id == data["loc_mumbai"].id)
        loc = (await session.execute(loc_stmt)).scalars().first()
        loc.location_name = "UPDATED Reliance Smart Point"
        loc.store_code = "9999-CHANGED"
        await session.commit()

    # Verify historical invoice snapshot in PostgreSQL was NOT mutated
    async with TestSessionLocal() as session:
        inv_stmt = select(SalesInvoice).where(SalesInvoice.id == invoice_id)
        persisted_inv = (await session.execute(inv_stmt)).scalars().first()

        # Immutable snapshot check
        assert persisted_inv.delivery_store_code == "1888"  # Must retain 1888, NOT 9999-CHANGED
        assert persisted_inv.delivery_location_snapshot["location_name"] == "Reliance Smart Bazaar - Kurla"


@pytest.mark.anyio
async def test_10_cross_customer_gst_registration_rejected(setup_seed_data, tenant_ctx):
    """Requirement 10: Reject Billed GST registration belonging to another customer with HTTP 400."""
    data = setup_seed_data
    async with TestSessionLocal() as session:
        service = SalesService(session, tenant_ctx)
        # Attempt to bill Reliance customer using Trent/Tata GST registration
        inv_in = SalesInvoiceCreate(
            customer_id=data["cust_ril"].id,
            billed_party_gstin_id=data["reg_tata"].id,
            warehouse_id=data["warehouse_id"],
            payment_mode="CASH",
            status="Draft",
            items=[
                SalesInvoiceItemCreate(
                    product_id=data["product_id"],
                    code=data["product_code"],
                    name="Test Item",
                    price=Decimal("100.00"),
                    quantity=Decimal("1.0000")
                )
            ]
        )
        with pytest.raises(HTTPException) as exc_info:
            await service.create_sales_invoice(inv_in)
        assert exc_info.value.status_code == 400
        assert "does not belong to the selected customer" in str(exc_info.value.detail)


@pytest.mark.anyio
async def test_11_cross_customer_delivery_location_rejected(setup_seed_data, tenant_ctx):
    """Requirement 11: Reject Delivery Location belonging to another customer with HTTP 400."""
    data = setup_seed_data
    async with TestSessionLocal() as session:
        service = SalesService(session, tenant_ctx)
        # Attempt to deliver Reliance invoice to Trent/Tata store
        inv_in = SalesInvoiceCreate(
            customer_id=data["cust_ril"].id,
            delivery_location_id=data["loc_tata"].id,
            warehouse_id=data["warehouse_id"],
            payment_mode="CASH",
            status="Draft",
            items=[
                SalesInvoiceItemCreate(
                    product_id=data["product_id"],
                    code=data["product_code"],
                    name="Test Item",
                    price=Decimal("100.00"),
                    quantity=Decimal("1.0000")
                )
            ]
        )
        with pytest.raises(HTTPException) as exc_info:
            await service.create_sales_invoice(inv_in)
        assert exc_info.value.status_code == 400
        assert "does not belong to the selected customer" in str(exc_info.value.detail)


@pytest.mark.anyio
async def test_12_cross_company_gst_registration_rejected(setup_seed_data, tenant_ctx):
    """Requirement 12: Reject GST registration belonging to a different company with HTTP 403."""
    data = setup_seed_data
    async with TestSessionLocal() as session:
        service = SalesService(session, tenant_ctx)
        # Attempt to use foreign company GST registration under active tenant
        inv_in = SalesInvoiceCreate(
            customer_id=data["cust_ril"].id,
            billed_party_gstin_id=data["reg_foreign"].id,
            warehouse_id=data["warehouse_id"],
            payment_mode="CASH",
            status="Draft",
            items=[
                SalesInvoiceItemCreate(
                    product_id=data["product_id"],
                    code=data["product_code"],
                    name="Test Item",
                    price=Decimal("100.00"),
                    quantity=Decimal("1.0000")
                )
            ]
        )
        with pytest.raises(HTTPException) as exc_info:
            await service.create_sales_invoice(inv_in)
        assert exc_info.value.status_code == 403
        assert "Cross-company" in str(exc_info.value.detail)


@pytest.mark.anyio
async def test_13_cross_company_delivery_location_rejected(setup_seed_data, tenant_ctx):
    """Requirement 13: Reject Delivery Location belonging to a different company with HTTP 403."""
    data = setup_seed_data
    async with TestSessionLocal() as session:
        service = SalesService(session, tenant_ctx)
        inv_in = SalesInvoiceCreate(
            customer_id=data["cust_ril"].id,
            delivery_location_id=data["loc_foreign"].id,
            warehouse_id=data["warehouse_id"],
            payment_mode="CASH",
            status="Draft",
            items=[
                SalesInvoiceItemCreate(
                    product_id=data["product_id"],
                    code=data["product_code"],
                    name="Test Item",
                    price=Decimal("100.00"),
                    quantity=Decimal("1.0000")
                )
            ]
        )
        with pytest.raises(HTTPException) as exc_info:
            await service.create_sales_invoice(inv_in)
        assert exc_info.value.status_code == 403
        assert "Cross-company" in str(exc_info.value.detail)


@pytest.mark.anyio
async def test_14_delivery_gstin_state_invariant_rejected(setup_seed_data, tenant_ctx):
    """Requirement 14: Reject Delivery GSTIN if its state code conflicts with delivery location state code."""
    data = setup_seed_data
    async with TestSessionLocal() as session:
        service = SalesService(session, tenant_ctx)
        # loc_gurgaon is state 06 (Haryana), but pass delivery_gstin with 27 (Maharashtra)
        inv_in = SalesInvoiceCreate(
            customer_id=data["cust_ril"].id,
            delivery_location_id=data["loc_gurgaon"].id,
            delivery_gstin="27AAACR7015K1Z0",  # Invariant violation!
            warehouse_id=data["warehouse_id"],
            payment_mode="CASH",
            status="Draft",
            items=[
                SalesInvoiceItemCreate(
                    product_id=data["product_id"],
                    code=data["product_code"],
                    name="Test Item",
                    price=Decimal("100.00"),
                    quantity=Decimal("1.0000")
                )
            ]
        )
        with pytest.raises(HTTPException) as exc_info:
            await service.create_sales_invoice(inv_in)
        assert exc_info.value.status_code == 400
        assert "does not match delivery location state" in str(exc_info.value.detail)


@pytest.mark.anyio
async def test_15_credit_billing_regression(setup_seed_data, tenant_ctx):
    """Requirement 15: B2B Credit sale enforces payment_mode=CREDIT, paid_amount=0, balance_amount=grand_total."""
    data = setup_seed_data
    async with TestSessionLocal() as session:
        service = SalesService(session, tenant_ctx)
        inv_in = SalesInvoiceCreate(
            customer_id=data["cust_ril"].id,
            billed_party_gstin_id=data["reg_mh"].id,
            delivery_location_id=data["loc_mumbai"].id,
            warehouse_id=data["warehouse_id"],
            payment_mode="CREDIT",
            status="Completed",
            items=[
                SalesInvoiceItemCreate(
                    product_id=data["product_id"],
                    code=data["product_code"],
                    name="Test Credit Item",
                    price=Decimal("1000.00"),
                    quantity=Decimal("1.0000"),
                    gst_rate=Decimal("18.00")
                )
            ]
        )
        inv = await service.create_sales_invoice(inv_in)
        await session.commit()

        assert inv.payment_mode == "CREDIT"
        assert inv.paid_amount == Decimal("0.00")
        assert inv.balance_amount == inv.grand_total
        assert inv.grand_total == Decimal("1180.00")

        # Verify customer outstanding incremented atomically
        cust_stmt = select(Customer).where(Customer.id == data["cust_ril"].id)
        cust = (await session.execute(cust_stmt)).scalars().first()
        assert cust.outstanding == Decimal("1180.00")


@pytest.mark.anyio
async def test_16_cash_billing_regression(setup_seed_data, tenant_ctx):
    """Requirement 16: Cash sale preserves payment_mode=CASH, paid_amount=total, balance_amount=0."""
    data = setup_seed_data
    async with TestSessionLocal() as session:
        service = SalesService(session, tenant_ctx)
        inv_in = SalesInvoiceCreate(
            customer_id=data["cust_ril"].id,
            warehouse_id=data["warehouse_id"],
            payment_mode="CASH",
            paid_amount=Decimal("118.00"),
            balance_amount=Decimal("0.00"),
            status="Completed",
            items=[
                SalesInvoiceItemCreate(
                    product_id=data["product_id"],
                    code=data["product_code"],
                    name="Test Cash Item",
                    price=Decimal("100.00"),
                    quantity=Decimal("1.0000"),
                    gst_rate=Decimal("18.00")
                )
            ]
        )
        inv = await service.create_sales_invoice(inv_in)
        await session.commit()

        assert inv.payment_mode == "CASH"
        assert inv.paid_amount == Decimal("118.00")
        assert inv.balance_amount == Decimal("0.00")


@pytest.mark.anyio
async def test_17_document_series_numbering_regression(setup_seed_data, tenant_ctx):
    """Requirement 17: Canonical sequence allocation preserved, never hardcoded D1DS13-1."""
    data = setup_seed_data
    async with TestSessionLocal() as session:
        service = SalesService(session, tenant_ctx)
        # Empty invoice_no or D1DS13-1 triggers auto-allocation via DocumentsEngine
        inv_in = SalesInvoiceCreate(
            invoice_no="D1DS13-1",
            customer_id=data["cust_ril"].id,
            warehouse_id=data["warehouse_id"],
            payment_mode="CASH",
            status="Draft",
            items=[
                SalesInvoiceItemCreate(
                    product_id=data["product_id"],
                    code=data["product_code"],
                    name="Test Item",
                    price=Decimal("50.00"),
                    quantity=Decimal("1.0000")
                )
            ]
        )
        inv = await service.create_sales_invoice(inv_in)
        await session.commit()

        assert inv.invoice_no != "D1DS13-1"
        assert inv.invoice_no is not None
        assert len(inv.invoice_no) > 0


@pytest.mark.anyio
async def test_18_customer_group_credit_policy_enforcement(setup_seed_data, tenant_ctx):
    """Requirement 18: Credit policy headroom checked against CustomerGroup limit."""
    data = setup_seed_data
    async with TestSessionLocal() as session:
        service = SalesService(session, tenant_ctx)
        # Attempt credit invoice exceeding group limit of 1,000,000
        inv_in = SalesInvoiceCreate(
            customer_id=data["cust_ril"].id,
            warehouse_id=data["warehouse_id"],
            payment_mode="CREDIT",
            status="Completed",
            items=[
                SalesInvoiceItemCreate(
                    product_id=data["product_id"],
                    code=data["product_code"],
                    name="Expensive Item",
                    price=Decimal("2000000.00"),
                    quantity=Decimal("1.0000"),
                    gst_rate=Decimal("18.00")
                )
            ]
        )
        with pytest.raises(HTTPException) as exc_info:
            await service.create_sales_invoice(inv_in)
        assert exc_info.value.status_code == 400
        assert "exceeded" in str(exc_info.value.detail).lower() or "credit" in str(exc_info.value.detail).lower()


# ─────────────────────────────────────────────────────────────────────────────
# SECTION Q: DIRECT POSTGRESQL DATABASE RAW QUERY ASSERTIONS
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.anyio
async def test_section_q_direct_postgresql_database_assertions(setup_seed_data, tenant_ctx):
    """Section Q: Verify exact fields and immutable snapshots directly in PostgreSQL via raw SQL."""
    data = setup_seed_data

    # 1. Create a corporate invoice through SalesService
    async with TestSessionLocal() as session:
        service = SalesService(session, tenant_ctx)
        inv_in = SalesInvoiceCreate(
            customer_id=data["cust_ril"].id,
            billed_party_gstin_id=data["reg_mh"].id,
            delivery_location_id=data["loc_gurgaon"].id,
            warehouse_id=data["warehouse_id"],
            payment_mode="CREDIT",
            po_reference="PO-CORP-SEC-Q-2026",
            status="Completed",
            items=[
                SalesInvoiceItemCreate(
                    product_id=data["product_id"],
                    code=data["product_code"],
                    name="Direct PG Assert Item",
                    price=Decimal("5000.00"),
                    quantity=Decimal("2.0000"),
                    gst_rate=Decimal("18.00")
                )
            ]
        )
        created = await service.create_sales_invoice(inv_in)
        await session.commit()
        invoice_id = created.id

    # 2. Raw SQL query directly against PostgreSQL table 'sales_invoices'
    async with TestSessionLocal() as session:
        raw_result = await session.execute(
            text("""
                SELECT 
                    customer_id,
                    billed_party_gstin_id,
                    customer_gstin,
                    delivery_location_id,
                    delivery_store_code,
                    delivery_gstin,
                    delivery_location_snapshot,
                    place_of_supply_code,
                    sis_code,
                    po_reference,
                    company_id
                FROM sales_invoices
                WHERE id = :inv_id
            """),
            {"inv_id": invoice_id}
        )
        row = raw_result.mappings().first()

        assert row is not None, "Invoice must exist in PostgreSQL sales_invoices table"

        # Assert Section Q requirements:
        # customer_id == selected corporate customer
        assert row["customer_id"] == data["cust_ril"].id
        # billed_party_gstin_id belongs to customer
        assert row["billed_party_gstin_id"] == data["reg_mh"].id
        # customer_gstin == authoritative billed GSTIN
        assert row["customer_gstin"] == "27AAACR7015K1Z0"
        # delivery_location_id belongs to customer
        assert row["delivery_location_id"] == data["loc_gurgaon"].id
        # delivery_store_code == selected location store_code
        assert row["delivery_store_code"] == "T97D"
        # sis_code mirrors delivery_store_code for legacy compatibility
        assert row["sis_code"] == "T97D"
        # delivery_gstin == authoritative selected delivery GSTIN
        assert row["delivery_gstin"] == "06AAACR7015K1Z1"
        # place_of_supply_code == expected transaction POS (Haryana: '06')
        assert row["place_of_supply_code"] == "06"
        # po_reference persisted
        assert row["po_reference"] == "PO-CORP-SEC-Q-2026"
        # delivery_location_snapshot is valid dictionary
        snapshot = row["delivery_location_snapshot"]
        assert isinstance(snapshot, dict)
        assert snapshot["store_code"] == "T97D"
        assert snapshot["city"] == "Gurgaon"
        assert snapshot["state_code"] == "06"
        # Tenant isolation
        assert row["company_id"] == "COMP-001"
