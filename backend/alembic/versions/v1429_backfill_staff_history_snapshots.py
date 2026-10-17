"""Backfill immutable staff history baselines and placement address snapshots.

Revision ID: v1429_backfill_staff_history_snapshots
Revises: v1428_staff_history_and_placement_address
"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "v1429_backfill_staff_history_snapshots"
down_revision: Union[str, Sequence[str], None] = "v1428_staff_history_and_placement_address"
branch_labels = None
depends_on = None


def _is_control_plane(bind) -> bool:
    current_db = bind.execute(sa.text("SELECT current_database();")).scalar()
    return not current_db or current_db.lower() in ("smritisys", "postgres", "template0", "template1")


def upgrade() -> None:
    bind = op.get_bind()
    if _is_control_plane(bind):
        return

    op.execute(sa.text("""
        UPDATE staff_placement_assignments p
        SET host_store_code_snapshot = COALESCE(p.host_store_code_snapshot, l.store_code),
            host_store_name_snapshot = COALESCE(p.host_store_name_snapshot, l.location_name),
            host_address_line1_snapshot = COALESCE(p.host_address_line1_snapshot, l.address_line1),
            host_address_line2_snapshot = COALESCE(p.host_address_line2_snapshot, l.address_line2),
            host_city_snapshot = COALESCE(p.host_city_snapshot, l.city),
            host_state_snapshot = COALESCE(p.host_state_snapshot, l.state),
            host_pincode_snapshot = COALESCE(p.host_pincode_snapshot, l.pincode)
        FROM customer_delivery_locations l
        WHERE p.host_delivery_location_id = l.id
          AND p.is_deleted = false
          AND p.placement_type IN ('CUSTOMER_STORE', 'THIRD_PARTY_STORE')
    """))

    op.execute(sa.text("""
        INSERT INTO staff_profile_history (
            id, uuid, company_id, branch_id, created_at, modified_at,
            is_active, is_deleted, version, staff_profile_id, user_id,
            change_type, before_state_json, after_state_json, changed_by, changed_at
        )
        SELECT
            'sph-' || left(md5(p.id || 'baseline'), 12),
            md5(p.id || 'baseline'), p.company_id, p.branch_id,
            NOW(), NOW(), true, false, 1, p.id, p.user_id,
            'BASELINE', '{}', to_jsonb(p)::text, 'system-migration', NOW()
        FROM staff_profiles p
        WHERE p.is_deleted = false
          AND NOT EXISTS (
              SELECT 1 FROM staff_profile_history h
              WHERE h.staff_profile_id = p.id AND h.change_type = 'BASELINE'
          )
    """))

def downgrade() -> None:
    pass
