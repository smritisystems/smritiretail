"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 1.0.0
Created      : 2026-09-24
Modified     : 2026-09-24
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
Target Test  : Audit Log Cryptographic SHA-256 Chaining & Forensic Verification Battery
"""

import json
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock
import pytest

from app.models.audit import ComplianceImmutableAuditLog
from app.services.compliance_audit import ComplianceAuditService


@pytest.fixture(autouse=True)
def auto_override_company_db():
    """Override conftest auto_override_company_db to run as fast, standalone unit tests without Postgres."""
    yield



def _create_mock_log(
    log_id: str,
    company_id: str,
    event_type: str,
    entity_name: str,
    entity_id: str,
    action_summary: str,
    previous_hash: str,
    timestamp: datetime,
    before_state: dict = None,
    after_state: dict = None,
    request_id: str = "req-test-01",
    client_user_agent: str = "SMRITI-POS-Terminal/3.28",
) -> ComplianceImmutableAuditLog:
    before_json = json.dumps(before_state) if before_state else None
    after_json = json.dumps(after_state) if after_state else None
    p_hash = ComplianceAuditService.compute_payload_hash(
        company_id=company_id,
        event_type=event_type,
        entity_name=entity_name,
        entity_id=entity_id,
        timestamp_str=timestamp.isoformat(),
        action_summary=action_summary,
        before_state=before_json,
        after_state=after_json,
        previous_hash=previous_hash,
    )
    return ComplianceImmutableAuditLog(
        id=log_id,
        uuid=f"uuid-{log_id}",
        company_id=company_id,
        branch_id="BR-MAIN",
        event_type=event_type,
        entity_name=entity_name,
        entity_id=entity_id,
        actor_user_id="usr_audit_01",
        actor_role="MANAGER",
        ip_address="192.168.1.100",
        before_state_json=before_json,
        after_state_json=after_json,
        action_summary=action_summary,
        payload_hash=p_hash,
        previous_hash=previous_hash,
        hash_chain_verified=True,
        request_id=request_id,
        client_user_agent=client_user_agent,
        retention_policy="STATUTORY_7_YEARS",
        worm_locked=True,
        timestamp=timestamp,
        is_active=True,
        is_deleted=False,
    )


def test_genesis_hash_constant():
    """TC-AUD-001: Genesis block hash is precisely 64 zero hexadecimal digits."""
    assert len(ComplianceAuditService.GENESIS_HASH) == 64
    assert ComplianceAuditService.GENESIS_HASH == "0" * 64


def test_compute_payload_hash_deterministic():
    """TC-AUD-002: Same input values yield identical SHA-256 hash."""
    h1 = ComplianceAuditService.compute_payload_hash(
        company_id="COMP-001",
        event_type="SALES_INVOICE_POSTED",
        entity_name="sales_invoices",
        entity_id="inv-101",
        timestamp_str="2026-09-24T00:00:00+00:00",
        action_summary="Posted invoice inv-101",
        before_state=None,
        after_state=None,
        previous_hash="0" * 64,
    )
    h2 = ComplianceAuditService.compute_payload_hash(
        company_id="COMP-001",
        event_type="SALES_INVOICE_POSTED",
        entity_name="sales_invoices",
        entity_id="inv-101",
        timestamp_str="2026-09-24T00:00:00+00:00",
        action_summary="Posted invoice inv-101",
        before_state=None,
        after_state=None,
        previous_hash="0" * 64,
    )
    assert h1 == h2
    assert len(h1) == 64


def test_compute_payload_hash_chain_dependency():
    """TC-AUD-003: Changing the previous_hash produces a completely different hash (cryptographic avalanche)."""
    base_args = {
        "company_id": "COMP-001",
        "event_type": "STOCK_ADJUSTMENT",
        "entity_name": "stock_ledger",
        "entity_id": "stk-001",
        "timestamp_str": "2026-09-24T01:00:00+00:00",
        "action_summary": "Adjusted stock +10",
        "before_state": None,
        "after_state": None,
    }
    h_genesis = ComplianceAuditService.compute_payload_hash(
        **base_args, previous_hash="0" * 64
    )
    h_chained = ComplianceAuditService.compute_payload_hash(
        **base_args, previous_hash="a" * 64
    )
    assert h_genesis != h_chained


def test_verify_audit_integrity_valid():
    """TC-AUD-004: An unmodified audit log record verifies as authentic."""
    import asyncio
    ts = datetime(2026, 9, 24, 1, 0, 0, tzinfo=timezone.utc)
    log = _create_mock_log(
        log_id="aud_001",
        company_id="COMP-001",
        event_type="PRICE_UPDATE",
        entity_name="item_master",
        entity_id="SKU-889",
        action_summary="Updated MRP to 499.00",
        previous_hash="0" * 64,
        timestamp=ts,
    )
    is_valid = asyncio.run(ComplianceAuditService.verify_audit_integrity(log))
    assert is_valid is True


def test_verify_audit_integrity_tampered_action():
    """TC-AUD-005: Tampering with action_summary breaks single-record integrity verification."""
    import asyncio
    ts = datetime(2026, 9, 24, 1, 0, 0, tzinfo=timezone.utc)
    log = _create_mock_log(
        log_id="aud_002",
        company_id="COMP-001",
        event_type="USER_ROLE_CHANGED",
        entity_name="users",
        entity_id="usr_009",
        action_summary="Granted CASHIER role",
        previous_hash="0" * 64,
        timestamp=ts,
    )
    # Fraudulent actor tampers with action_summary to disguise unauthorized SYSADMIN grant
    log.action_summary = "Granted SYSADMIN role"
    is_valid = asyncio.run(ComplianceAuditService.verify_audit_integrity(log))
    assert is_valid is False


def test_verify_chain_integrity_success():
    """TC-AUD-006: Sequential hash chain verifies unbroken across multiple blocks."""
    import asyncio
    t1 = datetime(2026, 9, 24, 1, 0, 0, tzinfo=timezone.utc)
    t2 = datetime(2026, 9, 24, 1, 1, 0, tzinfo=timezone.utc)
    t3 = datetime(2026, 9, 24, 1, 2, 0, tzinfo=timezone.utc)

    # Block 1 (Genesis predecessor)
    b1 = _create_mock_log("aud_b1", "COMP-001", "PO_CREATED", "purchase_orders", "PO-1", "Created PO", "0" * 64, t1)
    # Block 2 (Chained to Block 1)
    b2 = _create_mock_log("aud_b2", "COMP-001", "GRN_POSTED", "goods_receipt_notes", "GRN-1", "Posted GRN", b1.payload_hash, t2)
    # Block 3 (Chained to Block 2)
    b3 = _create_mock_log("aud_b3", "COMP-001", "BILLING_SALE", "sales_invoices", "INV-1", "Billed invoice", b2.payload_hash, t3)

    mock_session = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = [b1, b2, b3]
    mock_session.execute.return_value = mock_result

    report = asyncio.run(ComplianceAuditService.verify_chain_integrity(mock_session, company_id="COMP-001"))
    assert report["verified"] is True
    assert report["inspected_count"] == 3
    assert report["broken_at_id"] is None


def test_verify_chain_integrity_detects_broken_link():
    """TC-AUD-007: Chain verification immediately detects an inserted or reordered block."""
    import asyncio
    t1 = datetime(2026, 9, 24, 1, 0, 0, tzinfo=timezone.utc)
    t2 = datetime(2026, 9, 24, 1, 1, 0, tzinfo=timezone.utc)
    t3 = datetime(2026, 9, 24, 1, 2, 0, tzinfo=timezone.utc)

    b1 = _create_mock_log("aud_b1", "COMP-001", "PO_CREATED", "purchase_orders", "PO-1", "Created PO", "0" * 64, t1)
    b2 = _create_mock_log("aud_b2", "COMP-001", "GRN_POSTED", "goods_receipt_notes", "GRN-1", "Posted GRN", b1.payload_hash, t2)
    # b3 has a forged previous_hash that does not match b2.payload_hash
    b3 = _create_mock_log("aud_b3", "COMP-001", "BILLING_SALE", "sales_invoices", "INV-1", "Billed invoice", "f" * 64, t3)

    mock_session = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = [b1, b2, b3]
    mock_session.execute.return_value = mock_result

    report = asyncio.run(ComplianceAuditService.verify_chain_integrity(mock_session, company_id="COMP-001"))
    assert report["verified"] is False
    assert report["broken_at_id"] == "aud_b3"
    assert report["reason"] == "CHAIN_LINK_BROKEN"


def test_verify_chain_integrity_detects_tampered_payload():
    """TC-AUD-008: Chain verification detects record tampering inside an intermediate block."""
    import asyncio
    t1 = datetime(2026, 9, 24, 1, 0, 0, tzinfo=timezone.utc)
    t2 = datetime(2026, 9, 24, 1, 1, 0, tzinfo=timezone.utc)

    b1 = _create_mock_log("aud_b1", "COMP-001", "USER_LOGIN", "auth", "usr_1", "User logged in", "0" * 64, t1)
    b2 = _create_mock_log("aud_b2", "COMP-001", "SYSTEM_PARAM_CHANGED", "system_configs", "cfg_1", "Set param", b1.payload_hash, t2)

    # Tamper with b2 entity_id without updating payload_hash
    b2.entity_id = "cfg_tampered"

    mock_session = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = [b1, b2]
    mock_session.execute.return_value = mock_result

    report = asyncio.run(ComplianceAuditService.verify_chain_integrity(mock_session, company_id="COMP-001"))
    assert report["verified"] is False
    assert report["broken_at_id"] == "aud_b2"
    assert report["reason"] == "PAYLOAD_HASH_MISMATCH"



def test_serialize_audit_log_forensic_fields():
    """TC-AUD-009: Serialization exposes all forensic and WORM compliance fields."""
    ts = datetime(2026, 9, 24, 1, 0, 0, tzinfo=timezone.utc)
    log = _create_mock_log(
        log_id="aud_forensic_1",
        company_id="COMP-CORP",
        event_type="DISPATCH_BATCH_GENERATED",
        entity_name="dispatch_batches",
        entity_id="batch_99",
        action_summary="Generated B2B batch",
        previous_hash="0" * 64,
        timestamp=ts,
        request_id="req-uuid-999",
        client_user_agent="Smriti-Terminal-Agent/4.1",
    )
    dto = ComplianceAuditService.serialize_audit_log(log, actor_username="admin_jawahar")
    assert dto["previous_hash"] == "0" * 64
    assert dto["hash_chain_verified"] is True
    assert dto["request_id"] == "req-uuid-999"
    assert dto["client_user_agent"] == "Smriti-Terminal-Agent/4.1"
    assert dto["retention_policy"] == "STATUTORY_7_YEARS"
    assert dto["worm_locked"] is True
    assert dto["actor_username"] == "admin_jawahar"
