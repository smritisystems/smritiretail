"""Enforce basic integrity for database-backed postal reference data."""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "v1411_reference_location_integrity"
down_revision: Union[str, Sequence[str], None] = "v1410_merge_all_branches"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    # Current revision identifiers exceed the legacy alembic_version width.
    version_columns = {
        column["name"]: column for column in inspector.get_columns("alembic_version")
    } if "alembic_version" in inspector.get_table_names() else {}
    version_column = version_columns.get("version_num")
    if version_column and getattr(version_column["type"], "length", None) != 64:
        op.alter_column(
            "alembic_version",
            "version_num",
            existing_type=version_column["type"],
            type_=sa.String(length=64),
            existing_nullable=False,
        )

    if "postal_codes_ref" not in inspector.get_table_names():
        return

    constraints = {item["name"] for item in inspector.get_check_constraints("postal_codes_ref")}
    if "ck_postal_codes_ref_six_digit" not in constraints:
        op.create_check_constraint(
            "ck_postal_codes_ref_six_digit",
            "postal_codes_ref",
            "postal_code ~ '^[0-9]{6}$'",
        )

    indexes = {item["name"] for item in inspector.get_indexes("postal_codes_ref")}
    if "idx_postal_state_city" not in indexes:
        op.create_index(
            "idx_postal_state_city",
            "postal_codes_ref",
            ["country_code", "state_code", "city"],
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "postal_codes_ref" not in inspector.get_table_names():
        return

    indexes = {item["name"] for item in inspector.get_indexes("postal_codes_ref")}
    if "idx_postal_state_city" in indexes:
        op.drop_index("idx_postal_state_city", table_name="postal_codes_ref")

    constraints = {item["name"] for item in inspector.get_check_constraints("postal_codes_ref")}
    if "ck_postal_codes_ref_six_digit" in constraints:
        op.drop_constraint("ck_postal_codes_ref_six_digit", "postal_codes_ref", type_="check")