"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.18.0
Created      : 2026-09-14
Modified     : 2026-09-14
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import pytest
import uuid
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.numbering import DocumentSeries, NumberingAuditLog
from app.services.numbering import NumberingService
from app.schemas.numbering import (
    BillPrefixResolveRequest,
    BillPrefixBatchSaveRequest,
    BillPrefixBatchSaveItem,
    YearEndRolloverRequest,
    DocumentSeriesResponse,
    NumberingAuditLogResponse
)


def test_gst_rule_46b_validation():
    """Validates statutory GST Rule 46(b) length and character set rules."""
    # 1. Valid prefix and sequence: length <= 16, characters [A-Za-z0-9/-]
    res1 = NumberingService.validate_gst_rule_46b(prefix="INV/", doc_no="0001", suffix="26-27/")
    # "INV/000126-27/" length = 14 <= 16
    assert res1["isValid"] is True
    assert res1["length"] == 14
    assert res1["error"] is None

    # 2. Exceeding 16 characters -> should fail
    res2 = NumberingService.validate_gst_rule_46b(prefix="LONGCOMPANYPREFIX/", doc_no="0001", suffix="2026-2027/")
    # length > 16
    assert res2["isValid"] is False
    assert "exceeds maximum 16 characters" in res2["error"]

    # 3. Invalid characters (e.g. space, @, #, _) -> should fail
    res3 = NumberingService.validate_gst_rule_46b(prefix="INV#", doc_no="0001", suffix="")
    assert res3["isValid"] is False
    assert "invalid characters" in res3["error"]

    # 4. Valid with hyphens and slashes
    res4 = NumberingService.validate_gst_rule_46b(prefix="T1-INV-", doc_no="0101", suffix="")
    assert res4["isValid"] is True
    assert res4["combined"] == "T1-INV-0101"


@pytest.mark.asyncio
async def test_bill_prefix_resolution_hierarchy():
    """
    Tests resolution hierarchy:
    1. Terminal-specific prefix overrides common store prefix
    2. Common store prefix applies when no terminal-specific prefix exists
    3. Auto-instantiation provides safe default
    """
    from app.db.session import async_session as async_session_factory
    from sqlalchemy import text
    async with async_session_factory() as db:
        service = NumberingService(db)
        comp_res = await db.execute(text("SELECT id FROM companies WHERE is_deleted = false LIMIT 1"))
        test_company = comp_res.scalar_one_or_none()
        if not test_company:
            test_company = f"comp-test-{uuid.uuid4().hex[:6]}"
            await db.execute(
                text("INSERT INTO companies (id, name, is_active, is_deleted) VALUES (:id, :name, true, false)"),
                {"id": test_company, "name": "Test Company"}
            )
            await db.commit()

        # Clean up any leftover series from prior test runs
        await db.execute(
            text("DELETE FROM document_series WHERE company_id = :comp AND name IN ('Common Cash Sales', 'Terminal 01 Cash Sales')"),
            {"comp": test_company}
        )
        await db.commit()

        # Create common series
        common_item = BillPrefixBatchSaveItem(
            name="Common Cash Sales",
            documentType="SALES_CASH",
            transactionGroup="SALES",
            terminalId="COMMON",
            isCommonAcrossTerminals=True,
            prefix="INV/C/",
            suffix="26-27/",
            startNumber=1,
            runningLength=4,
            isActive=True
        )
        # Create terminal-specific series for POS-01
        term_item = BillPrefixBatchSaveItem(
            name="Terminal 01 Cash Sales",
            documentType="SALES_CASH",
            transactionGroup="SALES",
            terminalId="POS-01",
            isCommonAcrossTerminals=False,
            prefix="T01/C/",
            suffix="26-27/",
            startNumber=1,
            runningLength=4,
            isActive=True
        )

        batch_req = BillPrefixBatchSaveRequest(
            terminalId="COMMON",
            isCommonAcrossTerminals=True,
            items=[common_item, term_item]
        )
        await service.save_bill_prefixes_batch(test_company, None, batch_req, "TEST_ADMIN")

        # Resolve for POS-01 -> Should resolve terminal-specific T01/C/
        res_pos01 = await service.resolve_bill_prefix(
            company_id=test_company,
            branch_id=None,
            terminal_id="POS-01",
            transaction_type="SALES_CASH"
        )
        assert res_pos01["prefix"] == "T01/C/"
        assert res_pos01["terminalId"] == "POS-01"
        assert res_pos01["gstRule46bValid"] is True

        # Resolve for POS-02 (no specific definition) -> Should resolve common INV/C/
        res_pos02 = await service.resolve_bill_prefix(
            company_id=test_company,
            branch_id=None,
            terminal_id="POS-02",
            transaction_type="SALES_CASH"
        )
        assert res_pos02["prefix"] == "INV/C/"
        assert res_pos02["terminalId"] == "COMMON"
        assert res_pos02["gstRule46bValid"] is True


@pytest.mark.asyncio
async def test_year_end_rollover_process():
    """
    Tests supervisory Year End Process:
    - Increments financial year and suffix
    - Resets counter to start number
    - Logs audit trail
    """
    from app.db.session import async_session as async_session_factory
    async with async_session_factory() as db:
        service = NumberingService(db)
        test_company = f"COMP-YE-{uuid.uuid4().hex[:6]}"

        # Create a series with current count = 150
        series = await service.create_series(
            type("MockReq", (), {
                "name": "Test Sales Invoice",
                "documentType": "SALES_CREDIT",
                "module": "Sales",
                "prefix": "CR/",
                "suffix": "25-26/",
                "runningLength": 4,
                "resetRule": "Financial Year",
                "currentNumber": 150,
                "financialYear": "2025-2026",
                "companyCode": test_company,
                "mode": "Auto",
                "description": "Year end test",
                "terminalId": "COMMON",
                "isCommonAcrossTerminals": True,
                "transactionGroup": "SALES",
                "startNumber": 1,
                "isVoidUnified": False
            })(),
            creator="TEST_ADMIN"
        )
        assert series.current_number == 150

        # Run Year End Rollover
        rollover_req = YearEndRolloverRequest(
            newFinancialYear="2026-2027",
            newYearSuffix="26-27",
            resetToStartNumber=True
        )
        rollover_res = await service.execute_year_end_rollover(test_company, rollover_req, "SUPERVISOR")

        assert rollover_res["success"] is True
        assert rollover_res["newYear"] == "2026-2027"

        # Check refreshed series
        refreshed = await db.get(DocumentSeries, series.id)
        assert refreshed.financial_year == "2026-2027"
        assert "26-27" in refreshed.suffix
        assert refreshed.current_number == 0  # reset to start_number - 1


def test_document_series_response_serialization_with_orm():
    """
    Validates that DocumentSeriesResponse and NumberingAuditLogResponse serialize ORM
    snake_case attributes to the expected camelCase JSON without raising ValidationError.
    This guarantees no 500 Internal Server Error occurs on /bill-prefixes/save-batch.
    """
    ds = DocumentSeries(
        id="SER-test-001",
        name="Sales Cash Prefix",
        document_type="SALES_CASH",
        prefix="CS/",
        suffix="/26-27",
        running_length=4,
        reset_rule="Financial Year",
        current_number=42,
        is_active=True,
        is_void_unified=False,
        terminal_id="POS-01",
        is_common_across_terminals=False,
        transaction_group="SALES",
        start_number=1,
        mode="Auto"
    )

    validated = DocumentSeriesResponse.model_validate(ds)
    dumped = validated.model_dump(by_alias=True)

    assert dumped["id"] == "SER-test-001"
    assert dumped["name"] == "Sales Cash Prefix"
    assert dumped["documentType"] == "SALES_CASH"
    assert dumped["prefix"] == "CS/"
    assert dumped["suffix"] == "/26-27"
    assert dumped["runningLength"] == 4
    assert dumped["resetRule"] == "Financial Year"
    assert dumped["currentNumber"] == 42
    assert dumped["isActive"] is True
    assert dumped["isVoidUnified"] is False
    assert dumped["terminalId"] == "POS-01"
    assert dumped["isCommonAcrossTerminals"] is False
    assert dumped["startNumber"] == 1

    # Also verify NumberingAuditLogResponse
    log = NumberingAuditLog(
        id="NAL-test-001",
        series_id="SER-test-001",
        series_name="Sales Cash Prefix",
        action="UPDATE",
        document_no="CS/0042/26-27",
        operator="admin_user",
        created_at=datetime(2026, 9, 17, 12, 0, 0, tzinfo=timezone.utc)
    )

    validated_log = NumberingAuditLogResponse.model_validate(log)
    log_dumped = validated_log.model_dump(by_alias=True)

    assert log_dumped["id"] == "NAL-test-001"
    assert log_dumped["seriesId"] == "SER-test-001"
    assert log_dumped["seriesName"] == "Sales Cash Prefix"
    assert log_dumped["action"] == "UPDATE"
    assert log_dumped["user"] == "admin_user"
    assert log_dumped["documentNo"] == "CS/0042/26-27"
    assert "2026-09-17" in log_dumped["timestamp"]


@pytest.mark.asyncio
async def test_save_batch_with_null_and_missing_attributes():
    """
    Validates that save_bill_prefixes_batch gracefully handles None or missing
    runningLength, startNumber, isVoidUnified and produces response-valid objects.
    """
    from app.db.session import async_session as async_session_factory
    async with async_session_factory() as db:
        service = NumberingService(db)
        from sqlalchemy import text
        comp_res = await db.execute(text("SELECT id FROM companies WHERE is_deleted = false LIMIT 1"))
        test_company = comp_res.scalar_one_or_none()
        if not test_company:
            test_company = f"comp-test-{uuid.uuid4().hex[:6]}"
            await db.execute(
                text("INSERT INTO companies (id, name, is_active, is_deleted) VALUES (:id, :name, true, false)"),
                {"id": test_company, "name": "Test Company"}
            )
            await db.commit()

        # Clean up leftover test series
        await db.execute(
            text("DELETE FROM document_series WHERE company_id = :comp AND name = 'Batch Test Missing Nulls'"),
            {"comp": test_company}
        )
        await db.commit()

        batch_item = BillPrefixBatchSaveItem(
            name="Batch Test Missing Nulls",
            documentType="SALES_CREDIT",
            transactionGroup="SALES",
            terminalId=None,
            isCommonAcrossTerminals=True,
            prefix="CR-TEST-",
            suffix="",
            startNumber=None,
            currentNumber=None,
            runningLength=None,
            isActive=True,
            isVoidUnified=None
        )

        batch_req = BillPrefixBatchSaveRequest(
            terminalId="COMMON",
            isCommonAcrossTerminals=True,
            items=[batch_item]
        )

        results = await service.save_bill_prefixes_batch(test_company, None, batch_req, "TEST_OPERATOR")
        assert len(results) == 1

        # Must serialize cleanly into DocumentSeriesResponse without ValidationError
        serialized = [DocumentSeriesResponse.model_validate(r).model_dump(by_alias=True) for r in results]
        assert len(serialized) == 1
        assert serialized[0]["startNumber"] == 1
        assert serialized[0]["runningLength"] == 4
        assert serialized[0]["currentNumber"] == 0
        assert serialized[0]["isVoidUnified"] is False
        assert serialized[0]["documentType"] == "SALES_CREDIT"

