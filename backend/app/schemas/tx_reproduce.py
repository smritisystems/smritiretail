"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.44.0
Created      : 2026-08-25
Modified     : 2026-08-25
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

from typing import List, Optional, Dict, Any
from pydantic import BaseModel, ConfigDict, Field


class GovernanceSnapshot(BaseModel):
    snapshot_id: str
    snapshot_timestamp: str
    formula_versions: Dict[str, int] = Field(default_factory=dict)
    rule_versions: Dict[str, int] = Field(default_factory=dict)
    policy_versions: Dict[str, int] = Field(default_factory=dict)
    workflow_versions: Dict[str, int] = Field(default_factory=dict)
    pricing_version: Optional[int] = 1
    accounting_rule_version: Optional[int] = 1
    doc_template_version: Optional[int] = 1
    metadata: Dict[str, Any] = Field(default_factory=dict)


class SnapshotCreateRequest(BaseModel):
    formula_versions: Optional[Dict[str, int]] = None
    rule_versions: Optional[Dict[str, int]] = None
    policy_versions: Optional[Dict[str, int]] = None
    workflow_versions: Optional[Dict[str, int]] = None
    pricing_version: Optional[int] = 1
    accounting_rule_version: Optional[int] = 1
    doc_template_version: Optional[int] = 1
    extra_metadata: Optional[Dict[str, Any]] = None


class LedgerEntryReplay(BaseModel):
    account_code: str
    account_name: str
    debit: float
    credit: float


class TransactionReplayRequest(BaseModel):
    snapshot: Dict[str, Any]
    transaction_payload: Dict[str, Any]
    historical_catalog: Optional[Dict[str, Any]] = None
    expected_totals: Optional[Dict[str, float]] = None


class TransactionReplayResponse(BaseModel):
    reproduced: bool
    snapshot_id: str
    rules_replayed: Dict[str, Any]
    discounts_applied: List[Dict[str, Any]]
    total_discount: float
    tax_calculation: Dict[str, Any]
    ledger_entries: List[LedgerEntryReplay]
    final_payable_amount: float
    drift_detected: bool = False
    drift_details: Optional[Dict[str, Any]] = None
