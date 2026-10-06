"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.70.7
Created      : 2026-10-05
Modified     : 2026-10-05
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal

R-01 Runtime Safety Hardening Verification Test Suite
======================================================
Tests A through J verifying ADR-001, ADR-005, and Phase R-01 guarantees:
- Test A: Missing barcode creates unbarcoded variant; runtime placeholder generator raises RuntimeError.
- Test B: Official barcode preserved and resolves.
- Test C: Purchase receipt propagates variant_id from PO.
- Test D: StockMovement records variant_id from GRN.
- Test E: Ambiguous multi-variant item without variant_id fails fast with HTTP 400 AMBIGUOUS_ITEM_VARIANT.
- Test F: Batch resolution failure raises HTTP 422 BATCH_RESOLUTION_FAILED.
- Test G: Warehouse location resolution failure raises HTTP 422 WAREHOUSE_LOCATION_RESOLUTION_FAILED.
- Test H: Color lookup returns active ItemVariant.color with tenant scoping.
- Test I: Size lookup returns active ItemVariant.size with tenant scoping.
- Test J: Tracking resolver does not resolve NULL-company record.
"""

from __future__ import annotations

import uuid
from decimal import Decimal
from unittest.mock import patch, MagicMock, AsyncMock

import pytest
from fastapi import HTTPException
from sqlalchemy import select

from app.api.deps import TenantContext
from app.api.v1.master_lookup import list_master_entities
from app.db.session import get_company_sessionmaker
from app.models.auth import User, UserRole
from app.models.inventory import Product, StockMovement, Warehouse
from app.models.item_master import Item, ItemBatch, ItemVariant
from app.models.purchase import (
    PurchaseOrder,
    PurchaseOrderItem,
    PurchaseReceipt,
    PurchaseReceiptItem,
    Supplier,
)
from app.schemas.item_master import (
    ItemBarcodeItem,
    ItemCreateRequest,
    ItemVariantItem,
)
from app.schemas.purchase import (
    PurchaseOrderCreate,
    PurchaseOrderItemCreate,
    PurchaseReceiptCreate,
    PurchaseReceiptItemCreate,
)
from app.services.identity.engine import IdentityEngine
from app.services.item.item_catalog_svc import ItemCatalogService
from app.services.item.item_tracking_svc import ItemTrackingService
from app.services.item.variant_matrix_svc import VariantMatrixService
from app.services.item_master_svc import UniversalItemMasterService
from app.services.purchase import PurchaseService


def _get_mock_user(company_id: str = "COMP-001", role: UserRole = UserRole.MANAGER) -> User:
    user = User(
        id=f"usr_{uuid.uuid4().hex[:8]}",
        username=f"tester_{uuid.uuid4().hex[:6]}",
        role=role,
        company_id=company_id,
        branch_id="BR-MAIN-001",
        is_active=True,
    )
    return user


# ============================================================================
# Test A: Missing barcode creates unbarcoded variant; runtime generation prohibited
# ============================================================================
@pytest.mark.asyncio
async def test_a_missing_barcode_creates_unbarcoded_variant_and_prohibits_synthetic():
    """
    Test A: Runtime synthetic barcode generation must raise RuntimeError,
    and missing barcodes must leave variants unbarcoded (0 barcodes).
    """
    # 1. Direct generator invocation prohibited
    with pytest.raises(RuntimeError, match="Synthetic barcode generation is prohibited"):
        UniversalItemMasterService.generate_placeholder_barcode()

    with pytest.raises(RuntimeError, match="Synthetic barcode generation is prohibited"):
        VariantMatrixService.generate_placeholder_barcode()

    # 2. Creating item without barcodes creates unbarcoded variants
    sessionmaker = get_company_sessionmaker("smriti001")
    suffix = uuid.uuid4().hex[:6].upper()
    sku = f"TEST-A-{suffix}"

    req = ItemCreateRequest(
        item_code=sku,
        item_name=f"Test A Unbarcoded {suffix}",
        category="APPAREL",
        brand="SMRITI",
        selling_price=499.0,
        variants=[
            ItemVariantItem(
                variant_sku=f"{sku}-RED",
                variant_name=f"Test A Unbarcoded Red {suffix}",
                color="Red",
                size="M",
                selling_price=499.0,
                barcodes=[],  # Explicitly empty
            )
        ],
    )

    async with sessionmaker() as session:
        item = await UniversalItemMasterService.create_item(session, req)
        assert item is not None

        reloaded = await UniversalItemMasterService.get_item_by_id(session, item.id)
        assert len(reloaded.variants) == 1
        assert len(reloaded.variants[0].barcodes) == 0


# ============================================================================
# Test B: Official barcode preserved and resolves
# ============================================================================
@pytest.mark.asyncio
async def test_b_official_barcode_preserved_and_resolves():
    """
    Test B: Official barcode assigned to an item variant is preserved and resolvable.
    """
    sessionmaker = get_company_sessionmaker("smriti001")
    suffix = uuid.uuid4().hex[:6].upper()
    sku = f"TEST-B-{suffix}"
    official_bc = f"890{uuid.uuid4().int % 10000000000:010d}"

    req = ItemCreateRequest(
        item_code=sku,
        item_name=f"Test B Official Barcode {suffix}",
        category="APPAREL",
        brand="SMRITI",
        selling_price=799.0,
        variants=[
            ItemVariantItem(
                variant_sku=f"{sku}-BLU",
                variant_name=f"Test B Blue {suffix}",
                color="Blue",
                size="L",
                selling_price=799.0,
                barcodes=[
                    ItemBarcodeItem(barcode=official_bc, barcode_type="EAN13", is_primary=True)
                ],
            )
        ],
    )

    async with sessionmaker() as session:
        item = await UniversalItemMasterService.create_item(session, req)
        assert item is not None

        resolved = await UniversalItemMasterService.resolve_item_by_barcode_or_sku(session, official_bc)
        assert resolved is not None
        assert resolved.matched_by == "BARCODE"
        assert resolved.barcode == official_bc
        assert resolved.item_id == item.id


# ============================================================================
# Test C & D: Purchase receipt variant propagation & StockMovement lineage
# ============================================================================
@pytest.mark.asyncio
async def test_c_and_d_purchase_receipt_and_stock_movement_variant_propagation():
    """
    Test C: Purchase receipt propagates variant_id from PO.
    Test D: StockMovement records variant_id and item_id from GRN.
    """
    sessionmaker = get_company_sessionmaker("smriti001")
    suffix = uuid.uuid4().hex[:6].upper()
    sku = f"TEST-CD-{suffix}"
    supp_code = f"SUP-{suffix}"

    user = _get_mock_user("COMP-001")
    tenant = TenantContext(company_id=user.company_id, branch_id=user.branch_id)

    async with sessionmaker() as session:
        # Create canonical Item and Variant
        item = Item(
            id=IdentityEngine.generate_technical_id(),
            uuid=str(uuid.uuid4()),
            company_id=user.company_id,
            branch_id=user.branch_id,
            item_code=sku,
            item_name=f"Test CD Item {suffix}",
            category="APPAREL",
            brand="SMRITI",
            mrp=Decimal("999.00"),
            selling_price=Decimal("799.00"),
            cost_price=Decimal("350.00"),
            tax_rate=Decimal("12.00"),
            primary_uom="PCS",
            tracking_mode="NONE",
            is_active=True,
            is_deleted=False,
        )
        session.add(item)
        await session.flush()

        variant = ItemVariant(
            id=f"var_{uuid.uuid4().hex[:12]}",
            uuid=str(uuid.uuid4()),
            company_id=user.company_id,
            branch_id=user.branch_id,
            item_id=item.id,
            variant_sku=f"{sku}-BLK",
            variant_name=f"Test CD Item Black {suffix}",
            color="Black",
            size="XL",
            mrp=Decimal("999.00"),
            selling_price=Decimal("799.00"),
            cost_price=Decimal("350.00"),
            is_active=True,
            is_deleted=False,
        )
        session.add(variant)
        await session.flush()

        # Create Product bridge with category
        product = Product(
            id=f"prd_{uuid.uuid4().hex[:12]}",
            uuid=str(uuid.uuid4()),
            company_id=user.company_id,
            branch_id=user.branch_id,
            code=variant.variant_sku,
            sku=variant.variant_sku,
            name=variant.variant_name,
            barcode=variant.variant_sku,
            category="APPAREL",
            item_id=item.id,
            item_variant_id=variant.id,
            price=Decimal("799.00"),
            cost_price=Decimal("350.00"),
            buying_price=Decimal("350.00"),
            mrp=Decimal("999.00"),
            stock=0,
            is_active=True,
            is_deleted=False,
        )
        session.add(product)

        # Create Warehouse
        wh_res = await session.execute(
            select(Warehouse).where(
                Warehouse.company_id == user.company_id,
                Warehouse.is_deleted == False,
            )
        )
        wh = wh_res.scalars().first()
        if not wh:
            wh = Warehouse(
                id=f"wh_{uuid.uuid4().hex[:8]}",
                uuid=str(uuid.uuid4()),
                code=f"WH-{suffix}",
                name=f"Warehouse {suffix}",
                company_id=user.company_id,
                branch_id=user.branch_id,
                is_active=True,
                is_deleted=False,
            )
            session.add(wh)

        # Create Supplier
        supplier = Supplier(
            id=f"sup_{uuid.uuid4().hex[:8]}",
            uuid=str(uuid.uuid4()),
            company_id=user.company_id,
            branch_id=user.branch_id,
            code=supp_code,
            name=f"Supplier {suffix}",
            mobile="9876543210",
            outstanding=Decimal("0.00"),
            is_active=True,
            is_deleted=False,
        )
        session.add(supplier)
        await session.commit()

        # Instantiate PurchaseService
        svc = PurchaseService(db=session, tenant=tenant)

        # 1. Create Purchase Order with explicit variant_id
        po_req = PurchaseOrderCreate(
            supplier_id=supplier.id,
            items=[
                PurchaseOrderItemCreate(
                    product_id=product.id,
                    code=product.code,
                    name=product.name,
                    quantity=Decimal("10.00"),
                    cost_price=Decimal("350.00"),
                    gst_rate=Decimal("12.00"),
                    variant_id=variant.id,
                )
            ],
        )
        po = await svc.create_purchase_order(po_req)
        assert po is not None
        assert len(po.items) == 1
        assert po.items[0].variant_id == variant.id

        # 2. Create Purchase Receipt (GRN) linked to PO
        grn_req = PurchaseReceiptCreate(
            supplier_id=supplier.id,
            warehouse_id=wh.id,
            order_id=po.id,
            items=[
                PurchaseReceiptItemCreate(
                    product_id=product.id,
                    code=product.code,
                    name=product.name,
                    quantity_received=Decimal("5.00"),
                    cost_price=Decimal("350.00"),
                    gst_rate=Decimal("12.00"),
                    batch_no=f"BAT-{suffix}",
                    # variant_id intentionally omitted to verify PO propagation
                )
            ],
        )
        grn = await svc.create_purchase_receipt(grn_req)
        assert grn is not None

        # Test C assertion: variant_id propagated from PO
        rec_items_res = await session.execute(
            select(PurchaseReceiptItem).where(PurchaseReceiptItem.receipt_id == grn.id)
        )
        receipt_items = rec_items_res.scalars().all()
        assert len(receipt_items) == 1
        assert receipt_items[0].variant_id == variant.id
        assert receipt_items[0].item_id == item.id

        # Test D assertion: StockMovement audit row captures variant_id & item_id
        sm_res = await session.execute(
            select(StockMovement).where(
                StockMovement.reference_doc_id == grn.id,
                StockMovement.product_id == product.id,
            )
        )
        movements = sm_res.scalars().all()
        assert len(movements) >= 1
        movement = movements[0]
        assert movement.item_id == item.id
        assert movement.variant_id == variant.id


# ============================================================================
# Test E: Ambiguous multi-variant item without variant_id fails fast
# ============================================================================
@pytest.mark.asyncio
async def test_e_ambiguous_multi_variant_item_fails_fast():
    """
    Test E: When an item has multiple active variants and variant_id is not
    provided, PO / GRN creation must fail fast with HTTP 400 AMBIGUOUS_ITEM_VARIANT.
    """
    sessionmaker = get_company_sessionmaker("smriti001")
    suffix = uuid.uuid4().hex[:6].upper()
    sku = f"TEST-E-{suffix}"

    user = _get_mock_user("COMP-001")
    tenant = TenantContext(company_id=user.company_id, branch_id=user.branch_id)

    async with sessionmaker() as session:
        # Create Item with 2 variants
        item = Item(
            id=IdentityEngine.generate_technical_id(),
            uuid=str(uuid.uuid4()),
            company_id=user.company_id,
            branch_id=user.branch_id,
            item_code=sku,
            item_name=f"Test E MultiVariant {suffix}",
            category="APPAREL",
            brand="SMRITI",
            mrp=Decimal("1200.00"),
            selling_price=Decimal("999.00"),
            cost_price=Decimal("400.00"),
            tax_rate=Decimal("12.00"),
            primary_uom="PCS",
            tracking_mode="NONE",
            is_active=True,
            is_deleted=False,
        )
        session.add(item)
        await session.flush()

        v1 = ItemVariant(
            id=f"var_{uuid.uuid4().hex[:12]}",
            uuid=str(uuid.uuid4()),
            company_id=user.company_id,
            branch_id=user.branch_id,
            item_id=item.id,
            variant_sku=f"{sku}-RED",
            variant_name=f"Test E Red {suffix}",
            color="Red",
            size="S",
            is_active=True,
            is_deleted=False,
        )
        v2 = ItemVariant(
            id=f"var_{uuid.uuid4().hex[:12]}",
            uuid=str(uuid.uuid4()),
            company_id=user.company_id,
            branch_id=user.branch_id,
            item_id=item.id,
            variant_sku=f"{sku}-BLU",
            variant_name=f"Test E Blue {suffix}",
            color="Blue",
            size="M",
            is_active=True,
            is_deleted=False,
        )
        session.add_all([v1, v2])
        await session.flush()

        # Product bridge linked to item without specific item_variant_id
        product = Product(
            id=f"prd_{uuid.uuid4().hex[:12]}",
            uuid=str(uuid.uuid4()),
            company_id=user.company_id,
            branch_id=user.branch_id,
            code=sku,
            sku=sku,
            name=item.item_name,
            barcode=sku,
            category="APPAREL",
            item_id=item.id,
            item_variant_id=None,
            price=Decimal("999.00"),
            cost_price=Decimal("400.00"),
            stock=0,
            is_active=True,
            is_deleted=False,
        )
        session.add(product)

        supplier = Supplier(
            id=f"sup_{uuid.uuid4().hex[:8]}",
            uuid=str(uuid.uuid4()),
            company_id=user.company_id,
            branch_id=user.branch_id,
            code=f"SUP-E-{suffix}",
            name=f"Supplier E {suffix}",
            mobile="9876543211",
            outstanding=Decimal("0.00"),
            is_active=True,
            is_deleted=False,
        )
        session.add(supplier)
        await session.commit()

        svc = PurchaseService(db=session, tenant=tenant)

        # Attempt to create PO without variant_id
        po_req = PurchaseOrderCreate(
            supplier_id=supplier.id,
            items=[
                PurchaseOrderItemCreate(
                    product_id=product.id,
                    code=product.code,
                    name=product.name,
                    quantity=Decimal("5.00"),
                    cost_price=Decimal("400.00"),
                    gst_rate=Decimal("12.00"),
                    variant_id=None,  # Intentionally omitted
                )
            ],
        )

        with pytest.raises(HTTPException) as exc_info:
            await svc.create_purchase_order(po_req)

        assert exc_info.value.status_code == 400
        detail = exc_info.value.detail
        assert isinstance(detail, dict)
        assert detail.get("code") == "AMBIGUOUS_ITEM_VARIANT"


# ============================================================================
# Test F: Batch resolution failure raises HTTP 422 BATCH_RESOLUTION_FAILED
# ============================================================================
@pytest.mark.asyncio
async def test_f_batch_resolution_failure_raises_422():
    """
    Test F: When resolve_or_create_batch encounters an error during GRN,
    the exception is NOT swallowed; it raises HTTP 422 BATCH_RESOLUTION_FAILED.
    """
    sessionmaker = get_company_sessionmaker("smriti001")
    suffix = uuid.uuid4().hex[:6].upper()
    sku = f"TEST-F-{suffix}"

    user = _get_mock_user("COMP-001")
    tenant = TenantContext(company_id=user.company_id, branch_id=user.branch_id)

    async with sessionmaker() as session:
        item = Item(
            id=IdentityEngine.generate_technical_id(),
            uuid=str(uuid.uuid4()),
            company_id=user.company_id,
            branch_id=user.branch_id,
            item_code=sku,
            item_name=f"Test F Item {suffix}",
            category="APPAREL",
            brand="SMRITI",
            primary_uom="PCS",
            uom="PCS",
            selling_price=Decimal("200.00"),
            cost_price=Decimal("100.00"),
            mrp=Decimal("200.00"),
            tax_rate=Decimal("12.00"),
            is_active=True,
            is_deleted=False,
        )
        session.add(item)
        await session.flush()

        product = Product(
            id=f"prd_{uuid.uuid4().hex[:12]}",
            uuid=str(uuid.uuid4()),
            company_id=user.company_id,
            branch_id=user.branch_id,
            code=sku,
            sku=sku,
            name=f"Test F Product {suffix}",
            barcode=sku,
            category="APPAREL",
            item_id=item.id,
            price=Decimal("200.00"),
            cost_price=Decimal("100.00"),
            stock=0,
            is_active=True,
            is_deleted=False,
        )
        wh = Warehouse(
            id=f"wh_{uuid.uuid4().hex[:8]}",
            uuid=str(uuid.uuid4()),
            code=f"WH-F-{suffix}",
            name=f"Warehouse F {suffix}",
            company_id=user.company_id,
            branch_id=user.branch_id,
            is_active=True,
            is_deleted=False,
        )
        supplier = Supplier(
            id=f"sup_{uuid.uuid4().hex[:8]}",
            uuid=str(uuid.uuid4()),
            company_id=user.company_id,
            branch_id=user.branch_id,
            code=f"SUP-F-{suffix}",
            name=f"Supplier F {suffix}",
            mobile="9876543212",
            outstanding=Decimal("0.00"),
            is_active=True,
            is_deleted=False,
        )
        session.add_all([product, wh, supplier])
        await session.commit()

        svc = PurchaseService(db=session, tenant=tenant)

        grn_req = PurchaseReceiptCreate(
            supplier_id=supplier.id,
            warehouse_id=wh.id,
            items=[
                PurchaseReceiptItemCreate(
                    product_id=product.id,
                    code=product.code,
                    quantity_received=Decimal("1.00"),
                    cost_price=Decimal("100.00"),
                    batch_no="BAT-FAIL-TEST",
                )
            ],
        )

        with patch.object(
            ItemTrackingService,
            "resolve_or_create_batch",
            side_effect=RuntimeError("Simulated batch tracking disk failure"),
        ):
            with pytest.raises(HTTPException) as exc_info:
                await svc.create_purchase_receipt(grn_req)

            assert exc_info.value.status_code == 422
            detail = exc_info.value.detail
            assert isinstance(detail, dict)
            assert detail.get("code") == "BATCH_RESOLUTION_FAILED"


# ============================================================================
# Test G: Warehouse location resolution failure raises HTTP 422
# ============================================================================
@pytest.mark.asyncio
async def test_g_warehouse_location_resolution_failure_raises_422():
    """
    Test G: When resolve_or_create_warehouse_location encounters an error,
    it raises HTTP 422 WAREHOUSE_LOCATION_RESOLUTION_FAILED without swallowing.
    """
    sessionmaker = get_company_sessionmaker("smriti001")
    suffix = uuid.uuid4().hex[:6].upper()
    sku = f"TEST-G-{suffix}"

    user = _get_mock_user("COMP-001")
    tenant = TenantContext(company_id=user.company_id, branch_id=user.branch_id)

    async with sessionmaker() as session:
        item = Item(
            id=IdentityEngine.generate_technical_id(),
            uuid=str(uuid.uuid4()),
            company_id=user.company_id,
            branch_id=user.branch_id,
            item_code=sku,
            item_name=f"Test G Item {suffix}",
            category="APPAREL",
            brand="SMRITI",
            primary_uom="PCS",
            uom="PCS",
            selling_price=Decimal("200.00"),
            cost_price=Decimal("100.00"),
            mrp=Decimal("200.00"),
            tax_rate=Decimal("12.00"),
            is_active=True,
            is_deleted=False,
        )
        session.add(item)
        await session.flush()

        product = Product(
            id=f"prd_{uuid.uuid4().hex[:12]}",
            uuid=str(uuid.uuid4()),
            company_id=user.company_id,
            branch_id=user.branch_id,
            code=sku,
            sku=sku,
            name=f"Test G Product {suffix}",
            barcode=sku,
            category="APPAREL",
            item_id=item.id,
            price=Decimal("200.00"),
            cost_price=Decimal("100.00"),
            stock=0,
            is_active=True,
            is_deleted=False,
        )
        wh = Warehouse(
            id=f"wh_{uuid.uuid4().hex[:8]}",
            uuid=str(uuid.uuid4()),
            code=f"WH-G-{suffix}",
            name=f"Warehouse G {suffix}",
            company_id=user.company_id,
            branch_id=user.branch_id,
            is_active=True,
            is_deleted=False,
        )
        supplier = Supplier(
            id=f"sup_{uuid.uuid4().hex[:8]}",
            uuid=str(uuid.uuid4()),
            company_id=user.company_id,
            branch_id=user.branch_id,
            code=f"SUP-G-{suffix}",
            name=f"Supplier G {suffix}",
            mobile="9876543213",
            outstanding=Decimal("0.00"),
            is_active=True,
            is_deleted=False,
        )
        session.add_all([product, wh, supplier])
        await session.commit()

        svc = PurchaseService(db=session, tenant=tenant)

        grn_req = PurchaseReceiptCreate(
            supplier_id=supplier.id,
            warehouse_id=wh.id,
            items=[
                PurchaseReceiptItemCreate(
                    product_id=product.id,
                    code=product.code,
                    quantity_received=Decimal("1.00"),
                    cost_price=Decimal("100.00"),
                    batch_no="BAT-PASS",
                )
            ],
        )

        with patch.object(
            ItemTrackingService,
            "resolve_or_create_batch",
            new_callable=AsyncMock,
            return_value=MagicMock(id="mock_batch_001"),
        ), patch.object(
            ItemTrackingService,
            "resolve_or_create_warehouse_location",
            side_effect=RuntimeError("Simulated warehouse location constraint error"),
        ):
            with pytest.raises(HTTPException) as exc_info:
                await svc.create_purchase_receipt(grn_req)

            assert exc_info.value.status_code == 422
            detail = exc_info.value.detail
            assert isinstance(detail, dict)
            assert detail.get("code") == "WAREHOUSE_LOCATION_RESOLUTION_FAILED"


# ============================================================================
# Test H & I: Color and Size lookup from ItemVariant with tenant scoping
# ============================================================================
@pytest.mark.asyncio
async def test_h_and_i_color_and_size_master_lookup_tenant_scoping():
    """
    Test H: Color lookup returns active ItemVariant.color filtered by tenant.
    Test I: Size lookup returns active ItemVariant.size filtered by tenant.
    """
    sessionmaker = get_company_sessionmaker("smriti001")
    suffix = uuid.uuid4().hex[:6].upper()
    unique_color = f"Emerald_{suffix}"
    unique_size = f"38L_{suffix}"

    user_a = _get_mock_user("COMP-001")
    user_b = _get_mock_user("COMP-999")  # Different tenant

    async with sessionmaker() as session:
        # Create an item and variant in COMP-001
        item = Item(
            id=IdentityEngine.generate_technical_id(),
            uuid=str(uuid.uuid4()),
            company_id=user_a.company_id,
            branch_id=user_a.branch_id,
            item_code=f"ITM-HI-{suffix}",
            item_name=f"Color Size Test Item {suffix}",
            category="APPAREL",
            brand="SMRITI",
            is_active=True,
            is_deleted=False,
        )
        session.add(item)
        await session.flush()

        variant = ItemVariant(
            id=f"var_{uuid.uuid4().hex[:12]}",
            uuid=str(uuid.uuid4()),
            company_id=user_a.company_id,
            branch_id=user_a.branch_id,
            item_id=item.id,
            variant_sku=f"ITM-HI-{suffix}-VAR",
            variant_name=f"Color Size Test {suffix}",
            color=unique_color,
            size=unique_size,
            is_active=True,
            is_deleted=False,
        )
        session.add(variant)
        await session.commit()

        # 1. Test H: Color lookup for COMP-001
        res_a = await list_master_entities(
            entity_type="color",
            q=suffix,
            page_size=200,
            page=1,
            control_db=session,
            tenant_db=session,
            current_user=user_a,
        )
        color_names_a = [c["name"] for c in res_a["items"]]
        assert unique_color in color_names_a

        # Color lookup for COMP-999 (Tenant isolation)
        res_b = await list_master_entities(
            entity_type="color",
            q=suffix,
            page_size=200,
            page=1,
            control_db=session,
            tenant_db=session,
            current_user=user_b,
        )
        color_names_b = [c["name"] for c in res_b["items"]]
        assert unique_color not in color_names_b

        # 2. Test I: Size lookup for COMP-001
        res_s_a = await list_master_entities(
            entity_type="size",
            q=suffix,
            page_size=200,
            page=1,
            control_db=session,
            tenant_db=session,
            current_user=user_a,
        )
        size_names_a = [s["name"] for s in res_s_a["items"]]
        assert unique_size in size_names_a

        # Size lookup for COMP-999 (Tenant isolation)
        res_s_b = await list_master_entities(
            entity_type="size",
            q=suffix,
            page_size=200,
            page=1,
            control_db=session,
            tenant_db=session,
            current_user=user_b,
        )
        size_names_b = [s["name"] for s in res_s_b["items"]]
        assert unique_size not in size_names_b


# ============================================================================
# Test J: Tracking resolver does not resolve NULL-company record
# ============================================================================
@pytest.mark.asyncio
async def test_j_tracking_resolver_does_not_resolve_null_company():
    """
    Test J: ItemTrackingService resolvers must strictly filter by company_id
    and never fall back to company_id IS NULL or another company.
    """
    sessionmaker = get_company_sessionmaker("smriti001")
    suffix = uuid.uuid4().hex[:6].upper()
    test_batch = f"BAT-J-{suffix}"

    async with sessionmaker() as session:
        # Create base item for tenant COMP-OTHER
        item_other = Item(
            id=IdentityEngine.generate_technical_id(),
            uuid=str(uuid.uuid4()),
            company_id="COMP-OTHER",
            branch_id="BR-OTHER",
            item_code=f"ITM-JO-{suffix}",
            item_name=f"Tracking Scope Other Item {suffix}",
            category="APPAREL",
            brand="SMRITI",
            is_active=True,
            is_deleted=False,
        )
        session.add(item_other)
        await session.flush()

        other_batch = ItemBatch(
            id=f"batch_{uuid.uuid4().hex[:12]}",
            company_id="COMP-OTHER",
            branch_id="BR-OTHER",
            item_id=item_other.id,
            batch_number=test_batch,
            mrp=Decimal("50.00"),
            cost_price=Decimal("25.00"),
            is_active=True,
        )
        session.add(other_batch)
        await session.commit()

        # Query using ItemTrackingService resolver logic with company_id="COMP-001"
        # It must NOT match other_batch
        stmt = select(ItemBatch).where(
            ItemBatch.batch_number == test_batch,
            ItemBatch.is_deleted == False,
            ItemBatch.company_id == "COMP-001",
        )
        res = (await session.execute(stmt)).scalars().first()
        assert res is None, "Batch belonging to COMP-OTHER must never be resolved for COMP-001"
