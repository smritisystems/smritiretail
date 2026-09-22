"""Add normalized Customer Master UX contract support.

This migration is additive. Existing customer, policy, loyalty, credit, GST,
and address data remains in its current authoritative structures.
"""
from alembic import op
import sqlalchemy as sa

revision = "v1480_customer_master_ux_contract"
down_revision = "v1479_receipt_po_line_tracking"
branch_labels = None
depends_on = None


def _add_column(table, column):
    inspector = sa.inspect(op.get_bind())
    if column.name not in {item["name"] for item in inspector.get_columns(table)}:
        op.add_column(table, column)


def upgrade():
    # Customer Master is tenant-owned. Keep this revision harmless when a
    # shared migration chain is inspected or bootstrapped on smritisys.
    if op.get_bind().exec_driver_sql("SELECT current_database()").scalar() == "smritisys":
        return

    customer_columns = [
        sa.Column("religion", sa.String(50), nullable=True),
        sa.Column("ethnicity", sa.String(50), nullable=True),
        sa.Column("age_group", sa.String(30), nullable=True),
        sa.Column("profession", sa.String(100), nullable=True),
        sa.Column("customer_type", sa.String(30), nullable=True),
        sa.Column("profile_notes", sa.Text(), nullable=True),
        sa.Column("company_code", sa.String(50), nullable=True),
        sa.Column("environment", sa.String(30), nullable=True),
        sa.Column("flat_file_format", sa.String(50), nullable=True),
        sa.Column("delimiter", sa.String(10), nullable=True),
        sa.Column("buying_factor", sa.Numeric(10, 4), nullable=True),
        sa.Column("selling_factor", sa.Numeric(10, 4), nullable=True),
        sa.Column("is_dependant", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("gender", sa.String(20), nullable=True),
        sa.Column("date_of_birth", sa.Date(), nullable=True),
        sa.Column("is_married", sa.Boolean(), nullable=True),
        sa.Column("wedding_anniversary", sa.Date(), nullable=True),
        sa.Column("lst_number", sa.String(50), nullable=True),
        sa.Column("lst_date", sa.Date(), nullable=True),
        sa.Column("cst_number", sa.String(50), nullable=True),
        sa.Column("cst_date", sa.Date(), nullable=True),
        sa.Column("pan_number", sa.String(10), nullable=True),
        sa.Column("is_pre_sale_form_applicable", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("pre_sale_form_name", sa.String(100), nullable=True),
        sa.Column("is_post_sale_form_applicable", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("post_sale_form_name", sa.String(100), nullable=True),
    ]
    for column in customer_columns:
        _add_column("customers", column)

    loyalty_columns = [
        sa.Column("loyalty_program_id", sa.String(50), nullable=True),
        sa.Column("loyalty_program_code", sa.String(50), nullable=True),
    ]
    for column in loyalty_columns:
        _add_column("loyalty_members", column)
    op.create_index("ix_loyalty_members_program_id", "loyalty_members", ["loyalty_program_id"], if_not_exists=True)
    op.create_index("ix_loyalty_members_program_code", "loyalty_members", ["loyalty_program_code"], if_not_exists=True)

    inspector = sa.inspect(op.get_bind())
    tables = set(inspector.get_table_names())
    if "customer_policies" not in tables:
        op.create_table(
            "customer_policies",
            sa.Column("id", sa.String(50), primary_key=True),
            sa.Column("uuid", sa.String(36), nullable=True),
            sa.Column("company_id", sa.String(50), sa.ForeignKey("companies.id", ondelete="RESTRICT"), nullable=True),
            sa.Column("branch_id", sa.String(50), sa.ForeignKey("branches.id", ondelete="RESTRICT"), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=True, server_default=sa.text("CURRENT_TIMESTAMP")),
            sa.Column("modified_at", sa.DateTime(timezone=True), nullable=True, server_default=sa.text("CURRENT_TIMESTAMP")),
            sa.Column("created_by", sa.String(100), nullable=True),
            sa.Column("updated_by", sa.String(100), nullable=True),
            sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
            sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.text("false")),
            sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("deleted_by", sa.String(100), nullable=True),
            sa.Column("version", sa.Integer(), nullable=False, server_default=sa.text("1")),
            sa.Column("customer_id", sa.String(50), sa.ForeignKey("customers.id", ondelete="CASCADE"), nullable=False),
            sa.Column("payment_category", sa.String(30), nullable=True),
            sa.Column("payment_term", sa.String(100), nullable=True),
            sa.Column("transport_mode", sa.String(30), nullable=True),
            sa.Column("transport_code", sa.String(50), nullable=True),
            sa.Column("transit_days", sa.Integer(), nullable=True),
            sa.Column("bank_code", sa.String(50), nullable=True),
            sa.Column("bank_location", sa.String(150), nullable=True),
            sa.Column("retail_factor", sa.Numeric(10, 4), nullable=True),
            sa.Column("dealer_factor", sa.Numeric(10, 4), nullable=True),
            sa.Column("destination_tax_type", sa.String(50), nullable=True),
            sa.Column("allow_cash_bill", sa.Boolean(), nullable=True),
            sa.Column("allow_dc_gen", sa.Boolean(), nullable=True),
            sa.Column("allow_credit_invoice", sa.Boolean(), nullable=True),
            sa.Column("allow_misc_issue", sa.Boolean(), nullable=True),
            sa.Column("allow_misc_receipts", sa.Boolean(), nullable=True),
            sa.UniqueConstraint("customer_id", name="uq_customer_policy_customer"),
        )
        op.create_index("ix_customer_policies_company_id", "customer_policies", ["company_id"])
        op.create_index("ix_customer_policies_customer_id", "customer_policies", ["customer_id"])

    if "customer_relationships" not in tables:
        op.create_table(
            "customer_relationships",
            sa.Column("id", sa.String(50), primary_key=True),
            sa.Column("uuid", sa.String(36), nullable=True),
            sa.Column("company_id", sa.String(50), sa.ForeignKey("companies.id", ondelete="RESTRICT"), nullable=True),
            sa.Column("branch_id", sa.String(50), sa.ForeignKey("branches.id", ondelete="RESTRICT"), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=True, server_default=sa.text("CURRENT_TIMESTAMP")),
            sa.Column("modified_at", sa.DateTime(timezone=True), nullable=True, server_default=sa.text("CURRENT_TIMESTAMP")),
            sa.Column("created_by", sa.String(100), nullable=True),
            sa.Column("updated_by", sa.String(100), nullable=True),
            sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
            sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.text("false")),
            sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("deleted_by", sa.String(100), nullable=True),
            sa.Column("version", sa.Integer(), nullable=False, server_default=sa.text("1")),
            sa.Column("parent_customer_id", sa.String(50), sa.ForeignKey("customers.id", ondelete="RESTRICT"), nullable=False),
            sa.Column("dependant_customer_id", sa.String(50), sa.ForeignKey("customers.id", ondelete="RESTRICT"), nullable=False),
            sa.Column("relation", sa.String(50), nullable=False),
            sa.Column("apply_same_mailing", sa.Boolean(), nullable=False, server_default=sa.text("false")),
            sa.Column("notes", sa.Text(), nullable=True),
            sa.UniqueConstraint("parent_customer_id", "dependant_customer_id", name="uq_customer_relationship_pair"),
        )
        op.create_index("ix_customer_relationships_company_id", "customer_relationships", ["company_id"])
        op.create_index("ix_customer_relationships_parent", "customer_relationships", ["parent_customer_id"])
        op.create_index("ix_customer_relationships_dependant", "customer_relationships", ["dependant_customer_id"])


def downgrade():
    op.drop_table("customer_relationships")
    op.drop_table("customer_policies")
    op.drop_index("ix_loyalty_members_program_code", table_name="loyalty_members")
    op.drop_index("ix_loyalty_members_program_id", table_name="loyalty_members")
    for name in [
        "religion", "ethnicity", "age_group", "profession", "customer_type", "profile_notes",
        "company_code", "environment", "flat_file_format", "delimiter", "buying_factor", "selling_factor",
        "is_dependant", "gender", "date_of_birth", "is_married", "wedding_anniversary", "lst_number", "lst_date",
        "cst_number", "cst_date", "pan_number", "is_pre_sale_form_applicable", "pre_sale_form_name",
        "is_post_sale_form_applicable", "post_sale_form_name",
    ]:
        op.drop_column("customers", name)
    op.drop_column("loyalty_members", "loyalty_program_code")
    op.drop_column("loyalty_members", "loyalty_program_id")