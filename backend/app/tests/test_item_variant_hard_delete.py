"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.82.0
Created      : 2026-10-15
Modified     : 2026-10-15
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Enterprise Domain Verification Test Suite
"""

import uuid
from decimal import Decimal
import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select

from app.api.deps import TenantContext, get_tenant_context
from app.core.security import create_access_token, hash_password
from app.main import app
from app.models.auth import User, UserRole
from app.models.item_master import Item, ItemVariant, ItemBarcode, ItemBatch
from app.models.inventory import Product
from app.models.tenant import Company, Branch
from app.models.audit import ComplianceImmutableAuditLog
from app.services.item_domain_svc import ItemDomainService, BusinessLogicError
from app.schemas.item_master import (
    ItemStyleCreateRequest,
    ItemVariantCreateRequest,
    ItemVariantUpdateRequest,
)


async def _make_tenant(db_session, suffix: str):
    s = f"{suffix}_{uuid.uuid4().hex[:6]}"
    comp = Company(
        id=f"comp-hd-{s}",
        name=f"Hard Delete Test Co {s}",
        gst_number="27ABCDE1234F1Z5",
        is_active=True,
    )
    br = Branch(
        id=f"br-hd-{s}",
        company_id=comp.id,
        name=f"Main Branch {s}",
        code=f"BR-{s.upper()}",
        is_active=True,
    )
    db_session.add_all([comp, br])
    await db_session.commit()
    return comp, br


async def _make_user(db_session, suffix: str, comp_id: str, br_id: str, role: UserRole = UserRole.MANAGER):
    s = f"{suffix}_{uuid.uuid4().hex[:6]}"
    user = User(
        id=f"usr-hd-{s}",
        username=f"usr_hd_{s}",
        hashed_password=hash_password("Test@1234"),
        role=role,
        is_active=True,
        is_deleted=False,
        company_id=comp_id,
        branch_id=br_id,
    )
    db_session.add(user)
    await db_session.commit()
    return user


def _bearer(user: User, comp_id: str, br_id: str) -> dict:
    token = create_access_token({
        "sub": user.id,
        "username": user.username,
        "role": user.role.value,
        "company_id": comp_id,
        "branch_id": br_id,
        "jti": str(uuid.uuid4()),
        "type": "access",
    })
    return {"Authorization": f"Bearer {token}"}


def _set_tenant(comp_id: str, br_id: str):
    async def _gt():
        return TenantContext(company_id=comp_id, branch_id=br_id)
    app.dependency_overrides[get_tenant_context] = _gt


@pytest.mark.asyncio
async def test_untransacted_variant_hard_delete_and_sku_release(db_session):
    """
    Test 1: Guarded Hard Delete for 100% Un-transacted Variant.
    Verifies:
    - Pre-flight status reports can_hard_delete=True, transaction_count=0.
    - Physical removal of variant, barcodes, and legacy product row.
    - Released SKU and Barcode can be reused immediately without collision.
    - WORM audit trail created in ComplianceImmutableAuditLog.
    """
    comp, br = await _make_tenant(db_session, "uhd1")
    manager = await _make_user(db_session, "mgr", comp.id, br.id, role=UserRole.MANAGER)
    headers = _bearer(manager, comp.id, br.id)
    _set_tenant(comp.id, br.id)

    # 1. Create parent style
    style_code = f"ST-{uuid.uuid4().hex[:8].upper()}"
    style_req = ItemStyleCreateRequest(
        style_code=style_code,
        style_name="Mistake Style Un-transacted",
        brand="CAMPUS",
        category="FOOTWEAR",
        primary_uom="PRS",
        hsn_code="64041990",
        tax_rate=18.0,
    )
    style = await ItemDomainService.create_style(db_session, style_req, company_id=comp.id)
    assert style.id is not None

    # 2. Create un-transacted variant with unique SKU and Barcode
    sku_to_purge = f"PURGE-SKU-{uuid.uuid4().hex[:6].upper()}"
    barcode_to_purge = f"89099{uuid.uuid4().hex[:7].upper()}"
    var_req = ItemVariantCreateRequest(
        style_id=style.id,
        variant_sku=sku_to_purge,
        color="RED",
        size="8",
        primary_barcode=barcode_to_purge,
        mrp=999.0,
        selling_price=799.0,
        cost_price=450.0,
    )
    variant, _, _ = await ItemDomainService.create_variant(db_session, var_req, company_id=comp.id, branch_id=br.id)
    assert variant.id is not None
    assert variant.variant_sku == sku_to_purge

    # Create sibling variant to verify parent style preservation when other variants remain
    sibling_sku = f"SIBLING-SKU-{uuid.uuid4().hex[:6].upper()}"
    var2_req = ItemVariantCreateRequest(
        style_id=style.id,
        variant_sku=sibling_sku,
        color="BLUE",
        size="9",
        mrp=999.0,
        selling_price=799.0,
        cost_price=450.0,
    )
    sibling_variant, _, _ = await ItemDomainService.create_variant(db_session, var2_req, company_id=comp.id, branch_id=br.id)
    assert sibling_variant.id is not None

    # 3. Check pre-flight deletion eligibility via API
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        status_res = await ac.get(f"/api/v1/item-variants/{variant.id}/deletion-status", headers=headers)
        assert status_res.status_code == 200, f"Got {status_res.status_code}: {status_res.text}"
        del_status = status_res.json()
        assert del_status["can_hard_delete"] is True
        assert del_status["transaction_count"] == 0
        assert len(del_status["blocking_reasons"]) == 0

        # 4. Perform guarded permanent hard delete via API
        del_res = await ac.delete(f"/api/v1/item-variants/{variant.id}/hard-delete", headers=headers)
        assert del_res.status_code == 200, f"Got {del_res.status_code}: {del_res.text}"
        del_data = del_res.json()
        assert del_data["success"] is True
        assert del_data["released_sku"] == sku_to_purge
        assert barcode_to_purge in del_data["released_barcodes"]
        assert del_data["parent_style_deleted"] is False

    # 5. Verify database records: purged variant is removed, parent style and sibling variant preserved
    check_var = await db_session.scalar(
        select(ItemVariant).where(ItemVariant.id == variant.id)
    )
    assert check_var is None

    check_bc = await db_session.scalar(
        select(ItemBarcode).where(ItemBarcode.barcode == barcode_to_purge)
    )
    assert check_bc is None

    # Parent style must still exist!
    check_style = await db_session.scalar(
        select(Item).where(Item.id == style.id)
    )
    assert check_style is not None

    # Sibling variant must still exist!
    check_sibling = await db_session.scalar(
        select(ItemVariant).where(ItemVariant.id == sibling_variant.id)
    )
    assert check_sibling is not None

    # 6. Verify released SKU and Barcode can now be reused without collision!
    reuse_req = ItemVariantCreateRequest(
        style_id=style.id,
        variant_sku=sku_to_purge,  # Reused released SKU!
        color="BLACK",
        size="10",
        primary_barcode=barcode_to_purge,  # Reused released barcode!
        mrp=1299.0,
        selling_price=1099.0,
    )
    reused_variant, _, _ = await ItemDomainService.create_variant(db_session, reuse_req, company_id=comp.id, branch_id=br.id)
    assert reused_variant.id is not None
    assert reused_variant.variant_sku == sku_to_purge

    # 7. Verify WORM audit trail in ComplianceImmutableAuditLog
    audit_row = await db_session.scalar(
        select(ComplianceImmutableAuditLog).where(
            ComplianceImmutableAuditLog.company_id == comp.id,
            ComplianceImmutableAuditLog.event_type == "ITEM_VARIANT_HARD_DELETED",
            ComplianceImmutableAuditLog.entity_id == variant.id,
        )
    )
    assert audit_row is not None
    assert sku_to_purge in audit_row.action_summary
    assert audit_row.worm_locked is True


@pytest.mark.asyncio
async def test_transacted_variant_blocks_hard_delete_409(db_session):
    """
    Test 2: Guarded Deletion Blocks Transacted Variant with HTTP 409 Conflict.
    Simulates live stock and batch dependencies against the variant.
    """
    comp, br = await _make_tenant(db_session, "thd2")
    manager = await _make_user(db_session, "mgr", comp.id, br.id, role=UserRole.MANAGER)
    headers = _bearer(manager, comp.id, br.id)
    _set_tenant(comp.id, br.id)

    # 1. Create style and variant
    style_req = ItemStyleCreateRequest(
        style_code=f"ST-{uuid.uuid4().hex[:8].upper()}",
        style_name="Transacted Style",
        brand="BATA",
        category="FORMAL",
        primary_uom="PRS",
    )
    style = await ItemDomainService.create_style(db_session, style_req, company_id=comp.id)
    sku = f"TX-SKU-{uuid.uuid4().hex[:6].upper()}"
    var_req = ItemVariantCreateRequest(
        style_id=style.id,
        variant_sku=sku,
        color="BROWN",
        size="7",
        mrp=1999.0,
        selling_price=1799.0,
    )
    variant, _, _ = await ItemDomainService.create_variant(db_session, var_req, company_id=comp.id, branch_id=br.id)

    # 2. Simulate transaction dependency: active inventory batch attached to variant
    active_batch = ItemBatch(
        id=f"bat-{uuid.uuid4().hex[:12]}",
        company_id=comp.id,
        item_id=style.id,
        variant_id=variant.id,
        batch_number=f"BAT-{uuid.uuid4().hex[:6].upper()}",
        mrp=Decimal("1999.0"),
        cost_price=Decimal("1200.0"),
        is_active=True,
    )
    db_session.add(active_batch)

    # Also update legacy product stock
    prod = await db_session.scalar(
        select(Product).where(Product.company_id == comp.id, Product.sku == sku)
    )
    if prod:
        prod.stock = 5.0
    await db_session.commit()

    # 3. Check pre-flight status via API
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        status_res = await ac.get(f"/api/v1/item-variants/{variant.id}/deletion-status", headers=headers)
        assert status_res.status_code == 200, f"Got {status_res.status_code}: {status_res.text}"
        del_status = status_res.json()
        assert del_status["can_hard_delete"] is False
        assert del_status["transaction_count"] >= 1
        assert any("Batch" in r or "Stock" in r for r in del_status["blocking_reasons"])

        # 4. Attempt hard delete via API: MUST return HTTP 409 Conflict
        del_res = await ac.delete(f"/api/v1/item-variants/{variant.id}/hard-delete", headers=headers)
        assert del_res.status_code == 409
        err_msg = del_res.json()["detail"]
        assert "Cannot hard delete" in err_msg


@pytest.mark.asyncio
async def test_untransacted_variant_identity_edit(db_session):
    """
    Test 3: Un-transacted variant allows correcting identity fields (SKU, Color, Size, Barcode) via PUT.
    """
    comp, br = await _make_tenant(db_session, "edit3")
    manager = await _make_user(db_session, "mgr", comp.id, br.id, role=UserRole.MANAGER)
    headers = _bearer(manager, comp.id, br.id)
    _set_tenant(comp.id, br.id)

    style_req = ItemStyleCreateRequest(
        style_code=f"ST-{uuid.uuid4().hex[:8].upper()}",
        style_name="Editable Variant Style",
        brand="ACTION",
        category="CASUAL",
        primary_uom="PRS",
    )
    style = await ItemDomainService.create_style(db_session, style_req, company_id=comp.id)

    old_sku = f"OLD-SKU-{uuid.uuid4().hex[:6].upper()}"
    old_bc = f"89011{uuid.uuid4().hex[:7].upper()}"
    var_req = ItemVariantCreateRequest(
        style_id=style.id,
        variant_sku=old_sku,
        color="NAVY",
        size="6",
        primary_barcode=old_bc,
        mrp=599.0,
        selling_price=499.0,
    )
    variant, _, _ = await ItemDomainService.create_variant(db_session, var_req, company_id=comp.id, branch_id=br.id)

    # Correct variant identity via API PUT with approved Master Lookup values
    new_sku = f"CORRECT-SKU-{uuid.uuid4().hex[:6].upper()}"
    new_bc = f"89022{uuid.uuid4().hex[:7].upper()}"
    update_payload = {
        "variant_sku": new_sku,
        "primary_barcode": new_bc,
        "color": "BLUE",
        "size": "UK-7",
        "mrp": 649.0,
        "selling_price": 549.0,
    }

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        put_res = await ac.put(f"/api/v1/item-variants/{variant.id}", json=update_payload, headers=headers)
        assert put_res.status_code == 200, f"Got {put_res.status_code}: {put_res.text}"
        updated = put_res.json()
        assert updated["variant_sku"] == new_sku
        assert updated["color"] == "BLUE"
        assert updated["size"] == "UK-7"
        assert float(updated["mrp"]) == 649.0
        primary_bcs = [b["barcode"] for b in updated["barcodes"] if b.get("is_primary")]
        assert new_bc in primary_bcs

        # Verify that unlisted Master Lookup word is strictly rejected with 422
        bad_payload = {
            "color": "NON_EXISTENT_COLOR_123",
            "size": "UK-7",
        }
        bad_res = await ac.put(f"/api/v1/item-variants/{variant.id}", json=bad_payload, headers=headers)
        assert bad_res.status_code == 422, f"Expected 422 for unlisted color, got: {bad_res.status_code}"
        err = bad_res.json()
        assert "not registered in the Master Lookup registry" in str(err) or "Color" in str(err)


@pytest.mark.asyncio
async def test_transacted_variant_identity_edit_rejection(db_session):
    """
    Test 4: Transacted variant locks identity fields (SKU, Color, Size, Barcode) returning 409
    but permits commercial and active status updates.
    """
    comp, br = await _make_tenant(db_session, "lock4")
    manager = await _make_user(db_session, "mgr", comp.id, br.id, role=UserRole.MANAGER)
    headers = _bearer(manager, comp.id, br.id)
    _set_tenant(comp.id, br.id)

    style_req = ItemStyleCreateRequest(
        style_code=f"ST-{uuid.uuid4().hex[:8].upper()}",
        style_name="Locked Variant Style",
        brand="SPARX",
        category="SPORTS",
        primary_uom="PRS",
    )
    style = await ItemDomainService.create_style(db_session, style_req, company_id=comp.id)

    sku = f"LOCKED-SKU-{uuid.uuid4().hex[:6].upper()}"
    var_req = ItemVariantCreateRequest(
        style_id=style.id,
        variant_sku=sku,
        color="GREY",
        size="8",
        mrp=899.0,
        selling_price=799.0,
    )
    variant, _, _ = await ItemDomainService.create_variant(db_session, var_req, company_id=comp.id, branch_id=br.id)

    # Simulate transaction by attaching active batch with quantity
    batch = ItemBatch(
        id=f"bat-{uuid.uuid4().hex[:12]}",
        company_id=comp.id,
        item_id=style.id,
        variant_id=variant.id,
        batch_number=f"BAT-{uuid.uuid4().hex[:6].upper()}",
        mrp=Decimal("899.0"),
        is_active=True,
    )
    db_session.add(batch)
    await db_session.commit()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Attempt to change SKU: MUST return HTTP 409 Conflict
        put_res = await ac.put(f"/api/v1/item-variants/{variant.id}", json={"variant_sku": "NEW-ATTEMPT-SKU"}, headers=headers)
        assert put_res.status_code == 409, f"Got {put_res.status_code}: {put_res.text}"
        assert "Identity fields are permanent once transacted" in put_res.json()["detail"]

        # Updating commercial fields (MRP, selling price, active status) MUST succeed with 200
        comm_update = {
            "mrp": 949.0,
            "selling_price": 849.0,
            "is_active": False,
        }
        comm_res = await ac.put(f"/api/v1/item-variants/{variant.id}", json=comm_update, headers=headers)
        assert comm_res.status_code == 200, f"Got {comm_res.status_code}: {comm_res.text}"
        updated = comm_res.json()
        assert float(updated["mrp"]) == 949.0
        assert float(updated["selling_price"]) == 849.0
        assert updated["is_active"] is False


@pytest.mark.asyncio
async def test_variant_deactivate_and_reactivate(db_session):
    """
    Test 5: Toggle active status (is_active) via PATCH endpoint.
    """
    comp, br = await _make_tenant(db_session, "act5")
    manager = await _make_user(db_session, "mgr", comp.id, br.id, role=UserRole.MANAGER)
    headers = _bearer(manager, comp.id, br.id)
    _set_tenant(comp.id, br.id)

    style_req = ItemStyleCreateRequest(
        style_code=f"ST-{uuid.uuid4().hex[:8].upper()}",
        style_name="Toggle Active Style",
        brand="WOODLAND",
        category="BOOTS",
        primary_uom="PRS",
    )
    style = await ItemDomainService.create_style(db_session, style_req, company_id=comp.id)
    sku = f"ACT-SKU-{uuid.uuid4().hex[:6].upper()}"
    var_req = ItemVariantCreateRequest(
        style_id=style.id,
        variant_sku=sku,
        color="KHAKI",
        size="9",
        mrp=3499.0,
        selling_price=2999.0,
    )
    variant, _, _ = await ItemDomainService.create_variant(db_session, var_req, company_id=comp.id, branch_id=br.id)
    assert variant.is_active is True

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Deactivate
        patch_deact = await ac.patch(f"/api/v1/item-variants/{variant.id}/status?is_active=false", headers=headers)
        assert patch_deact.status_code == 200
        assert patch_deact.json()["is_active"] is False

        # Reactivate
        patch_act = await ac.patch(f"/api/v1/item-variants/{variant.id}/status?is_active=true", headers=headers)
        assert patch_act.status_code == 200
        assert patch_act.json()["is_active"] is True
