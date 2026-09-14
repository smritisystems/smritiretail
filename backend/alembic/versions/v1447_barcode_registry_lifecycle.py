"""Add lifecycle and audit support to the canonical barcode registry."""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "v1447_barcode_registry_lifecycle"
down_revision: Union[str, Sequence[str], None] = "v1446_enforce_master_value_reference_guard"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_cols = {col["name"] for col in inspector.get_columns("item_barcodes")}
    existing_indexes = {idx["name"] for idx in inspector.get_indexes("item_barcodes")}
    existing_tables = set(inspector.get_table_names())

    op.alter_column("item_barcodes", "item_id", existing_type=sa.String(length=50), nullable=True)

    columns_to_add = [
        ("barcode_normalized", sa.Column("barcode_normalized", sa.String(length=100), nullable=True)),
        ("barcode_purpose", sa.Column("barcode_purpose", sa.String(length=20), server_default="RETAIL", nullable=False)),
        ("encoding_standard", sa.Column("encoding_standard", sa.String(length=20), server_default="NONE", nullable=False)),
        ("status", sa.Column("status", sa.String(length=20), server_default="ASSIGNED", nullable=False)),
        ("source", sa.Column("source", sa.String(length=30), server_default="LEGACY", nullable=False)),
        ("source_reference", sa.Column("source_reference", sa.String(length=100), nullable=True)),
        ("assigned_at", sa.Column("assigned_at", sa.Date(), nullable=True)),
        ("assigned_by", sa.Column("assigned_by", sa.String(length=100), nullable=True)),
        ("retired_at", sa.Column("retired_at", sa.Date(), nullable=True)),
        ("retirement_reason", sa.Column("retirement_reason", sa.Text(), nullable=True)),
    ]

    for col_name, col_def in columns_to_add:
        if col_name not in existing_cols:
            op.add_column("item_barcodes", col_def)

    op.execute("UPDATE item_barcodes SET barcode_normalized = UPPER(BTRIM(barcode)) WHERE barcode_normalized IS NULL")
    if "ix_item_barcodes_normalized" not in existing_indexes:
        op.create_index("ix_item_barcodes_normalized", "item_barcodes", ["company_id", "barcode_normalized"])

    # Check constraint
    constraints = {c["name"] for c in inspector.get_check_constraints("item_barcodes")}
    if "ck_item_barcodes_assignment_target" not in constraints:
        op.create_check_constraint(
            "ck_item_barcodes_assignment_target",
            "item_barcodes",
            "(status = 'UNASSIGNED' AND item_id IS NULL AND variant_id IS NULL) OR "
            "(status IN ('ASSIGNED', 'QUARANTINED', 'CONFLICT', 'RETIRED') AND item_id IS NOT NULL)",
        )

    if "barcode_registry_audit" not in existing_tables:
        op.create_table(
            "barcode_registry_audit",
            sa.Column("id", sa.String(length=50), primary_key=True),
            sa.Column("uuid", sa.String(length=36), nullable=False),
            sa.Column("company_id", sa.String(length=50), nullable=True),
            sa.Column("branch_id", sa.String(length=50), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()"), nullable=False),
            sa.Column("modified_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()"), nullable=False),
            sa.Column("created_by", sa.String(length=100), nullable=True),
            sa.Column("updated_by", sa.String(length=100), nullable=True),
            sa.Column("is_active", sa.Boolean(), server_default="true", nullable=False),
            sa.Column("is_deleted", sa.Boolean(), server_default="false", nullable=False),
            sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("deleted_by", sa.String(length=100), nullable=True),
            sa.Column("version", sa.Integer(), server_default="1", nullable=False),
            sa.Column("barcode_id", sa.String(length=50), sa.ForeignKey("item_barcodes.id", ondelete="CASCADE"), nullable=False),
            sa.Column("action", sa.String(length=30), nullable=False),
            sa.Column("previous_status", sa.String(length=20), nullable=True),
            sa.Column("next_status", sa.String(length=20), nullable=False),
            sa.Column("details_json", postgresql.JSONB(), server_default=sa.text("'{}'::jsonb"), nullable=False),
            sa.Column("reason", sa.Text(), nullable=True),
        )
        op.create_index("ix_barcode_registry_audit_barcode_id", "barcode_registry_audit", ["barcode_id"])


def downgrade() -> None:
    op.drop_table("barcode_registry_audit")
    op.drop_constraint("ck_item_barcodes_assignment_target", "item_barcodes", type_="check")
    op.drop_index("ix_item_barcodes_normalized", table_name="item_barcodes")
    for column in ("retirement_reason", "retired_at", "assigned_by", "assigned_at", "source_reference", "source", "status", "encoding_standard", "barcode_purpose", "barcode_normalized"):
        op.drop_column("item_barcodes", column)
    op.alter_column("item_barcodes", "item_id", existing_type=sa.String(length=50), nullable=False)