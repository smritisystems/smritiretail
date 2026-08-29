"""Create canonical security control-plane tables used by permission checks."""

from alembic import op
import sqlalchemy as sa

revision = "v1379_control_plane_security_fix"
down_revision = "v1378_control_plane_registry_fix"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_tables = set(inspector.get_table_names())

    if "smriti_permissions" not in existing_tables:
        op.create_table(
            "smriti_permissions",
            sa.Column("id", sa.String(length=50), primary_key=True, nullable=False),
            sa.Column("uuid", sa.String(length=36), nullable=False, unique=True),
            sa.Column("company_id", sa.String(length=50), sa.ForeignKey("companies.id", ondelete="RESTRICT"), nullable=True),
            sa.Column("branch_id", sa.String(length=50), sa.ForeignKey("branches.id", ondelete="RESTRICT"), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=True, server_default=sa.text("NOW()")),
            sa.Column("modified_at", sa.DateTime(timezone=True), nullable=True, server_default=sa.text("NOW()")),
            sa.Column("created_by", sa.String(length=100), nullable=True),
            sa.Column("updated_by", sa.String(length=100), nullable=True),
            sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
            sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.text("false")),
            sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("deleted_by", sa.String(length=100), nullable=True),
            sa.Column("version", sa.Integer(), nullable=False, server_default=sa.text("1")),
            sa.Column("code", sa.String(length=100), nullable=False),
            sa.Column("resource", sa.String(length=100), nullable=False),
            sa.Column("action", sa.String(length=50), nullable=False),
            sa.Column("scope", sa.String(length=50), nullable=False),
            sa.Column("module", sa.String(length=100), nullable=False, server_default="core"),
            sa.Column("description", sa.Text(), nullable=True),
            sa.Column("tenant_id", sa.String(length=50), nullable=True),
        )

        op.create_index(
            "ix_smriti_permissions_scope_resource_action",
            "smriti_permissions",
            ["scope", "resource", "action"],
        )
        op.create_index(
            "ix_smriti_permissions_company_branch",
            "smriti_permissions",
            ["company_id", "branch_id"],
        )

    if "smriti_audit_log" not in existing_tables:
        op.create_table(
            "smriti_audit_log",
            sa.Column("id", sa.String(length=50), primary_key=True, nullable=False),
            sa.Column("tenant_id", sa.String(length=50), nullable=True),
            sa.Column("entity_id", sa.String(length=100), nullable=True),
            sa.Column("changed_table", sa.String(length=100), nullable=False),
            sa.Column("changed_record_id", sa.String(length=100), nullable=False),
            sa.Column("field_name", sa.String(length=100), nullable=True),
            sa.Column("old_value", sa.Text(), nullable=True),
            sa.Column("new_value", sa.Text(), nullable=True),
            sa.Column("change_type", sa.String(length=50), nullable=False),
            sa.Column("change_reason", sa.Text(), nullable=True),
            sa.Column("change_source", sa.String(length=100), nullable=True),
            sa.Column("changed_by", sa.String(length=50), nullable=True),
            sa.Column("changed_by_name", sa.String(length=100), nullable=True),
            sa.Column("changed_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("sha256_hash", sa.String(length=64), nullable=True),
        )

        op.create_index(
            "ix_smriti_audit_log_changed_table",
            "smriti_audit_log",
            ["changed_table", "changed_record_id"],
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_tables = set(inspector.get_table_names())

    if "smriti_audit_log" in existing_tables:
        op.drop_table("smriti_audit_log")
    if "smriti_permissions" in existing_tables:
        op.drop_table("smriti_permissions")
