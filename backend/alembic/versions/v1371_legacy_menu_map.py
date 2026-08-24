"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 1.0.0
Created      : 2026-08-24
Modified     : 2026-08-24
Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

"""Create smriti_legacy_menu_map table

Revision ID: v1371_legacy_menu_map
Revises: v1370_tenant_capability_binding_status
Create Date: 2026-08-24

Sprint 2 -- Legacy Shoper9 Menu to SMRITI Workspace mapping table.

This table is the authoritative join registry between:
  - Shoper9 vaMenu (MnuNo, MenuOpt) natural keys
  - SMRITI canonical workspace + action + document_type

Design constraints:
  - APPEND-ONLY: rows are never deleted
  - migration_status is a closed CHECK-constrained enum
  - Global scope: no company_id/branch_id -- all tenants share same lineage
  - Unique constraint on (sh9_mnu_no, sh9_menu_opt)

Downgrade: drops the table only (safe -- data is re-seeded from CSV)
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers -- must stay <= 32 chars
revision = "v1371_legacy_menu_map"
down_revision = "v1370_tenant_capability_binding_status"
branch_labels = None
depends_on = None

TABLE_NAME = "smriti_legacy_menu_map"


def upgrade() -> None:
    conn = op.get_bind()
    exists = conn.execute(
        sa.text(
            "SELECT table_name FROM information_schema.tables "
            "WHERE table_schema='public' AND table_name=:tn"
        ),
        {"tn": TABLE_NAME},
    ).fetchone()

    if exists:
        return  # Idempotent: table already present

    op.create_table(
        TABLE_NAME,

        # ── BaseEntity standard columns ───────────────────────────────────
        sa.Column("id",          sa.String(50),  primary_key=True),
        sa.Column("uuid",        sa.String(36),  nullable=False, unique=True),
        sa.Column("company_id",  sa.String(50),  nullable=True),
        sa.Column("branch_id",   sa.String(50),  nullable=True),
        sa.Column("created_at",  sa.DateTime(timezone=True), nullable=True),
        sa.Column("modified_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by",  sa.String(100), nullable=True),
        sa.Column("updated_by",  sa.String(100), nullable=True),
        sa.Column("is_active",   sa.Boolean,     nullable=False, server_default="true"),
        sa.Column("is_deleted",  sa.Boolean,     nullable=False, server_default="false"),
        sa.Column("deleted_at",  sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_by",  sa.String(100), nullable=True),
        sa.Column("version",     sa.Integer,     nullable=False, server_default="1"),

        # ── Shoper9 Identity ──────────────────────────────────────────────
        sa.Column("sh9_mnu_no",      sa.Integer,      nullable=False),
        sa.Column("sh9_menu_opt",    sa.Integer,      nullable=False),
        sa.Column("sh9_mnu_name",    sa.String(120),  nullable=True),
        sa.Column("sh9_mnu_cap",     sa.String(200),  nullable=True),
        sa.Column("sh9_exe_name",    sa.String(60),   nullable=True),
        sa.Column("sh9_pgm_opt",     sa.SmallInteger, nullable=True),
        sa.Column("sh9_allow_closed",sa.SmallInteger, nullable=True, server_default="0"),
        sa.Column("sh9_multi_inst",  sa.SmallInteger, nullable=True, server_default="0"),

        # ── SMRITI Target ─────────────────────────────────────────────────
        sa.Column("smriti_menu_id",   sa.String(80),  nullable=True),
        sa.Column("smriti_workspace", sa.String(120), nullable=True),
        sa.Column("smriti_module",    sa.String(50),  nullable=True),
        sa.Column("smriti_action",    sa.String(60),  nullable=True),
        sa.Column("document_type",    sa.String(60),  nullable=True),

        # ── Migration Governance ──────────────────────────────────────────
        sa.Column("migration_status", sa.String(20),
                  nullable=False, server_default="PENDING"),
        sa.Column("migration_notes",  sa.Text, nullable=True),

        # ── Source Traceability ───────────────────────────────────────────
        sa.Column("source_file",  sa.String(120), nullable=True),
        sa.Column("map_version",  sa.String(10),  nullable=False, server_default="1.0"),

        # ── Constraints ───────────────────────────────────────────────────
        sa.UniqueConstraint("sh9_mnu_no", "sh9_menu_opt",
                            name="uq_legacy_map_mnu_opt"),
        sa.CheckConstraint(
            "migration_status IN ("
            "'MAPPED','MERGED','REPLACED','DEPRECATED','NOT_APPLIC','PENDING')",
            name="ck_legacy_map_status"
        ),
        sa.CheckConstraint(
            "sh9_mnu_no >= 0 AND sh9_menu_opt >= 0",
            name="ck_legacy_map_nonneg"
        ),
    )

    # Indexes for common lookup patterns
    op.create_index("ix_legacy_map_mnu_no",  TABLE_NAME, ["sh9_mnu_no"])
    op.create_index("ix_legacy_map_status",  TABLE_NAME, ["migration_status"])
    op.create_index("ix_legacy_map_menu_id", TABLE_NAME, ["smriti_menu_id"])
    op.create_index("ix_legacy_map_module",  TABLE_NAME, ["smriti_module"])


def downgrade() -> None:
    conn = op.get_bind()
    exists = conn.execute(
        sa.text(
            "SELECT table_name FROM information_schema.tables "
            "WHERE table_schema='public' AND table_name=:tn"
        ),
        {"tn": TABLE_NAME},
    ).fetchone()
    if exists:
        op.drop_index("ix_legacy_map_module",  table_name=TABLE_NAME)
        op.drop_index("ix_legacy_map_menu_id", table_name=TABLE_NAME)
        op.drop_index("ix_legacy_map_status",  table_name=TABLE_NAME)
        op.drop_index("ix_legacy_map_mnu_no",  table_name=TABLE_NAME)
        op.drop_table(TABLE_NAME)
