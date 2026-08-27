"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.35.0
Created      : 2026-08-28
Modified     : 2026-08-28
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal

SMRITI Reporting & BI Engine — Universal Drill-Down & Audit Lineage Tracer.
Enforces Invariant 7: No aggregate number loses its transaction/document lineage.
Enforces Invariant 8: Cross-studio drill-down preserves unified reporting contracts.
"""

import uuid
import hashlib
from enum import Enum
from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field


class DrillDownLevel(int, Enum):
    LEVEL_1_STUDIO_SUMMARY = 1       # e.g., Brand or Category aggregate row
    LEVEL_2_ITEM_LEDGER = 2          # e.g., SKU item-level summary
    LEVEL_3_DOCUMENT_REGISTER = 3    # e.g., Chronological invoice/GRN list
    LEVEL_4_DOCUMENT_AUDIT = 4       # e.g., Raw receipt, cashier timestamp, tender hash


class AuditLineageTrace(BaseModel):
    trace_id: str
    source_report_id: str
    current_level: DrillDownLevel
    target_level: DrillDownLevel
    target_route: str
    context_filters: Dict[str, Any] = Field(default_factory=dict)
    source_document_ids: List[str] = Field(default_factory=list)
    parent_trace_id: Optional[str] = None
    audit_event_hash: str


DRILL_ROUTES: Dict[str, Dict[DrillDownLevel, str]] = {
    # Sales Reports Drill Path
    "RPT-SAL-001": {
        DrillDownLevel.LEVEL_2_ITEM_LEDGER: "/reports/sales/item-wise",
        DrillDownLevel.LEVEL_3_DOCUMENT_REGISTER: "/reports/sales/bill-wise",
        DrillDownLevel.LEVEL_4_DOCUMENT_AUDIT: "/sales/invoice-detail",
    },
    "RPT-TAX-002": {
        DrillDownLevel.LEVEL_3_DOCUMENT_REGISTER: "/reports/sales/bill-wise",
        DrillDownLevel.LEVEL_4_DOCUMENT_AUDIT: "/sales/invoice-detail",
    },
    "RPT-MRC-001": {
        DrillDownLevel.LEVEL_2_ITEM_LEDGER: "/merchandise/matrix-explorer",
        DrillDownLevel.LEVEL_3_DOCUMENT_REGISTER: "/reports/sales/bill-wise",
        DrillDownLevel.LEVEL_4_DOCUMENT_AUDIT: "/sales/invoice-detail",
    },
    "RPT-INV-001": {
        DrillDownLevel.LEVEL_2_ITEM_LEDGER: "/inventory/stock-ledger-detail",
        DrillDownLevel.LEVEL_3_DOCUMENT_REGISTER: "/inventory/movements",
        DrillDownLevel.LEVEL_4_DOCUMENT_AUDIT: "/inventory/grn-detail",
    },
}


class AuditLineageEngine:
    """Constructs verifiable audit lineage traces for interactive drill-downs."""

    @classmethod
    def generate_audit_hash(
        cls,
        source_report_id: str,
        level: DrillDownLevel,
        filters: Dict[str, Any],
        doc_ids: List[str]
    ) -> str:
        payload = f"{source_report_id}|{level.value}|{str(sorted(filters.items()))}|{','.join(sorted(doc_ids))}"
        return hashlib.sha256(payload.encode("utf-8")).hexdigest()[:24].upper()

    @classmethod
    def create_drilldown_trace(
        cls,
        source_report_id: str,
        current_level: DrillDownLevel,
        target_level: DrillDownLevel,
        context_filters: Dict[str, Any],
        source_document_ids: Optional[List[str]] = None,
        parent_trace_id: Optional[str] = None,
    ) -> AuditLineageTrace:
        """Constructs an immutable drill-down lineage envelope."""
        doc_ids = source_document_ids or []
        routes = DRILL_ROUTES.get(source_report_id, {})
        target_route = routes.get(target_level, "/reports/generic-drilldown")

        audit_hash = cls.generate_audit_hash(
            source_report_id=source_report_id,
            level=target_level,
            filters=context_filters,
            doc_ids=doc_ids
        )

        return AuditLineageTrace(
            trace_id=f"TRC-{uuid.uuid4().hex[:12].upper()}",
            source_report_id=source_report_id,
            current_level=current_level,
            target_level=target_level,
            target_route=target_route,
            context_filters=context_filters,
            source_document_ids=doc_ids,
            parent_trace_id=parent_trace_id,
            audit_event_hash=audit_hash,
        )
