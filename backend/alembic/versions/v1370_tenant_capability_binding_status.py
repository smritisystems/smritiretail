"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.26.0
Created      : 2026-08-24
Modified     : 2026-08-24
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

"""Add status column to tenant_capability_bindings

Revision ID: v1370_tenant_capability_binding_status
Revises: v1369_integration_hub_registry
Create Date: 2026-08-24

Closes schema/ORM drift: TenantCapabilityBinding ORM model carries a
`status VARCHAR(30)` column that was not present in the tenant database
schema. This migration adds the column with a safe default of 'ACTIVE'
so existing rows are non-null after backfill.
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers — must stay ≤ 32 chars (alembic_version.version_num constraint)
revision = "v1370_tcb_status"
down_revision = "v1369_integration_hub_registry"
branch_labels = None
depends_on = None



def upgrade() -> None:
    # Inspect existing columns to make this idempotent.
    # Must guard against both: fresh DBs (table not yet created) and
    # existing DBs where the column was already added manually.
    conn = op.get_bind()

    # First check table exists
    tbl_result = conn.execute(
        sa.text(
            "SELECT to_regclass('public.tenant_capability_bindings')"
        )
    )
    if not tbl_result.scalar():
        # Table doesn't exist yet — a later migration will create it with
        # the status column included. Nothing to do here.
        return

    # Table exists — check if column already present
    col_result = conn.execute(
        sa.text(
            """
            SELECT column_name FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name   = 'tenant_capability_bindings'
              AND column_name  = 'status'
            """
        )
    )
    if col_result.fetchone() is None:
        op.add_column(
            "tenant_capability_bindings",
            sa.Column(
                "status",
                sa.String(30),
                server_default="ACTIVE",
                nullable=False,
            ),
        )
        # Back-fill any existing rows (server_default handles new rows)
        op.execute(
            "UPDATE tenant_capability_bindings SET status = 'ACTIVE' WHERE status IS NULL"
        )


def downgrade() -> None:
    conn = op.get_bind()
    result = conn.execute(
        sa.text(
            """
            SELECT column_name FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name   = 'tenant_capability_bindings'
              AND column_name  = 'status'
            """
        )
    )
    if result.fetchone() is not None:
        op.drop_column("tenant_capability_bindings", "status")
