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
import pytest
from httpx import AsyncClient, ASGITransport

from app.main import app
from app.db.session import get_company_sessionmaker
from app.core.security import create_access_token
from app.services.item_master_svc import UniversalItemMasterService
from app.schemas.item_master import (
    ItemCreateRequest,
    ItemVariantItem,
    ItemBarcodeItem,
    ItemBatchItem,
    ItemSerialItem,
    ItemLocationItem,
    MatrixVariantGenRequest,
    MatrixVariantDimension,
)


def _get_auth_headers(role: str = "SYSADMIN") -> dict:
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
async def test_create_item_with_variants_and_barcodes():
    """Verify atomic creation of item with custom variants and primary barcodes."""
    sessionmaker = get_company_sessionmaker("smriti001")
    unique_suffix = uuid.uuid4().hex[:6]
    sku = f"ITM-{unique_suffix.upper()}"
    barcode_val = f"890{uuid.uuid4().int % 10000000000:010d}"

    req = ItemCreateRequest(
        item_code=sku,
        item_name=f"Premium Linen Shirt {unique_suffix}",
        item_type="FINISHED_GOOD",
        category="APPAREL",
        brand="Smriti Classic",
        hsn_code="6205",
        tax_rate=12.0,
        primary_uom="PCS",
        mrp=1999.0,
        selling_price=1499.0,
        cost_price=750.0,
        is_batch_tracked=False,
        is_serial_tracked=False,
        tags=["APPAREL", "SUMMER", "MEN"],
        variants=[
            ItemVariantItem(
                variant_sku=f"{sku}-M",
                variant_name=f"Premium Linen Shirt {unique_suffix} (Medium)",
                attributes_json={"size": "M", "color": "White"},
                mrp=1999.0,
                selling_price=1499.0,
                cost_price=750.0,
                barcodes=[
                    ItemBarcodeItem(barcode=barcode_val, barcode_type="EAN13", is_primary=True)
                ],
            )
        ],
        locations=[
            ItemLocationItem(
                warehouse_id="WH-MAIN",
                location_bin="AISLE-3-SHELF-2",
                min_reorder_level=10.0,
                max_capacity=100.0,
                reorder_quantity=25.0,
            )
        ],
    )

    async with sessionmaker() as session:
        item = await UniversalItemMasterService.create_item(session, req)
        assert item is not None
        assert item.item_code == sku
        assert item.category == "APPAREL"
        assert item.tax_rate == 12.0
        assert len(item.variants) >= 1
        assert item.variants[0].variant_sku == f"{sku}-M"
        assert len(item.variants[0].barcodes) == 1
        assert item.variants[0].barcodes[0].barcode == barcode_val
        assert len(item.locations) == 1
        assert item.locations[0].location_bin == "AISLE-3-SHELF-2"


@pytest.mark.asyncio
async def test_matrix_variant_generator_cartesian():
    """Verify matrix variant generator produces Cartesian product of dimensions."""
    sessionmaker = get_company_sessionmaker("smriti001")
    unique_suffix = uuid.uuid4().hex[:6]
    sku = f"POLO-{unique_suffix.upper()}"

    # 1. Create base item
    req = ItemCreateRequest(
        item_code=sku,
        item_name=f"Polo T-Shirt {unique_suffix}",
        category="APPAREL",
        brand="Smriti Sport",
        tax_rate=18.0,
        mrp=999.0,
        selling_price=799.0,
        cost_price=350.0,
    )

    async with sessionmaker() as session:
        item = await UniversalItemMasterService.create_item(session, req)

        # 2. Generate 3 Sizes x 2 Colors = 6 Variants
        gen_req = MatrixVariantGenRequest(
            dimensions=[
                MatrixVariantDimension(dimension_name="size", values=["S", "M", "L"]),
                MatrixVariantDimension(dimension_name="color", values=["Navy", "Black"]),
            ],
            base_mrp=999.0,
            base_selling_price=799.0,
            base_cost_price=350.0,
            auto_generate_barcodes=True,
        )

        variants = await UniversalItemMasterService.generate_matrix_variants(session, item.id, gen_req)
        assert len(variants) == 6

        skus = [v.variant_sku for v in variants]
        assert f"{sku}-S-NAVY" in skus
        assert f"{sku}-M-BLACK" in skus
        assert f"{sku}-L-NAVY" in skus

        # Reload item and verify
        reloaded = await UniversalItemMasterService.get_item_by_id(session, item.id)
        assert len(reloaded.variants) >= 6


@pytest.mark.asyncio
async def test_fast_4_tier_scanner_resolver():
    """Verify fast 4-tier scanner resolution: Barcode -> Variant SKU -> Item Code -> Serial."""
    sessionmaker = get_company_sessionmaker("smriti001")
    unique_suffix = uuid.uuid4().hex[:6]
    sku = f"PHN-{unique_suffix.upper()}"
    barcode_val = f"890{uuid.uuid4().int % 10000000000:010d}"
    serial_val = f"IMEI-{uuid.uuid4().hex[:12].upper()}"

    req = ItemCreateRequest(
        item_code=sku,
        item_name=f"Smartphone X {unique_suffix}",
        category="ELECTRONICS",
        brand="TechPro",
        tax_rate=18.0,
        mrp=49999.0,
        selling_price=44999.0,
        cost_price=35000.0,
        is_serial_tracked=True,
        variants=[
            ItemVariantItem(
                variant_sku=f"{sku}-128GB",
                variant_name=f"Smartphone X {unique_suffix} (128GB)",
                attributes_json={"storage": "128GB", "color": "Midnight"},
                mrp=49999.0,
                selling_price=44999.0,
                cost_price=35000.0,
                barcodes=[
                    ItemBarcodeItem(barcode=barcode_val, barcode_type="EAN13", is_primary=True)
                ],
            )
        ],
    )

    async with sessionmaker() as session:
        item = await UniversalItemMasterService.create_item(session, req)

        # Register Serial
        await UniversalItemMasterService.register_serial_numbers(
            session,
            item.id,
            [
                ItemSerialItem(
                    variant_id=item.variants[0].id,
                    serial_number=serial_val,
                    status="AVAILABLE",
                    warehouse_id="WH-ELEC",
                )
            ],
        )

        # 1. Resolve by Barcode
        res_bc = await UniversalItemMasterService.resolve_item_by_barcode_or_sku(session, barcode_val)
        assert res_bc is not None
        assert res_bc.matched_by == "BARCODE"
        assert res_bc.item_code == sku
        assert res_bc.barcode == barcode_val
        assert res_bc.selling_price == 44999.0

        # 2. Resolve by Variant SKU
        res_sku = await UniversalItemMasterService.resolve_item_by_barcode_or_sku(session, f"{sku}-128GB")
        assert res_sku is not None
        assert res_sku.matched_by == "VARIANT_SKU"
        assert res_sku.variant_sku == f"{sku}-128GB"

        # 3. Resolve by Item Code
        res_itm = await UniversalItemMasterService.resolve_item_by_barcode_or_sku(session, sku)
        assert res_itm is not None
        assert res_itm.matched_by == "ITEM_CODE"
        assert res_itm.item_id == item.id

        # 4. Resolve by Serial Number
        res_ser = await UniversalItemMasterService.resolve_item_by_barcode_or_sku(session, serial_val)
        assert res_ser is not None
        assert res_ser.matched_by == "SERIAL"
        assert res_ser.serial_number == serial_val


@pytest.mark.asyncio
async def test_batch_registration_and_tracking():
    """Verify batch creation with expiration and MRP tracking for pharma/grocery items."""
    sessionmaker = get_company_sessionmaker("smriti001")
    unique_suffix = uuid.uuid4().hex[:6]
    sku = f"MED-{unique_suffix.upper()}"
    batch_no = f"BAT-{uuid.uuid4().hex[:8].upper()}"

    req = ItemCreateRequest(
        item_code=sku,
        item_name=f"Paracetamol 650mg {unique_suffix}",
        category="PHARMA",
        brand="HealthCare",
        tax_rate=12.0,
        mrp=45.0,
        selling_price=40.0,
        cost_price=22.0,
        is_batch_tracked=True,
    )

    async with sessionmaker() as session:
        item = await UniversalItemMasterService.create_item(session, req)

        batch = await UniversalItemMasterService.create_batch(
            session,
            item.id,
            ItemBatchItem(
                batch_number=batch_no,
                mrp=45.0,
                cost_price=22.0,
                is_active=True,
            ),
        )
        assert batch is not None
        assert batch.batch_number == batch_no

        reloaded = await UniversalItemMasterService.get_item_by_id(session, item.id)
        assert len(reloaded.batches) == 1
        assert reloaded.batches[0].batch_number == batch_no


@pytest.mark.asyncio
async def test_legacy_product_adapter():
    """Verify backward-compatible adapter presents Universal Item as legacy Product object."""
    sessionmaker = get_company_sessionmaker("smriti001")
    unique_suffix = uuid.uuid4().hex[:6]
    sku = f"PROD-{unique_suffix.upper()}"

    req = ItemCreateRequest(
        item_code=sku,
        item_name=f"Organic Tea Leaves {unique_suffix}",
        category="GROCERY",
        brand="NatureHarvest",
        hsn_code="0902",
        tax_rate=5.0,
        primary_uom="KG",
        mrp=350.0,
        selling_price=300.0,
        cost_price=180.0,
    )

    async with sessionmaker() as session:
        item = await UniversalItemMasterService.create_item(session, req)

        adapter_view = await UniversalItemMasterService.get_legacy_product_view(session, item.id)
        assert adapter_view is not None
        assert adapter_view.sku == sku
        assert adapter_view.name == f"Organic Tea Leaves {unique_suffix}"
        assert adapter_view.price == 300.0
        assert adapter_view.cost == 180.0
        assert adapter_view.tax_rate == 5.0
        assert adapter_view.uom == "KG"
        assert adapter_view.is_active is True


@pytest.mark.asyncio
async def test_api_item_endpoints():
    """Verify REST API endpoints for listing, creating, matrix generation, and barcode resolver."""
    unique_suffix = uuid.uuid4().hex[:4]
    sku = f"ITM-API-{unique_suffix.upper()}"
    barcode_val = f"890{uuid.uuid4().int % 10000000000:010d}"

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Create Item via API
        create_res = await client.post(
            "/api/v1/universal/items",
            json={
                "item_code": sku,
                "item_name": f"API Test Cotton Polo {unique_suffix}",
                "category": "APPAREL",
                "brand": "Smriti API",
                "hsn_code": "6105",
                "tax_rate": 12.0,
                "primary_uom": "PCS",
                "mrp": 1299.0,
                "selling_price": 999.0,
                "cost_price": 450.0,
                "barcodes": [
                    {"barcode": barcode_val, "barcode_type": "EAN13", "is_primary": True}
                ],
            },
            headers=_get_auth_headers(),
        )
        assert create_res.status_code == 201
        created_data = create_res.json()
        item_id = created_data["id"]
        assert created_data["item_code"] == sku

        # 2. Get Item Details
        get_res = await client.get(
            f"/api/v1/universal/items/{item_id}",
            headers=_get_auth_headers(),
        )
        assert get_res.status_code == 200
        assert get_res.json()["item_name"] == f"API Test Cotton Polo {unique_suffix}"

        # 3. Resolve via Barcode Scanner endpoint
        resolve_res = await client.get(
            f"/api/v1/universal/items/resolve?query={barcode_val}",
            headers=_get_auth_headers(),
        )
        assert resolve_res.status_code == 200
        resolve_data = resolve_res.json()
        assert resolve_data["matched_by"] == "BARCODE"
        assert resolve_data["item_id"] == item_id

        # 4. Generate Matrix Variants
        matrix_res = await client.post(
            f"/api/v1/universal/items/{item_id}/variants/matrix",
            json={
                "dimensions": [
                    {"dimension_name": "size", "values": ["S", "M"]},
                    {"dimension_name": "color", "values": ["Blue", "Red"]},
                ],
                "base_mrp": 1299.0,
                "base_selling_price": 999.0,
                "auto_generate_barcodes": True,
            },
            headers=_get_auth_headers(),
        )
        assert matrix_res.status_code == 200
        assert matrix_res.json()["variants_created"] == 4

        # 5. Legacy Product Adapter View
        adapter_res = await client.get(
            f"/api/v1/universal/items/{item_id}/adapter/product",
            headers=_get_auth_headers(),
        )
        assert adapter_res.status_code == 200
        assert adapter_res.json()["sku"] == sku
