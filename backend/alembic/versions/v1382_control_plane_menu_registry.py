"""Create the canonical control-plane menu registry used by the workspace UI and menu API."""

from alembic import op
import sqlalchemy as sa

revision = "v1382_menu_registry"
down_revision = "v1381_policy"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_tables = set(inspector.get_table_names())

    if "smriti_menus" not in existing_tables:
        op.create_table(
            "smriti_menus",
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
            sa.Column("title", sa.String(length=255), nullable=False),
            sa.Column("route", sa.String(length=255), nullable=True),
            sa.Column("icon", sa.String(length=100), nullable=True),
            sa.Column("module", sa.String(length=100), nullable=False),
            sa.Column("permission", sa.String(length=100), nullable=True),
            sa.Column("sequence", sa.Integer(), nullable=False, server_default=sa.text("0")),
            sa.Column("parent_id", sa.String(length=255), sa.ForeignKey("smriti_menus.id", ondelete="RESTRICT"), nullable=True),
            sa.Column("feature_flag", sa.String(length=100), nullable=True),
            sa.Column("badge", sa.String(length=50), nullable=True),
        )

        op.create_index(op.f("ix_smriti_menus_module"), "smriti_menus", ["module"], unique=False)


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_tables = set(inspector.get_table_names())

    if "smriti_menus" in existing_tables:
        op.drop_table("smriti_menus")
