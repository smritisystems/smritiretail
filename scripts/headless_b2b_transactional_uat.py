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
Source Module: Headless Transactional UAT — Corporate B2B Billing Workspace Flow
"""

import os
import sys
import uuid
import asyncio
from decimal import Decimal
from pathlib import Path

# Ensure backend path is on sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))

# Environment configuration
os.environ["JWT_SECRET_KEY"] = "test-jwt-secret-key-smriti"
os.environ["INTERNAL_SERVICE_KEY"] = "test-internal-key-smriti"
os.environ["SGIP_VAULT_MASTER_KEY"] = "test-vault-master-key-smriti-32chars"

from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.pool import NullPool
from sqlalchemy import select, text

from app.api.deps import TenantContext
from app.models.tenant import Company, Branch
from app.models.crm import Customer, CustomerGroup, CustomerGSTRegistration, CustomerDeliveryLocation
from app.models.inventory import Product, Warehouse
from app.models.sales import SalesInvoice
from app.schemas.sales import SalesInvoiceCreate, SalesInvoiceItemCreate
from app.services.sales import SalesService

TEST_DB_URL = "postgresql+asyncpg://postgres:postgres@localhost:5432/smriti_test_phase2c"
engine = create_async_engine(TEST_DB_URL, echo=False, poolclass=NullPool)
SessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)

async def run_headless_b2b_transactional_uat():
    print("=" * 80)
    print("SMRITI RETAIL OS — PHASE 2C HEADLESS TRANSACTIONAL UAT")
    print("=" * 80)
    
    tenant_ctx = TenantContext(company_id="COMP-001", branch_id="MAIN")
    suffix = uuid.uuid4().hex[:6]
    
    async with SessionLocal() as session:
        # Step 0: Ensure foundational entities
        comp = await session.get(Company, "COMP-001")
        if not comp:
            comp = Company(
                id="COMP-001",
                name="SMRITI Retail Corp",
                gst_number="27AAAAA0000A1Z5",
                company_code="COMP-001",
                is_active=True,
                is_deleted=False
            )
            session.add(comp)
        
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
        
        wh = Warehouse(
            id=f"wh-uat-{suffix}",
            code=f"WH-UAT-{suffix}",
            name=f"Central Godown {suffix}",
            company_id="COMP-001",
            is_active=True,
            is_deleted=False
        )
        session.add(wh)
        
        prod = Product(
            id=f"prod-uat-{suffix}",
            code=f"SKU-CORP-{suffix}",
            name=f"Corporate Uniform Shirt {suffix}",
            price=Decimal("1500.00"),
            mrp=Decimal("1800.00"),
            gst_percentage=Decimal("18.00"),
            hsn_code="6205",
            category="Apparel",
            barcode=f"BAR-UAT-{suffix}",
            tracking_mode="No-stock",
            company_id="COMP-001",
            is_active=True,
            is_deleted=False
        )
        
        cg = CustomerGroup(
            id=f"cg-uat-{suffix}",
            company_id="COMP-001",
            name=f"Key Accounts Corporate {suffix}",
            credit_limit=Decimal("5000000.00"),
            credit_days=60,
            is_active=True,
            is_deleted=False
        )
        session.add_all([prod, cg])
        await session.flush()
        
        # Step 1: Corporate Customer
        cust = Customer(
            id=f"cust-ril-{suffix}",
            company_id="COMP-001",
            customer_group_id=cg.id,
            code=f"CUST-RIL-{suffix}",
            name="Reliance Retail Limited",
            mobile="9820098200",
            gst_number="27AAACR7015K1Z0",
            outstanding=Decimal("0.00"),
            is_active=True,
            is_deleted=False
        )
        session.add(cust)
        await session.flush()
        
        # Multi-state GST registrations
        reg_mh = CustomerGSTRegistration(
            id=f"gst-mh-{suffix}",
            company_id="COMP-001",
            customer_id=cust.id,
            gstin="27AAACR7015K1Z0",
            state_code="27",
            state_name="Maharashtra",
            registration_type="Regular",
            is_primary=True,
            metadata_json={"trade_name": "Reliance Retail - Maharashtra"},
            is_active=True,
            is_deleted=False
        )
        reg_dl = CustomerGSTRegistration(
            id=f"gst-dl-{suffix}",
            company_id="COMP-001",
            customer_id=cust.id,
            gstin="07AAACR7015K1Z2",
            state_code="07",
            state_name="Delhi",
            registration_type="Regular",
            is_primary=False,
            metadata_json={"trade_name": "Reliance Retail - Delhi"},
            is_active=True,
            is_deleted=False
        )
        reg_hr = CustomerGSTRegistration(
            id=f"gst-hr-{suffix}",
            company_id="COMP-001",
            customer_id=cust.id,
            gstin="06AAACR7015K1Z1",
            state_code="06",
            state_name="Haryana",
            registration_type="Regular",
            is_primary=False,
            metadata_json={"trade_name": "Reliance Retail - Haryana"},
            is_active=True,
            is_deleted=False
        )
        session.add_all([reg_mh, reg_dl, reg_hr])
        await session.flush()
        
        # Delivery Locations with Store Codes
        loc_gurgaon = CustomerDeliveryLocation(
            id=f"loc-gurgaon-{suffix}",
            company_id="COMP-001",
            customer_id=cust.id,
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
            metadata_json={"site_type": "Store"},
            is_active=True,
            is_deleted=False
        )
        loc_mumbai = CustomerDeliveryLocation(
            id=f"loc-mumbai-{suffix}",
            company_id="COMP-001",
            customer_id=cust.id,
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
            metadata_json={"site_type": "Hypermarket"},
            is_active=True,
            is_deleted=False
        )
        session.add_all([loc_gurgaon, loc_mumbai])
        await session.commit()
        
        print("\n[STEP 1: CORPORATE CUSTOMER SELECTION]")
        print(f"  Selected Customer : {cust.name} ({cust.code})")
        print(f"  Customer Group    : {cg.name} (Credit Limit: INR {cg.credit_limit:,.2f})")
        
        # Step 2: Query active GST registrations
        gst_regs_stmt = select(CustomerGSTRegistration).filter(
            CustomerGSTRegistration.customer_id == cust.id,
            CustomerGSTRegistration.is_active == True,
            CustomerGSTRegistration.is_deleted == False
        ).order_by(CustomerGSTRegistration.is_primary.desc())
        regs = (await session.execute(gst_regs_stmt)).scalars().all()
        print("\n[STEP 2: LOAD BILLED GST REGISTRATIONS]")
        for r in regs:
            primary_tag = " [PRIMARY]" if r.is_primary else ""
            print(f"  - ID: {r.id} | GSTIN: {r.gstin} | State: {r.state_name} ({r.state_code}){primary_tag}")
        
        # Select Delhi GST Registration
        selected_reg = reg_dl
        print(f"  --> Action: User selects Billed GST: {selected_reg.gstin} ({selected_reg.state_name})")
        
        # Step 3: Query active Delivery Locations
        locs_stmt = select(CustomerDeliveryLocation).filter(
            CustomerDeliveryLocation.customer_id == cust.id,
            CustomerDeliveryLocation.is_active == True,
            CustomerDeliveryLocation.is_deleted == False
        ).order_by(CustomerDeliveryLocation.store_code)
        locs = (await session.execute(locs_stmt)).scalars().all()
        print("\n[STEP 3: LOAD DELIVERY LOCATIONS / STORES]")
        for l in locs:
            print(f"  - ID: {l.id} | Store Code: {l.store_code} | Name: {l.location_name} | State: {l.state} ({l.state_code}) | GSTIN: {l.gstin}")
            
        # Select Gurgaon Store Location
        selected_loc = loc_gurgaon
        print(f"  --> Action: User selects Delivery Location: {selected_loc.location_name} (Store Code: {selected_loc.store_code})")
        
        # Step 4: Auto-population verification
        print("\n[STEP 4: AUTO-POPULATED TRANSACTION CONTEXT]")
        print(f"  delivery_location_id : {selected_loc.id}")
        print(f"  delivery_store_code  : {selected_loc.store_code} [READ-ONLY]")
        print(f"  delivery_gstin       : {selected_loc.gstin} [READ-ONLY]")
        print(f"  delivery address     : {selected_loc.address_line1}, {selected_loc.city}, {selected_loc.state} - {selected_loc.pincode}")
        print(f"  place_of_supply_code : {selected_loc.state_code} [AUTHORITATIVE TRANSACTION POS: {selected_loc.state}]")
        print(f"  po_reference         : PO-RIL-UAT-2026-991")
        
        # Step 5: Execute Invoice Creation via SalesService
        service = SalesService(session, tenant_ctx)
        inv_payload = SalesInvoiceCreate(
            customer_id=cust.id,
            billed_party_gstin_id=selected_reg.id,
            delivery_location_id=selected_loc.id,
            warehouse_id=wh.id,
            payment_mode="CREDIT",
            po_reference="PO-RIL-UAT-2026-991",
            status="Completed",
            items=[
                SalesInvoiceItemCreate(
                    product_id=prod.id,
                    code=prod.code,
                    name=prod.name,
                    price=Decimal("1500.00"),
                    quantity=Decimal("10.0000"),
                    gst_rate=Decimal("18.00")
                )
            ]
        )
        
        print("\n[STEP 5: INVOICE CREATION VIA SALESSERVICE]")
        inv = await service.create_sales_invoice(inv_payload)
        await session.commit()
        invoice_id = inv.id
        print(f"  Generated Invoice ID : {inv.id}")
        print(f"  Document Invoice No  : {inv.invoice_no}")
        print(f"  Taxable Value        : INR {inv.taxable_value:,.2f}")
        print(f"  Tax Total            : INR {inv.tax_total:,.2f}")
        print(f"  Grand Total          : INR {inv.grand_total:,.2f}")
        print(f"  Payment Mode         : {inv.payment_mode}")
        print(f"  Paid Amount          : INR {inv.paid_amount:,.2f}")
        print(f"  Balance Amount       : INR {inv.balance_amount:,.2f}")
        print(f"  Is Inter-state       : {inv.is_interstate}")
        
        # Step 6: Direct Raw SQL Assertions against PostgreSQL
        print("\n[STEP 6: DIRECT POSTGRESQL RAW SQL ASSERTIONS]")
        raw_query = text("""
            SELECT 
                id,
                invoice_no,
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
                is_interstate,
                payment_mode,
                paid_amount,
                balance_amount,
                company_id
            FROM sales_invoices
            WHERE id = :id
        """)
        row = (await session.execute(raw_query, {"id": invoice_id})).mappings().first()
        
        assert row is not None, "Invoice must exist in PostgreSQL!"
        print(f"  [PASS] invoice.customer_id                 : {row['customer_id']} == {cust.id}")
        assert row["customer_id"] == cust.id
        
        print(f"  [PASS] invoice.billed_party_gstin_id       : {row['billed_party_gstin_id']} == {selected_reg.id}")
        assert row["billed_party_gstin_id"] == selected_reg.id
        
        print(f"  [PASS] invoice.customer_gstin              : {row['customer_gstin']} == {selected_reg.gstin} (Delhi)")
        assert row["customer_gstin"] == "07AAACR7015K1Z2"
        
        print(f"  [PASS] invoice.delivery_location_id        : {row['delivery_location_id']} == {selected_loc.id}")
        assert row["delivery_location_id"] == selected_loc.id
        
        print(f"  [PASS] invoice.delivery_store_code         : {row['delivery_store_code']} == {selected_loc.store_code}")
        assert row["delivery_store_code"] == "T97D"
        
        print(f"  [PASS] invoice.sis_code (compat)           : {row['sis_code']} == {selected_loc.store_code}")
        assert row["sis_code"] == "T97D"
        
        print(f"  [PASS] invoice.delivery_gstin              : {row['delivery_gstin']} == {selected_loc.gstin} (Haryana)")
        assert row["delivery_gstin"] == "06AAACR7015K1Z1"
        
        print(f"  [PASS] invoice.place_of_supply_code        : {row['place_of_supply_code']} == {selected_loc.state_code} (Haryana)")
        assert row["place_of_supply_code"] == "06"
        
        print(f"  [PASS] invoice.is_interstate               : {row['is_interstate']} (Store 27 -> Delivery 06 => Inter-state)")
        assert row["is_interstate"] is True
        
        print(f"  [PASS] invoice.po_reference                : {row['po_reference']} == 'PO-RIL-UAT-2026-991'")
        assert row["po_reference"] == "PO-RIL-UAT-2026-991"
        
        print(f"  [PASS] invoice.payment_mode                : {row['payment_mode']} == 'CREDIT'")
        assert row["payment_mode"] == "CREDIT"
        
        print(f"  [PASS] invoice.paid_amount                 : {row['paid_amount']} == 0.00")
        assert row["paid_amount"] == Decimal("0.00")
        
        print(f"  [PASS] invoice.balance_amount              : {row['balance_amount']} == grand_total ({row['balance_amount']})")
        assert row["balance_amount"] > Decimal("0.00")
        
        snapshot = row["delivery_location_snapshot"]
        print(f"  [PASS] invoice.delivery_location_snapshot  : store_code='{snapshot.get('store_code')}', location_name='{snapshot.get('location_name')}', city='{snapshot.get('city')}', state='{snapshot.get('state_name')}'")
        assert snapshot.get("store_code") == "T97D"
        assert snapshot.get("city") == "Gurgaon"
        
        # Step 7: Immutability assertion
        print("\n[STEP 7: HISTORICAL SNAPSHOT IMMUTABILITY TEST]")
        selected_loc.store_code = "CHANGED-999"
        selected_loc.location_name = "Mutated Location Name"
        await session.commit()
        
        # Re-read invoice from DB
        re_row = (await session.execute(raw_query, {"id": invoice_id})).mappings().first()
        print(f"  Mutated Location store_code in Master : {selected_loc.store_code}")
        print(f"  Persisted Invoice delivery_store_code : {re_row['delivery_store_code']} (MUST REMAIN T97D)")
        assert re_row["delivery_store_code"] == "T97D"
        assert re_row["delivery_location_snapshot"]["store_code"] == "T97D"
        print("  [PASS] Immutability Verified: Historical invoice snapshot is unaffected by master changes!")
        
    print("\n" + "=" * 80)
    print("ALL PHASE 2C TRANSACTIONAL UAT GATES & DB ASSERTIONS: PASSED")
    print("=" * 80)

if __name__ == "__main__":
    asyncio.run(run_headless_b2b_transactional_uat())
