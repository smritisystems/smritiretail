"""
Project      : SMRITI Retail OS
Repository   : SMRITIRetailNX
Organization : AITDL NETWORKS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.41.0
Created      : 2026-09-18
Modified     : 2026-09-18
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal Core Architecture

Revision ID: v1471_add_canonical_code_to_system_parameters
Revises: v1470_purchase_grn_debit_note_purchase_bill_identity
Create Date: 2026-09-18 23:15:00.000000

Governance Standard: AGENTS.md Rules 1-12, UADHP-v1.0
Scope of Migration:
  - Adds `canonical_code` column (VARCHAR 150, nullable) to `system_parameters` table.
  - Creates index `idx_sys_param_canonical_code` on `canonical_code` for fast dual-key
    resolution (canonical SMRITI.DOMAIN.FEATURE keys alongside legacy Shoper 9 param_code).
  - This is a non-breaking additive migration. All existing param_code values are preserved.
  - The canonical_code column is populated by the subsequent backfill migration v1472.

Architecture Context:
  - Activates the SMRITI canonical parameter namespace defined in ADR-042.
  - Enables dual-key resolution: SMRITI.* -> canonical_code; legacy -> param_code.
  - Zero regression on existing POS billing, seeding, and test suites.
"""

from alembic import op
import sqlalchemy as sa

revision = "v1471_add_canonical_code_to_system_parameters"
down_revision = "v1470_purchase_grn_debit_note_purchase_bill_identity"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add canonical_code column — nullable, added after param_code for logical ordering
    op.add_column(
        "system_parameters",
        sa.Column("canonical_code", sa.String(150), nullable=True),
    )

    # Index for fast canonical-key resolution
    op.create_index(
        "idx_sys_param_canonical_code",
        "system_parameters",
        ["canonical_code"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("idx_sys_param_canonical_code", table_name="system_parameters")
    op.drop_column("system_parameters", "canonical_code")
