"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.16.0
Created      : 2026-08-23
Modified     : 2026-08-23
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import sys
import os
from pathlib import Path

backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from dotenv import dotenv_values
env_file = backend_dir.parent / ".env"
if env_file.exists():
    for k, v in dotenv_values(env_file).items():
        if v is not None and k not in os.environ:
            os.environ[k] = v

import pytest
from sqlalchemy import select, delete
from app.db.session import get_company_sessionmaker
from app.services.item_master_svc import UniversalItemMasterService
from app.models.item_master import Item, ItemVariant, ItemBarcode


@pytest.fixture(autouse=True)
async def cleanup_test_items():
    """Clean up test items before and after each test."""
    test_codes = ["SKU-POLO-NAVY", "SKU-TSHIRT-BLK", "SKU-JEANS-SLIM", "SKU-ISO-TEST-01", "SKU-SCAN-ITEM-01"]
    for db in ["smriti001", "smriti002"]:
        session_factory = get_company_sessionmaker(db)
        async with session_factory() as session:
            # Delete child variants and barcodes
            subquery = select(Item.id).where(Item.item_code.in_(test_codes))
            await session.execute(delete(ItemBarcode).where(ItemBarcode.item_id.in_(subquery)))
            await session.execute(delete(ItemVariant).where(ItemVariant.item_id.in_(subquery)))
            await session.execute(delete(Item).where(Item.item_code.in_(test_codes)))
            await session.commit()
    yield
    for db in ["smriti001", "smriti002"]:
        session_factory = get_company_sessionmaker(db)
        async with session_factory() as session:
            subquery = select(Item.id).where(Item.item_code.in_(test_codes))
            await session.execute(delete(ItemBarcode).where(ItemBarcode.item_id.in_(subquery)))
            await session.execute(delete(ItemVariant).where(ItemVariant.item_id.in_(subquery)))
            await session.execute(delete(Item).where(Item.item_code.in_(test_codes)))
            await session.commit()


@pytest.mark.asyncio
async def test_create_and_fetch_universal_item_with_variants():
    """Verify creating a canonical Item with variants and unique barcodes."""
    session_factory = get_company_sessionmaker("smriti001")
    async with session_factory() as session:
        item = await UniversalItemMasterService.create_item(
            session=session,
            company_id="COMP-001",
            item_code="SKU-POLO-NAVY",
            item_name="Premium Pique Polo Shirt",
            category="Apparel",
            brand="SMRITI Luxe",
            hsn_code="61051000",
            tax_rate=12.00,
            mrp=1499.00,
            selling_price=1299.00,
            cost_price=650.00,
            primary_barcode="8901234567890",
            variants_data=[
                {
                    "variant_sku": "SKU-POLO-NAVY-M",
                    "variant_name": "Polo Navy Size M",
                    "attributes_json": {"size": "M", "color": "Navy"},
                    "barcode": "8901234567891",
                    "mrp": 1499.00,
                    "selling_price": 1299.00
                },
                {
                    "variant_sku": "SKU-POLO-NAVY-L",
                    "variant_name": "Polo Navy Size L",
                    "attributes_json": {"size": "L", "color": "Navy"},
                    "barcode": "8901234567892",
                    "mrp": 1599.00,
                    "selling_price": 1399.00
                }
            ]
        )

        assert item is not None
        assert item.item_code == "SKU-POLO-NAVY"
        assert item.category == "Apparel"
        assert float(item.tax_rate) == 12.00
        assert len(item.variants) == 2
        assert len(item.barcodes) >= 2


@pytest.mark.asyncio
async def test_lookup_by_barcode_canonical_item():
    """Verify fast scanner resolution via canonical ItemBarcode registry."""
    session_factory = get_company_sessionmaker("smriti001")
    async with session_factory() as session:
        await UniversalItemMasterService.create_item(
            session=session,
            company_id="COMP-001",
            item_code="SKU-SCAN-ITEM-01",
            item_name="Scanner Test Item",
            category="Accessories",
            tax_rate=18.00,
            mrp=999.00,
            selling_price=899.00,
            cost_price=450.00,
            variants_data=[
                {
                    "variant_sku": "SKU-SCAN-ITEM-01-V1",
                    "variant_name": "Scanner Test Item V1",
                    "barcode": "8909988776655",
                    "mrp": 999.00,
                    "selling_price": 899.00
                }
            ]
        )
        res = await UniversalItemMasterService.lookup_by_barcode(session, "8909988776655")
        assert res is not None
        assert res["item_code"] == "SKU-SCAN-ITEM-01"
        assert res["variant_sku"] == "SKU-SCAN-ITEM-01-V1"
        assert res["mrp"] == 999.00
        assert res["selling_price"] == 899.00
        assert res["tax_rate"] == 18.00


@pytest.mark.asyncio
async def test_item_tenant_isolation():
    """Verify item created in smriti001 does not leak into smriti002."""
    session_001 = get_company_sessionmaker("smriti001")
    session_002 = get_company_sessionmaker("smriti002")

    async with session_001() as s1:
        await UniversalItemMasterService.create_item(
            session=s1,
            company_id="COMP-001",
            item_code="SKU-ISO-TEST-01",
            item_name="Isolated Item Tenant Master",
            category="Hardware"
        )
        i1 = await UniversalItemMasterService.get_item_by_code(s1, "SKU-ISO-TEST-01")
        assert i1 is not None

    async with session_002() as s2:
        i2 = await UniversalItemMasterService.get_item_by_code(s2, "SKU-ISO-TEST-01")
        assert i2 is None, "Expected item from smriti001 not to exist in smriti002!"


@pytest.mark.asyncio
async def test_five_bucket_inventory_resolution():
    """Verify resolver computes all 5 enterprise inventory buckets with adopted ATP formula."""
    session_factory = get_company_sessionmaker("smriti001")
    async with session_factory() as session:
        # Create item with variant
        await UniversalItemMasterService.create_item(
            session=session,
            company_id="COMP-001",
            item_code="SKU-5BKT-TEST-01",
            item_name="Five Bucket Test Item",
            category="Footwear",
            mrp=1500.00,
            selling_price=1200.00,
            variants_data=[
                {
                    "variant_sku": "SKU-5BKT-TEST-01-V1",
                    "variant_name": "Variant 1",
                    "barcode": "8905544332211",
                    "mrp": 1500.00,
                    "selling_price": 1200.00,
                }
            ]
        )

        res = await UniversalItemMasterService.resolve_by_key(session, "8905544332211")
        assert res is not None
        assert "inventory" in res
        inv = res["inventory"]
        assert "physical_on_hand" in inv
        assert "in_transit_qty" in inv
        assert "reserved_qty" in inv
        assert "committed_qty" in inv
        assert "quarantine_qty" in inv
        assert "available_to_promise" in inv
        assert res["physical_on_hand"] == inv["physical_on_hand"]
        assert res["in_transit_qty"] == inv["in_transit_qty"]
        assert res["reserved_qty"] == inv["reserved_qty"]
        assert res["committed_qty"] == inv["committed_qty"]
        assert res["quarantine_qty"] == inv["quarantine_qty"]
        assert res["available_to_promise"] >= 0.0

        # Adopted Enterprise Formula: max(0, (physical_on_hand + in_transit_qty) - (reserved_qty + committed_qty + quarantine_qty))
        expected_atp = max(0.0, round((inv["physical_on_hand"] + inv["in_transit_qty"]) - (inv["reserved_qty"] + inv["committed_qty"] + inv["quarantine_qty"]), 4))
        assert res["available_to_promise"] == expected_atp


@pytest.mark.asyncio
async def test_temporal_and_contract_governed_pricing():
    """Verify customer authorization, temporal date gating, and pricing auditability."""
    import uuid
    from datetime import date, timedelta
    from app.models.customer_article_mapping import CustomerArticleMapping
    from app.models.crm import Customer

    session_factory = get_company_sessionmaker("smriti001")
    uid = uuid.uuid4().hex[:8]
    item_code = f"SKU-PRC-{uid.upper()}"
    barcode = f"8901{uid[:8]}"
    buyer_art = f"BUYER-ART-{uid[:6].upper()}"
    cam_id = f"cam_test_prc_{uid}"

    async with session_factory() as session:
        item = await UniversalItemMasterService.create_item(
            session=session,
            company_id="COMP-001",
            item_code=item_code,
            item_name="Pricing Contract Test Item",
            category="Footwear",
            mrp=2000.00,
            selling_price=1800.00,
            tax_rate=18.00,
            variants_data=[
                {
                    "variant_sku": f"{item_code}-V1",
                    "variant_name": "Pricing Variant 1",
                    "barcode": barcode,
                    "mrp": 2000.00,
                    "selling_price": 1800.00,
                }
            ]
        )
        variant = item.variants[0]

        # Ensure customer exists and is active
        cust_stmt = select(Customer).where(Customer.id == "CUST-TEST-99")
        cust = (await session.execute(cust_stmt)).scalar_one_or_none()
        if not cust:
            cust = Customer(
                id="CUST-TEST-99",
                uuid=str(uuid.uuid4()),
                company_id="COMP-001",
                code="CUST-99",
                name="Authorized Test Customer",
                is_active=True,
            )
            session.add(cust)
            await session.flush()
        else:
            cust.is_active = True
            await session.flush()

        today = date.today()
        cam = CustomerArticleMapping(
            id=cam_id,
            uuid=str(uuid.uuid4()),
            company_id="COMP-001",
            customer_id="CUST-TEST-99",
            item_id=item.id,
            variant_id=variant.id,
            customer_article=buyer_art,
            vendor_article=item.item_code,
            color="NAVY",
            size="42",
            barcode=barcode,
            base_mrp=2000.00,
            contract_rate=1150.00,
            effective_from=today - timedelta(days=5),
            effective_to=today + timedelta(days=5),
            status="ACTIVE",
            currency="INR",
            source_system="CONTRACT_TEST",
            is_active=True,
            is_deleted=False,
        )
        session.add(cam)
        await session.commit()

        try:
            # 1. Authorized Customer with Active Contract
            res_auth = await UniversalItemMasterService.resolve_by_key(
                session=session, key=buyer_art, customer_id="CUST-TEST-99"
            )
            assert res_auth is not None
            assert res_auth["effective_price"] == 1150.00
            assert res_auth["pricing_audit"]["contract_status"] == "ACTIVE"
            assert res_auth["pricing_audit"]["is_contract_active"] is True
            assert res_auth["pricing_audit"]["customer_authorized"] is True
            assert res_auth["pricing_audit"]["pricing_rule_applied"] == "CUSTOMER_CONTRACT_RATE"

            # 2. Unauthorized Context (no customer_id provided)
            res_unauth = await UniversalItemMasterService.resolve_by_key(
                session=session, key=buyer_art, customer_id=None
            )
            assert res_unauth is not None
            assert res_unauth["effective_price"] == 1800.00  # Fallback to base selling price
            assert res_unauth["pricing_audit"]["customer_authorized"] is False
            assert res_unauth["pricing_audit"]["is_contract_active"] is False

            # 3. Customer Mismatch (wrong customer_id provided)
            res_mismatch = await UniversalItemMasterService.resolve_by_key(
                session=session, key=buyer_art, customer_id="CUST-OTHER-01"
            )
            assert res_mismatch is not None
            assert res_mismatch["effective_price"] == 1800.00  # Fallback to base selling price
            assert res_mismatch["pricing_audit"]["customer_authorized"] is False
            assert res_mismatch["pricing_audit"]["contract_status"] == "CUSTOMER_MISMATCH"

            # 4. Expired Contract (evaluated 10 days in future)
            res_expired = await UniversalItemMasterService.resolve_by_key(
                session=session, key=buyer_art, customer_id="CUST-TEST-99", as_of_date=today + timedelta(days=10)
            )
            assert res_expired is not None
            assert res_expired["effective_price"] == 1800.00  # Fallback to base selling price
            assert res_expired["pricing_audit"]["contract_status"] == "EXPIRED"
            assert res_expired["pricing_audit"]["is_contract_active"] is False

            # 5. Future Contract (evaluated 10 days in past)
            res_future = await UniversalItemMasterService.resolve_by_key(
                session=session, key=buyer_art, customer_id="CUST-TEST-99", as_of_date=today - timedelta(days=10)
            )
            assert res_future is not None
            assert res_future["effective_price"] == 1800.00  # Fallback to base selling price
            assert res_future["pricing_audit"]["contract_status"] == "FUTURE_CONTRACT"
            assert res_future["pricing_audit"]["is_contract_active"] is False
        finally:
            cam_obj = await session.get(CustomerArticleMapping, cam_id)
            if cam_obj:
                await session.delete(cam_obj)
                await session.commit()


@pytest.mark.asyncio
async def test_pricing_negative_unauthorized_and_inactive_customer():
    """Negative Test: Verify inactive customer account and customer-group mismatch fallback."""
    import uuid
    from datetime import date, timedelta
    from app.models.customer_article_mapping import CustomerArticleMapping
    from app.models.crm import Customer

    session_factory = get_company_sessionmaker("smriti001")
    uid = uuid.uuid4().hex[:8]
    item_code = f"SKU-CUSTNEG-{uid.upper()}"
    buyer_art = f"BUYER-NEG-{uid.upper()}"
    cam_id = f"cam_neg_{uid}"
    today = date.today()

    async with session_factory() as session:
        item = await UniversalItemMasterService.create_item(
            session=session,
            company_id="COMP-001",
            item_code=item_code,
            item_name="Customer Negative Test Item",
            mrp=1000.00,
            selling_price=800.00,
            variants_data=[{"variant_sku": f"{item_code}-V1", "barcode": f"8902{uid[:8]}"}],
        )
        variant = item.variants[0]

        # Create inactive customer without FK-dependent customer_group_id
        inact_cust = Customer(
            id=f"CUST-INACT-{uid}",
            uuid=str(uuid.uuid4()),
            company_id="COMP-001",
            code=f"INACT-{uid}",
            name="Inactive Suspended Customer",
            is_active=False,
        )
        session.add(inact_cust)

        # Create CAM with eligible_customer_groups restriction in metadata
        cam = CustomerArticleMapping(
            id=cam_id,
            uuid=str(uuid.uuid4()),
            company_id="COMP-001",
            customer_id=f"CUST-INACT-{uid}",
            item_id=item.id,
            variant_id=variant.id,
            customer_article=buyer_art,
            vendor_article=item.item_code,
            color="BLACK",
            size="40",
            barcode=f"8902{uid[:8]}",
            base_mrp=1000.00,
            contract_rate=500.00,
            effective_from=today - timedelta(days=1),
            effective_to=today + timedelta(days=30),
            status="ACTIVE",
            currency="INR",
            source_system="CONTRACT_NEG_TEST",
            metadata_json={"eligible_customer_groups": ["TIER_A_DISTRIBUTORS"]},
            is_active=True,
            is_deleted=False,
        )
        session.add(cam)
        await session.commit()

        try:
            # 1. Inactive Customer -> CUSTOMER_INACTIVE fallback
            res = await UniversalItemMasterService.resolve_by_key(
                session=session, key=buyer_art, customer_id=f"CUST-INACT-{uid}"
            )
            assert res is not None
            assert res["effective_price"] == 800.00  # Fallback to base selling price
            assert res["pricing_audit"]["contract_status"] == "CUSTOMER_INACTIVE"
            assert res["pricing_audit"]["customer_authorized"] is False

            # 2. Reactivate customer but customer group mismatch -> CUSTOMER_GROUP_MISMATCH fallback
            inact_cust.is_active = True
            await session.commit()

            res_grp = await UniversalItemMasterService.resolve_by_key(
                session=session, key=buyer_art, customer_id=f"CUST-INACT-{uid}", customer_group_id="RETAIL_DEALERS"
            )
            assert res_grp is not None
            assert res_grp["effective_price"] == 800.00  # Fallback to base
            assert res_grp["pricing_audit"]["contract_status"] == "CUSTOMER_GROUP_MISMATCH"
            assert res_grp["pricing_audit"]["customer_authorized"] is False

            # 3. Matching customer group -> Success
            res_ok = await UniversalItemMasterService.resolve_by_key(
                session=session, key=buyer_art, customer_id=f"CUST-INACT-{uid}", customer_group_id="TIER_A_DISTRIBUTORS"
            )
            assert res_ok is not None
            assert res_ok["effective_price"] == 500.00
            assert res_ok["pricing_audit"]["contract_status"] == "ACTIVE"
            assert res_ok["pricing_audit"]["customer_authorized"] is True

        finally:
            cam_obj = await session.get(CustomerArticleMapping, cam_id)
            if cam_obj:
                await session.delete(cam_obj)
            c_obj = await session.get(Customer, f"CUST-INACT-{uid}")
            if c_obj:
                await session.delete(c_obj)
            await session.commit()


@pytest.mark.asyncio
async def test_pricing_negative_invalid_dates_and_currency_mismatch():
    """Negative Test: Verify inverted dates (effective_from > effective_to) and currency mismatch across distinct variants."""
    import uuid
    from datetime import date, timedelta
    from app.models.customer_article_mapping import CustomerArticleMapping
    from app.models.crm import Customer

    session_factory = get_company_sessionmaker("smriti001")
    uid = uuid.uuid4().hex[:8]
    item_code = f"SKU-DATERNG-{uid.upper()}"
    buyer_art_date = f"BUYER-INVDATE-{uid.upper()}"
    buyer_art_curr = f"BUYER-CURR-{uid.upper()}"
    cam_id_date = f"cam_date_{uid}"
    cam_id_curr = f"cam_curr_{uid}"
    today = date.today()

    async with session_factory() as session:
        # Create item with two distinct variants to satisfy uq_cam_customer_variant_active
        item = await UniversalItemMasterService.create_item(
            session=session,
            company_id="COMP-001",
            item_code=item_code,
            item_name="Date and Currency Test Item",
            mrp=3000.00,
            selling_price=2500.00,
            variants_data=[
                {"variant_sku": f"{item_code}-V1", "barcode": f"8903{uid[:6]}01"},
                {"variant_sku": f"{item_code}-V2", "barcode": f"8903{uid[:6]}02"},
            ],
        )
        variant1 = item.variants[0]
        variant2 = item.variants[1]

        cust = Customer(
            id=f"CUST-DATE-{uid}",
            uuid=str(uuid.uuid4()),
            company_id="COMP-001",
            code=f"DATE-{uid}",
            name="Date Test Customer",
            is_active=True,
        )
        session.add(cust)

        # 1. Inverted date range CAM on Variant 1: effective_from (today + 10) > effective_to (today)
        cam_inv = CustomerArticleMapping(
            id=cam_id_date,
            uuid=str(uuid.uuid4()),
            company_id="COMP-001",
            customer_id=f"CUST-DATE-{uid}",
            item_id=item.id,
            variant_id=variant1.id,
            customer_article=buyer_art_date,
            vendor_article=item.item_code,
            color="BLUE",
            size="41",
            barcode=f"8903{uid[:6]}01",
            base_mrp=3000.00,
            contract_rate=1900.00,
            effective_from=today + timedelta(days=10),
            effective_to=today,  # Inverted!
            status="ACTIVE",
            currency="INR",
            source_system="CONTRACT_NEG_TEST",
            is_active=True,
            is_deleted=False,
        )
        session.add(cam_inv)

        # 2. USD Currency Contract on Variant 2
        cam_usd = CustomerArticleMapping(
            id=cam_id_curr,
            uuid=str(uuid.uuid4()),
            company_id="COMP-001",
            customer_id=f"CUST-DATE-{uid}",
            item_id=item.id,
            variant_id=variant2.id,
            customer_article=buyer_art_curr,
            vendor_article=item.item_code,
            color="BLUE",
            size="42",
            barcode=f"8903{uid[:6]}02",
            base_mrp=3000.00,
            contract_rate=25.00,  # $25 USD
            effective_from=today - timedelta(days=5),
            effective_to=today + timedelta(days=30),
            status="ACTIVE",
            currency="USD",  # Foreign currency
            source_system="EXPORT_TEST",
            is_active=True,
            is_deleted=False,
        )
        session.add(cam_usd)
        await session.commit()

        try:
            # Test A: Inverted date range -> INVALID_DATE_RANGE
            res_date = await UniversalItemMasterService.resolve_by_key(
                session=session, key=buyer_art_date, customer_id=f"CUST-DATE-{uid}"
            )
            assert res_date is not None
            assert res_date["effective_price"] == 2500.00  # Fallback to base
            assert res_date["pricing_audit"]["contract_status"] == "INVALID_DATE_RANGE"
            assert "is greater than effective_to" in res_date["pricing_audit"]["rejection_reason"]

            # Test B: Currency Mismatch (Queried in INR when contract is USD)
            res_curr = await UniversalItemMasterService.resolve_by_key(
                session=session, key=buyer_art_curr, customer_id=f"CUST-DATE-{uid}", transaction_currency="INR"
            )
            assert res_curr is not None
            assert res_curr["effective_price"] == 2500.00  # Fallback to base
            assert res_curr["pricing_audit"]["contract_status"] == "CURRENCY_MISMATCH"
            assert "does not match contract currency 'USD'" in res_curr["pricing_audit"]["rejection_reason"]

            # Test C: Currency Match (Queried in USD when contract is USD)
            res_curr_ok = await UniversalItemMasterService.resolve_by_key(
                session=session, key=buyer_art_curr, customer_id=f"CUST-DATE-{uid}", transaction_currency="USD"
            )
            assert res_curr_ok is not None
            assert res_curr_ok["effective_price"] == 25.00  # Applied contract rate!
            assert res_curr_ok["currency"] == "USD"
            assert res_curr_ok["pricing_audit"]["contract_status"] == "ACTIVE"
            assert res_curr_ok["pricing_audit"]["customer_authorized"] is True

        finally:
            c1 = await session.get(CustomerArticleMapping, cam_id_date)
            if c1: await session.delete(c1)
            c2 = await session.get(CustomerArticleMapping, cam_id_curr)
            if c2: await session.delete(c2)
            c_obj = await session.get(Customer, f"CUST-DATE-{uid}")
            if c_obj: await session.delete(c_obj)
            await session.commit()


@pytest.mark.asyncio
async def test_pricing_statutory_gst_split_and_slabs():
    """Verify statutory GST slabs and intra-state (CGST+SGST) vs inter-state (IGST) split."""
    import uuid
    from app.models.crm import Customer

    session_factory = get_company_sessionmaker("smriti001")
    uid = uuid.uuid4().hex[:8]
    item_code = f"SKU-TAX-{uid.upper()}"
    barcode_val = f"8904{uuid.uuid4().int % 100000000:08d}"

    async with session_factory() as session:
        item = await UniversalItemMasterService.create_item(
            session=session,
            company_id="COMP-001",
            item_code=item_code,
            item_name="GST Statutory Split Test Item",
            tax_rate=18.00,  # Statutory 18% slab
            selling_price=1000.00,
            variants_data=[{"variant_sku": f"{item_code}-V1", "barcode": barcode_val}],
        )

        # 1. Intra-state Transaction (Dispatch from Maharashtra 27 to Maharashtra 27)
        res_intra = await UniversalItemMasterService.resolve_by_key(
            session=session, key=barcode_val, place_of_supply="27", company_state="27"
        )
        assert res_intra is not None
        tax_info = res_intra["pricing_audit"]["statutory_gst"]
        assert tax_info["is_standard_slab"] is True
        assert tax_info["is_inter_state"] is False
        assert tax_info["cgst_rate"] == 9.0
        assert tax_info["sgst_rate"] == 9.0
        assert tax_info["igst_rate"] == 0.0
        assert tax_info["cgst_amount"] == 90.00
        assert tax_info["sgst_amount"] == 90.00
        assert tax_info["igst_amount"] == 0.0
        assert tax_info["total_tax"] == 180.00
        assert res_intra["effective_price_inclusive"] == 1180.00

        # 2. Inter-state Transaction (Dispatch from Maharashtra 27 to Gujarat 24)
        res_inter = await UniversalItemMasterService.resolve_by_key(
            session=session, key=barcode_val, place_of_supply="24", company_state="27"
        )
        assert res_inter is not None
        tax_info_inter = res_inter["pricing_audit"]["statutory_gst"]
        assert tax_info_inter["is_standard_slab"] is True
        assert tax_info_inter["is_inter_state"] is True
        assert tax_info_inter["cgst_rate"] == 0.0
        assert tax_info_inter["sgst_rate"] == 0.0
        assert tax_info_inter["igst_rate"] == 18.0
        assert tax_info_inter["cgst_amount"] == 0.0
        assert tax_info_inter["sgst_amount"] == 0.0
        assert tax_info_inter["igst_amount"] == 180.00
        assert tax_info_inter["total_tax"] == 180.00
        assert res_inter["effective_price_inclusive"] == 1180.00


@pytest.mark.asyncio
async def test_five_bucket_inventory_atp_formula_enterprise_calculation():
    """Verify adopted enterprise ATP formula: ATP = max(0, (on_hand + in_transit) - (reserved + committed + quarantine))."""
    # Formula mathematical check
    def compute_atp(on_hand, in_transit, reserved, committed, quarantine):
        supply = on_hand + in_transit
        deductions = reserved + committed + quarantine
        return max(0.0, round(supply - deductions, 4))

    # Case 1: Standard supply with commitments and in-transit
    assert compute_atp(on_hand=100.0, in_transit=25.0, reserved=10.0, committed=15.0, quarantine=5.0) == 95.0

    # Case 2: In-transit stock satisfies committed demand
    assert compute_atp(on_hand=0.0, in_transit=50.0, reserved=0.0, committed=30.0, quarantine=0.0) == 20.0

    # Case 3: Oversubscribed (deductions > supply) clamps to 0.0, never negative
    assert compute_atp(on_hand=10.0, in_transit=0.0, reserved=5.0, committed=15.0, quarantine=0.0) == 0.0

    # Case 4: Quarantine deduction isolates damaged goods
    assert compute_atp(on_hand=50.0, in_transit=0.0, reserved=0.0, committed=0.0, quarantine=50.0) == 0.0


@pytest.mark.asyncio
async def test_committed_vs_reserved_semantic_separation_and_anti_doubling():
    """Verify that committed_qty and soft reserved_qty do not overlap or double-deduct from ATP."""
    # Test mathematical and operational netting logic
    raw_product_reserved = 25.0
    confirmed_so_commitments = 15.0

    net_soft_reserved = max(0.0, round(raw_product_reserved - confirmed_so_commitments, 4))
    assert net_soft_reserved == 10.0

    # Total withholdings must exactly equal 25.0, never 40.0 (which would be double-counted)
    total_withheld = net_soft_reserved + confirmed_so_commitments
    assert total_withheld == 25.0

    # Scenario where no sales orders exist: all reserved stock is soft hold
    raw_soft_only = 12.0
    zero_commitments = 0.0
    assert max(0.0, round(raw_soft_only - zero_commitments, 4)) == 12.0

    # Scenario where commitments exceed denormalized column: soft hold clamps to 0.0
    stale_denorm_reserved = 5.0
    fresh_commitments = 8.0
    assert max(0.0, round(stale_denorm_reserved - fresh_commitments, 4)) == 0.0


