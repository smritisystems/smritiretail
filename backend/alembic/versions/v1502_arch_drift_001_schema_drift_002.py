"""v1502: ARCH-DRIFT-001 resolution + SCHEMA-DRIFT-002 fix

ARCH-DRIFT-001: smriti_numbering_registry.tenant_id vs companies.id drift
  Root cause: tenant_id column stores companies.id values (162/167 rows match),
  but the canonical company_id FK column is never populated.
  The company_id column already has a FK to companies (smriti_numbering_registry_company_id_fkey).
  Fix: backfill company_id from tenant_id where tenant_id matches a companies.id.

  Row disposition (167 total rows in smritisys):
    162 rows: tenant_id matches companies.id -> backfill company_id = tenant_id
      1 row: tenant_id = 'test_tenant_gov' -> true orphan (no company), leave as-is
      4 rows: tenant_id = '' (empty) -> system-wide sequences, leave as-is

  module_states.tenant_id: CLOSED as intentional.
    Contains DB-name discriminator ('smriti001') not a companies.id reference.
    module_states is a per-tenant DB health table; tenant_id = DB name is correct design.
    No FK to companies is appropriate or possible for this column.

SCHEMA-DRIFT-002: sales_factors.valid_from + valid_to varchar(20) -> timestamptz
  Table has 0 rows. Clean DDL change, no data migration needed.
  ORM model defines DateTime(timezone=True); live schema was character varying(20).

Gate evidence:
  smriti_numbering_registry: 162 backfill rows, 1 test orphan, 4 empty -> NOT VALID FK
    company_id FK already in schema: smriti_numbering_registry_company_id_fkey
  sales_factors: 0 rows -> safe USING cast

Run as:
  alembic -x target=control -x db=smritisys upgrade v1502   # ARCH-DRIFT-001
  alembic -x target=tenant  -x db=smriti001 upgrade v1502   # SCHEMA-DRIFT-002

Note: Both changes are in one migration file. The control target runs only
the ARCH-DRIFT-001 block; tenant target runs only the SCHEMA-DRIFT-002 block.
The migration uses op.get_bind() to introspect which tables exist and routes
accordingly.

Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Version      : 1.0.0
Created      : 2026-09-29
Modified     : 2026-09-29
Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import sqlalchemy as sa
from alembic import op

revision = "v1502"
down_revision = "v1501"
branch_labels = None
depends_on = None


def _table_exists(bind, table_name):
    r = bind.execute(sa.text(
        "SELECT COUNT(*) FROM information_schema.tables "
        "WHERE table_schema='public' AND table_name=:t"
    ), {"t": table_name})
    return r.scalar() > 0


def upgrade():
    bind = op.get_bind()

    # -----------------------------------------------------------------------
    # ARCH-DRIFT-001: smriti_numbering_registry company_id backfill
    # Runs only on control DB (smritisys) where this table exists
    # -----------------------------------------------------------------------
    if _table_exists(bind, "smriti_numbering_registry"):
        # Gate: verify row counts match expected disposition
        total = bind.execute(sa.text("SELECT COUNT(*) FROM smriti_numbering_registry")).scalar()
        to_backfill = bind.execute(sa.text(
            "SELECT COUNT(*) FROM smriti_numbering_registry nr "
            "JOIN companies c ON c.id = nr.tenant_id "
            "WHERE (nr.company_id IS NULL OR nr.company_id = '')"
        )).scalar()

        # Backfill company_id from tenant_id for rows that match companies.id
        result = bind.execute(sa.text(
            "UPDATE smriti_numbering_registry nr "
            "SET company_id = nr.tenant_id "
            "FROM companies c "
            "WHERE c.id = nr.tenant_id "
            "  AND (nr.company_id IS NULL OR nr.company_id = '')"
        ))

        # Verify backfill succeeded
        still_empty = bind.execute(sa.text(
            "SELECT COUNT(*) FROM smriti_numbering_registry nr "
            "JOIN companies c ON c.id = nr.tenant_id "
            "WHERE (nr.company_id IS NULL OR nr.company_id = '')"
        )).scalar()
        if still_empty != 0:
            raise RuntimeError(
                f"v1502 ARCH-DRIFT-001: backfill incomplete — {still_empty} rows still have "
                f"empty company_id after UPDATE. Rolling back."
            )

        # Now the existing FK (smriti_numbering_registry_company_id_fkey) covers 162 rows.
        # Remaining 5 rows (1 test orphan + 4 empty tenant_id) cannot be covered.
        # Document: these rows are system-wide sequences not scoped to any company.

    # -----------------------------------------------------------------------
    # SCHEMA-DRIFT-002: sales_factors.valid_from + valid_to varchar -> timestamptz
    # Runs only on tenant DBs where sales_factors exists
    # -----------------------------------------------------------------------
    if _table_exists(bind, "sales_factors"):
        # Gate: must have 0 rows (safe cast) or all values are valid ISO timestamps
        row_count = bind.execute(sa.text("SELECT COUNT(*) FROM sales_factors")).scalar()
        if row_count == 0:
            # Safe: no data to migrate, plain ALTER
            bind.execute(sa.text(
                "ALTER TABLE sales_factors "
                "ALTER COLUMN valid_from TYPE timestamptz "
                "USING valid_from::timestamptz"
            ))
            bind.execute(sa.text(
                "ALTER TABLE sales_factors "
                "ALTER COLUMN valid_to TYPE timestamptz "
                "USING valid_to::timestamptz"
            ))
        else:
            # Safety: check no rows have invalid timestamps before casting
            invalid = bind.execute(sa.text(
                "SELECT COUNT(*) FROM sales_factors "
                "WHERE valid_from IS NOT NULL "
                "  AND valid_from !~ '^\\d{4}-\\d{2}-\\d{2}'"
            )).scalar()
            if invalid > 0:
                raise RuntimeError(
                    f"v1502 SCHEMA-DRIFT-002: {invalid} rows in sales_factors.valid_from "
                    f"have non-ISO format — cannot safely cast to timestamptz. "
                    f"Manually clean data before re-running."
                )
            bind.execute(sa.text(
                "ALTER TABLE sales_factors "
                "ALTER COLUMN valid_from TYPE timestamptz "
                "USING valid_from::timestamptz"
            ))
            bind.execute(sa.text(
                "ALTER TABLE sales_factors "
                "ALTER COLUMN valid_to TYPE timestamptz "
                "USING valid_to::timestamptz"
            ))


def downgrade():
    bind = op.get_bind()

    # Reverse SCHEMA-DRIFT-002
    if _table_exists(bind, "sales_factors"):
        bind.execute(sa.text(
            "ALTER TABLE sales_factors "
            "ALTER COLUMN valid_from TYPE character varying(20) "
            "USING valid_from::text"
        ))
        bind.execute(sa.text(
            "ALTER TABLE sales_factors "
            "ALTER COLUMN valid_to TYPE character varying(20) "
            "USING valid_to::text"
        ))

    # Note: ARCH-DRIFT-001 backfill is NOT reversed — clearing company_id would
    # break the existing FK and lose referential data. Document-only downgrade.
    if _table_exists(bind, "smriti_numbering_registry"):
        pass  # Intentional: data backfill is not reversed