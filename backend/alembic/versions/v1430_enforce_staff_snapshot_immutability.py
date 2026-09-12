"""Enforce immutable staff history and placement snapshots.

Revision ID: v1430_enforce_staff_snapshot_immutability
Revises: v1429_backfill_staff_history_snapshots
"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "v1430_enforce_staff_snapshot_immutability"
down_revision: Union[str, Sequence[str], None] = "v1429_backfill_staff_history_snapshots"
branch_labels = None
depends_on = None


def _is_control_plane(bind) -> bool:
    current_db = bind.execute(sa.text("SELECT current_database();")).scalar()
    return not current_db or current_db.lower() in ("smritisys", "postgres", "template0", "template1")


def upgrade() -> None:
    bind = op.get_bind()
    if _is_control_plane(bind):
        return
    op.execute(sa.text("""CREATE OR REPLACE FUNCTION prevent_staff_history_mutation() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'staff_profile_history rows are immutable'; END; $$ LANGUAGE plpgsql"""))
    op.execute(sa.text("DROP TRIGGER IF EXISTS trg_staff_profile_history_immutable ON staff_profile_history"))
    op.execute(sa.text("CREATE TRIGGER trg_staff_profile_history_immutable BEFORE UPDATE OR DELETE ON staff_profile_history FOR EACH ROW EXECUTE FUNCTION prevent_staff_history_mutation()"))
    op.execute(sa.text("""CREATE OR REPLACE FUNCTION prevent_staff_placement_snapshot_mutation() RETURNS trigger AS $$ BEGIN IF NEW.host_store_code_snapshot IS DISTINCT FROM OLD.host_store_code_snapshot OR NEW.host_store_name_snapshot IS DISTINCT FROM OLD.host_store_name_snapshot OR NEW.host_address_line1_snapshot IS DISTINCT FROM OLD.host_address_line1_snapshot OR NEW.host_address_line2_snapshot IS DISTINCT FROM OLD.host_address_line2_snapshot OR NEW.host_city_snapshot IS DISTINCT FROM OLD.host_city_snapshot OR NEW.host_state_snapshot IS DISTINCT FROM OLD.host_state_snapshot OR NEW.host_pincode_snapshot IS DISTINCT FROM OLD.host_pincode_snapshot THEN RAISE EXCEPTION 'staff placement location snapshots are immutable'; END IF; RETURN NEW; END; $$ LANGUAGE plpgsql"""))
    op.execute(sa.text("DROP TRIGGER IF EXISTS trg_staff_placement_snapshot_immutable ON staff_placement_assignments"))
    op.execute(sa.text("CREATE TRIGGER trg_staff_placement_snapshot_immutable BEFORE UPDATE ON staff_placement_assignments FOR EACH ROW EXECUTE FUNCTION prevent_staff_placement_snapshot_mutation()"))


def downgrade() -> None:
    bind = op.get_bind()
    if _is_control_plane(bind):
        return
    op.execute(sa.text("DROP TRIGGER IF EXISTS trg_staff_profile_history_immutable ON staff_profile_history"))
    op.execute(sa.text("DROP TRIGGER IF EXISTS trg_staff_placement_snapshot_immutable ON staff_placement_assignments"))
    op.execute(sa.text("DROP FUNCTION IF EXISTS prevent_staff_history_mutation()"))
    op.execute(sa.text("DROP FUNCTION IF EXISTS prevent_staff_placement_snapshot_mutation()"))
