"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.42.0
Created      : 2026-09-19
Modified     : 2026-09-19
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

from datetime import date
from sqlalchemy import (
    Boolean, Column, Date, ForeignKey, Index, String, Text, text, UniqueConstraint
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship
from ..db.base import BaseEntity


class VendorProductAssignment(BaseEntity):
    """
    SMRITI Vendor Product Assignment — Multi-vendor, multi-level, effective-date-governed
    assignment of products/catalog hierarchy nodes to vendor parties.

    Supports:
    - Multiple vendors per product (PRIMARY / PREFERRED / SECONDARY priority)
    - Assignment at any catalog level: BRAND / CATEGORY / STYLE / ARTICLE / MODEL / SKU / BARCODE
    - Inheritance: a more specific level overrides a broader level
    - Effective date windows (effective_from / effective_to)
    - Restriction at item level (status = RESTRICTED)
    - Per-assignment approval override (approval_required = True)

    Governance:
    - Tenant-isolated: company_id scoped.
    - Dual-vendor bridge: vendor_party_id → parties.id (canonical) with
      legacy_supplier_id bridge to suppliers.id for backward compatibility.
    - Does NOT repurpose items.vendor_code or master_values.vendor_code — those are
      the vendor's own item codes, not SMRITI party relationships.
    """
    __tablename__ = "vendor_product_assignments"
    __table_args__ = (
        # Prevent duplicate active assignment of same vendor to same target at same level
        UniqueConstraint(
            "company_id", "vendor_party_id", "assignment_level", "assignment_target_id",
            name="uq_vpa_vendor_level_target",
        ),
        # Fast lookup: which vendors supply this product at this level?
        Index("ix_vpa_target_lookup", "company_id", "assignment_level", "assignment_target_id"),
        # Fast lookup: all assignments for a vendor
        Index("ix_vpa_vendor_lookup", "company_id", "vendor_party_id"),
        # Code-based lookup (for F2/barcode/style-code lookups)
        Index("ix_vpa_target_code", "company_id", "assignment_target_code"),
    )

    # ── Vendor Identity ─────────────────────────────────────────────────────────
    vendor_party_id = Column(
        String(50),
        ForeignKey("parties.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
        comment="Canonical Party ID (parties.id) — the authoritative vendor reference.",
    )
    legacy_supplier_id = Column(
        String(50),
        nullable=True,
        index=True,
        comment="Legacy suppliers.id bridge — populated for backward compat with PO screen.",
    )

    # ── Assignment Level & Target ────────────────────────────────────────────────
    assignment_level = Column(
        String(20),
        nullable=False,
        index=True,
        comment="Catalog hierarchy level: BRAND | CATEGORY | STYLE | ARTICLE | MODEL | SKU | BARCODE",
    )
    assignment_target_id = Column(
        String(100),
        nullable=False,
        index=True,
        comment="ID of the target at the assignment_level (item_id, variant_id, master_value.id, etc.).",
    )
    assignment_target_code = Column(
        String(100),
        nullable=False,
        index=True,
        comment="Denormalized code for fast lookup (item_code, variant_sku, style_code, barcode, brand name).",
    )
    assignment_target_name = Column(
        String(255),
        nullable=True,
        comment="Denormalized display name for the assigned entity.",
    )

    # ── Vendor Priority ──────────────────────────────────────────────────────────
    vendor_priority = Column(
        String(20),
        nullable=False,
        default="PRIMARY",
        comment="PRIMARY | PREFERRED | SECONDARY — ordering when multiple vendors supply same product.",
    )

    # ── Assignment Status ────────────────────────────────────────────────────────
    status = Column(
        String(20),
        nullable=False,
        default="ACTIVE",
        comment="ACTIVE | INACTIVE | RESTRICTED — RESTRICTED means explicitly blocked for this vendor.",
    )

    # ── Purchasing Permissions ────────────────────────────────────────────────────
    allow_purchase = Column(Boolean, nullable=False, default=True)
    allow_po = Column(Boolean, nullable=False, default=True,
                      comment="Controls PO-specific permission distinct from general purchasing.")
    allow_grn = Column(Boolean, nullable=False, default=True)
    approval_required = Column(
        Boolean, nullable=False, default=False,
        comment="If True, this specific assignment always requires approval regardless of global policy.",
    )

    # ── Effective Date Window ─────────────────────────────────────────────────────
    effective_from = Column(Date, nullable=True,
                            comment="Assignment valid from this date. NULL = no start restriction.")
    effective_to = Column(Date, nullable=True,
                          comment="Assignment valid until this date. NULL = indefinite.")

    # ── Audit ─────────────────────────────────────────────────────────────────────
    remarks = Column(Text, nullable=True)
    created_by = Column(String(100), nullable=True)
    modified_by = Column(String(100), nullable=True)
    metadata_json = Column(JSONB, server_default=text("'{}'::jsonb"), nullable=False)

    # ── Relationships ─────────────────────────────────────────────────────────────
    vendor_party = relationship("Party", foreign_keys=[vendor_party_id])


class POProductDecisionLog(BaseEntity):
    """
    Immutable audit ledger of every PO product policy decision made by the
    POProductPolicyEngine.

    Persists the full decision context at evaluation time — including a snapshot
    of the active policy parameters — so that historical PO decisions remain
    explainable even after policy or assignment changes.

    Governance (AGENTS.md Rule 34 — Historical PO Immutability):
    Changing vendor assignments, system parameters, or business templates must
    NOT alter historical entries in this table.
    """
    __tablename__ = "po_product_decision_log"
    __table_args__ = (
        Index("ix_ppdl_po", "company_id", "purchase_order_id"),
        Index("ix_ppdl_vendor_product", "company_id", "vendor_party_id", "product_id"),
        Index("ix_ppdl_status", "company_id", "decision_status"),
    )

    # ── PO Context ────────────────────────────────────────────────────────────────
    purchase_order_id = Column(
        String(50),
        ForeignKey("purchase_orders.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
        comment="The PO to which this decision belongs. NULL = pre-PO browse evaluation.",
    )
    purchase_order_item_id = Column(
        String(50),
        nullable=True,
        index=True,
        comment="The specific PO line item (post-add). NULL for browse-time evaluations.",
    )

    # ── Decision Inputs ──────────────────────────────────────────────────────────
    vendor_party_id = Column(String(50), nullable=False, index=True)
    product_id = Column(String(50), nullable=False, index=True,
                        comment="Legacy products.id or items.id.")
    item_id = Column(String(50), nullable=True, index=True)
    variant_id = Column(String(50), nullable=True, index=True)
    product_code = Column(String(100), nullable=True)
    transaction_date = Column(Date, nullable=True)

    # ── Decision Outputs ─────────────────────────────────────────────────────────
    decision_status = Column(
        String(20), nullable=False,
        comment="ASSIGNED | CROSS_VENDOR | UNASSIGNED | RESTRICTED",
    )
    decision_action = Column(
        String(25), nullable=False,
        comment="ALLOW | READ_ONLY | APPROVAL_REQUIRED | BLOCK",
    )

    # ── Assignment Trace ─────────────────────────────────────────────────────────
    assignment_id = Column(
        String(50),
        ForeignKey("vendor_product_assignments.id", ondelete="SET NULL"),
        nullable=True,
        comment="The specific VendorProductAssignment row that determined the decision.",
    )
    assignment_level = Column(String(20), nullable=True)
    assignment_source_vendor_id = Column(
        String(50), nullable=True,
        comment="vendor_party_id from the matched assignment (may differ from PO vendor for CROSS_VENDOR).",
    )

    # ── Policy Snapshot ──────────────────────────────────────────────────────────
    policy_snapshot = Column(
        JSONB,
        server_default=text("'{}'::jsonb"),
        nullable=False,
        comment="Snapshot of the 8 canonical SystemParameter values at evaluation time.",
    )

    # ── Approval Link ────────────────────────────────────────────────────────────
    approval_request_id = Column(
        String(50),
        ForeignKey("approval_requests.id", ondelete="SET NULL"),
        nullable=True,
    )
    approval_reason_code = Column(String(50), nullable=True)
    approval_reason_text = Column(Text, nullable=True)

    # ── Explainability ───────────────────────────────────────────────────────────
    explanation = Column(
        Text, nullable=False, default="",
        comment="Human-readable explanation of why this decision was made.",
    )

    # ── Actor ────────────────────────────────────────────────────────────────────
    decided_by = Column(String(100), nullable=True)
