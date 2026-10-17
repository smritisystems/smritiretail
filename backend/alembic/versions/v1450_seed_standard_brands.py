"""Seed standard catalog brands into master_values."""

from alembic import op
import sqlalchemy as sa

revision = "v1450_seed_standard_brands"
down_revision = "v1449_seed_admin_menu_workspaces"
branch_labels = None
depends_on = None

STANDARD_BRANDS = [
    ("SMRITI", "SMRITI", "Flagship SMRITI retail brand"),
    ("BEANSTALK", "Beanstalk", "Beanstalk kids & family apparel"),
    ("Tattly Threads", "Tattly Threads", "Tattly Threads apparel line"),
    ("Heritage", "Heritage", "Classic heritage collection"),
    ("Swift", "Swift", "Swift activewear and footwear"),
    ("Generic", "Generic", "Generic unbranded commodities"),
]


def upgrade() -> None:
    bind = op.get_bind()
    for code, name, desc in STANDARD_BRANDS:
        bind.execute(
            sa.text(
                """
                INSERT INTO master_values (
                    id, master_type_id, company_id, branch_id, code, name,
                    vendor_code, data, active, sort_order, updated_at, is_deleted
                )
                SELECT 
                    gen_random_uuid(), mt.id, 'GLOBAL', NULL, CAST(:code AS varchar), CAST(:name AS varchar),
                    NULL, jsonb_build_object('description', CAST(:desc AS text)), true, 0, NOW(), false
                FROM master_types mt
                WHERE mt.code = 'brand'
                  AND NOT EXISTS (
                      SELECT 1 FROM master_values mv
                      WHERE mv.master_type_id = mt.id
                        AND (LOWER(mv.code) = LOWER(CAST(:code AS varchar)) OR LOWER(mv.name) = LOWER(CAST(:name AS varchar)))
                        AND mv.is_deleted = false
                  )
                """
            ),
            {"code": code, "name": name, "desc": desc},
        )


def downgrade() -> None:
    pass
