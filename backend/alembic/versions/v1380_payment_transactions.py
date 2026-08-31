"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 1.0.0
Created      : 2026-08-29
Modified     : 2026-08-29
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal

Alembic v1380 -- Payment Transactions & Allocations Schema
===========================================================

Sprint 34 data schema migration (rectification).

Context:
  PaymentTransaction and PaymentAllocation ORM models were defined in
  backend/app/models/payment_ledger.py but were never migrated to Alembic.
  
  They were only created via Base.metadata.create_all() in test fixtures,
  causing asymmetry:
    - smriti001 (test DB): table exists (via metadata.create_all)
    - smritisys (control DB): table missing (only Alembic migrations applied)
  
  This migration rectifies the schema gap by creating both tables with
  the canonical model schema from payment_ledger.py.

Tables Created:
  1. payment_transactions - Multi-tender payment transaction ledger
  2. payment_allocations - Payment-to-invoice allocation settlement links

Schema matches:
  - app.models.payment_ledger.PaymentTransaction (24 columns)
  - app.models.payment_ledger.PaymentAllocation (8 columns)

Revision History:
  v1379_control_plane_security_fix
    → v1380_payment_transactions (this migration)
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

# Revision identifiers - must be <= 32 chars total
revision = "v1380_payment_transactions"
down_revision = "v1379_control_plane_security_fix"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """
    Create payment_transactions and payment_allocations tables.
    
    Both tables follow BaseEntity pattern from app.db.base for consistency
    with control-plane authorization and audit models.
    """
    
    # =========================================================================
    # 1. PAYMENT_TRANSACTIONS -- Multi-tender payment ledger
    # =========================================================================
    op.create_table(
        "payment_transactions",
        # BaseEntity columns (13 from abstract base)
        sa.Column("id", sa.String(50), primary_key=True, nullable=False),
        sa.Column("uuid", sa.String(36), unique=True, nullable=False,
                  server_default=sa.text("gen_random_uuid()::text")),
        sa.Column("company_id", sa.String(50),
                  sa.ForeignKey("companies.id", ondelete="RESTRICT"),
                  nullable=True, index=True),
        sa.Column("branch_id", sa.String(50),
                  sa.ForeignKey("branches.id", ondelete="RESTRICT"),
                  nullable=True, index=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True,
                  server_default=sa.text("NOW()")),
        sa.Column("modified_at", sa.DateTime(timezone=True), nullable=True,
                  server_default=sa.text("NOW()")),
        sa.Column("created_by", sa.String(100), nullable=True),
        sa.Column("updated_by", sa.String(100), nullable=True),
        sa.Column("is_active", sa.Boolean, nullable=True,
                  server_default="true"),
        sa.Column("is_deleted", sa.Boolean, nullable=True,
                  server_default="false", index=True),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_by", sa.String(100), nullable=True),
        sa.Column("version", sa.Integer, nullable=True, server_default="1"),

        # Payment-specific columns (11)
        sa.Column("transaction_no", sa.String(100), nullable=False, unique=True,
                  index=True),
        sa.Column("reference_doc_type", sa.String(50), nullable=False),
        sa.Column("reference_doc_id", sa.String(50), nullable=False, index=True),
        sa.Column("party_id", sa.String(50), nullable=True, index=True),
        sa.Column("tender_type", sa.String(30), nullable=False),
        sa.Column("amount", sa.Numeric(15, 2), nullable=False),
        sa.Column("currency", sa.String(10), nullable=False,
                  server_default="'INR'"),
        sa.Column("idempotency_key", sa.String(100), nullable=False,
                  index=True),
        sa.Column("status", sa.String(30), nullable=False,
                  server_default="'SUCCESS'"),
        sa.Column("gateway_reference", sa.String(100), nullable=True),
        sa.Column("captured_at", sa.DateTime(timezone=True), nullable=True,
                  server_default=sa.text("NOW()")),

        # Constraints
        sa.UniqueConstraint("idempotency_key", name="uq_payment_idempotency_key"),
    )

    # Create indexes for performance (matching ORM model + runtime queries)
    op.create_index("ix_payment_transactions_company_branch",
                    "payment_transactions", ["company_id", "branch_id"])
    op.create_index("ix_payment_transactions_status",
                    "payment_transactions", ["status"])
    op.create_index("ix_payment_transactions_reference_doc",
                    "payment_transactions", ["reference_doc_type", "reference_doc_id"])
    op.create_index("ix_payment_transactions_tender_type",
                    "payment_transactions", ["tender_type"])
    op.create_index("ix_payment_transactions_created_at",
                    "payment_transactions", ["created_at"])

    # =========================================================================
    # 2. PAYMENT_ALLOCATIONS -- Payment-to-invoice settlement links
    # =========================================================================
    op.create_table(
        "payment_allocations",
        # BaseEntity columns (13)
        sa.Column("id", sa.String(50), primary_key=True, nullable=False),
        sa.Column("uuid", sa.String(36), unique=True, nullable=False,
                  server_default=sa.text("gen_random_uuid()::text")),
        sa.Column("company_id", sa.String(50),
                  sa.ForeignKey("companies.id", ondelete="RESTRICT"),
                  nullable=True, index=True),
        sa.Column("branch_id", sa.String(50),
                  sa.ForeignKey("branches.id", ondelete="RESTRICT"),
                  nullable=True, index=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True,
                  server_default=sa.text("NOW()")),
        sa.Column("modified_at", sa.DateTime(timezone=True), nullable=True,
                  server_default=sa.text("NOW()")),
        sa.Column("created_by", sa.String(100), nullable=True),
        sa.Column("updated_by", sa.String(100), nullable=True),
        sa.Column("is_active", sa.Boolean, nullable=True,
                  server_default="true"),
        sa.Column("is_deleted", sa.Boolean, nullable=True,
                  server_default="false", index=True),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_by", sa.String(100), nullable=True),
        sa.Column("version", sa.Integer, nullable=True, server_default="1"),

        # Allocation-specific columns (5)
        sa.Column("payment_id", sa.String(50),
                  sa.ForeignKey("payment_transactions.id", ondelete="CASCADE"),
                  nullable=False, index=True),
        sa.Column("invoice_id", sa.String(50), nullable=False, index=True),
        sa.Column("allocated_amount", sa.Numeric(15, 2), nullable=False),
        sa.Column("discount_allowed", sa.Numeric(15, 2), nullable=False,
                  server_default="0.00"),
        sa.Column("settled_at", sa.DateTime(timezone=True), nullable=True,
                  server_default=sa.text("NOW()")),
    )

    # Create indexes for allocation queries
    op.create_index("ix_payment_allocations_company_branch",
                    "payment_allocations", ["company_id", "branch_id"])
    op.create_index("ix_payment_allocations_invoice",
                    "payment_allocations", ["invoice_id"])
    op.create_index("ix_payment_allocations_settled_at",
                    "payment_allocations", ["settled_at"])


def downgrade() -> None:
    """
    Remove payment_allocations and payment_transactions tables.
    
    Drops in reverse order (allocation first, transaction second)
    to respect foreign key constraints.
    """
    # Drop indexes first
    op.drop_index("ix_payment_allocations_settled_at",
                  table_name="payment_allocations")
    op.drop_index("ix_payment_allocations_invoice",
                  table_name="payment_allocations")
    op.drop_index("ix_payment_allocations_company_branch",
                  table_name="payment_allocations")

    # Drop payment_allocations table (references payment_transactions)
    op.drop_table("payment_allocations")

    # Drop payment_transactions indexes
    op.drop_index("ix_payment_transactions_created_at",
                  table_name="payment_transactions")
    op.drop_index("ix_payment_transactions_tender_type",
                  table_name="payment_transactions")
    op.drop_index("ix_payment_transactions_reference_doc",
                  table_name="payment_transactions")
    op.drop_index("ix_payment_transactions_status",
                  table_name="payment_transactions")
    op.drop_index("ix_payment_transactions_company_branch",
                  table_name="payment_transactions")

    # Drop payment_transactions table
    op.drop_table("payment_transactions")
