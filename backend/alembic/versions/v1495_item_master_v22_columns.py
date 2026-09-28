"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.17.0
Created      : 2026-09-28
Modified     : 2026-09-28
Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

"""v1495_item_master_v22_columns

Revision ID: v1495
Revises: v1494_product_identity_psv_tenant_hardening
Create Date: 2026-09-28

Adds 13 first-class columns to the items table as defined in
SMRITI Item Master Creation Standard v2.2.

Promoted from attributes_json blob:
  gender, purchase_class, product_type, design_attribute, heel_type,
  upper_material, outsole_material, collection_type

Business logic flags (IM-008/IM-009):
  is_inventory_yn (default TRUE), is_billable_yn (default TRUE), is_service_yn (default FALSE)

Workflow validation:
  validation_status, validation_message

All columns are nullable or have safe server defaults. Zero-downtime migration.
Backfill copies JSON blob values for existing rows.
"""

from alembic import op
import sqlalchemy as sa

revision = "v1495"
down_revision = "v1494_product_identity_psv_tenant_hardening"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("items", sa.Column("gender",           sa.String(30),  nullable=True))
    op.add_column("items", sa.Column("purchase_class",   sa.String(100), nullable=True))
    op.add_column("items", sa.Column("product_type",     sa.String(100), nullable=True))
    op.add_column("items", sa.Column("design_attribute", sa.String(100), nullable=True))
    op.add_column("items", sa.Column("heel_type",        sa.String(100), nullable=True))
    op.add_column("items", sa.Column("upper_material",   sa.String(100), nullable=True))
    op.add_column("items", sa.Column("outsole_material", sa.String(100), nullable=True))
    op.add_column("items", sa.Column("collection_type",  sa.String(100), nullable=True))
    op.add_column("items", sa.Column("is_inventory_yn",  sa.Boolean(), nullable=False, server_default=sa.text("true")))
    op.add_column("items", sa.Column("is_billable_yn",   sa.Boolean(), nullable=False, server_default=sa.text("true")))
    op.add_column("items", sa.Column("is_service_yn",    sa.Boolean(), nullable=False, server_default=sa.text("false")))
    op.add_column("items", sa.Column("validation_status",  sa.String(30), nullable=True))
    op.add_column("items", sa.Column("validation_message", sa.Text(),     nullable=True))
    op.create_index("ix_items_gender",       "items", ["gender"],       unique=False)
    op.create_index("ix_items_product_type", "items", ["product_type"], unique=False)
    backfill = [
        ("gender",           "gender"),
        ("heel_type",        "heel_type"),
        ("upper_material",   "upper_material"),
        ("outsole_material", "outsole"),
        ("design_attribute", "design_attribute"),
        ("collection_type",  "collection_type"),
    ]
    for col, key in backfill:
        op.execute(sa.text(
            f"UPDATE items SET {col} = attributes_json ->> '{key}' "
            f"WHERE {col} IS NULL AND attributes_json IS NOT NULL "
            f"AND attributes_json ->> '{key}' IS NOT NULL AND attributes_json ->> '{key}' != ''"
        ))


def downgrade() -> None:
    op.drop_index("ix_items_product_type", table_name="items")
    op.drop_index("ix_items_gender",       table_name="items")
    for col in ("validation_message","validation_status","is_service_yn","is_billable_yn",
                "is_inventory_yn","collection_type","outsole_material","upper_material",
                "heel_type","design_attribute","product_type","purchase_class","gender"):
        op.drop_column("items", col)
