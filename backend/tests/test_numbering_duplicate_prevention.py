"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.32.0
Created      : 2026-09-17
Modified     : 2026-09-17
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Description  : Unit tests — Numbering duplicate prevention (SMRITI-NUM-001/002/003)
               Verifies pre-flight 409 checks in save_bill_prefixes_batch.
               Uses AsyncMock + MagicMock; no real DB required.
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from fastapi import HTTPException

from app.services.numbering import NumberingService
from app.schemas.numbering import BillPrefixBatchSaveItem, BillPrefixBatchSaveRequest


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _make_item(**kwargs) -> BillPrefixBatchSaveItem:
    """Return a BillPrefixBatchSaveItem with safe defaults."""
    defaults = {
        "name": "Cash Sales Invoice",
        "documentType": "SALES_CASH",
        "transactionGroup": "SALES",
        "terminalId": "COMMON",
        "isCommonAcrossTerminals": True,
        "prefix": "INV/C/",
        "suffix": "26-27",
        "startNumber": 1,
        "currentNumber": 0,
        "runningLength": 4,
        "isActive": True,
        "isVoidUnified": False,
    }
    defaults.update(kwargs)
    return BillPrefixBatchSaveItem(**defaults)


def _make_service(db: AsyncMock) -> NumberingService:
    return NumberingService(db=db)


def _mock_scalar_result(value):
    """Build a mock execute result that returns `value` from .scalars().first()"""
    scalars_mock = MagicMock()
    scalars_mock.first.return_value = value
    result_mock = MagicMock()
    result_mock.scalars.return_value = scalars_mock
    return result_mock


def _make_req(*items) -> BillPrefixBatchSaveRequest:
    return BillPrefixBatchSaveRequest(items=list(items))


# ─────────────────────────────────────────────────────────────────────────────
# Test 1 — duplicate name raises 409 SMRITI-NUM-001
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_duplicate_name_raises_409():
    """
    If the DB already has a series named 'Cash Sales Invoice' for this company
    (name_chk returns a non-None id), save_bill_prefixes_batch must raise HTTP 409
    with code SMRITI-NUM-001.
    """
    db = AsyncMock()

    # name check returns an existing row id → collision
    existing_id_result = _mock_scalar_result("SER-existing01")
    db.execute = AsyncMock(return_value=existing_id_result)

    service = _make_service(db)
    item = _make_item(id=None)  # no id → new record path

    with pytest.raises(HTTPException) as exc_info:
        await service.save_bill_prefixes_batch(
            company_id="C001", branch_id="B001",
            req=_make_req(item), operator="test_user"
        )

    assert exc_info.value.status_code == 409
    detail = exc_info.value.detail
    assert detail["code"] == "SMRITI-NUM-001"
    assert detail["field"] == "name"
    assert "Cash Sales Invoice" in detail["message"]


# ─────────────────────────────────────────────────────────────────────────────
# Test 2 — duplicate prefix+suffix combo raises 409 SMRITI-NUM-002
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_duplicate_prefix_suffix_combo_raises_409():
    """
    Name check passes (returns None) but the prefix+suffix combo already exists
    on another active series → 409 SMRITI-NUM-002.
    """
    db = AsyncMock()

    conflict_series = MagicMock()
    conflict_series.name = "Existing Cash Series"

    call_count = 0

    async def side_effect(query, *args, **kwargs):
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            # First execute: name check → no collision
            return _mock_scalar_result(None)
        else:
            # Second execute: prefix+suffix check → collision found
            scalars = MagicMock()
            scalars.first.return_value = conflict_series
            result = MagicMock()
            result.scalars.return_value = scalars
            return result

    db.execute = AsyncMock(side_effect=side_effect)

    service = _make_service(db)
    item = _make_item(id=None, isActive=True)

    with pytest.raises(HTTPException) as exc_info:
        await service.save_bill_prefixes_batch(
            company_id="C001", branch_id="B001",
            req=_make_req(item), operator="test_user"
        )

    assert exc_info.value.status_code == 409
    detail = exc_info.value.detail
    assert detail["code"] == "SMRITI-NUM-002"
    assert detail["field"] == "prefix"
    assert "Existing Cash Series" in detail["message"]


# ─────────────────────────────────────────────────────────────────────────────
# Test 3 — same prefix different suffix is allowed
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_same_prefix_different_suffix_allowed():
    """
    Two items with the same prefix but different suffix are NOT duplicates.
    Both pre-flight checks must pass; upsert logic should proceed to commit.
    """
    db = AsyncMock()

    # All DB queries return no collision (None)
    db.execute = AsyncMock(return_value=_mock_scalar_result(None))
    db.get = AsyncMock(return_value=None)
    db.add = MagicMock()
    db.commit = AsyncMock()
    db.refresh = AsyncMock()

    service = _make_service(db)
    # Patch validate_gst_rule_46b to always pass
    service.validate_gst_rule_46b = MagicMock(return_value={"isValid": True, "length": 14, "error": None})

    item_a = _make_item(name="FY26-27 Cash", prefix="INV/C/", suffix="26-27")
    item_b = _make_item(name="FY27-28 Cash", prefix="INV/C/", suffix="27-28")

    # Must not raise
    await service.save_bill_prefixes_batch(
        company_id="C001", branch_id="B001",
        req=_make_req(item_a, item_b), operator="test_user"
    )

    db.commit.assert_awaited_once()


# ─────────────────────────────────────────────────────────────────────────────
# Test 4 — same prefix different terminal is allowed
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_same_prefix_different_terminal_allowed():
    """
    Same prefix+suffix+type at different terminals (POS-01 vs POS-02) must NOT
    be blocked — each terminal forms its own uniqueness scope.
    All pre-flight checks pass → commit is called.
    """
    db = AsyncMock()
    db.execute = AsyncMock(return_value=_mock_scalar_result(None))
    db.get = AsyncMock(return_value=None)
    db.add = MagicMock()
    db.commit = AsyncMock()
    db.refresh = AsyncMock()

    service = _make_service(db)
    service.validate_gst_rule_46b = MagicMock(return_value={"isValid": True, "length": 14, "error": None})

    item_t1 = _make_item(name="POS-01 Cash", terminalId="POS-01",
                          isCommonAcrossTerminals=False, prefix="INV/C/", suffix="26-27")
    item_t2 = _make_item(name="POS-02 Cash", terminalId="POS-02",
                          isCommonAcrossTerminals=False, prefix="INV/C/", suffix="26-27")

    await service.save_bill_prefixes_batch(
        company_id="C001", branch_id="B001",
        req=_make_req(item_t1, item_t2), operator="test_user"
    )

    db.commit.assert_awaited_once()


# ─────────────────────────────────────────────────────────────────────────────
# Test 5 — soft-deleted duplicate does not block new creation
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_soft_deleted_duplicate_allowed():
    """
    A soft-deleted record with the same name/prefix should NOT block creation.
    Pre-flight queries filter is_deleted = FALSE, so the deleted record is invisible.
    All checks pass and commit proceeds.
    """
    db = AsyncMock()
    # Both pre-flight checks see no live conflict
    db.execute = AsyncMock(return_value=_mock_scalar_result(None))
    db.get = AsyncMock(return_value=None)
    db.add = MagicMock()
    db.commit = AsyncMock()
    db.refresh = AsyncMock()

    service = _make_service(db)
    service.validate_gst_rule_46b = MagicMock(return_value={"isValid": True, "length": 14, "error": None})

    item = _make_item(name="Cash Sales Invoice", prefix="INV/C/", suffix="26-27")

    # Must not raise — soft-deleted record is invisible to the query
    await service.save_bill_prefixes_batch(
        company_id="C001", branch_id="B001",
        req=_make_req(item), operator="test_user"
    )

    db.commit.assert_awaited_once()
