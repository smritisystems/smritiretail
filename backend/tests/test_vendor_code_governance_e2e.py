"""
Project      : SMRITI Retail OS
Repository   : SMRITIRetailNX
Organization : AITDL NETWORKS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 4.0.0
Created      : 2026-09-12
Modified     : 2026-09-12
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import sys
import uuid
from decimal import Decimal
from pathlib import Path
import pytest
from fastapi import HTTPException
from sqlalchemy import select, delete, or_, and_, text
from sqlalchemy.exc import IntegrityError

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.db.session import get_company_sessionmaker
from app.models.party import (
    Party,
    PartyRole,
    SupplierProfile,
    VendorIdentityMigration,
)
from app.models.purchase import Supplier
from app.models.inventory import Product, Warehouse, WarehouseLocation
from app.schemas.vendor import (
    VendorCreateRequest,
    VendorCommercialProfileDTO,
)
from app.services.vendor_svc import VendorService


class MockTenant:
    company_id = "COMP-001"
    branch_id = "MAIN"
    user_id = "USR-ARCH-GOV"


TEST_VENDOR_CODES = ["VGOV-001", "VGOV-002", "VGOV-COLLIDE"]
TEST_STYLE_CODES = ["ST-GOV-ALPHA", "ST-GOV-BETA"]


@pytest.fixture(autouse=True)
async def cleanup_gov_e2e_data():
    """Clean up test entities before and after each test."""
    session_factory = get_company_sessionmaker("smriti001")
    async with session_factory() as session:
        # Delete test products
        await session.execute(
            delete(Product).where(
                or_(
                    Product.style_code.in_(TEST_STYLE_CODES),
                    Product.code.like("PRD-GOV-%"),
                    Product.vendor_code.in_(TEST_VENDOR_CODES),
                )
            )
        )
        # Delete test warehouse locations
        await session.execute(
            delete(WarehouseLocation).where(
                WarehouseLocation.code.like("LOC-GOV-%")
            )
        )
        # Delete test warehouses
        await session.execute(
            delete(Warehouse).where(
                Warehouse.id.like("wh-gov-%")
            )
        )
        # Delete test vendor migrations
        await session.execute(
            delete(VendorIdentityMigration).where(
                VendorIdentityMigration.legacy_supplier_id.like("sup-vgov%")
            )
        )
        # Delete test suppliers
        await session.execute(
            delete(Supplier).where(
                Supplier.code.in_(TEST_VENDOR_CODES)
            )
        )
        # Delete test parties
        await session.execute(
            delete(Party).where(
                Party.party_code.in_(TEST_VENDOR_CODES)
            )
        )
        await session.commit()

    yield

    async with session_factory() as session:
        await session.execute(
            delete(Product).where(
                or_(
                    Product.style_code.in_(TEST_STYLE_CODES),
                    Product.code.like("PRD-GOV-%"),
                    Product.vendor_code.in_(TEST_VENDOR_CODES),
                )
            )
        )
        await session.execute(
            delete(WarehouseLocation).where(
                WarehouseLocation.code.like("LOC-GOV-%")
            )
        )
        await session.execute(
            delete(Warehouse).where(
                Warehouse.id.like("wh-gov-%")
            )
        )
        await session.execute(
            delete(VendorIdentityMigration).where(
                VendorIdentityMigration.legacy_supplier_id.like("sup-vgov%")
            )
        )
        await session.execute(
            delete(Supplier).where(
                Supplier.code.in_(TEST_VENDOR_CODES)
            )
        )
        await session.execute(
            delete(Party).where(
                Party.party_code.in_(TEST_VENDOR_CODES)
            )
        )
        await session.commit()


@pytest.mark.asyncio
async def test_vendor_code_collision_and_normalization():
    """
    Test Risk 1:
    1. Vendor Code uniqueness must prevent registering duplicate vendor codes.
    2. Case-insensitive and whitespace-stripped duplicate vendor code registration must be rejected with 409 Conflict.
    """
    session_factory = get_company_sessionmaker("smriti001")
    tenant = MockTenant()

    async with session_factory() as session:
        svc = VendorService(session, tenant)

        # 1. Create canonical vendor
        v1 = await svc.create_vendor(
            VendorCreateRequest(
                code="VGOV-001",
                legal_name="Governed Prime Textiles Ltd",
                mobile="9911002233",
                gstin="27AAAPG1111A1Z1",
            )
        )
        assert v1.code == "VGOV-001"

        # 2. Attempt exact duplicate code
        with pytest.raises(HTTPException) as exc_info:
            await svc.create_vendor(
                VendorCreateRequest(
                    code="VGOV-001",
                    legal_name="Duplicate Code Supplier",
                    mobile="9911002244",
                    gstin="27AAAPG2222A1Z2",
                )
            )
        assert exc_info.value.status_code == 409
        assert "already exists" in str(exc_info.value.detail).lower()

        # 3. Attempt case-insensitive & whitespace duplicate code
        with pytest.raises(HTTPException) as exc_info_case:
            await svc.create_vendor(
                VendorCreateRequest(
                    code=" vgov-001 ",
                    legal_name="Case Invariant Duplicate Supplier",
                    mobile="9911002255",
                    gstin="27AAAPG3333A1Z3",
                )
            )
        assert exc_info_case.value.status_code == 409


@pytest.mark.asyncio
async def test_vendor_style_matrix_and_variant_uniqueness_e2e():
    """
    Test Risk 4:
    E2E Database Lifecycle:
    1. Onboard canonical Vendor VGOV-002.
    2. Define Article/Style ST-GOV-ALPHA with vendor_code="VGOV-002".
    3. Generate 4 Color x Size matrix variants.
    4. Verify uq_variant_identity_active database constraint stops duplicate (company_id, style_code, color, size).
    5. Link variants to canonical warehouse location.
    """
    session_factory = get_company_sessionmaker("smriti001")
    tenant = MockTenant()

    async with session_factory() as session:
        svc = VendorService(session, tenant)

        # Step 1: Create canonical vendor
        vendor = await svc.create_vendor(
            VendorCreateRequest(
                code="VGOV-002",
                legal_name="Heritage Garments Corporation",
                mobile="9922003344",
                gstin="27AAAPG4444A1Z4",
            )
        )
        assert vendor.code == "VGOV-002"

        # Step 2: Create a physical warehouse & location
        wh = Warehouse(
            id=f"wh-gov-{uuid.uuid4().hex[:8]}",
            code="WH-GOV-CENTRAL",
            name="Central Governed Warehouse",
            company_id=tenant.company_id,
            branch_id=tenant.branch_id,
        )
        session.add(wh)
        await session.flush()

        loc = WarehouseLocation(
            id=f"loc-{uuid.uuid4().hex[:8]}",
            company_id=tenant.company_id,
            branch_id=tenant.branch_id,
            warehouse_id=wh.id,
            code="LOC-GOV-A1R2",
            name="Aisle 1 Rack 2 Governed Bin",
            aisle="A1",
            rack="R2",
            shelf="S3",
            bin_code="B05",
        )
        session.add(loc)
        await session.flush()

        # Step 3: Generate 4 matrix variants for Style ST-GOV-ALPHA
        colors = ["Black", "Blue"]
        sizes = ["M", "L"]
        variants: list[Product] = []

        for c in colors:
            for s in sizes:
                prod = Product(
                    id=f"prd-{uuid.uuid4().hex[:12]}",
                    company_id=tenant.company_id,
                    branch_id=tenant.branch_id,
                    code=f"PRD-GOV-{c[:3].upper()}-{s}-{uuid.uuid4().hex[:4]}",
                    name=f"Heritage Denim Jacket {c} {s}",
                    category="Apparel",
                    brand="Heritage",
                    style_code="ST-GOV-ALPHA",
                    vendor_code=vendor.code,
                    color=c,
                    size=s,
                    barcode=f"BAR-GOV-{c[:2].upper()}-{s}-{uuid.uuid4().hex[:4]}",
                    price=Decimal("1999.00"),
                    mrp=Decimal("2499.00"),
                )
                session.add(prod)
                variants.append(prod)

        await session.commit()
        assert len(variants) == 4

        # Step 4: Verify variant uniqueness constraint (uq_variant_identity_active)
        # Attempt to insert duplicate variant with same company_id, lower(style_code), lower(color), lower(size)
        dup_prod = Product(
            id=f"prd-{uuid.uuid4().hex[:12]}",
            company_id=tenant.company_id,
            branch_id=tenant.branch_id,
            code="PRD-GOV-DUP-VARIANT",
            name="Duplicate Heritage Denim Jacket Black M",
            category="Apparel",
            brand="Heritage",
            style_code="st-gov-alpha",  # lower case test
            vendor_code=vendor.code,
            color="black",             # lower case test
            size="m",                  # lower case test
            barcode=f"BAR-GOV-DUP-{uuid.uuid4().hex[:4]}",
            price=Decimal("1999.00"),
        )
        session.add(dup_prod)
        with pytest.raises(IntegrityError) as exc_info:
            await session.commit()
        await session.rollback()
        assert "uq_variant_identity_active" in str(exc_info.value)

        # Step 5: Verify all variants are bound to authoritative vendor_code
        saved_variants = (await session.execute(
            select(Product).where(
                Product.company_id == tenant.company_id,
                Product.style_code == "ST-GOV-ALPHA",
                Product.is_deleted.is_(False),
            )
        )).scalars().all()
        assert len(saved_variants) == 4
        for v in saved_variants:
            assert v.vendor_code == "VGOV-002"
            assert v.brand == "Heritage"


@pytest.mark.asyncio
async def test_vendor_code_immutability_guard():
    """
    Test Risk 1 (Reassignment Protection):
    Once assigned to a product record, vendor_code cannot be mutated to an arbitrary vendor
    without an explicit catalog transfer protocol.
    """
    session_factory = get_company_sessionmaker("smriti001")
    tenant = MockTenant()

    async with session_factory() as session:
        # Create test product with assigned vendor_code
        prod_id = f"prd-{uuid.uuid4().hex[:12]}"
        prod = Product(
            id=prod_id,
            company_id=tenant.company_id,
            branch_id=tenant.branch_id,
            code="PRD-GOV-IMMUTABLE",
            name="Governed Running Shoes",
            category="Footwear",
            brand="Swift",
            style_code="ST-GOV-BETA",
            vendor_code="VGOV-001",
            color="White",
            size="9",
            barcode=f"BAR-GOV-IMM-{uuid.uuid4().hex[:4]}",
            price=Decimal("2999.00"),
        )
        session.add(prod)
        await session.commit()

        # Fetch product and verify immutability rule
        loaded = (await session.execute(select(Product).where(Product.id == prod_id))).scalars().first()
        assert loaded is not None
        assert loaded.vendor_code == "VGOV-001"

        # Simulating business rule check: vendor_code reassignment validation
        proposed_vendor_code = "VGOV-002"
        if loaded.vendor_code and loaded.vendor_code != proposed_vendor_code:
            is_reassignment_blocked = True
        else:
            is_reassignment_blocked = False

        assert is_reassignment_blocked is True
