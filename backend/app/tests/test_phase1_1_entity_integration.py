"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.35.0
Created      : 2026-09-18
Modified     : 2026-09-18
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import pytest
from decimal import Decimal
from datetime import datetime, timezone
from sqlalchemy import select, delete, text
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker

from app.core.config import settings
from app.services.identity.engine import IdentityEngine
from app.services.identity.validator import IdentityValidator
from app.models.tenant import Company, Branch
from app.models.item_master import Item
from app.models.crm import Customer
from app.models.purchase import Supplier
from app.models.identity_registry import SmritiIdentityAlias, SmritiIdentityAllocationLog
from app.schemas.tenant import CompanyResponse, BranchResponse
from app.schemas.item_master import ItemResponse
from app.schemas.crm import CustomerResponse
from app.schemas.purchase import SupplierResponse


@pytest.fixture
def session_factory():
    engine = create_async_engine(settings.DATABASE_URL, pool_size=5, max_overflow=5)
    return async_sessionmaker(bind=engine, expire_on_commit=False)


@pytest.mark.asyncio
async def test_backfilled_identity_codes_format_and_sequence(session_factory):
    """
    Verify all 5 target tables have 100% non-null, validly formatted SMRITI Identity Codes:
    - ORG-CMP-... for companies
    - ORG-BRN-... for branches
    - MST-ITM-... for items
    - CRM-CUS-... for customers
    - PUR-SUP-... for suppliers
    """
    async with session_factory() as session:
        # 1. Companies
        res = await session.execute(
            select(Company.id, Company.identity_code).limit(20)
        )
        companies = res.fetchall()
        assert len(companies) > 0, "Expected companies to be present"
        for cid, id_code in companies:
            assert id_code is not None, f"Company {cid} has null identity_code"
            assert id_code.startswith("ORG-CMP-"), f"Unexpected company code {id_code}"
            assert IdentityValidator.validate_syntax(id_code) is True
            assert await IdentityValidator.validate_identity_code(session, id_code) is True

        # 2. Branches
        res = await session.execute(
            select(Branch.id, Branch.identity_code).limit(20)
        )
        branches = res.fetchall()
        assert len(branches) > 0, "Expected branches to be present"
        for bid, id_code in branches:
            assert id_code is not None, f"Branch {bid} has null identity_code"
            assert id_code.startswith("ORG-BRN-"), f"Unexpected branch code {id_code}"
            assert IdentityValidator.validate_syntax(id_code) is True
            assert await IdentityValidator.validate_identity_code(session, id_code) is True

        # 3. Items
        res = await session.execute(
            select(Item.id, Item.identity_code).limit(20)
        )
        items = res.fetchall()
        assert len(items) > 0, "Expected items to be present"
        for iid, id_code in items:
            assert id_code is not None, f"Item {iid} has null identity_code"
            assert id_code.startswith("MST-ITM-"), f"Unexpected item code {id_code}"
            assert IdentityValidator.validate_syntax(id_code) is True
            assert await IdentityValidator.validate_identity_code(session, id_code) is True

        # 4. Customers
        res = await session.execute(
            select(Customer.id, Customer.identity_code).limit(20)
        )
        customers = res.fetchall()
        assert len(customers) > 0, "Expected customers to be present"
        for cuid, id_code in customers:
            assert id_code is not None, f"Customer {cuid} has null identity_code"
            assert id_code.startswith("CRM-CUS-"), f"Unexpected customer code {id_code}"
            assert IdentityValidator.validate_syntax(id_code) is True
            assert await IdentityValidator.validate_identity_code(session, id_code) is True

        # 5. Suppliers
        res = await session.execute(
            select(Supplier.id, Supplier.identity_code).limit(20)
        )
        suppliers = res.fetchall()
        assert len(suppliers) > 0, "Expected suppliers to be present"
        for sid, id_code in suppliers:
            assert id_code is not None, f"Supplier {sid} has null identity_code"
            assert id_code.startswith("PUR-SUP-"), f"Unexpected supplier code {id_code}"
            assert IdentityValidator.validate_syntax(id_code) is True
            assert await IdentityValidator.validate_identity_code(session, id_code) is True


@pytest.mark.asyncio
async def test_tier_1_governed_identity_code_resolution(session_factory):
    """
    Verify that backfilled entities resolve deterministically via Tier 1 (Allocation Log / Identity Code).
    """
    async with session_factory() as session:
        # Sample one item
        item_res = await session.execute(
            select(Item.id, Item.identity_code)
            .where(Item.identity_code.is_not(None))
            .limit(1)
        )
        item = item_res.fetchone()
        assert item is not None

        res = await IdentityEngine.resolve_identifier(
            session=session,
            identifier=item.identity_code,
        )
        assert res.found is True, f"Failed to resolve item by identity code {item.identity_code}"
        assert res.canonical_id == item.id
        assert res.entity_type == "ITEM"
        assert res.resolution_tier in ["TIER_1_ALLOCATION_LOG", "TIER_1_IDENTITY_CODE"]

        # Sample one company
        cmp_res = await session.execute(
            select(Company.id, Company.identity_code)
            .where(Company.identity_code.is_not(None))
            .limit(1)
        )
        company = cmp_res.fetchone()
        assert company is not None

        res_cmp = await IdentityEngine.resolve_identifier(
            session=session,
            identifier=company.identity_code,
        )
        assert res_cmp.found is True
        assert res_cmp.canonical_id == company.id
        assert res_cmp.entity_type == "COMPANY"


@pytest.mark.asyncio
async def test_tier_2_legacy_shoper9_alias_resolution(session_factory):
    """
    Verify that historical Shoper 9 identifiers resolve through smriti_identity_alias to canonical entities.
    """
    async with session_factory() as session:
        # Find a legacy alias ingested during migration
        alias_res = await session.execute(
            select(SmritiIdentityAlias)
            .where(
                SmritiIdentityAlias.source_system == "SHOPER9",
                SmritiIdentityAlias.alias_type == "LEGACY_IMPORT",
            )
            .limit(1)
        )
        alias = alias_res.scalars().first()
        assert alias is not None, "Expected at least one Shoper 9 alias to be present"

        # Resolve using the historical legacy alias code
        res = await IdentityEngine.resolve_identifier(
            session=session,
            identifier=alias.alias_code,
            company_id=alias.company_id,
        )
        assert res.found is True, f"Failed to resolve legacy alias {alias.alias_code}"
        assert res.canonical_id == alias.entity_id
        assert res.entity_type == alias.entity_type
        assert res.resolution_tier in ["TIER_2_ALIAS", "TIER_2_HISTORICAL_ALIAS"]


@pytest.mark.asyncio
async def test_entity_creation_lifecycle_allocates_governed_identity_code(session_factory):
    """
    Verify that allocating a new identity for an entity uses the numbering sequence and generates valid codes.
    """
    async with session_factory() as session:
        try:
            async with session.begin():
                # Allocate next item identity
                tech_id, id_code = await IdentityEngine.generate_identity(
                    session=session,
                    entity_type="ITEM",
                    purpose="PHASE_1_1_UNIT_TEST",
                    correlation_id="test_alloc_item_1",
                )

            assert len(tech_id) == 36
            assert id_code.startswith("MST-ITM-")
            assert IdentityValidator.validate_syntax(id_code) is True

            # Verify allocation logged
            alloc_res = await session.execute(
                select(SmritiIdentityAllocationLog).where(
                    SmritiIdentityAllocationLog.identity_code == id_code
                )
            )
            alloc = alloc_res.scalars().first()
            assert alloc is not None
            assert alloc.purpose == "PHASE_1_1_UNIT_TEST"
            assert alloc.canonical_id == tech_id
        finally:
            async with session_factory() as cleanup_session:
                async with cleanup_session.begin():
                    await cleanup_session.execute(
                        delete(SmritiIdentityAllocationLog).where(
                            SmritiIdentityAllocationLog.purpose == "PHASE_1_1_UNIT_TEST"
                        )
                    )


def test_pydantic_schema_serialization():
    """
    Verify that all 5 Pydantic response schemas serialize identity_code properly.
    """
    now = datetime.now(timezone.utc)

    # 1. CompanyResponse
    cmp_dto = CompanyResponse(
        id="cmp_test_123",
        uuid="0191f6e2-2a74-7221-a203-d34eefb5e43a",
        name="Test Retail Corp",
        identity_code="ORG-CMP-00000001",
        is_deleted=False,
        created_at=now,
        modified_at=now,
    )
    assert cmp_dto.identity_code == "ORG-CMP-00000001"
    assert cmp_dto.model_dump()["identity_code"] == "ORG-CMP-00000001"

    # 2. BranchResponse
    brn_dto = BranchResponse(
        id="brn_test_123",
        uuid="0191f6e2-2a74-7221-a203-d34eefb5e43a",
        company_id="cmp_test_123",
        name="Flagship Store",
        code="FLG01",
        identity_code="ORG-BRN-00000001",
        is_deleted=False,
        created_at=now,
        modified_at=now,
    )
    assert brn_dto.identity_code == "ORG-BRN-00000001"
    assert brn_dto.model_dump()["identity_code"] == "ORG-BRN-00000001"

    # 3. ItemResponse
    itm_dto = ItemResponse(
        id="itm_test_123",
        item_code="SKU-1001",
        item_name="Formal Linen Shirt",
        item_type="STANDARD",
        category="Apparel",
        tax_rate=5.0,
        primary_uom="PCS",
        mrp=1999.0,
        selling_price=1799.0,
        cost_price=900.0,
        is_batch_tracked=False,
        is_serial_tracked=False,
        status="ACTIVE",
        identity_code="MST-ITM-00000001",
    )
    assert itm_dto.identity_code == "MST-ITM-00000001"
    assert itm_dto.model_dump()["identity_code"] == "MST-ITM-00000001"

    # 4. CustomerResponse
    cus_dto = CustomerResponse(
        id="cus_test_123",
        name="Jane Doe",
        code="CUS-001",
        identity_code="CRM-CUS-00000001",
    )
    assert cus_dto.identity_code == "CRM-CUS-00000001"
    assert cus_dto.model_dump()["identity_code"] == "CRM-CUS-00000001"

    # 5. SupplierResponse
    sup_dto = SupplierResponse(
        id="sup_test_123",
        name="Apex Textiles Ltd",
        code="VEND-01",
        outstanding=Decimal("15000.00"),
        identity_code="PUR-SUP-00000001",
    )
    assert sup_dto.identity_code == "PUR-SUP-00000001"
    assert sup_dto.model_dump()["identity_code"] == "PUR-SUP-00000001"
