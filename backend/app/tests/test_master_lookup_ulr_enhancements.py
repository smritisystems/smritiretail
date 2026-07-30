"""
Unit and Integration Tests for Universal Lookup Registry (ULR) Enhancements.
"""

import pytest
from uuid import uuid4
from app.models.master_lookup import MasterType, MasterValue
from app.repositories.master_lookup import LookupRepository
from app.services.master_lookup import LookupService
from app.schemas.master_lookup import MasterValueCreate, MasterValueUpdate


@pytest.mark.asyncio
async def test_ulr_is_default_and_branch_support(db_session):
    repo = LookupRepository(db_session)
    service = LookupService(db_session)

    type_code = f"ULR_TYPE_{uuid4().hex[:6].upper()}"

    # 1. Create a MasterType
    mtype = MasterType(
        id=uuid4(),
        code=type_code,
        label="Test ULR Type",
        category_type="BUSINESS",
        is_system=False,
        field_schema={},
    )
    await repo.create_type(mtype)

    # 2. Create MasterValue with is_default and branch_id
    val_in = MasterValueCreate(
        code="ULR_VAL_01",
        name="Test Default Branch Value",
        is_default=True,
        branch_id="BR-MAIN-01",
        sort_order=10,
    )
    val = await service.create_value(type_code, val_in, tenant_id="TENANT-001")

    assert val.code == "ULR_VAL_01"
    assert val.name == "Test Default Branch Value"
    assert val.is_default is True
    assert val.branch_id == "BR-MAIN-01"

    # 3. Query with branch_id filter
    branch_vals = await service.search_values(type_code, branch_id="BR-MAIN-01")
    assert len(branch_vals) >= 1
    assert branch_vals[0].code == "ULR_VAL_01"


@pytest.mark.asyncio
async def test_ulr_bulk_operations(db_session):
    repo = LookupRepository(db_session)
    service = LookupService(db_session)

    type_code = f"BULK_TYPE_{uuid4().hex[:6].upper()}"

    mtype = MasterType(
        id=uuid4(),
        code=type_code,
        label="Test Bulk Type",
        category_type="BUSINESS",
        is_system=False,
        field_schema={},
    )
    await repo.create_type(mtype)

    val1 = await service.create_value(type_code, MasterValueCreate(code="BULK_01", name="Bulk Val 1"))
    val2 = await service.create_value(type_code, MasterValueCreate(code="BULK_02", name="Bulk Val 2"))

    # Test Bulk Set Active (Deactivate)
    res_deact = await service.bulk_set_active([val1.id, val2.id], active=False)
    assert res_deact["affected_count"] == 2

    # Verify deactivated
    v1_updated = await repo.get_value_by_id(val1.id)
    assert v1_updated.active is False

    # Test Bulk Reorder
    res_reorder = await service.bulk_reorder([{"id": val1.id, "sort_order": 99}, {"id": val2.id, "sort_order": 100}])
    assert res_reorder["reordered_count"] == 2

    # Test Bulk Soft Delete
    res_del = await service.bulk_soft_delete([val1.id, val2.id], deleted_by="admin_user")
    assert res_del["affected_count"] == 2


@pytest.mark.asyncio
async def test_ulr_ai_duplicate_detection(db_session):
    repo = LookupRepository(db_session)
    service = LookupService(db_session)

    type_code = f"AI_TYPE_{uuid4().hex[:6].upper()}"

    mtype = MasterType(
        id=uuid4(),
        code=type_code,
        label="Test AI Type",
        category_type="BUSINESS",
        is_system=False,
        field_schema={},
    )
    await repo.create_type(mtype)

    await service.create_value(type_code, MasterValueCreate(code="DEPT_HR", name="Human Resources"))
    await service.create_value(type_code, MasterValueCreate(code="DEPT-HR", name="Human Resources Dept"))

    report = await service.ai_detect_duplicates(type_code)
    assert report["type_code"] == type_code
    assert len(report["duplicate_candidates"]) >= 1
    assert report["duplicate_candidates"][0]["similarity_score"] >= 0.80
