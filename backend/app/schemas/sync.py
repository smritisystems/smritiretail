"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.24.0
Created      : 2026-08-23
Modified     : 2026-08-23
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

from enum import Enum
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field
from datetime import datetime


class SyncResolutionStatus(str, Enum):
    ACCEPTED = "ACCEPTED"                      # Fully posted to authoritative ledgers
    ACCEPTED_WARN = "ACCEPTED_WARN"            # Posted, but invariant threshold breached (e.g. negative stock / credit warning)
    DEDUPLICATED = "DEDUPLICATED"              # Duplicate idempotency key safely acknowledged and skipped
    NEEDS_REVIEW = "NEEDS_REVIEW"              # Escalated to Store Manager Reconciliation Queue
    REJECTED = "REJECTED"                      # Irreconcilable schema, permission, or security violation
    COMPENSATED = "COMPENSATED"                # Automatically compensated (e.g., reversal transaction emitted)


class SyncConflictCategory(str, Enum):
    NONE = "NONE"
    INVENTORY_STOCK = "INVENTORY_STOCK"
    DOCUMENT_NUMBERING = "DOCUMENT_NUMBERING"
    CREDIT_LIMIT = "CREDIT_LIMIT"
    PRICING_PROMOTION = "PRICING_PROMOTION"
    MASTER_DATA = "MASTER_DATA"
    PAYMENT_ALLOCATION = "PAYMENT_ALLOCATION"
    RULE_VERSION = "RULE_VERSION"
    WORKFLOW_STATE = "WORKFLOW_STATE"


class SyncConflictResolutionStrategy(str, Enum):
    SERVER_AUTHORITATIVE = "SERVER_AUTHORITATIVE"
    AUTO_MERGE_DELTA = "AUTO_MERGE_DELTA"
    PRICE_AT_SALE_PRESERVATION = "PRICE_AT_SALE_PRESERVATION"
    IDEMPOTENT_DEDUPLICATION = "IDEMPOTENT_DEDUPLICATION"
    RECONCILIATION_QUEUE = "RECONCILIATION_QUEUE"
    AUTO_COMPENSATION = "AUTO_COMPENSATION"


class SyncConflictDiagnostic(BaseModel):
    field: str
    client_assumption: Optional[Any] = None
    server_truth: Optional[Any] = None
    action_taken: str


class SyncOperationItem(BaseModel):
    client_id: str = Field(..., description="Client-generated unique transaction UUID / idempotency key")
    type: str = Field(default="SALES_INVOICE", description="Operation type e.g. SALES_INVOICE, STOCK_TRANSFER")
    invoice_no: Optional[str] = None
    customer_id: Optional[str] = None
    items: List[Dict[str, Any]] = Field(default_factory=list)
    payment_mode: str = "CASH"
    is_interstate: bool = False
    governance_snapshot_id: Optional[str] = None
    client_timestamp: Optional[datetime] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)


class SyncResolutionResult(BaseModel):
    client_id: str
    queue_id: str
    status: SyncResolutionStatus
    conflict_category: SyncConflictCategory = SyncConflictCategory.NONE
    resolution_strategy: SyncConflictResolutionStrategy = SyncConflictResolutionStrategy.SERVER_AUTHORITATIVE
    server_entity_id: Optional[str] = None
    document_number: Optional[str] = None
    grand_total: Optional[float] = None
    diagnostics: List[SyncConflictDiagnostic] = Field(default_factory=list)
    error: Optional[str] = None


class SyncBatchRequest(BaseModel):
    batch_id: str
    terminal_id: str = "POS-01"
    allow_negative_stock: bool = True
    transactions: List[SyncOperationItem]


class SyncBatchResponse(BaseModel):
    batch_id: str
    company_id: str
    branch_id: Optional[str] = None
    total_received: int
    accepted_count: int
    accepted_warn_count: int
    deduplicated_count: int
    needs_review_count: int
    failed_count: int
    results: List[SyncResolutionResult]
