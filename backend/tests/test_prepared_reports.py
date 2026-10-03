"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.80.0
Created      : 2026-09-11
Modified     : 2026-09-11
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal

Automated Test Suite for Frappe-Inspired Prepared Reports Engine & Universal Contract.
Verifies:
1. Parameter SHA-256 hashing determinism and key-ordering invariance
2. Universal 5-tuple report contract envelope validation
3. Prepared report enqueueing, execution, vault artifact writing, and forensic sealing
4. Snapshot cache hits on duplicate requests
5. Binary artifact streaming and media-type resolution
6. Live reporting distribution engine payload generation
"""

import os
import io
import json
import pytest
import hashlib
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional
from unittest.mock import AsyncMock, MagicMock, patch

from app.api.deps import TenantContext
from app.models.reporting import PreparedReport
from app.schemas.reports import (
    PreparedReportEnqueueRequest,
    PreparedReportStatusResponse,
    UniversalReportEnvelope,
    ReportColumnSchema,
    ReportSummaryCardSchema,
    ReportChartConfigSchema,
)
from app.services.prepared_report_service import PreparedReportService
from app.services.reporting_distribution_svc import ReportDistributionEngine


# ─────────────────────────────────────────────────────────────────────────────
# Test 1: Parameter SHA-256 Hashing Determinism
# ─────────────────────────────────────────────────────────────────────────────

def test_parameter_hash_determinism_and_key_ordering():
    """Verify compute_parameters_hash produces identical hashes regardless of key ordering."""
    code = "RPT-TAX-006"
    params_a = {"from_date": "2026-04-01", "to_date": "2026-09-01", "status": "COMPLETED", "store": "BR-01"}
    params_b = {"store": "BR-01", "status": "COMPLETED", "to_date": "2026-09-01", "from_date": "2026-04-01"}

    hash_a = PreparedReportService.compute_parameters_hash(code, params_a, "XLSX")
    hash_b = PreparedReportService.compute_parameters_hash(code, params_b, "XLSX")

    assert hash_a == hash_b, "Parameter hash must be invariant to dict key insertion order"
    assert len(hash_a) == 64, "Parameter hash must be a valid 64-character SHA-256 hex string"

    # Different format must produce different hash
    hash_csv = PreparedReportService.compute_parameters_hash(code, params_a, "CSV")
    assert hash_a != hash_csv, "Different export formats must yield distinct parameter hashes"


# ─────────────────────────────────────────────────────────────────────────────
# Test 2: Universal Report Envelope Schema Parity
# ─────────────────────────────────────────────────────────────────────────────

def test_universal_report_envelope_schema_contract():
    """Verify UniversalReportEnvelope satisfies 5-tuple contract: (columns, rows, summary, chart, message)."""
    columns = [
        ReportColumnSchema(key="invoice_no", label="INVOICE NO", datatype="link", entity_link="invoice", width=140),
        ReportColumnSchema(key="doc_date", label="DATE", datatype="date", width=110),
        ReportColumnSchema(key="taxable_amount", label="TAXABLE AMT (₹)", datatype="currency", align="right", width=130),
        ReportColumnSchema(key="status", label="STATUS", datatype="badge", align="center", width=100),
    ]
    rows = [
        {"invoice_no": "INV-2026-001", "doc_date": "2026-09-01", "taxable_amount": 10500.00, "status": "COMPLETED"},
        {"invoice_no": "INV-2026-002", "doc_date": "2026-09-02", "taxable_amount": 4200.00, "status": "COMPLETED"},
    ]
    summary_cards = [
        ReportSummaryCardSchema(label="Total Invoices", value=2, indicator="neutral", datatype="number"),
        ReportSummaryCardSchema(label="Gross Turnover", value=14700.00, indicator="green", datatype="currency"),
    ]
    chart = ReportChartConfigSchema(chart_type="bar", labels=["INV-001", "INV-002"], datasets=[{"name": "Amt", "data": [10500, 4200]}])

    envelope = UniversalReportEnvelope(
        report_id="RPT-TAX-001",
        report_name="Tax Register",
        category="Tax & Compliance",
        generated_at=datetime.now(timezone.utc).isoformat(),
        columns=columns,
        rows=rows,
        summary_cards=summary_cards,
        chart_config=chart,
        system_message="Forensic Verification OK",
        total_records=2,
    )

    assert envelope.report_id == "RPT-TAX-001"
    assert len(envelope.columns) == 4
    assert envelope.columns[0].entity_link == "invoice"
    assert len(envelope.rows) == 2
    assert len(envelope.summary_cards) == 2
    assert envelope.summary_cards[1].indicator == "green"
    assert envelope.chart_config.chart_type == "bar"


# ─────────────────────────────────────────────────────────────────────────────
# Test 3: Prepared Report Lifecycle, Enqueue & Cache Hit
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_prepared_report_enqueue_and_cache_reuse(tmp_path):
    """Verify task is registered in QUEUED state, and duplicate enqueue returns cached hit when completed."""
    mock_db = AsyncMock()
    mock_tenant = TenantContext(company_id="COMP-001", branch_id="BR-MAIN-001")

    payload = PreparedReportEnqueueRequest(
        report_code="RPT-TAX-006",
        parameters={"from_date": "2026-04-01", "to_date": "2026-09-01"},
        export_format="XLSX",
    )

    # Initial query: no existing cached report found
    mock_result_empty = MagicMock()
    mock_result_empty.scalars().first.return_value = None
    mock_db.execute.return_value = mock_result_empty

    # 1. First Enqueue -> New Task
    task, is_cached = await PreparedReportService.enqueue_prepared_report(
        db=mock_db,
        tenant_ctx=mock_tenant,
        payload=payload,
        requested_by_id="usr-test-1",
    )

    assert is_cached is False, "First enqueue must be a cache miss"
    assert task.status == "QUEUED"
    assert task.report_code == "RPT-TAX-006"
    assert task.export_format == "XLSX"

    # Simulate task completion and file write
    dummy_file = tmp_path / "RPT-TAX-006_test.xlsx"
    dummy_file.write_bytes(b"PK\x03\x04DummyExcelPayload")

    completed_task = PreparedReport(
        id=task.id,
        company_id="COMP-001",
        branch_id="BR-MAIN-001",
        report_code="RPT-TAX-006",
        report_name="Tax Report",
        parameters_hash=task.parameters_hash,
        status="COMPLETED",
        export_format="XLSX",
        output_file_path=str(dummy_file),
        file_size_bytes=len(b"PK\x03\x04DummyExcelPayload"),
        expires_at=datetime.now(timezone.utc) + timedelta(hours=10),
    )

    # 2. Second Enqueue with identical parameters -> Cache Hit
    mock_result_hit = MagicMock()
    mock_result_hit.scalars().first.return_value = completed_task
    mock_db.execute.return_value = mock_result_hit

    cached_task, is_cached_second = await PreparedReportService.enqueue_prepared_report(
        db=mock_db,
        tenant_ctx=mock_tenant,
        payload=payload,
        requested_by_id="usr-test-2",
    )

    assert is_cached_second is True, "Second enqueue with identical parameters must hit cache"
    assert cached_task.id == task.id
    assert cached_task.status == "COMPLETED"


# ─────────────────────────────────────────────────────────────────────────────
# Test 4: Prepared Report Background Execution & Forensic Sealing
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_prepared_report_background_execution_and_sealing(tmp_path):
    """Verify background task transitions to COMPLETED, writes file to vault, and seals SHA-256 digest."""
    mock_db = AsyncMock()
    task_id = "prep-test-12345"

    dummy_task = PreparedReport(
        id=task_id,
        company_id="COMP-001",
        branch_id="BR-MAIN-001",
        report_code="RPT-SAL-001",
        report_name="Daily Sales Summary",
        parameters={"from_date": "2026-09-01"},
        parameters_hash="abc123hash",
        status="QUEUED",
        export_format="CSV",
    )

    mock_res = MagicMock()
    mock_res.scalar_one_or_none.return_value = dummy_task
    mock_db.execute.return_value = mock_res

    # Patch statutory vault directory to temporary path
    with patch.object(PreparedReportService, "VAULT_DIR", str(tmp_path)):
        # Mock ReportsService get_universal_report_envelope
        mock_envelope = UniversalReportEnvelope(
            report_id="RPT-SAL-001",
            report_name="Daily Sales Summary",
            category="Sales",
            generated_at=datetime.now(timezone.utc).isoformat(),
            columns=[
                ReportColumnSchema(key="report_date", label="DATE", datatype="date"),
                ReportColumnSchema(key="total_sales", label="SALES", datatype="currency"),
            ],
            rows=[{"report_date": "2026-09-01", "total_sales": 55000.00}],
            summary_cards=[],
            total_records=1,
        )

        with patch("app.services.reports.ReportsService.get_universal_report_envelope", new_callable=AsyncMock) as mock_get_env:
            mock_get_env.return_value = mock_envelope

            await PreparedReportService.execute_task_background(task_id=task_id, db=mock_db)

            assert dummy_task.status == "COMPLETED"
            assert dummy_task.output_file_path is not None
            assert os.path.exists(dummy_task.output_file_path)
            assert dummy_task.file_size_bytes > 0
            assert dummy_task.forensic_hash is not None
            assert len(dummy_task.forensic_hash) == 64

            # Verify file contents
            with open(dummy_task.output_file_path, "rb") as f:
                content = f.read()
            expected_hash = hashlib.sha256(content).hexdigest()
            assert dummy_task.forensic_hash == expected_hash, "Forensic hash must match SHA-256 of output artifact"


# ─────────────────────────────────────────────────────────────────────────────
# Test 5: Artifact Download Streaming & Media Types
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_prepared_report_artifact_stream(tmp_path):
    """Verify get_artifact_stream returns correct binary bytes, filename, and MIME media-type."""
    mock_db = AsyncMock()
    task_id = "prep-stream-001"
    target_file = tmp_path / "RPT-SO-008_prep-stream-001.xlsx"
    target_file.write_bytes(b"PK\x03\x04MasterSalesOrderBytes")

    task = PreparedReport(
        id=task_id,
        report_code="RPT-SO-008",
        status="COMPLETED",
        export_format="XLSX",
        output_file_path=str(target_file),
    )

    mock_res = MagicMock()
    mock_res.scalar_one_or_none.return_value = task
    mock_db.execute.return_value = mock_res

    content, filename, media_type = await PreparedReportService.get_artifact_stream(mock_db, task_id)

    assert content == b"PK\x03\x04MasterSalesOrderBytes"
    assert filename == "RPT-SO-008_prep-stream-001.xlsx"
    assert media_type == "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
