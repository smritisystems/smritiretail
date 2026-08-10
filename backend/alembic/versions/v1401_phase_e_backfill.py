"""Phase E backfill — data migrations for category_code and cbm_m3.

E2:  Backfill Product.category_code from MasterValue
E4:  Backfill CategoryAttributeGroupMapping.category_code from MasterValue
E11: Backfill Product.cbm_m3 from attributes['cbm']

Revision ID: v1401_phase_e_backfill
Revises: v1400_phase_e_auth_hardening
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


# revision identifiers, used by Alembic.
revision: str = "v1401_phase_e_backfill"
down_revision: Union[str, Sequence[str], None] = "v1400_phase_e_auth_hardening"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Backfill category_code and cbm_m3 using server-side SQL.

    All backfills are safe for clean-install (0 rows affected) and
    correctly handle tenant isolation for future real data.
    """

    # ── E2: Backfill Product.category_code from MasterValue ──
    # Resolution: Product.category (name) → MasterValue.name WHERE
    #   MasterValue.master_type.code = 'product_category'
    #   AND (MasterValue.is_system = TRUE OR MasterValue.tenant_id = Product.company_id)
    # Uses a correlated subquery to handle tenant scoping.
    op.execute(sa.text("""
        UPDATE products p
        SET category_code = mv.code
        FROM master_values mv
        JOIN master_types mt ON mv.master_type_id = mt.id
        WHERE mt.code = 'product_category'
          AND UPPER(mv.name) = UPPER(p.category)
          AND (mv.is_system = TRUE OR mv.tenant_id = p.company_id)
          AND p.category_code IS NULL
          AND p.is_deleted = FALSE
    """))

    # ── E4: Backfill CategoryAttributeGroupMapping.category_code from MasterValue ──
    op.execute(sa.text("""
        UPDATE category_attribute_group_mappings cam
        SET category_code = mv.code
        FROM master_values mv
        JOIN master_types mt ON mv.master_type_id = mt.id
        WHERE mt.code = 'product_category'
          AND UPPER(mv.name) = UPPER(cam.category)
          AND (mv.is_system = TRUE OR mv.tenant_id = cam.company_id OR cam.company_id IS NULL)
          AND cam.category_code IS NULL
          AND cam.is_deleted = FALSE
    """))

    # ── E11: Backfill Product.cbm_m3 from attributes['cbm'] ──
    # Only backfill when attributes->'cbm' is a valid numeric value.
    # Uses a safe CAST with WHERE guard to skip non-numeric entries.
    op.execute(sa.text("""
        UPDATE products
        SET cbm_m3 = (attributes->>'cbm')::NUMERIC(10,4)
        WHERE cbm_m3 IS NULL
          AND attributes IS NOT NULL
          AND attributes->>'cbm' IS NOT NULL
          AND attributes->>'cbm' ~ '^[0-9]+(\\.[0-9]+)?$'
          AND (attributes->>'cbm')::NUMERIC >= 0
          AND is_deleted = FALSE
    """))


def downgrade() -> None:
    """Clear backfilled values (reversible — original data untouched)."""
    op.execute(sa.text("UPDATE products SET category_code = NULL"))
    op.execute(sa.text("UPDATE category_attribute_group_mappings SET category_code = NULL"))
    op.execute(sa.text("UPDATE products SET cbm_m3 = NULL"))
