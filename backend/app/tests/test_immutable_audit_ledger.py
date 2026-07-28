"""
Project      : SMRITI Retail OS
Organization : SmritiSys
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.0.0
Created      : 2026-07-28
Modified     : 2026-07-28
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

import pytest
from app.core.immutable_audit_ledger import (
    ImmutableAuditLedger,
    AuditAction,
    GENESIS_HASH,
)

def test_audit_ledger_hash_chain_creation_and_verification():
    ledger = ImmutableAuditLedger()

    # 1. Add Entry 1: Create Invoice
    e1 = ledger.append_entry(
        entity_type="SalesInvoice",
        entity_id="INV-2026-001",
        user_id="USR-101",
        action=AuditAction.CREATE,
        payload={"total_amount": 11800.0, "tax_amount": 1800.0},
        timestamp="2026-07-28T10:00:00",
    )
    assert e1.sequence == 1
    assert e1.previous_hash == GENESIS_HASH

    # 2. Add Entry 2: Post Journal
    e2 = ledger.append_entry(
        entity_type="SalesInvoice",
        entity_id="INV-2026-001",
        user_id="USR-101",
        action=AuditAction.POST,
        payload={"journal_id": "JV-5001", "posted_at": "2026-07-28T10:05:00"},
        timestamp="2026-07-28T10:05:00",
    )
    assert e2.sequence == 2
    assert e2.previous_hash == e1.entry_hash

    # 3. Verify intact chain
    is_valid, tampered_seq = ledger.verify_chain_integrity()
    assert is_valid is True
    assert tampered_seq is None

def test_tamper_detection_in_audit_chain():
    ledger = ImmutableAuditLedger()
    e1 = ledger.append_entry("SalesInvoice", "INV-100", "USR-1", AuditAction.CREATE, {"amt": 1000})
    e2 = ledger.append_entry("SalesInvoice", "INV-100", "USR-1", AuditAction.POST, {"status": "POSTED"})

    # Tamper with entry 1 payload directly in memory
    e1.payload["amt"] = 999999

    # Verification must catch tampering!
    is_valid, tampered_seq = ledger.verify_chain_integrity()
    assert is_valid is False
    assert tampered_seq == 1
