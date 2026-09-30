"""v1497b: retire smriti_themes.tenant_id and smriti_workspace_profiles.tenant_id
         — control-plane migration (smritisys)

Tables:
  smritisys.smriti_themes.tenant_id            — 4 rows, 0 populated
  smritisys.smriti_workspace_profiles.tenant_id — 5 rows, 0 populated

5-Gate retirement evidence (all gates passed before commit):
  Gate 1 — Row-level data: smriti_themes (0/4), smriti_workspace_profiles (0/5).
            Confirmed 2026-09-29 via direct DB query.
  Gate 2 — Write paths: ctrl_seeder.py creates SmritiTheme and SmritiWorkspaceProfile
            without tenant_id field. No service/API write site found. Confirmed 2026-09-29.
  Gate 3 — No FK constraint exists on either column.
  Gate 4 — DDL archived: both character varying, nullable=True, no default.
  Gate 5 — Test suite green before and after.

Run as: alembic -x target=control -x db=smritisys upgrade v1497b

Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Version      : 1.0.0
Created      : 2026-09-29
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

from alembic import op
import sqlalchemy as sa

revision = "v1497b"
down_revision = "v1496"   # current smritisys head as of 2026-09-29
branch_labels = None
depends_on = None


def _table_exists(bind, table_name: str) -> bool:
    r = bind.execute(sa.text(
        "SELECT COUNT(*) FROM information_schema.tables "
        "WHERE table_schema='public' AND table_name=:t"
    ), {"t": table_name})
    return bool((r.scalar() or 0) > 0)


def upgrade() -> None:
    bind = op.get_bind()

    # Pre-flight: smriti_themes (control plane only)
    if _table_exists(bind, "smriti_themes"):
        col_exists = bind.execute(sa.text(
            "SELECT 1 FROM information_schema.columns "
            "WHERE table_name = 'smriti_themes' AND column_name = 'tenant_id'"
        )).scalar()
        if col_exists:
            r1 = bind.execute(
                sa.text("SELECT COUNT(*) FROM smriti_themes WHERE tenant_id IS NOT NULL")
            )
            c1 = r1.scalar()
            if c1 != 0:
                raise RuntimeError(
                    f"v1497b aborted: smriti_themes.tenant_id has {c1} non-NULL rows."
                )
            op.drop_column("smriti_themes", "tenant_id")

    # Pre-flight: smriti_workspace_profiles (control plane only)
    if _table_exists(bind, "smriti_workspace_profiles"):
        col_exists = bind.execute(sa.text(
            "SELECT 1 FROM information_schema.columns "
            "WHERE table_name = 'smriti_workspace_profiles' AND column_name = 'tenant_id'"
        )).scalar()
        if col_exists:
            r2 = bind.execute(
                sa.text(
                    "SELECT COUNT(*) FROM smriti_workspace_profiles "
                    "WHERE tenant_id IS NOT NULL"
                )
            )
            c2 = r2.scalar()
            if c2 != 0:
                raise RuntimeError(
                    f"v1497b aborted: smriti_workspace_profiles.tenant_id has {c2} non-NULL rows."
                )
            op.drop_column("smriti_workspace_profiles", "tenant_id")


def downgrade() -> None:
    op.add_column(
        "smriti_themes",
        sa.Column("tenant_id", sa.String(50), nullable=True),
    )
    op.add_column(
        "smriti_workspace_profiles",
        sa.Column("tenant_id", sa.String(50), nullable=True),
    )
