"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 5.1.0
Created      : 2026-07-21
Modified     : 2026-07-21
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal Architecture Standard
"""

import asyncio
import pytest
from uuid import uuid4
from fastapi import HTTPException

from app.models.master_lookup import MasterType, MasterValue
from app.repositories.master_lookup import LookupRepository
from app.services.master_lookup import LookupService, register_lookup_event_listener
from app.schemas.master_lookup import MasterValueCreate, MasterValueReplace, MasterValueUpdate


@pytest.mark.asyncio
async def test_repository_and_service_crud(db_session):
    repo = LookupRepository(db_session)
    service = LookupService(db_session)

    # 1. Ensure master type exists or create test type
    test_type_code = f"test_cat_{uuid4().hex[:6]}"
    mtype = MasterType(
        code=test_type_code,
        label="Test Category",
        category_type="REFERENCE",
        is_system=False,
        field_schema={"type": "object"}
    )
    await repo.create_type(mtype)

    # 2. Create value
    val_in = MasterValueCreate(
        code="VAL_01",
        name="Test Value 1",
        active=True
    )
    created = await service.create_value(test_type_code, val_in)
    assert created.code == "VAL_01"
    assert created.name == "Test Value 1"
    assert created.active is True
    assert created.supersedes_id is None

    # 3. Get value
    fetched = await service.get_value("VAL_01", type_code=test_type_code)
    assert fetched.id == created.id

    # 4. Search values
    search_res = await service.search_values(test_type_code)
    assert len(search_res) >= 1
    assert any(v.code == "VAL_01" for v in search_res)

    # 5. Validate value
    is_valid = await service.validate_value(test_type_code, "VAL_01")
    assert is_valid is True

    # 6. Update value
    update_in = MasterValueUpdate(name="Test Value 1 Updated")
    updated = await service.update_value(str(created.id), update_in)
    assert updated.name == "Test Value 1 Updated"


@pytest.mark.asyncio
async def test_atomic_replacement_versioning(db_session):
    repo = LookupRepository(db_session)
    service = LookupService(db_session)

    test_type_code = f"test_uom_{uuid4().hex[:6]}"
    mtype = MasterType(
        code=test_type_code,
        label="Test UOM Category",
        category_type="REFERENCE",
        is_system=False,
        field_schema={"type": "object"}
    )
    await repo.create_type(mtype)

    # 1. Create original version
    val1 = await service.create_value(test_type_code, MasterValueCreate(code="KG_V1", name="Kilogram Initial"))

    # 2. Perform atomic replacement
    replace_in = MasterValueReplace(new_name="Kilogram Standard Rate 2026")
    replaced = await service.replace_value(str(val1.id), replace_in)

    assert replaced.id != val1.id
    assert replaced.code == "KG_V1"  # Immutable code preserved
    assert replaced.name == "Kilogram Standard Rate 2026"
    assert replaced.supersedes_id == val1.id
    assert replaced.active is True

    # Check old record state
    old_record = await repo.get_value_by_id(val1.id)
    assert old_record.active is False
    assert old_record.effective_to is not None

    # 3. Retrieve audit history
    history = await service.get_audit_history(str(replaced.id))
    assert len(history) == 2
    assert history[0].id == replaced.id
    assert history[1].id == val1.id


@pytest.mark.asyncio
async def test_hierarchical_tree_integrity_constraints(db_session):
    repo = LookupRepository(db_session)
    service = LookupService(db_session)

    type1_code = f"tree_cat1_{uuid4().hex[:6]}"
    type2_code = f"tree_cat2_{uuid4().hex[:6]}"

    mtype1 = await repo.create_type(MasterType(code=type1_code, label="Tree Cat 1", category_type="REFERENCE", is_system=False, field_schema={}))
    mtype2 = await repo.create_type(MasterType(code=type2_code, label="Tree Cat 2", category_type="REFERENCE", is_system=False, field_schema={}))

    # Level 1
    l1 = await service.create_value(type1_code, MasterValueCreate(code="L1", name="Level 1"))
    # Level 2
    l2 = await service.create_value(type1_code, MasterValueCreate(code="L2", name="Level 2", parent_value_id=l1.id))
    # Level 3
    l3 = await service.create_value(type1_code, MasterValueCreate(code="L3", name="Level 3", parent_value_id=l2.id))

    # Level 4 should fail (exceeds max depth 3)
    with pytest.raises(HTTPException) as exc_info:
        await service.create_value(type1_code, MasterValueCreate(code="L4", name="Level 4", parent_value_id=l3.id))
    assert "depth exceeds" in str(exc_info.value.detail)

    # Cross-category parent should fail
    l_other = await service.create_value(type2_code, MasterValueCreate(code="OTHER", name="Other Cat Level 1"))
    with pytest.raises(HTTPException) as exc_info2:
        await service.create_value(type1_code, MasterValueCreate(code="INVALID_PARENT", name="Invalid Parent", parent_value_id=l_other.id))
    assert "same master category" in str(exc_info2.value.detail)


@pytest.mark.asyncio
async def test_system_category_deactivation_guard(db_session):
    repo = LookupRepository(db_session)
    service = LookupService(db_session)

    sys_type_code = f"sys_cat_{uuid4().hex[:6]}"
    mtype = await repo.create_type(MasterType(code=sys_type_code, label="System Category", category_type="SYSTEM", is_system=True, field_schema={}))

    val = await service.create_value(sys_type_code, MasterValueCreate(code="SYS_CODE_1", name="System Protected Code"))

    # Deactivating system code should raise HTTPException
    with pytest.raises(HTTPException) as exc_info:
        await service.deactivate_value(str(val.id))
    assert "protected and cannot be deactivated" in str(exc_info.value.detail)


@pytest.mark.asyncio
async def test_event_signals_emission(db_session):
    events_received = []

    def event_listener(event_type: str, payload: dict):
        events_received.append((event_type, payload))

    register_lookup_event_listener(event_listener)

    repo = LookupRepository(db_session)
    service = LookupService(db_session)

    test_type_code = f"event_type_{uuid4().hex[:6]}"
    await repo.create_type(MasterType(code=test_type_code, label="Event Test", category_type="REFERENCE", is_system=False, field_schema={}))

    # 1. Create
    val = await service.create_value(test_type_code, MasterValueCreate(code="EVT_1", name="Event Test 1"))
    # 2. Update
    await service.update_value(str(val.id), MasterValueUpdate(name="Event Test 1 Modified"))
    # 3. Replace
    await service.replace_value(str(val.id), MasterValueReplace(new_name="Event Test 1 Replaced"))

    assert len(events_received) >= 3
    event_types = [e[0] for e in events_received]
    assert "lookup.created" in event_types
    assert "lookup.updated" in event_types
    assert "lookup.replaced" in event_types


@pytest.mark.asyncio
async def test_concurrent_lookup_replacements(db_session):
    repo = LookupRepository(db_session)
    service = LookupService(db_session)

    test_type_code = f"conc_cat_{uuid4().hex[:6]}"
    await repo.create_type(MasterType(code=test_type_code, label="Concurrency Test", category_type="REFERENCE", is_system=False, field_schema={}))

    val = await service.create_value(test_type_code, MasterValueCreate(code="CONC_1", name="Initial Name"))

    # Execute two rapid replacements sequentially in atomic transactions
    r1 = await service.replace_value(str(val.id), MasterValueReplace(new_name="Name Replacement 1"))
    r2 = await service.replace_value(str(r1.id), MasterValueReplace(new_name="Name Replacement 2"))

    assert r2.supersedes_id == r1.id
    assert r1.supersedes_id == val.id
    assert r2.code == "CONC_1"

    # Verify history chain completeness
    history = await service.get_audit_history(str(r2.id))
    assert len(history) == 3
    assert [h.name for h in history] == ["Name Replacement 2", "Name Replacement 1", "Initial Name"]

