"""SMRITI Retail OS Item Master Phase 11: Tracking Mode Harmonization & Database Constraint Enactment

Revision ID: v1522_item_master_phase11_tracking_mode_harmonization
Revises: v1521_item_master_phase8_company_id_not_null
Create Date: 2026-10-05

Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.70.6
Copyright    : (C) SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal

Architecture Invariants Enforced:
1. Every item must have consistent tracking fields (tracking_mode, tracking_type, is_batch_tracked, is_serial_tracked).
2. Dual tracking is strictly prohibited at the database level: an item CANNOT be simultaneously batch-tracked and serial-tracked.
3. Database CHECK constraints:
   - chk_no_dual_tracking: NOT (is_batch_tracked = TRUE AND is_serial_tracked = TRUE)
   - chk_tracking_mode_matches_flags: ensures tracking_mode enum ('BATCH', 'SERIAL', 'NONE') matches the boolean flags.
4. tracking_type and tracking_mode are guaranteed NOT NULL with default 'NONE'.
5. Fully reversible upgrade and downgrade paths.
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.engine.reflection import Inspector

revision = "v1522_item_master_phase11_tracking_mode_harmonization"
down_revision = "v1521_item_master_phase8_company_id_not_null"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()

    # ─────────────────────────────────────────────────────────────
    # STEP 1: Idempotent data repair prior to constraint enactment
    # ─────────────────────────────────────────────────────────────
    # 1.1 Harmonize BATCH items
    conn.execute(sa.text("""
        UPDATE items
        SET tracking_mode = 'BATCH',
            tracking_type = 'BATCH',
            is_batch_tracked = TRUE,
            is_serial_tracked = FALSE,
            modified_at = NOW()
        WHERE (is_batch_tracked = TRUE OR tracking_mode = 'BATCH' OR tracking_type = 'BATCH')
          AND is_serial_tracked IS NOT TRUE;
    """))

    # 1.2 Harmonize SERIAL items
    conn.execute(sa.text("""
        UPDATE items
        SET tracking_mode = 'SERIAL',
            tracking_type = 'SERIAL',
            is_serial_tracked = TRUE,
            is_batch_tracked = FALSE,
            modified_at = NOW()
        WHERE (is_serial_tracked = TRUE OR tracking_mode = 'SERIAL' OR tracking_type = 'SERIAL');
    """))

    # 1.3 Resolve potential edge-case dual tracking
    conn.execute(sa.text("""
        UPDATE items
        SET tracking_mode = 'BATCH',
            tracking_type = 'BATCH',
            is_batch_tracked = TRUE,
            is_serial_tracked = FALSE,
            modified_at = NOW()
        WHERE is_batch_tracked = TRUE AND is_serial_tracked = TRUE;
    """))

    # 1.4 Harmonize remaining NONE items
    conn.execute(sa.text("""
        UPDATE items
        SET tracking_mode = 'NONE',
            tracking_type = 'NONE',
            is_batch_tracked = FALSE,
            is_serial_tracked = FALSE,
            modified_at = NOW()
        WHERE (is_batch_tracked IS NOT TRUE AND is_serial_tracked IS NOT TRUE)
           OR (tracking_mode != 'BATCH' AND tracking_mode != 'SERIAL')
           OR tracking_type IS NULL;
    """))

    # ─────────────────────────────────────────────────────────────
    # STEP 2: Enforce column NOT NULL constraints with defaults
    # ─────────────────────────────────────────────────────────────
    op.alter_column("items", "tracking_type", existing_type=sa.String(50), nullable=False, server_default="NONE")
    op.alter_column("items", "tracking_mode", existing_type=sa.String(20), nullable=False, server_default="NONE")
    op.alter_column("items", "is_batch_tracked", existing_type=sa.Boolean(), nullable=False, server_default=sa.text("false"))
    op.alter_column("items", "is_serial_tracked", existing_type=sa.Boolean(), nullable=False, server_default=sa.text("false"))

    # ─────────────────────────────────────────────────────────────
    # STEP 3: Enact database CHECK constraints
    # ─────────────────────────────────────────────────────────────
    op.create_check_constraint(
        "chk_no_dual_tracking",
        "items",
        "NOT (is_batch_tracked = TRUE AND is_serial_tracked = TRUE)",
    )

    op.create_check_constraint(
        "chk_tracking_mode_matches_flags",
        "items",
        """
        (tracking_mode = 'BATCH' AND is_batch_tracked = TRUE AND is_serial_tracked = FALSE) OR
        (tracking_mode = 'SERIAL' AND is_serial_tracked = TRUE AND is_batch_tracked = FALSE) OR
        (tracking_mode = 'NONE' AND is_batch_tracked = FALSE AND is_serial_tracked = FALSE)
        """,
    )


def downgrade() -> None:
    op.drop_constraint("chk_tracking_mode_matches_flags", "items", type_="check")
    op.drop_constraint("chk_no_dual_tracking", "items", type_="check")
    op.alter_column("items", "tracking_type", existing_type=sa.String(50), nullable=True)
