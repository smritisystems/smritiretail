"""
v1476 — Create po_product_decision_log table.

Immutable audit ledger for POProductPolicyEngine decisions (Execution Command Rule 26).
Preserves full context at evaluation time so historical PO decisions are explainable
even after policy or assignment changes (Rule 27 — Historical Immutability).
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.sql import text

revision: str = "v1476_po_product_decision_log"
down_revision: Union[str, Sequence[str], None] = "v1475_vendor_product_assignments"
branch_labels = None
depends_on = None


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    if "po_product_decision_log" in inspector.get_table_names():
        return  # Idempotent

    op.create_table(
        "po_product_decision_log",
        # ── BaseEntity ───────────────────────────────────────────────────────
        sa.Column("id", sa.String(50), primary_key=True),
        sa.Column("company_id", sa.String(50), nullable=True, index=True),
        sa.Column("branch_id", sa.String(50), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=text("NOW()"),
        ),

        # ── PO Context ───────────────────────────────────────────────────────
        sa.Column(
            "purchase_order_id",
            sa.String(50),
            sa.ForeignKey("purchase_orders.id", ondelete="SET NULL"),
            nullable=True,
            index=True,
            comment="NULL = pre-PO browse evaluation",
        ),
        sa.Column("purchase_order_item_id", sa.String(50), nullable=True, index=True),

        # ── Decision Inputs ──────────────────────────────────────────────────
        sa.Column("vendor_party_id", sa.String(50), nullable=False, index=True),
        sa.Column("product_id", sa.String(50), nullable=False, index=True),
        sa.Column("item_id", sa.String(50), nullable=True),
        sa.Column("variant_id", sa.String(50), nullable=True),
        sa.Column("product_code", sa.String(100), nullable=True),
        sa.Column("transaction_date", sa.Date, nullable=True),

        # ── Decision Outputs ─────────────────────────────────────────────────
        sa.Column(
            "decision_status", sa.String(20), nullable=False,
            comment="ASSIGNED | CROSS_VENDOR | UNASSIGNED | RESTRICTED",
        ),
        sa.Column(
            "decision_action", sa.String(25), nullable=False,
            comment="ALLOW | READ_ONLY | APPROVAL_REQUIRED | BLOCK",
        ),

        # ── Assignment Trace ─────────────────────────────────────────────────
        sa.Column(
            "assignment_id",
            sa.String(50),
            sa.ForeignKey("vendor_product_assignments.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("assignment_level", sa.String(20), nullable=True),
        sa.Column("assignment_source_vendor_id", sa.String(50), nullable=True),

        # ── Policy Snapshot (Rule 27 — immutable historical reference) ───────
        sa.Column(
            "policy_snapshot",
            JSONB,
            nullable=False,
            server_default=text("'{}'::jsonb"),
            comment="Snapshot of 8 SystemParameter values at evaluation time.",
        ),

        # ── Approval Link ────────────────────────────────────────────────────
        sa.Column(
            "approval_request_id",
            sa.String(50),
            sa.ForeignKey("approval_requests.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("approval_reason_code", sa.String(50), nullable=True),
        sa.Column("approval_reason_text", sa.Text, nullable=True),

        # ── Explainability (Rule 22) ─────────────────────────────────────────
        sa.Column("explanation", sa.Text, nullable=False, server_default=text("''")),

        # ── Actor ────────────────────────────────────────────────────────────
        sa.Column("decided_by", sa.String(100), nullable=True),
    )

    # Lookup indexes
    op.create_index("ix_ppdl_po", "po_product_decision_log", ["company_id", "purchase_order_id"])
    op.create_index(
        "ix_ppdl_vendor_product",
        "po_product_decision_log",
        ["company_id", "vendor_party_id", "product_id"],
    )
    op.create_index(
        "ix_ppdl_status",
        "po_product_decision_log",
        ["company_id", "decision_status"],
    )


def downgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    if "po_product_decision_log" in inspector.get_table_names():
        op.drop_table("po_product_decision_log")
