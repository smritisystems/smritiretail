"""
v1475 — Create vendor_product_assignments table.

Migration Safety (Execution Command Rules 28-29):
- Checks for table existence before creating.
- Uses partial unique index (PostgreSQL WHERE clause) to allow multiple
  INACTIVE records while enforcing uniqueness of ACTIVE assignments.
- No destructive reinterpretation of existing vendor_code fields.
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.sql import text

revision: str = "v1475_vendor_product_assignments"
down_revision: Union[str, Sequence[str], None] = "v1474_po_vendor_product_control_params"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    existing_tables = inspector.get_table_names()

    if "vendor_product_assignments" in existing_tables:
        # Table already exists — idempotently ensure indexes
        existing_indexes = {i["name"] for i in inspector.get_indexes("vendor_product_assignments")}
        _ensure_indexes(existing_indexes)
        return

    op.create_table(
        "vendor_product_assignments",
        # ── BaseEntity columns ────────────────────────────────────────────────
        sa.Column("id", sa.String(50), primary_key=True),
        sa.Column("company_id", sa.String(50), nullable=True, index=True),
        sa.Column("branch_id", sa.String(50), nullable=True),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default=text("TRUE")),
        sa.Column("is_deleted", sa.Boolean, nullable=False, server_default=text("FALSE")),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=text("NOW()"),
        ),
        sa.Column("modified_at", sa.DateTime(timezone=True), nullable=True),

        # ── Vendor Identity ───────────────────────────────────────────────────
        sa.Column(
            "vendor_party_id",
            sa.String(50),
            sa.ForeignKey("parties.id", ondelete="RESTRICT"),
            nullable=False,
            index=True,
        ),
        sa.Column("legacy_supplier_id", sa.String(50), nullable=True, index=True),

        # ── Assignment Level & Target ─────────────────────────────────────────
        sa.Column(
            "assignment_level", sa.String(20), nullable=False, index=True,
            comment="BRAND | CATEGORY | STYLE | ARTICLE | MODEL | SKU | BARCODE",
        ),
        sa.Column("assignment_target_id", sa.String(100), nullable=False, index=True),
        sa.Column("assignment_target_code", sa.String(100), nullable=False, index=True),
        sa.Column("assignment_target_name", sa.String(255), nullable=True),

        # ── Priority & Status ─────────────────────────────────────────────────
        sa.Column(
            "vendor_priority", sa.String(20), nullable=False, server_default=text("'PRIMARY'"),
            comment="PRIMARY | PREFERRED | SECONDARY",
        ),
        sa.Column(
            "status", sa.String(20), nullable=False, server_default=text("'ACTIVE'"),
            comment="ACTIVE | INACTIVE | RESTRICTED",
        ),

        # ── Purchasing Permissions ────────────────────────────────────────────
        sa.Column("allow_purchase", sa.Boolean, nullable=False, server_default=text("TRUE")),
        sa.Column("allow_po", sa.Boolean, nullable=False, server_default=text("TRUE")),
        sa.Column("allow_grn", sa.Boolean, nullable=False, server_default=text("TRUE")),
        sa.Column("approval_required", sa.Boolean, nullable=False, server_default=text("FALSE")),

        # ── Effective Date Window ─────────────────────────────────────────────
        sa.Column("effective_from", sa.Date, nullable=True),
        sa.Column("effective_to", sa.Date, nullable=True),

        # ── Audit ─────────────────────────────────────────────────────────────
        sa.Column("remarks", sa.Text, nullable=True),
        sa.Column("created_by", sa.String(100), nullable=True),
        sa.Column("modified_by", sa.String(100), nullable=True),
        sa.Column(
            "metadata_json",
            JSONB,
            nullable=False,
            server_default=text("'{}'::jsonb"),
        ),
    )

    _ensure_indexes(set())


def _ensure_indexes(existing: set) -> None:
    """Create indexes idempotently."""
    conn = op.get_bind()

    # Compound indexes for fast lookup
    if "ix_vpa_target_lookup" not in existing:
        op.create_index(
            "ix_vpa_target_lookup",
            "vendor_product_assignments",
            ["company_id", "assignment_level", "assignment_target_id"],
        )
    if "ix_vpa_vendor_lookup" not in existing:
        op.create_index(
            "ix_vpa_vendor_lookup",
            "vendor_product_assignments",
            ["company_id", "vendor_party_id"],
        )
    if "ix_vpa_target_code" not in existing:
        op.create_index(
            "ix_vpa_target_code",
            "vendor_product_assignments",
            ["company_id", "assignment_target_code"],
        )

    # Partial unique: only one ACTIVE assignment per vendor+level+target per company
    if "uq_vpa_vendor_level_target_active" not in existing:
        conn.execute(text("""
            CREATE UNIQUE INDEX IF NOT EXISTS uq_vpa_vendor_level_target_active
            ON vendor_product_assignments (company_id, vendor_party_id, assignment_level, assignment_target_id)
            WHERE is_active = TRUE AND is_deleted = FALSE AND status = 'ACTIVE'
        """))


def downgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    if "vendor_product_assignments" in inspector.get_table_names():
        op.drop_table("vendor_product_assignments")
