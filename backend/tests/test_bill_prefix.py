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
    YearEndRolloverRequest
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
