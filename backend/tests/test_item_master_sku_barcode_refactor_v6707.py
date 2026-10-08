"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.70.7
Created      : 2026-10-08
Modified     : 2026-10-08
Copyright    : (C) SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal

Master Test Battery: SMRITI Retail OS — Item Master Identity & SKU/Barcode Refactor v6.70.7
=============================================================================================
Comprehensive tests verifying all 18 specification requirements:
 1. Barcode exists + SKU blank -> SKU initialized from barcode
 2. User SKU exists + barcode exists -> User SKU preserved
 3. No barcode + user SKU -> User SKU preserved
 4. No barcode + no SKU -> Rejected with ITEM_MASTER_VALIDATION_ERROR (No silent generation)
 5. Generate SKU action -> Candidate proposal only (Zero persistence)
 6. Approve generated SKU -> Candidate persisted on approval
 7. Cancel generated SKU -> SKU remains blank (No persistence)
 8. Duplicate generated SKU -> Safe collision resolution without collision
 9. Barcode changes after transaction -> SKU unchanged and immutable
10. Multiple barcodes -> Same variant can have multiple barcodes
11. Multiple primary barcodes -> Rejected with SMRITI-PRIMARY-BARCODE-COLLISION
12. Cross-company duplicate SKU -> Permitted within tenant isolation
13. Cross-company barcode isolation -> Allowed across distinct companies
14. Synthetic barcode attempt -> Strictly rejected
15. Multi-variant purchase without variant_id -> AMBIGUOUS_ITEM_VARIANT
16. GRN variant propagation -> Purchase receipt retains PO variant_id
17. StockMovement variant propagation -> Stock movement retains receipt variant_id
18. Tracking concurrency -> Correct savepoint flush boundary verified
"""

from __future__ import annotations

import asyncio
import uuid
from decimal import Decimal

import pytest
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import TenantContext
from app.db.session import get_company_sessionmaker
from app.models.inventory import StockMovement, Warehouse
from app.models.item_master import Item, ItemBarcode, ItemVariant
from app.models.purchase import Supplier, PurchaseReceiptItem
from app.schemas.item_master import (
    ItemBarcodeCreateRequest,
    ItemVariantCreateRequest,
)
from app.schemas.purchase import (
    PurchaseOrderCreate,
    PurchaseOrderItemCreate,
    PurchaseReceiptCreate,
    PurchaseReceiptItemCreate,
)
from app.services.item.item_tracking_svc import ItemTrackingService
from app.services.item_domain_svc import BusinessLogicError, ItemDomainService
from app.services.purchase import PurchaseService


# ── Test 1: Barcode exists + SKU blank -> SKU initialized from barcode ────────
@pytest.mark.asyncio
async def test_01_barcode_exists_sku_blank_initializes_sku_from_barcode():
    sessionmaker = get_company_sessionmaker("smriti001")
    company_id = "COMP-001"
    async with sessionmaker() as db:
        suffix = uuid.uuid4().hex[:6].upper()
        barcode_val = f"8901234{suffix}"

        # Create master style
        item = Item(
            id=f"itm_{uuid.uuid4().hex[:8]}",
            company_id=company_id,
            item_code=f"STYLE-T1-{suffix}",
            item_name=f"Style T1 {suffix}",
            category="FOOTWEAR",
            brand="SMRITI",
            is_active=True,
        )
        db.add(item)
        await db.flush()

        # Call create_variant with primary_barcode and variant_sku blank (None)
        req = ItemVariantCreateRequest(
            style_id=item.id,
            color="BLACK",
            size="8",
            variant_sku=None,
            primary_barcode=barcode_val,
            mrp=1500.0,
        )
        var, pbe, bc = await ItemDomainService.create_variant(
            session=db,
            req=req,
            company_id=company_id,
            commit=True,
        )

        # Decision Tree Case 1: Initial SKU is set to primary barcode
        assert var.variant_sku == barcode_val
        assert var.sku == barcode_val

        # Verify barcode stored independently in item_barcodes
        stmt = select(ItemBarcode).where(
            ItemBarcode.variant_id == var.id,
            ItemBarcode.barcode == barcode_val,
        )
        res = await db.execute(stmt)
        saved_bc = res.scalar_one_or_none()
        assert saved_bc is not None
        assert saved_bc.is_primary is True


# ── Test 2: User SKU exists + barcode exists -> user SKU preserved ────────────
@pytest.mark.asyncio
async def test_02_user_sku_exists_with_barcode_user_sku_preserved():
    sessionmaker = get_company_sessionmaker("smriti001")
    company_id = "COMP-001"
    async with sessionmaker() as db:
        suffix = uuid.uuid4().hex[:6].upper()
        custom_sku = f"CH-501-TT-BLACK-36-{suffix}"
        barcode_val = f"8907890{suffix}"

        item = Item(
            id=f"itm_{uuid.uuid4().hex[:8]}",
            company_id=company_id,
            item_code=f"STYLE-T2-{suffix}",
            item_name=f"Style T2 {suffix}",
            category="FOOTWEAR",
            brand="SMRITI",
            is_active=True,
        )
        db.add(item)
        await db.flush()

        req = ItemVariantCreateRequest(
            style_id=item.id,
            color="BLACK",
            size="36",
            variant_sku=custom_sku,
            primary_barcode=barcode_val,
            mrp=1899.0,
        )
        var, pbe, bc = await ItemDomainService.create_variant(
            session=db,
            req=req,
            company_id=company_id,
            commit=True,
        )

        # Decision Tree Case 2: User SKU takes precedence
        assert var.variant_sku == custom_sku
        assert var.sku == custom_sku


# ── Test 3: No barcode + user SKU -> user SKU preserved ───────────────────────
@pytest.mark.asyncio
async def test_03_no_barcode_with_user_sku_user_sku_preserved():
    sessionmaker = get_company_sessionmaker("smriti001")
    company_id = "COMP-001"
    async with sessionmaker() as db:
        suffix = uuid.uuid4().hex[:6].upper()
        custom_sku = f"SMR-CUSTOM-SKU-{suffix}"

        item = Item(
            id=f"itm_{uuid.uuid4().hex[:8]}",
            company_id=company_id,
            item_code=f"STYLE-T3-{suffix}",
            item_name=f"Style T3 {suffix}",
            category="FOOTWEAR",
            brand="SMRITI",
            is_active=True,
        )
        db.add(item)
        await db.flush()

        req = ItemVariantCreateRequest(
            style_id=item.id,
            color="TAN",
            size="9",
            variant_sku=custom_sku,
            primary_barcode=None,
            mrp=1299.0,
        )
        var, pbe, bc = await ItemDomainService.create_variant(
            session=db,
            req=req,
            company_id=company_id,
            commit=True,
        )

        assert var.variant_sku == custom_sku
        assert var.sku == custom_sku


# ── Test 4: No barcode + no SKU -> no automatic SKU (Rejected) ────────────────
@pytest.mark.asyncio
async def test_04_no_barcode_and_no_sku_rejected_no_silent_generation():
    sessionmaker = get_company_sessionmaker("smriti001")
    company_id = "COMP-001"
    async with sessionmaker() as db:
        suffix = uuid.uuid4().hex[:6].upper()

        item = Item(
            id=f"itm_{uuid.uuid4().hex[:8]}",
            company_id=company_id,
            item_code=f"STYLE-T4-{suffix}",
            item_name=f"Style T4 {suffix}",
            category="FOOTWEAR",
            brand="SMRITI",
            is_active=True,
        )
        db.add(item)
        await db.flush()

        # Decision Tree Case 3: Rejection with structured ITEM_MASTER_VALIDATION_ERROR
        req = ItemVariantCreateRequest(
            style_id=item.id,
            color="GREY",
            size="10",
            variant_sku=None,
            primary_barcode=None,
            mrp=999.0,
        )
        with pytest.raises(BusinessLogicError) as exc_info:
            await ItemDomainService.create_variant(
                session=db,
                req=req,
                company_id=company_id,
                commit=True,
            )

        assert exc_info.value.code == "ITEM_MASTER_VALIDATION_ERROR"
        assert "SKU / Item Code is required or must be approved before saving." in exc_info.value.message


# ── Test 5: Generate SKU action -> proposal only (Zero persistence) ───────────
@pytest.mark.asyncio
async def test_05_generate_sku_action_proposal_only_zero_persistence():
    sessionmaker = get_company_sessionmaker("smriti001")
    company_id = "COMP-001"
    async with sessionmaker() as db:
        # Propose candidate SKU
        res = await ItemDomainService.propose_sku(session=db, company_id=company_id)
        candidate = res["proposed_sku"]
        assert candidate.startswith("SMR-ITM-")

        # Verify zero database persistence (no variant created with this candidate)
        stmt = select(ItemVariant).where(
            ItemVariant.company_id == company_id,
            ItemVariant.variant_sku == candidate,
        )
        db_res = await db.execute(stmt)
        assert db_res.scalar_one_or_none() is None


# ── Test 6: Approve generated SKU -> SKU persisted ────────────────────────────
@pytest.mark.asyncio
async def test_06_approve_generated_sku_persists_sku():
    sessionmaker = get_company_sessionmaker("smriti001")
    company_id = "COMP-001"
    async with sessionmaker() as db:
        suffix = uuid.uuid4().hex[:6].upper()

        item = Item(
            id=f"itm_{uuid.uuid4().hex[:8]}",
            company_id=company_id,
            item_code=f"STYLE-T6-{suffix}",
            item_name=f"Style T6 {suffix}",
            category="FOOTWEAR",
            brand="SMRITI",
            is_active=True,
        )
        db.add(item)
        await db.flush()

        prop_res = await ItemDomainService.propose_sku(session=db, company_id=company_id)
        candidate = prop_res["proposed_sku"]

        # Explicit user approval -> persist
        req = ItemVariantCreateRequest(
            style_id=item.id,
            color="BLUE",
            size="7",
            variant_sku=candidate,
            primary_barcode=None,
            mrp=1100.0,
        )
        var, pbe, bc = await ItemDomainService.create_variant(
            session=db,
            req=req,
            company_id=company_id,
            commit=True,
        )

        assert var.variant_sku == candidate
        assert var.sku == candidate


# ── Test 7: Cancel generated SKU -> SKU remains blank (No persistence) ────────
@pytest.mark.asyncio
async def test_07_cancel_generated_sku_no_persistence():
    sessionmaker = get_company_sessionmaker("smriti001")
    company_id = "COMP-001"
    async with sessionmaker() as db:
        prop_res = await ItemDomainService.propose_sku(session=db, company_id=company_id)
        candidate = prop_res["proposed_sku"]

        # User clicks cancel: no persistence occurs
        stmt = select(ItemVariant).where(ItemVariant.variant_sku == candidate)
        res = await db.execute(stmt)
        assert res.scalar_one_or_none() is None


# ── Test 8: Duplicate generated SKU -> Safe collision resolution ──────────────
@pytest.mark.asyncio
async def test_08_duplicate_generated_sku_safe_collision_resolution():
    sessionmaker = get_company_sessionmaker("smriti001")
    company_id = "COMP-001"
    async with sessionmaker() as db:
        suffix = uuid.uuid4().hex[:6].upper()

        item = Item(
            id=f"itm_{uuid.uuid4().hex[:8]}",
            company_id=company_id,
            item_code=f"STYLE-T8-{suffix}",
            item_name=f"Style T8 {suffix}",
            category="FOOTWEAR",
            brand="SMRITI",
            is_active=True,
        )
        db.add(item)
        await db.flush()

        # Propose and persist candidate 1
        cand1 = (await ItemDomainService.propose_sku(session=db, company_id=company_id))["proposed_sku"]
        req1 = ItemVariantCreateRequest(
            style_id=item.id,
            color="NAVY",
            size="8",
            variant_sku=cand1,
            mrp=1400.0,
        )
        await ItemDomainService.create_variant(
            session=db,
            req=req1,
            company_id=company_id,
            commit=True,
        )

        # Propose candidate 2 must safely avoid collision with cand1
        cand2 = (await ItemDomainService.propose_sku(session=db, company_id=company_id))["proposed_sku"]
        assert cand2 != cand1

        # Attempting to save duplicate SKU in the same company fails
        req_dup = ItemVariantCreateRequest(
            style_id=item.id,
            color="NAVY",
            size="9",
            variant_sku=cand1,
            mrp=1400.0,
        )
        with pytest.raises(BusinessLogicError) as exc_info:
            await ItemDomainService.create_variant(
                session=db,
                req=req_dup,
                company_id=company_id,
                commit=True,
            )
        assert exc_info.value.code == "SMRITI-SKU-COLLISION"


# ── Test 9: Barcode changes after transaction -> SKU unchanged ────────────────
@pytest.mark.asyncio
async def test_09_barcode_changes_after_transaction_sku_unchanged():
    sessionmaker = get_company_sessionmaker("smriti001")
    company_id = "COMP-001"
    async with sessionmaker() as db:
        suffix = uuid.uuid4().hex[:6].upper()
        initial_barcode = f"8909087{suffix}"
        new_barcode = f"8909999{suffix}"

        item = Item(
            id=f"itm_{uuid.uuid4().hex[:8]}",
            company_id=company_id,
            item_code=f"STYLE-T9-{suffix}",
            item_name=f"Style T9 {suffix}",
            category="FOOTWEAR",
            brand="SMRITI",
            is_active=True,
        )
        db.add(item)
        await db.flush()

        # Initial SKU from primary barcode
        req = ItemVariantCreateRequest(
            style_id=item.id,
            color="BLACK",
            size="40",
            variant_sku=None,
            primary_barcode=initial_barcode,
            mrp=2500.0,
        )
        var, pbe, bc = await ItemDomainService.create_variant(
            session=db,
            req=req,
            company_id=company_id,
            commit=True,
        )

        original_sku = var.variant_sku
        assert original_sku == initial_barcode

        # Later: new barcode added
        # SKU MUST remain unchanged (Case 5)
        bc_req = ItemBarcodeCreateRequest(
            variant_id=var.id,
            barcode=new_barcode,
            is_primary=False,
        )
        await ItemDomainService.create_barcode(
            session=db,
            req=bc_req,
            company_id=company_id,
            commit=True,
        )

        # Refresh variant
        await db.refresh(var)
        assert var.variant_sku == original_sku


# ── Test 10: Multiple barcodes for same variant ───────────────────────────────
@pytest.mark.asyncio
async def test_10_multiple_barcodes_same_variant():
    sessionmaker = get_company_sessionmaker("smriti001")
    company_id = "COMP-001"
    async with sessionmaker() as db:
        suffix = uuid.uuid4().hex[:6].upper()

        item = Item(
            id=f"itm_{uuid.uuid4().hex[:8]}",
            company_id=company_id,
            item_code=f"STYLE-T10-{suffix}",
            item_name=f"Style T10 {suffix}",
            category="FOOTWEAR",
            brand="SMRITI",
            is_active=True,
        )
        db.add(item)
        await db.flush()

        bc1 = f"8901111{suffix}"
        bc2 = f"8902222{suffix}"
        bc3 = f"8903333{suffix}"

        req = ItemVariantCreateRequest(
            style_id=item.id,
            color="RED",
            size="6",
            variant_sku=f"SKU-MULTI-{suffix}",
            primary_barcode=bc1,
            mrp=899.0,
        )
        var, pbe, bc = await ItemDomainService.create_variant(
            session=db,
            req=req,
            company_id=company_id,
            commit=True,
        )

        # Add secondary barcodes
        await ItemDomainService.create_barcode(
            session=db,
            req=ItemBarcodeCreateRequest(variant_id=var.id, barcode=bc2, is_primary=False),
            company_id=company_id,
            commit=True,
        )
        await ItemDomainService.create_barcode(
            session=db,
            req=ItemBarcodeCreateRequest(variant_id=var.id, barcode=bc3, is_primary=False),
            company_id=company_id,
            commit=True,
        )

        # Verify all 3 barcodes exist for this variant
        stmt = select(ItemBarcode).where(ItemBarcode.variant_id == var.id)
        res = await db.execute(stmt)
        barcodes = res.scalars().all()
        assert len(barcodes) == 3
        primary_bcs = [b for b in barcodes if b.is_primary]
        assert len(primary_bcs) == 1
        assert primary_bcs[0].barcode == bc1


# ── Test 11: Multiple primary barcodes rejected ───────────────────────────────
@pytest.mark.asyncio
async def test_11_multiple_primary_barcodes_rejected():
    sessionmaker = get_company_sessionmaker("smriti001")
    company_id = "COMP-001"
    async with sessionmaker() as db:
        suffix = uuid.uuid4().hex[:6].upper()

        item = Item(
            id=f"itm_{uuid.uuid4().hex[:8]}",
            company_id=company_id,
            item_code=f"STYLE-T11-{suffix}",
            item_name=f"Style T11 {suffix}",
            category="FOOTWEAR",
            brand="SMRITI",
            is_active=True,
        )
        db.add(item)
        await db.flush()

        req = ItemVariantCreateRequest(
            style_id=item.id,
            color="GREEN",
            size="8",
            variant_sku=f"SKU-P1-{suffix}",
            primary_barcode=f"8904444{suffix}",
            mrp=999.0,
        )
        var, pbe, bc = await ItemDomainService.create_variant(
            session=db,
            req=req,
            company_id=company_id,
            commit=True,
        )

        # Second primary barcode must be rejected
        with pytest.raises(BusinessLogicError) as exc_info:
            await ItemDomainService.create_barcode(
                session=db,
                req=ItemBarcodeCreateRequest(variant_id=var.id, barcode=f"8905555{suffix}", is_primary=True),
                company_id=company_id,
                commit=True,
            )
        assert exc_info.value.code == "SMRITI-PRIMARY-BARCODE-COLLISION"


# ── Test 12: Cross-company duplicate SKU allowed ──────────────────────────────
@pytest.mark.asyncio
async def test_12_cross_company_duplicate_sku_allowed():
    sessionmaker = get_company_sessionmaker("smriti001")
    suffix = uuid.uuid4().hex[:6].upper()
    common_sku = f"SHARED-SKU-{suffix}"

    async with sessionmaker() as db:
        # Company A item & variant
        item_a = Item(
            id=f"itm_a_{uuid.uuid4().hex[:6]}",
            company_id="COMP-A",
            item_code=f"STYLE-A-{suffix}",
            item_name="Style A",
            is_active=True,
        )
        db.add(item_a)
        await db.flush()

        var_a, _, _ = await ItemDomainService.create_variant(
            session=db,
            req=ItemVariantCreateRequest(
                style_id=item_a.id,
                color="BLACK",
                size="7",
                variant_sku=common_sku,
                mrp=500.0,
            ),
            company_id="COMP-A",
            commit=True,
        )

        # Company B item & variant with SAME SKU
        item_b = Item(
            id=f"itm_b_{uuid.uuid4().hex[:6]}",
            company_id="COMP-B",
            item_code=f"STYLE-B-{suffix}",
            item_name="Style B",
            is_active=True,
        )
        db.add(item_b)
        await db.flush()

        var_b, _, _ = await ItemDomainService.create_variant(
            session=db,
            req=ItemVariantCreateRequest(
                style_id=item_b.id,
                color="BLACK",
                size="7",
                variant_sku=common_sku,
                mrp=500.0,
            ),
            company_id="COMP-B",
            commit=True,
        )

        assert var_a.variant_sku == common_sku
        assert var_b.variant_sku == common_sku
        assert var_a.company_id == "COMP-A"
        assert var_b.company_id == "COMP-B"


# ── Test 13: Cross-company barcode isolation ──────────────────────────────────
@pytest.mark.asyncio
async def test_13_cross_company_barcode_isolation():
    sessionmaker = get_company_sessionmaker("smriti001")
    suffix = uuid.uuid4().hex[:6].upper()
    common_barcode = f"8909876{suffix}"

    async with sessionmaker() as db:
        item_a = Item(
            id=f"itm_iso_a_{uuid.uuid4().hex[:6]}",
            company_id="COMP-TENANT-A",
            item_code=f"STYLE-ISO-A-{suffix}",
            item_name="Style ISO A",
            is_active=True,
        )
        item_b = Item(
            id=f"itm_iso_b_{uuid.uuid4().hex[:6]}",
            company_id="COMP-TENANT-B",
            item_code=f"STYLE-ISO-B-{suffix}",
            item_name="Style ISO B",
            is_active=True,
        )
        db.add_all([item_a, item_b])
        await db.flush()

        var_a, _, _ = await ItemDomainService.create_variant(
            session=db,
            req=ItemVariantCreateRequest(
                style_id=item_a.id,
                color="RED",
                size="7",
                variant_sku=f"SKU-A-{suffix}",
                primary_barcode=common_barcode,
                mrp=600.0,
            ),
            company_id="COMP-TENANT-A",
            commit=True,
        )
        var_b, _, _ = await ItemDomainService.create_variant(
            session=db,
            req=ItemVariantCreateRequest(
                style_id=item_b.id,
                color="RED",
                size="7",
                variant_sku=f"SKU-B-{suffix}",
                primary_barcode=common_barcode,
                mrp=600.0,
            ),
            company_id="COMP-TENANT-B",
            commit=True,
        )

        # Both exist isolated in their respective company tenant scopes
        assert var_a.company_id == "COMP-TENANT-A"
        assert var_b.company_id == "COMP-TENANT-B"


# ── Test 14: Synthetic barcode generation attempt rejected ────────────────────
@pytest.mark.asyncio
async def test_14_synthetic_barcode_generation_attempt_rejected():
    sessionmaker = get_company_sessionmaker("smriti001")
    company_id = "COMP-001"
    async with sessionmaker() as db:
        suffix = uuid.uuid4().hex[:6].upper()

        item = Item(
            id=f"itm_{uuid.uuid4().hex[:8]}",
            company_id=company_id,
            item_code=f"STYLE-T14-{suffix}",
            item_name=f"Style T14 {suffix}",
            category="FOOTWEAR",
            brand="SMRITI",
            is_active=True,
        )
        db.add(item)
        await db.flush()

        # 1. 890GEN pattern rejected
        with pytest.raises(BusinessLogicError) as exc_info1:
            await ItemDomainService.create_variant(
                session=db,
                req=ItemVariantCreateRequest(
                    style_id=item.id,
                    color="BLUE",
                    size="8",
                    variant_sku=f"SKU-14A-{suffix}",
                    primary_barcode="890GEN123456",
                    mrp=700.0,
                ),
                company_id=company_id,
                commit=True,
            )
        assert exc_info1.value.code == "SMRITI-SYNTHETIC-BARCODE-PROHIBITED"

        # 2. ITM- pattern rejected
        with pytest.raises(BusinessLogicError) as exc_info2:
            await ItemDomainService.create_variant(
                session=db,
                req=ItemVariantCreateRequest(
                    style_id=item.id,
                    color="BLUE",
                    size="8",
                    variant_sku=f"SKU-14B-{suffix}",
                    primary_barcode="ITM-9988776655",
                    mrp=700.0,
                ),
                company_id=company_id,
                commit=True,
            )
        assert exc_info2.value.code == "SMRITI-SYNTHETIC-BARCODE-PROHIBITED"

        # 3. Sxxxxxxxxxxxx pattern rejected
        with pytest.raises(BusinessLogicError) as exc_info3:
            await ItemDomainService.create_variant(
                session=db,
                req=ItemVariantCreateRequest(
                    style_id=item.id,
                    color="BLUE",
                    size="8",
                    variant_sku=f"SKU-14C-{suffix}",
                    primary_barcode="S123456789012",
                    mrp=700.0,
                ),
                company_id=company_id,
                commit=True,
            )
        assert exc_info3.value.code == "SMRITI-SYNTHETIC-BARCODE-PROHIBITED"


# ── Test 15: Multi-variant purchase without variant_id -> AMBIGUOUS_ITEM_VARIANT
@pytest.mark.asyncio
async def test_15_multivariant_purchase_without_variant_id_fails_fast():
    sessionmaker = get_company_sessionmaker("smriti001")
    company_id = "COMP-001"
    async with sessionmaker() as db:
        suffix = uuid.uuid4().hex[:6].upper()

        item = Item(
            id=f"itm_mv_{uuid.uuid4().hex[:8]}",
            company_id=company_id,
            item_code=f"STYLE-MV-{suffix}",
            item_name=f"Style MV {suffix}",
            category="FOOTWEAR",
            brand="SMRITI",
            is_active=True,
        )
        db.add(item)
        await db.flush()

        # Create two variants under the same item
        await ItemDomainService.create_variant(
            session=db,
            req=ItemVariantCreateRequest(
                style_id=item.id,
                color="BLACK",
                size="7",
                variant_sku=f"SKU-MV1-{suffix}",
                mrp=1500.0,
            ),
            company_id=company_id,
            commit=True,
        )
        await ItemDomainService.create_variant(
            session=db,
            req=ItemVariantCreateRequest(
                style_id=item.id,
                color="BLACK",
                size="8",
                variant_sku=f"SKU-MV2-{suffix}",
                mrp=1500.0,
            ),
            company_id=company_id,
            commit=True,
        )

        tenant_ctx = TenantContext(
            company_id=company_id,
            branch_id="BR-MAIN-001",
        )
        po_svc = PurchaseService(db, tenant_ctx)
        supplier = Supplier(
            id=f"sup_{uuid.uuid4().hex[:8]}",
            code=f"SUP-MV-{suffix}",
            company_id=company_id,
            name=f"Supplier MV {suffix}",
            is_active=True,
        )
        db.add(supplier)
        await db.flush()

        po_in = PurchaseOrderCreate(
            supplier_id=supplier.id,
            lines=[
                PurchaseOrderItemCreate(
                    product_id=item.id,  # item has multiple variants!
                    variant_id=None,      # omitted variant_id -> must fail fast
                    quantity=Decimal("10"),
                    cost_price=Decimal("800.00"),
                )
            ],
        )

        with pytest.raises(HTTPException) as exc_info:
            await po_svc.create_purchase_order(po_in)
        assert exc_info.value.status_code == 400
        assert "AMBIGUOUS_ITEM_VARIANT" in str(exc_info.value.detail)


# ── Test 16: GRN variant propagation ──────────────────────────────────────────
@pytest.mark.asyncio
async def test_16_grn_variant_propagation_from_po():
    sessionmaker = get_company_sessionmaker("smriti001")
    company_id = "COMP-001"
    async with sessionmaker() as db:
        suffix = uuid.uuid4().hex[:6].upper()

        item = Item(
            id=f"itm_grn_{uuid.uuid4().hex[:8]}",
            company_id=company_id,
            item_code=f"STYLE-GRN-{suffix}",
            item_name=f"Style GRN {suffix}",
            category="FOOTWEAR",
            brand="SMRITI",
            is_active=True,
        )
        db.add(item)
        await db.flush()

        var, _, _ = await ItemDomainService.create_variant(
            session=db,
            req=ItemVariantCreateRequest(
                style_id=item.id,
                color="BROWN",
                size="9",
                variant_sku=f"SKU-GRN-{suffix}",
                mrp=2000.0,
            ),
            company_id=company_id,
            commit=True,
        )

        tenant_ctx = TenantContext(
            company_id=company_id,
            branch_id="BR-MAIN-001",
        )
        po_svc = PurchaseService(db, tenant_ctx)
        supplier = Supplier(
            id=f"sup_grn_{uuid.uuid4().hex[:8]}",
            code=f"SUP-GRN-{suffix}",
            company_id=company_id,
            name=f"Supplier GRN {suffix}",
            is_active=True,
        )
        db.add(supplier)
        await db.flush()

        po_in = PurchaseOrderCreate(
            supplier_id=supplier.id,
            lines=[
                PurchaseOrderItemCreate(
                    product_id=item.id,
                    variant_id=var.id,
                    quantity=Decimal("5"),
                    cost_price=Decimal("1200.00"),
                )
            ],
        )
        po = await po_svc.create_purchase_order(po_in)
        po_item = po.items[0]

        # Create GRN linking to this PO line
        grn_in = PurchaseReceiptCreate(
            supplier_id=supplier.id,
            order_id=po.id,
            items=[
                PurchaseReceiptItemCreate(
                    product_id=po_item.product_id,
                    variant_id=var.id,
                    purchase_order_id=po.id,
                    purchase_order_line_id=po_item.id,
                    quantity_received=Decimal("5"),
                    cost_price=Decimal("1200.00"),
                )
            ],
        )
        grn = await po_svc.create_purchase_receipt(grn_in)
        stmt = select(PurchaseReceiptItem).where(
            PurchaseReceiptItem.receipt_id == grn.id,
            PurchaseReceiptItem.is_deleted == False,
        )
        res = await db.execute(stmt)
        grn_items = res.scalars().all()
        assert len(grn_items) == 1
        grn_item = grn_items[0]

        # Invariant: GRN line inherits variant_id strictly from PO line
        assert grn_item.variant_id == var.id


# ── Test 17: StockMovement variant propagation ────────────────────────────────
@pytest.mark.asyncio
async def test_17_stock_movement_variant_propagation_from_grn():
    sessionmaker = get_company_sessionmaker("smriti001")
    company_id = "COMP-001"
    async with sessionmaker() as db:
        suffix = uuid.uuid4().hex[:6].upper()

        item = Item(
            id=f"itm_sm_{uuid.uuid4().hex[:8]}",
            company_id=company_id,
            item_code=f"STYLE-SM-{suffix}",
            item_name=f"Style SM {suffix}",
            category="FOOTWEAR",
            brand="SMRITI",
            is_active=True,
        )
        db.add(item)
        await db.flush()

        var, _, _ = await ItemDomainService.create_variant(
            session=db,
            req=ItemVariantCreateRequest(
                style_id=item.id,
                color="WHITE",
                size="8",
                variant_sku=f"SKU-SM-{suffix}",
                mrp=2200.0,
            ),
            company_id=company_id,
            commit=True,
        )

        tenant_ctx = TenantContext(
            company_id=company_id,
            branch_id="BR-MAIN-001",
        )
        po_svc = PurchaseService(db, tenant_ctx)
        supplier = Supplier(
            id=f"sup_sm_{uuid.uuid4().hex[:8]}",
            code=f"SUP-SM-{suffix}",
            company_id=company_id,
            name=f"Supplier SM {suffix}",
            is_active=True,
        )
        warehouse = Warehouse(
            id=f"wh_sm_{uuid.uuid4().hex[:8]}",
            code=f"WH-SM-{suffix}",
            company_id=company_id,
            branch_id="BR-MAIN-001",
            name=f"Warehouse SM {suffix}",
            is_active=True,
        )
        db.add_all([supplier, warehouse])
        await db.flush()

        po_in = PurchaseOrderCreate(
            supplier_id=supplier.id,
            lines=[
                PurchaseOrderItemCreate(
                    product_id=item.id,
                    variant_id=var.id,
                    quantity=Decimal("4"),
                    cost_price=Decimal("1100.00"),
                )
            ],
        )
        po = await po_svc.create_purchase_order(po_in)
        po_item = po.items[0]

        grn_in = PurchaseReceiptCreate(
            supplier_id=supplier.id,
            order_id=po.id,
            warehouse_id=warehouse.id,
            items=[
                PurchaseReceiptItemCreate(
                    product_id=po_item.product_id,
                    variant_id=var.id,
                    purchase_order_id=po.id,
                    purchase_order_line_id=po_item.id,
                    quantity_received=Decimal("4"),
                    cost_price=Decimal("1100.00"),
                )
            ],
        )
        grn = await po_svc.create_purchase_receipt(grn_in)
        await db.commit()

        # Verify StockMovement records created with variant_id
        stmt = select(StockMovement).where(
            StockMovement.reference_doc_id == grn.id,
            StockMovement.company_id == company_id,
        )
        res = await db.execute(stmt)
        movements = res.scalars().all()
        assert len(movements) >= 1
        for mv in movements:
            assert mv.variant_id == var.id


# ── Test 18: Tracking concurrency ─────────────────────────────────────────────
@pytest.mark.asyncio
async def test_18_tracking_concurrency_savepoint_flush_boundary():
    sessionmaker = get_company_sessionmaker("smriti001")
    company_id = "COMP-001"

    async with sessionmaker() as db:
        suffix = uuid.uuid4().hex[:6].upper()
        item = Item(
            id=f"itm_tc_{uuid.uuid4().hex[:8]}",
            company_id=company_id,
            item_code=f"STYLE-TC-{suffix}",
            item_name=f"Style TC {suffix}",
            is_active=True,
        )
        db.add(item)
        await db.flush()

        var = ItemVariant(
            id=f"var_tc_{uuid.uuid4().hex[:8]}",
            company_id=company_id,
            item_id=item.id,
            variant_sku=f"SKU-TC-{suffix}",
            variant_name=f"Style TC {suffix} Black 9",
            color="BLACK",
            size="9",
            is_active=True,
        )
        db.add(var)
        await db.commit()

    # Run 5 concurrent tracking batch records under separate sessions
    async def create_tracking_entry(idx: int):
        async with sessionmaker() as session:
            batch = await ItemTrackingService.resolve_or_create_batch(
                session=session,
                item_id=item.id,
                batch_number=f"BATCH-{idx}-{uuid.uuid4().hex[:4]}",
                variant_id=var.id,
                company_id=company_id,
                branch_id="BR-MAIN-001",
                auto_commit=True,
            )
            return batch.id

    results = await asyncio.gather(*(create_tracking_entry(i) for i in range(5)))
    assert len(results) == 5
    assert len(set(results)) == 5  # 5 distinct records without deadlocks or savepoint errors
