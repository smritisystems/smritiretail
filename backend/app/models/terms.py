"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.16.0
Created      : 2026-07-12
Modified     : 2026-07-12
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

from sqlalchemy import Column, String, Text, DateTime, Integer, Boolean
from ..db.base import BaseEntity


class TermsClause(BaseEntity):
    """
    Individual legal terms & conditions clauses.
    """
    __tablename__ = "terms_clauses"

    code         = Column(String(50), nullable=True)
    title        = Column(String(200), nullable=False)
    category     = Column(String(100), nullable=False)
    content      = Column(Text, nullable=False)
    status       = Column(String(20), default="Approved")  # Draft, Pending Approval, Approved
    language     = Column(String(50), default="English")
    approved_by  = Column(String(100), nullable=True)
    approved_at  = Column(DateTime, nullable=True)


class TermsDefault(BaseEntity):
    """
    Mapped default clauses assigned at Company, Branch, Document, or Party levels.
    """
    __tablename__ = "terms_defaults"

    level      = Column(String(50), nullable=False)  # Company, Branch, Document, Supplier, Customer
    ref_id     = Column(String(50), nullable=False)  # Ref ID e.g. Branch code or Document type
    clause_ids = Column(Text, nullable=False)        # JSON array of clause IDs stored as string


class TermsSnapshot(BaseEntity):
    """
    Archived snapshot of resolved terms resolved on document generation.
    """
    __tablename__ = "terms_snapshots"

    document_type    = Column(String(100), nullable=False)
    document_no      = Column(String(100), nullable=False)
    snapshot_at      = Column(DateTime, nullable=False)
    clauses_snapshot = Column(Text, nullable=False)      # Concatenated clauses or JSON snapshot


class ApprovalWorkflowLog(BaseEntity):
    """
    Audit trail of clause revisions validation pipeline.
    """
    __tablename__ = "approval_workflow_logs"

    clause_id         = Column(String(50), nullable=False)
    title             = Column(String(200), nullable=False)
    submitted_by      = Column(String(100), nullable=True)
    submitted_at      = Column(DateTime, nullable=True)
    status            = Column(String(50), default="Pending")  # Pending, Approved, Rejected
    approved_by       = Column(String(100), nullable=True)
    approved_at       = Column(DateTime, nullable=True)
    comments          = Column(Text, nullable=True)
    proposed_changes  = Column(Text, nullable=True)            # JSON proposed revision details
