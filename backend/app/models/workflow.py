"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.21.0
Created      : 2026-07-15
Modified     : 2026-07-15
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

import uuid as _uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, DateTime, Text, ForeignKey, Index
from sqlalchemy.orm import relationship

from ..db.base import Base


def _uid() -> str:
    return str(_uuid.uuid4())


class WorkflowEvent(Base):
    """
    Immutable audit trail for every document state transition.

    Every call to the Core Workflow API (POST /api/v1/workflow/{docType}/{id}/{action})
    appends one WorkflowEvent row. Rows are never updated or deleted.

    Indexed by (doc_type, doc_id) for fast chronological event history retrieval.
    """
    __tablename__ = "workflow_events"

    id               = Column(String(50), primary_key=True, default=_uid)
    doc_type         = Column(String(50), nullable=False,
                              comment="E.g. PurchaseOrder, SalesInvoice, SalesQuotation")
    doc_id           = Column(String(50), nullable=False,
                              comment="FK to the business document (not enforced, cross-model)")
    action           = Column(String(50), nullable=False,
                              comment="submit | approve | cancel | reject | amend")
    from_status      = Column(String(50), nullable=True,
                              comment="Status before the transition; NULL for initial events")
    to_status        = Column(String(50), nullable=False,
                              comment="Status after the transition")
    performed_by_id  = Column(String(50), ForeignKey("users.id", ondelete="SET NULL"),
                              nullable=True)
    performed_by_name = Column(String(150), nullable=True,
                               comment="Denormalised name for readability without join")
    company_id       = Column(String(50), nullable=False)
    branch_id        = Column(String(50), nullable=False)
    notes            = Column(Text, nullable=True)
    created_at       = Column(
        DateTime(timezone=True), nullable=False,
        default=lambda: datetime.now(timezone.utc)
    )

    # Relationships
    performed_by = relationship("User", foreign_keys=[performed_by_id], lazy="noload")

    __table_args__ = (
        Index("ix_workflow_events_doc", "doc_type", "doc_id"),
        Index("ix_workflow_events_company", "company_id", "branch_id", "created_at"),
    )
