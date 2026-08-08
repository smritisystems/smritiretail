"""Phase E authority hardening — schema changes.

E0.5: UniqueConstraint on master_values(master_type_id, code)
E1:   Product.category_code nullable String(50)
E3:   CategoryAttributeGroupMapping.category_code nullable String(50)
E10:  Product.cbm_m3 NUMERIC(10,4) nullable

Revision ID: v1400_phase_e_authority_hardening
Revises: v900_multi_group_category_mapping
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


# revision identifiers, used by Alembic.
revision: str = "v1400_phase_e_authority_hardening"
down_revision: Union[str, Sequence[str], None] = "v900_multi_group_category_mapping"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── E0.5: MasterValue (master_type_id, code) unique constraint ──
    # Phase D Architecture Review BLOCKING ISSUE #2.
    # Application-level check exists but no DB-level enforcement.
    # Verified: zero duplicate (master_type_id, code) rows in current data.
    op.create_unique_constraint(
        "uq_master_value_type_code",
        "master_values",
        ["master_type_id", "code"],
    )

    # ── E1: Product.category_code — stable MasterValue.code reference ──
    # Product.category (display name) remains unchanged for SKU/fingerprint.
    # category_code is a parallel stable reference for CategoryAttributeGroupMapping joins.
    op.add_column(
        "products",
        sa.Column("category_code", sa.String(50), nullable=True),
    )
    op.create_index(
        "ix_products_category_code",
        "products",
        ["category_code"],
    )

    # ── E3: CategoryAttributeGroupMapping.category_code ──
    # Existing category (name) column is preserved during transition.
    op.add_column(
        "category_attribute_group_mappings",
        sa.Column("category_code", sa.String(50), nullable=True),
    )

    # ── E10: Product.cbm_m3 — typed CBM column for financial calculations ──
    # Replaces untyped attributes["cbm"] for landed-cost allocation.
    op.add_column(
        "products",
        sa.Column("cbm_m3", sa.Numeric(10, 4), nullable=True),
    )


def downgrade() -> None:
    # Reverse in opposite order
    op.drop_column("products", "cbm_m3")
    op.drop_column("category_attribute_group_mappings", "category_code")
    op.drop_index("ix_products_category_code", table_name="products")
    op.drop_column("products", "category_code")
    op.drop_constraint("uq_master_value_type_code", "master_values", type_="unique")
