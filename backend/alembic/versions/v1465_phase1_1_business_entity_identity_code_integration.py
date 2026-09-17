"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.35.0
Created      : 2026-09-18
Modified     : 2026-09-18
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

"""v1465 – phase1_1_business_entity_identity_code_integration: Business Entity Identity Code Integration & Legacy Alias Migration

Adds additive identity_code VARCHAR(100) and B-Tree indexes to:
  1. companies
  2. branches
  3. items
  4. customers
  5. suppliers

Deterministically backfills sequential SMRITI Identity Codes:
  - ORG-CMP-{seq:08d} for companies
  - ORG-BRN-{seq:08d} for branches
  - MST-ITM-{seq:08d} for items
  - CRM-CUS-{seq:08d} for customers
  - PUR-SUP-{seq:08d} for suppliers

Ingests historical business identifiers into smriti_identity_alias as LEGACY_IMPORT / SHOPER9.
Audit-logs all backfilled allocations in smriti_identity_allocation_log.
Updates smriti_numbering_registry sequence counters.
Enforces guarded rollback safety.

Revision ID: v1465_phase1_1_business_entity_identity_code_integration
Revises:     v1464_smriti_unified_identity_control_plane
Create Date: 2026-09-18
"""

import uuid
from datetime import datetime, timezone
from alembic import op
import sqlalchemy as sa
from sqlalchemy.sql import table, column, bindparam


revision: str = "v1465_phase1_1_business_entity_identity_code_integration"
down_revision: str = "v1464_smriti_unified_identity_control_plane"
branch_labels = None
depends_on = None


ENTITY_SPECS = [
    {
        "entity_type": "COMPANY",
        "group_code": "ORG",
        "prefix": "ORG-CMP",
        "table_name": "companies",
        "business_code_col": "company_code",
        "has_company_id": False,
        "has_branch_id": False,
        "scope": "GLOBAL",
    },
    {
        "entity_type": "BRANCH",
        "group_code": "ORG",
        "prefix": "ORG-BRN",
        "table_name": "branches",
        "business_code_col": "code",
        "has_company_id": True,
        "has_branch_id": False,
        "scope": "COMPANY",
    },
    {
        "entity_type": "ITEM",
        "group_code": "MST",
        "prefix": "MST-ITM",
        "table_name": "items",
        "business_code_col": "item_code",
        "has_company_id": True,
        "has_branch_id": True,
        "scope": "TENANT",
    },
    {
        "entity_type": "CUSTOMER",
        "group_code": "CRM",
        "prefix": "CRM-CUS",
        "table_name": "customers",
        "business_code_col": "code",
        "has_company_id": True,
        "has_branch_id": True,
        "scope": "TENANT",
    },
    {
        "entity_type": "SUPPLIER",
        "group_code": "PUR",
        "prefix": "PUR-SUP",
        "table_name": "suppliers",
        "business_code_col": "code",
        "has_company_id": True,
        "has_branch_id": True,
        "scope": "TENANT",
    },
]


def upgrade() -> None:
    conn = op.get_bind()

    # -------------------------------------------------------------------------
    # 1. Additive Schema Extension: identity_code column + B-Tree index
    # -------------------------------------------------------------------------
    for spec in ENTITY_SPECS:
        tbl = spec["table_name"]
        idx = f"ix_{tbl}_identity_code"
        op.add_column(tbl, sa.Column("identity_code", sa.String(length=100), nullable=True))
        op.create_index(idx, tbl, ["identity_code"])

    # -------------------------------------------------------------------------
    # 2. Deterministic Sequential Allocation, Backfill & Legacy Alias Ingestion
    # -------------------------------------------------------------------------
    alloc_table = table(
        "smriti_identity_allocation_log",
        column("id", sa.String),
        column("uuid", sa.String),
        column("tenant_id", sa.String),
        column("entity_type", sa.String),
        column("group_code", sa.String),
        column("canonical_id", sa.String),
        column("identity_code", sa.String),
        column("scope", sa.String),
        column("purpose", sa.String),
        column("correlation_id", sa.String),
        column("company_id", sa.String),
        column("branch_id", sa.String),
        column("created_by", sa.String),
        column("is_active", sa.Boolean),
        column("is_deleted", sa.Boolean),
        column("version", sa.Integer),
    )

    alias_table = table(
        "smriti_identity_alias",
        column("id", sa.String),
        column("uuid", sa.String),
        column("entity_type", sa.String),
        column("entity_id", sa.String),
        column("canonical_identity_code", sa.String),
        column("alias_code", sa.String),
        column("alias_type", sa.String),
        column("source_system", sa.String),
        column("company_id", sa.String),
        column("branch_id", sa.String),
        column("notes", sa.Text),
        column("created_by", sa.String),
        column("is_active", sa.Boolean),
        column("is_deleted", sa.Boolean),
        column("version", sa.Integer),
    )

    for spec in ENTITY_SPECS:
        tbl_name = spec["table_name"]
        prefix = spec["prefix"]
        entity_type = spec["entity_type"]
        group_code = spec["group_code"]
        bcode_col = spec["business_code_col"]
        has_cmp = spec["has_company_id"]
        has_brn = spec["has_branch_id"]
        scope = spec["scope"]

        # Fetch current sequence value from smriti_numbering_registry
        seq_res = conn.execute(
            sa.text(
                "SELECT sequence_value FROM smriti_numbering_registry "
                "WHERE entity_type = :etype AND prefix = :pfx"
            ),
            {"etype": entity_type, "pfx": prefix},
        ).scalar()
        current_seq = seq_res if seq_res is not None else 0

        # Query all records deterministically ordered by created_at ASC, id ASC
        cols = ["id"]
        if has_cmp:
            cols.append("company_id")
        if has_brn:
            cols.append("branch_id")
        if bcode_col:
            cols.append(bcode_col)

        col_select = ", ".join(cols)
        query = f"SELECT {col_select} FROM {tbl_name} ORDER BY COALESCE(created_at, '1970-01-01'::timestamptz) ASC, id ASC"
        rows = conn.execute(sa.text(query)).fetchall()

        if not rows:
            continue

        updates = []
        alloc_records = []
        alias_records = []
        seen_aliases = set()

        for r in rows:
            current_seq += 1
            allocated_code = f"{prefix}-{current_seq:08d}"
            rec_id = r[0]
            cmp_id = None
            brn_id = None
            legacy_code = None

            idx = 1
            if has_cmp:
                cmp_id = r[idx]
                idx += 1
            if has_brn:
                brn_id = r[idx]
                idx += 1
            if bcode_col:
                legacy_code = r[idx]

            # For companies table, company_id is None or the company itself
            if tbl_name == "companies":
                cmp_id = rec_id

            updates.append({"b_id": rec_id, "b_identity_code": allocated_code})

            alloc_records.append({
                "id": f"alloc_{uuid.uuid4().hex[:20]}",
                "uuid": str(uuid.uuid4()),
                "tenant_id": "",
                "entity_type": entity_type,
                "group_code": group_code,
                "canonical_id": rec_id,
                "identity_code": allocated_code,
                "scope": scope,
                "purpose": "MIGRATION_BACKFILL",
                "correlation_id": "PHASE_1_1_BACKFILL",
                "company_id": cmp_id,
                "branch_id": brn_id,
                "created_by": "SYSTEM_MIGRATION",
                "is_active": True,
                "is_deleted": False,
                "version": 1,
            })

            # Ingest legacy business code alias if non-empty and non-duplicate
            if legacy_code and str(legacy_code).strip():
                clean_legacy = str(legacy_code).strip()
                alias_key = (entity_type, clean_legacy, cmp_id or "")
                if alias_key not in seen_aliases:
                    seen_aliases.add(alias_key)
                    alias_records.append({
                        "id": f"alias_{uuid.uuid4().hex[:20]}",
                        "uuid": str(uuid.uuid4()),
                        "entity_type": entity_type,
                        "entity_id": rec_id,
                        "canonical_identity_code": allocated_code,
                        "alias_code": clean_legacy,
                        "alias_type": "LEGACY_IMPORT",
                        "source_system": "SHOPER9",
                        "company_id": cmp_id,
                        "branch_id": brn_id,
                        "notes": "Backfilled from legacy master data during Phase 1.1",
                        "created_by": "SYSTEM_MIGRATION",
                        "is_active": True,
                        "is_deleted": False,
                        "version": 1,
                    })

        # Batch update target table in chunks of 1000
        target_tbl = table(tbl_name, column("id", sa.String), column("identity_code", sa.String))
        chunk_size = 1000
        for i in range(0, len(updates), chunk_size):
            chunk = updates[i:i + chunk_size]
            conn.execute(
                target_tbl.update()
                .where(target_tbl.c.id == bindparam("b_id"))
                .values(identity_code=bindparam("b_identity_code")),
                chunk,
            )

        # Bulk insert allocation log in chunks
        for i in range(0, len(alloc_records), chunk_size):
            chunk = alloc_records[i:i + chunk_size]
            op.bulk_insert(alloc_table, chunk)

        # Bulk insert aliases in chunks
        for i in range(0, len(alias_records), chunk_size):
            chunk = alias_records[i:i + chunk_size]
            op.bulk_insert(alias_table, chunk)

        # Upsert sequence_value in smriti_numbering_registry
        updated = conn.execute(
            sa.text(
                "UPDATE smriti_numbering_registry SET sequence_value = :seq "
                "WHERE entity_type = :etype AND prefix = :pfx"
            ),
            {"seq": current_seq, "etype": entity_type, "pfx": prefix},
        ).rowcount

        if updated == 0:
            conn.execute(
                sa.text(
                    "INSERT INTO smriti_numbering_registry ("
                    "  id, uuid, entity_type, identity_group, group_code, prefix, format_template, "
                    "  scope, sequence_value, padding, reset_policy, financial_year, tenant_id, "
                    "  company_id, branch_id, status, is_active, is_deleted, version"
                    ") VALUES ("
                    "  :id, :uuid, :etype, :igroup, :gcode, :pfx, '{prefix}-{seq:08d}', "
                    "  :scope, :seq, 8, 'NEVER', '', '', NULL, NULL, 'ACTIVE', true, false, 1"
                    ")"
                ),
                {
                    "id": f"numreg_{entity_type.lower()}_default",
                    "uuid": str(uuid.uuid4()),
                    "etype": entity_type,
                    "igroup": "ORGANIZATION" if group_code == "ORG" else group_code,
                    "gcode": group_code,
                    "pfx": prefix,
                    "scope": scope,
                    "seq": current_seq,
                },
            )


def downgrade() -> None:
    conn = op.get_bind()

    # -------------------------------------------------------------------------
    # Guarded Downgrade: Check for post-migration allocations
    # -------------------------------------------------------------------------
    non_backfill = conn.execute(
        sa.text(
            "SELECT COUNT(*) FROM smriti_identity_allocation_log "
            "WHERE entity_type IN ('COMPANY', 'BRANCH', 'ITEM', 'CUSTOMER', 'SUPPLIER') "
            "  AND purpose != 'MIGRATION_BACKFILL'"
        )
    ).scalar()

    if non_backfill and non_backfill > 0:
        raise RuntimeError(
            f"ABORT DOWNGRADE: {non_backfill} active business entities have been allocated "
            f"identities post-migration. Reverting would corrupt transactional identity lineage."
        )

    # Clean rollback of backfill records
    conn.execute(
        sa.text(
            "DELETE FROM smriti_identity_alias "
            "WHERE entity_type IN ('COMPANY', 'BRANCH', 'ITEM', 'CUSTOMER', 'SUPPLIER') "
            "  AND alias_type = 'LEGACY_IMPORT' AND source_system = 'SHOPER9'"
        )
    )

    conn.execute(
        sa.text(
            "DELETE FROM smriti_identity_allocation_log "
            "WHERE entity_type IN ('COMPANY', 'BRANCH', 'ITEM', 'CUSTOMER', 'SUPPLIER') "
            "  AND purpose = 'MIGRATION_BACKFILL'"
        )
    )

    conn.execute(
        sa.text(
            "UPDATE smriti_numbering_registry SET sequence_value = 0 "
            "WHERE entity_type IN ('COMPANY', 'BRANCH', 'ITEM', 'CUSTOMER', 'SUPPLIER')"
        )
    )

    # Drop columns and indexes in reverse order
    for spec in reversed(ENTITY_SPECS):
        tbl = spec["table_name"]
        idx = f"ix_{tbl}_identity_code"
        op.drop_index(idx, table_name=tbl)
        op.drop_column(tbl, "identity_code")
