"""Use a configured or system-default warehouse when seeding item locations.

Revision ID: v1562
Revises: v1561
"""
from typing import Union

import sqlalchemy as sa
from alembic import op

revision: str = "v1562"
down_revision: Union[str, None] = "v1561"
branch_labels = None
depends_on = None


def upgrade() -> None:
    connection = op.get_bind()

    # Preserve user-selected defaults. For branches without one, prefer WH-001
    # when present, otherwise designate the oldest active warehouse.
    connection.execute(sa.text("""
        WITH branch_default_candidates AS (
            SELECT DISTINCT ON (w.company_id, w.branch_id) w.id
            FROM warehouses w
            WHERE w.branch_id IS NOT NULL
              AND w.is_active = TRUE
              AND w.is_deleted = FALSE
              AND NOT EXISTS (
                  SELECT 1
                  FROM warehouses configured
                  WHERE configured.company_id = w.company_id
                    AND configured.branch_id = w.branch_id
                    AND configured.is_default_for_branch = TRUE
                    AND configured.is_active = TRUE
                    AND configured.is_deleted = FALSE
              )
            ORDER BY
                w.company_id,
                w.branch_id,
                CASE
                    WHEN UPPER(w.id) = 'WH-001' OR UPPER(w.code) = 'WH-001' THEN 0
                    ELSE 1
                END,
                w.created_at ASC,
                w.id ASC
        )
        UPDATE warehouses w
        SET is_default_for_branch = TRUE
        FROM branch_default_candidates candidate
        WHERE w.id = candidate.id
    """))

    connection.execute(sa.text("""
        CREATE OR REPLACE FUNCTION fn_seed_default_warehouse_location()
        RETURNS TRIGGER LANGUAGE plpgsql AS $$
        DECLARE
            resolved_warehouse_id VARCHAR(50);
        BEGIN
            IF NEW.status = 'ACTIVE' THEN
                SELECT w.id
                INTO resolved_warehouse_id
                FROM warehouses w
                WHERE w.company_id = NEW.company_id
                  AND w.is_active = TRUE
                  AND w.is_deleted = FALSE
                ORDER BY
                    CASE
                        WHEN NEW.branch_id IS NOT NULL AND w.branch_id = NEW.branch_id THEN 0
                        ELSE 1
                    END,
                    w.is_default_for_branch DESC,
                    CASE
                        WHEN UPPER(w.id) = 'WH-001' OR UPPER(w.code) = 'WH-001' THEN 0
                        ELSE 1
                    END,
                    w.created_at ASC,
                    w.id ASC
                LIMIT 1;

                IF resolved_warehouse_id IS NOT NULL THEN
                    INSERT INTO item_warehouse_locations (
                        id, uuid, item_id, warehouse_id, company_id, branch_id,
                        location_bin, min_reorder_level, max_capacity, reorder_quantity,
                        created_at, modified_at, is_active, is_deleted, version
                    )
                    SELECT
                        'loc_' || substr(md5(random()::text), 1, 12),
                        gen_random_uuid(),
                        NEW.id,
                        resolved_warehouse_id,
                        NEW.company_id,
                        NEW.branch_id,
                        NULL,
                        0,
                        0,
                        0,
                        NOW(),
                        NOW(),
                        TRUE,
                        FALSE,
                        1
                    WHERE NOT EXISTS (
                        SELECT 1
                        FROM item_warehouse_locations existing
                        WHERE existing.item_id = NEW.id
                          AND existing.company_id = NEW.company_id
                          AND existing.warehouse_id = resolved_warehouse_id
                    );
                END IF;
            END IF;
            RETURN NEW;
        END;
        $$;
    """))


def downgrade() -> None:
    # Keep the corrected trigger and seeded defaults on downgrade: reverting
    # them would reintroduce invalid branch-as-warehouse assignments.
    pass
