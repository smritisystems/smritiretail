"""
Project      : SMRITI Retail OS
Repository   : SMRITIRetailNX
Organization : AITDL NETWORKS

Founders

* Pushpa Devi Jawahar Mallah
  * Founder & Chairperson
  * Phone: +91 9324117007
  * Email: founder@aitdl.com

* Jawahar Ramkripal Mallah
  * Founder, Chief Executive Officer (CEO) & Chief Software Architect
  * Email: founder@aitdl.com

* Websites: aitdl.com | erpnbook.com | aitdl.com

* Version    : 6.75.1
* Created    : 2026-10-14
* Modified   : 2026-10-14
* Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
* License    : Proprietary Commercial Software
Classification: Internal

Test Battery: Purchase Variant Resolution & Vendor Auto-Bridge Verification
Verifies:
  1. Auto-convergence of legacy unmigrated supplier in VendorProductAssignmentService.
  2. Multi-variant purchase order item resolves without AMBIGUOUS_ITEM_VARIANT when variant_id, variant_sku, or product variant is provided.
  3. Genuinely ambiguous item without variant specification correctly fails fast with AMBIGUOUS_ITEM_VARIANT.
"""

from __future__ import annotations

import pytest
import uuid
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock, patch

from fastapi import HTTPException
from app.services.vendor_product_assignment import VendorProductAssignmentService
from app.models.purchase import Supplier
from app.models.party import Party, VendorIdentityMigration
from app.models.item_master import ItemVariant
from app.models.inventory import Product
from app.services.purchase import PurchaseService
from app.schemas.purchase import PurchaseOrderCreate, PurchaseOrderItemCreate
from app.schemas.product_resolution import ProductResolutionResult


@pytest.mark.asyncio
async def test_vendor_auto_converge_legacy_supplier():
    """
    Test that when a supplier exists in legacy suppliers table but has no migration record,
    resolve_vendor_party_id automatically provisions a Party and VendorIdentityMigration record
    instead of throwing a 422 error.
    """
    mock_db = AsyncMock()
    tenant = MagicMock()
    tenant.company_id = "COMP-001"
    tenant.branch_id = "BR-001"
    tenant.user_id = "USR-001"

    svc = VendorProductAssignmentService(mock_db, tenant)

    legacy_sup = Supplier(
        id="sup_845a4f98ac",
        code="SUP-LEGACY-01",
        name="Legacy Shoes Supplier",
        company_id="COMP-001",
        branch_id="BR-001",
        gst_number="27ABCDE1234F1Z5",
        mobile="9876543210",
        email="supplier@example.com",
        is_deleted=False,
    )

    call_count = 0
    def mock_execute(stmt, *args, **kwargs):
        nonlocal call_count
        call_count += 1
        res = MagicMock()
        scalars = MagicMock()
        if call_count in (1, 2, 4, 5):
            scalars.first.return_value = None
        elif call_count == 3:
            scalars.first.return_value = legacy_sup
        else:
            scalars.first.return_value = None
        res.scalars.return_value = scalars
        return res

    mock_db.execute = AsyncMock(side_effect=mock_execute)
    added_entities = []
    mock_db.add = MagicMock(side_effect=lambda entity: added_entities.append(entity))
    mock_db.flush = AsyncMock()

    party_id = await svc.resolve_vendor_party_id("sup_845a4f98ac")

    assert party_id.startswith("pty_")
    assert len(added_entities) == 2
    party_entity = next(e for e in added_entities if isinstance(e, Party))
    mig_entity = next(e for e in added_entities if isinstance(e, VendorIdentityMigration))

    assert party_entity.id == party_id
    assert party_entity.legal_name == "Legacy Shoes Supplier"
    assert party_entity.gstin == "27ABCDE1234F1Z5"
    assert mig_entity.legacy_supplier_id == "sup_845a4f98ac"
    assert mig_entity.party_id == party_id
    assert mig_entity.migration_status == "COMPLETED"


@pytest.mark.asyncio
async def test_po_creation_resolves_variant_sku_without_ambiguity_error():
    """
    Test that when an item has 14 variants, but the line specifies a SKU matching one of the variants,
    PurchaseService resolves that exact variant and does not raise AMBIGUOUS_ITEM_VARIANT.
    """
    mock_db = AsyncMock()
    tenant = MagicMock()
    tenant.company_id = "COMP-001"
    tenant.branch_id = "BR-001"
    tenant.user_id = "USR-001"

    po_svc = PurchaseService(mock_db, tenant)

    supplier = Supplier(
        id="sup_845a4f98ac",
        name="Test Supplier",
        code="SUP-001",
        company_id="COMP-001",
        is_deleted=False,
    )

    mock_res = ProductResolutionResult(
        success=True,
        product_id="prd_test_001",
        item_id="itm_style_533",
        variant_id="var_c49a331a50d6",
        sku="CH-533-CREAM-36",
        barcode="890123456789",
        name="CH-533 Cream Size 36",
        selling_price=Decimal("1500.00"),
        cost_price=Decimal("800.00"),
        is_active=True,
    )

    mock_product = Product(
        id="prd_test_001",
        item_id="itm_style_533",
        item_variant_id="var_c49a331a50d6",
        code="CH-533-CREAM-36",
        name="CH-533 Cream Size 36",
        company_id="COMP-001",
        price=Decimal("1500.00"),
        cost_price=Decimal("800.00"),
        stock=0,
        is_deleted=False,
    )

    # Database mock returns supplier on first call, None on duplicate order check
    def mock_db_execute(stmt, *args, **kwargs):
        res = MagicMock()
        scalars = MagicMock()
        scalars.first.return_value = None
        scalars.all.return_value = []
        stmt_str = str(stmt).lower()
        if "suppliers" in stmt_str:
            scalars.first.return_value = supplier
        res.scalars.return_value = scalars
        return res

    mock_db.execute = AsyncMock(side_effect=mock_db_execute)
    mock_db.get = AsyncMock(return_value=mock_product)
    mock_db.add = MagicMock()
    mock_db.commit = AsyncMock()
    mock_db.refresh = AsyncMock()

    with patch("app.services.product_resolution_service.ProductResolutionService.validate_line", AsyncMock(return_value=mock_res)), \
         patch("app.services.identity.engine.IdentityEngine.allocate_internal", AsyncMock(return_value=("po_test_id", "PO-TEST-001"))):

        po_in = PurchaseOrderCreate(
            supplier_id="sup_845a4f98ac",
            order_no="PO-TEST-001",
            items=[
                PurchaseOrderItemCreate(
                    product_id="prd_test_001",
                    code="CH-533-CREAM-36",
                    name="CH-533 Cream Size 36",
                    quantity=Decimal("10"),
                    cost_price=Decimal("800.00"),
                    gst_rate=Decimal("5.00"),
                )
            ],
        )

        po = await po_svc.create_purchase_order(po_in)
        assert po is not None
        assert po.order_no == "PO-TEST-001"
        assert len(po.items) == 1
        assert po.items[0].variant_id == "var_c49a331a50d6"


@pytest.mark.asyncio
async def test_po_creation_truly_ambiguous_item_fails_fast():
    """
    Test that when an item has multiple variants and only the parent style is provided
    without variant_id or matching variant_sku, it properly fails fast with HTTP 400 AMBIGUOUS_ITEM_VARIANT.
    """
    mock_db = AsyncMock()
    tenant = MagicMock()
    tenant.company_id = "COMP-001"
    tenant.branch_id = "BR-001"
    tenant.user_id = "USR-001"

    po_svc = PurchaseService(mock_db, tenant)

    supplier = Supplier(
        id="sup_845a4f98ac",
        name="Test Supplier",
        code="SUP-001",
        company_id="COMP-001",
        is_deleted=False,
    )

    # Resolution returns parent item but NO variant_id
    mock_res = ProductResolutionResult(
        success=True,
        product_id="prd_parent_style",
        item_id="itm_style_533",
        variant_id=None,
        sku="CH-533",
        name="CH-533 Generic Style",
        selling_price=Decimal("1500.00"),
        cost_price=Decimal("800.00"),
        is_active=True,
    )

    mock_product = Product(
        id="prd_parent_style",
        item_id="itm_style_533",
        item_variant_id=None,
        code="CH-533",
        name="CH-533 Generic Style",
        company_id="COMP-001",
        price=Decimal("1500.00"),
        cost_price=Decimal("800.00"),
        stock=0,
        is_deleted=False,
    )

    var1 = ItemVariant(id="var_01", item_id="itm_style_533", variant_sku="CH-533-CREAM-36", is_active=True, is_deleted=False)
    var2 = ItemVariant(id="var_02", item_id="itm_style_533", variant_sku="CH-533-CREAM-37", is_active=True, is_deleted=False)

    def mock_db_execute(stmt, *args, **kwargs):
        res = MagicMock()
        scalars = MagicMock()
        scalars.first.return_value = None
        scalars.all.return_value = []
        stmt_str = str(stmt).lower()
        if "suppliers" in stmt_str:
            scalars.first.return_value = supplier
        elif "item_variants" in stmt_str:
            scalars.all.return_value = [var1, var2]
        res.scalars.return_value = scalars
        return res

    mock_db.execute = AsyncMock(side_effect=mock_db_execute)
    mock_db.get = AsyncMock(return_value=mock_product)

    with patch("app.services.product_resolution_service.ProductResolutionService.validate_line", AsyncMock(return_value=mock_res)), \
         patch("app.services.identity.engine.IdentityEngine.allocate_internal", AsyncMock(return_value=("po_test_id", "PO-TEST-002"))):

        po_in = PurchaseOrderCreate(
            supplier_id="sup_845a4f98ac",
            order_no="PO-TEST-002",
            items=[
                PurchaseOrderItemCreate(
                    product_id="prd_parent_style",
                    code="CH-533",  # style code only, no variant SKU or variant_id
                    quantity=Decimal("10"),
                    cost_price=Decimal("800.00"),
                )
            ],
        )

        with pytest.raises(HTTPException) as exc_info:
            await po_svc.create_purchase_order(po_in)

        assert exc_info.value.status_code == 400
        assert exc_info.value.detail.get("code") == "AMBIGUOUS_ITEM_VARIANT"
        assert len(exc_info.value.detail.get("available_variants")) == 2
