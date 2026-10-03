"""Remove accidentally deployed tenant objects from the control plane.

Revision v1480 is tenant-owned. This forward remediation removes only the
objects that v1480 added when it was incorrectly run against smritisys. It is
a no-op for company databases so the shared revision chain remains safe.
"""
from alembic import op
import sqlalchemy as sa

revision = "v1481_remove_v1480_control_plane_objects"
down_revision = "v1480_customer_master_ux_contract"
branch_labels = None
depends_on = None

CUSTOMER_COLUMNS = [
    "religion", "ethnicity", "age_group", "profession", "customer_type", "profile_notes",
    "company_code", "environment", "flat_file_format", "delimiter", "buying_factor", "selling_factor",
    "is_dependant", "gender", "date_of_birth", "is_married", "wedding_anniversary", "lst_number", "lst_date",
    "cst_number", "cst_date", "pan_number", "is_pre_sale_form_applicable", "pre_sale_form_name",
    "is_post_sale_form_applicable", "post_sale_form_name",
]


def upgrade():
    bind = op.get_bind()
    if bind.exec_driver_sql("SELECT current_database()").scalar() != "smritisys":
        return

    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())

    for table in ("customer_policies", "customer_relationships"):
        if table in tables:
            row_count = bind.execute(sa.text(f"SELECT count(*) FROM {table}")).scalar()
            if row_count:
                raise RuntimeError(
                    f"Refusing to remove non-empty control-plane table {table}; "
                    f"manual data governance review is required."
                )

    if "customer_relationships" in tables:
        op.drop_table("customer_relationships")
    if "customer_policies" in tables:
        op.drop_table("customer_policies")

    customer_columns = {column["name"] for column in inspector.get_columns("customers")}
    for column in CUSTOMER_COLUMNS:
        if column in customer_columns:
            op.drop_column("customers", column)

    loyalty_columns = {column["name"] for column in inspector.get_columns("loyalty_members")}
    for column in ("loyalty_program_code", "loyalty_program_id"):
        if column in loyalty_columns:
            op.drop_column("loyalty_members", column)


def downgrade():
    raise NotImplementedError(
        "FORWARD-ONLY: v1481 control-plane remediation must not be downgraded."
    )