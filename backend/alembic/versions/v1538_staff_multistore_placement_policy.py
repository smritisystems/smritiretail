"""
Project      : SMRITI Retail OS
Repository   : SMRITIRetailNX
Organization : AITDL NETWORKS

Founders
* Pushpa Devi Jawahar Mallah
  * Founder & Chairperson
* Jawahar Ramkripal Mallah
  * Founder, Chief Executive Officer (CEO) & Chief Software Architect

Websites: aitdl.com | erpnbook.com | smritibooks.com

Revision ID: v1538_staff_multistore_placement_policy
Revises: v1537_company_profile_foundation
Create Date: 2026-10-18
Classification: Staff Placement & Store Responsibility Multi-Store Architecture
"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "v1538_staff_multistore_placement_policy"
down_revision: Union[str, Sequence[str], None] = "v1537_company_profile_foundation"
branch_labels = None
depends_on = None


EXPECTED_UPGRADE_INDEXES = {
    "uq_staff_placement_active_branch_user",
    "uq_staff_placement_active_cdl_user",
    "uq_store_active_primary_rep",
    "uq_branch_active_manager",
}


def upgrade() -> None:
    bind = op.get_bind()
    current_db = (bind.execute(sa.text("SELECT current_database();")).scalar() or "").strip().lower()

    # 1. System and template databases must NEVER be migration targets (Fail-Fast)
    if current_db in ("postgres", "template0", "template1"):
        raise RuntimeError(
            f"Migration v1538 must not run against system/template database '{current_db}'. "
            "Use -x target=tenant -x db=<company_db>."
        )

    # 2. Control plane (smritisys) linear chain pass-through:
    # staff_placement_assignments is a TableOwner.TENANT table and must not exist in smritisys.
    if current_db == "smritisys":
        return

    # 3. Tenant databases: table MUST exist (Fail-Fast instead of silent skip)
    inspector = sa.inspect(bind)
    table_names = set(inspector.get_table_names())
    if "staff_placement_assignments" not in table_names:
        raise RuntimeError(
            f"Migration v1538 failed on tenant database '{current_db}': table 'staff_placement_assignments' "
            "does not exist. Verify that predecessor migration v1424 has been applied."
        )

    # 4. Drop legacy global 1-user-1-placement index if exists
    op.execute("DROP INDEX IF EXISTS uq_staff_placement_active_user;")

    # 5. Branch Placement Uniqueness: at most ONE active placement per user at the same internal branch
    op.execute(
        """
        CREATE UNIQUE INDEX IF NOT EXISTS uq_staff_placement_active_branch_user
        ON staff_placement_assignments (company_id, staff_user_id, internal_branch_id)
        WHERE is_deleted = false AND status = 'ACTIVE' AND internal_branch_id IS NOT NULL;
        """
    )

    # 6. Customer Delivery Location Placement Uniqueness: at most ONE active placement per user at the same customer outlet
    op.execute(
        """
        CREATE UNIQUE INDEX IF NOT EXISTS uq_staff_placement_active_cdl_user
        ON staff_placement_assignments (company_id, staff_user_id, host_delivery_location_id)
        WHERE is_deleted = false AND status = 'ACTIVE' AND host_delivery_location_id IS NOT NULL;
        """
    )

    # 7. Store Primary Responsibility Uniqueness: at most ONE active PRIMARY_REPRESENTATIVE per partner store
    op.execute(
        """
        CREATE UNIQUE INDEX IF NOT EXISTS uq_store_active_primary_rep
        ON staff_placement_assignments (company_id, host_delivery_location_id)
        WHERE is_deleted = false AND status = 'ACTIVE' AND role_at_location = 'PRIMARY_REPRESENTATIVE' AND host_delivery_location_id IS NOT NULL;
        """
    )

    # 8. Branch Primary Responsibility Uniqueness: at most ONE active STORE_MANAGER per internal branch
    op.execute(
        """
        CREATE UNIQUE INDEX IF NOT EXISTS uq_branch_active_manager
        ON staff_placement_assignments (company_id, internal_branch_id)
        WHERE is_deleted = false AND status = 'ACTIVE' AND role_at_location = 'STORE_MANAGER' AND internal_branch_id IS NOT NULL;
        """
    )

    # 9. Post-DDL Verification Assertion: guarantee indexes physically exist in PostgreSQL
    refreshed_indexes = {idx["name"] for idx in sa.inspect(bind).get_indexes("staff_placement_assignments")}
    missing = EXPECTED_UPGRADE_INDEXES - refreshed_indexes
    if missing:
        raise RuntimeError(
            f"Migration v1538 post-verification failed on '{current_db}': required indexes were not created: {missing}"
        )


def downgrade() -> None:
    bind = op.get_bind()
    current_db = (bind.execute(sa.text("SELECT current_database();")).scalar() or "").strip().lower()

    # 1. System and template databases must NEVER be migration targets (Fail-Fast)
    if current_db in ("postgres", "template0", "template1"):
        raise RuntimeError(
            f"Migration v1538 downgrade must not run against system/template database '{current_db}'."
        )

    # 2. Control plane (smritisys) linear chain pass-through
    if current_db == "smritisys":
        return

    # 3. Tenant databases: table MUST exist (Fail-Fast)
    inspector = sa.inspect(bind)
    table_names = set(inspector.get_table_names())
    if "staff_placement_assignments" not in table_names:
        raise RuntimeError(
            f"Migration v1538 downgrade failed on tenant database '{current_db}': table 'staff_placement_assignments' "
            "does not exist."
        )

    # 4. Safety Pre-flight Check: verify if any users hold multiple active store placements
    dup_count = bind.execute(sa.text("""
        SELECT COUNT(*) FROM (
            SELECT company_id, staff_user_id
            FROM staff_placement_assignments
            WHERE is_deleted = false AND status = 'ACTIVE'
            GROUP BY company_id, staff_user_id
            HAVING COUNT(*) > 1
        ) d;
    """)).scalar() or 0

    if dup_count > 0:
        raise RuntimeError(
            f"Downgrade blocked: {dup_count} user(s) currently hold multiple active store placements. "
            "To safely roll back to the legacy single-placement policy without deleting historical records, "
            "reconcile secondary placements by setting their effective_to date or updating status to 'SUSPENDED_ROLLBACK' first."
        )

    # 5. Drop the 4 multi-store indexes
    op.execute("DROP INDEX IF EXISTS uq_branch_active_manager;")
    op.execute("DROP INDEX IF EXISTS uq_store_active_primary_rep;")
    op.execute("DROP INDEX IF EXISTS uq_staff_placement_active_cdl_user;")
    op.execute("DROP INDEX IF EXISTS uq_staff_placement_active_branch_user;")

    # 6. Recreate the legacy unique index
    op.execute(
        """
        CREATE UNIQUE INDEX IF NOT EXISTS uq_staff_placement_active_user
        ON staff_placement_assignments (company_id, staff_user_id)
        WHERE is_deleted = false AND status = 'ACTIVE';
        """
    )

    # 7. Post-DDL Verification Assertion: guarantee legacy index physically exists
    refreshed_indexes = {idx["name"] for idx in sa.inspect(bind).get_indexes("staff_placement_assignments")}
    if "uq_staff_placement_active_user" not in refreshed_indexes:
        raise RuntimeError(
            f"Migration v1538 downgrade post-verification failed on '{current_db}': legacy index 'uq_staff_placement_active_user' was not created."
        )
