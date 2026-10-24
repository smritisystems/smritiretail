"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.35.2
Created      : 2026-09-18
Modified     : 2026-09-18
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

"""v1466 – phase1_2_transactional_identity_integration: Transactional Document & Ledger Identity Integration

Adds additive identity_code VARCHAR(100) and UNIQUE B-Tree indexes to:
  1. sales_invoices (SAL-INV)
  2. purchase_orders (PUR-ORD)
  3. shifts (POS-SFT)

Registers POS_SHIFT and aligns PURCHASE_ORDER in smriti_identity_registry.
Ensures sequence counters exist in smriti_numbering_registry.

Deterministically backfills sequential SMRITI Identity Codes:
  - SAL-INV-{seq:08d} for sales_invoices
  - PUR-ORD-{seq:08d} for purchase_orders
  - POS-SFT-{seq:08d} for shifts

Ingests existing document numbers (invoice_no, order_no) into smriti_identity_alias
as HISTORICAL_DOC / TRANSACTIONAL for universal polymorphic resolution.
Audit-logs all backfilled allocations in smriti_identity_allocation_log.
Synchronizes smriti_numbering_registry sequence counters.
Enforces guarded downgrade safety.

Revision ID: v1466_phase1_2_transactional_identity_integration
Revises:     v1465_phase1_1_business_entity_identity_code_integration
Create Date: 2026-09-18
"""

import uuid
from datetime import datetime, timezone
from alembic import op
import sqlalchemy as sa
from sqlalchemy.sql import table, column, bindparam


revision: str = "v1466_phase1_2_transactional_identity_integration"
down_revision: str = "v1465_phase1_1_business_entity_identity_code_integration"
branch_labels = None
depends_on = None


TRANSACTIONAL_SPECS = [
    {
        "entity_type": "SALES_INVOICE",
        "identity_group": "SALES",
        "group_code": "SAL",
        "prefix": "SAL-INV",
        "table_name": "sales_invoices",
        "business_code_col": "invoice_no",
        "has_company_id": True,
        "has_branch_id": True,
        "scope": "COMPANY",
    },
    {
        "entity_type": "PURCHASE_ORDER",
        "identity_group": "PURCHASE",
        "group_code": "PUR",
        "prefix": "PUR-ORD",
        "table_name": "purchase_orders",
        "business_code_col": "order_no",
        "has_company_id": True,
        "has_branch_id": True,
        "scope": "COMPANY",
    },
    {
        "entity_type": "POS_SHIFT",
        "identity_group": "POINT_OF_SALE",
        "group_code": "POS",
        "prefix": "POS-SFT",
        "table_name": "shifts",
        "business_code_col": None,
        "has_company_id": True,
        "has_branch_id": True,
        "scope": "BRANCH",
    },
]


def upgrade() -> None:
    conn = op.get_bind()

    # -------------------------------------------------------------------------
    # 1. Additive Schema Extension: identity_code column + UNIQUE B-Tree index
    # -------------------------------------------------------------------------
    for spec in TRANSACTIONAL_SPECS:
        tbl = spec["table_name"]
        idx = f"uq_{tbl}_identity_code"

        # Check if column already exists
        col_check = conn.execute(
            sa.text(
                "SELECT 1 FROM information_schema.columns "
                "WHERE table_name = :t AND column_name = 'identity_code'"
            ),
            {"t": tbl},
        ).scalar()

        if not col_check:
            op.add_column(tbl, sa.Column("identity_code", sa.String(length=100), nullable=True))

        # Check if index already exists
        idx_check = conn.execute(
            sa.text(
                "SELECT 1 FROM pg_indexes "
                "WHERE tablename = :t AND indexname = :i"
            ),
            {"t": tbl, "i": idx},
        ).scalar()

        if not idx_check:
            op.create_index(idx, tbl, ["identity_code"], unique=True)

    # -------------------------------------------------------------------------
    # 2. Control Plane Alignment: Registry & Numbering Series Initialization
    # -------------------------------------------------------------------------
    # 2a. Align PURCHASE_ORDER in smriti_identity_registry
    conn.execute(
        sa.text(
            "UPDATE smriti_identity_registry "
            "SET entity_code = 'ORD', identity_code_prefix = 'PUR-ORD', business_code_field = 'order_no' "
            "WHERE entity_type = 'PURCHASE_ORDER'"
        )
    )

    # 2b. Register POS_SHIFT in smriti_identity_registry if not present
    shift_reg_exists = conn.execute(
        sa.text("SELECT 1 FROM smriti_identity_registry WHERE entity_type = 'POS_SHIFT'")
    ).scalar()

    if not shift_reg_exists:
        conn.execute(
            sa.text(
                "INSERT INTO smriti_identity_registry ("
                "  id, uuid, entity_type, identity_group, group_code, entity_code, display_name, description, "
                "  identity_code_prefix, database_table, primary_key_field, identity_code_field, business_code_field, "
                "  company_scoped, branch_scoped, is_active, status, version"
                ") VALUES ("
                "  'reg_pos_shift', :uuid, 'POS_SHIFT', 'POINT_OF_SALE', 'POS', 'SFT', 'POS Shift Session', 'Cashier counter session', "
                "  'POS-SFT', 'shifts', 'id', 'identity_code', NULL, "
                "  true, true, true, 'ACTIVE', 1"
                ")"
            ),
            {"uuid": str(uuid.uuid4())},
        )

    # 2c. Ensure sequence rows exist in smriti_numbering_registry
    for spec in TRANSACTIONAL_SPECS:
        seq_row_exists = conn.execute(
            sa.text(
                "SELECT 1 FROM smriti_numbering_registry "
                "WHERE entity_type = :etype AND prefix = :pfx"
            ),
            {"etype": spec["entity_type"], "pfx": spec["prefix"]},
        ).scalar()

        if not seq_row_exists:
            conn.execute(
                sa.text(
                    "INSERT INTO smriti_numbering_registry ("
                    "  id, uuid, entity_type, identity_group, group_code, prefix, sequence_value, padding, is_active, version"
                    ") VALUES ("
                    "  :id, :uuid, :etype, :igroup, :gcode, :pfx, 0, 8, true, 1"
                    ")"
                ),
                {
                    "id": f"num_{spec['prefix'].lower().replace('-', '_')}",
                    "uuid": str(uuid.uuid4()),
                    "etype": spec["entity_type"],
                    "igroup": spec["identity_group"],
                    "gcode": spec["group_code"],
                    "pfx": spec["prefix"],
                },
            )

    # -------------------------------------------------------------------------
    # 3. Deterministic Sequential Allocation, Backfill & Document Alias Ingestion
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

    for spec in TRANSACTIONAL_SPECS:
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

        # Query records needing backfill deterministically ordered by created_at ASC, id ASC
        cols = ["id"]
        if has_cmp:
            cols.append("company_id")
        if has_brn:
            cols.append("branch_id")
        if bcode_col:
            cols.append(bcode_col)

        col_select = ", ".join(cols)
        query = (
            f"SELECT {col_select} FROM {tbl_name} "
            f"WHERE identity_code IS NULL "
            f"ORDER BY COALESCE(created_at, '1970-01-01'::timestamptz) ASC, id ASC"
        )
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
            biz_doc_no = None

            idx = 1
            if has_cmp:
                cmp_id = r[idx]
                idx += 1
            if has_brn:
                brn_id = r[idx]
                idx += 1
            if bcode_col:
                biz_doc_no = r[idx]

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
                "correlation_id": "PHASE_1_2_BACKFILL",
                "company_id": cmp_id,
                "branch_id": brn_id,
                "created_by": "SYSTEM_MIGRATION",
                "is_active": True,
                "is_deleted": False,
                "version": 1,
            })

            # Ingest existing document number (e.g. invoice_no, order_no) into alias registry
            if biz_doc_no and str(biz_doc_no).strip():
                clean_biz = str(biz_doc_no).strip()
                alias_key = (entity_type, clean_biz, cmp_id or "")
                if alias_key not in seen_aliases:
                    seen_aliases.add(alias_key)
                    alias_records.append({
                        "id": f"alias_{uuid.uuid4().hex[:20]}",
                        "uuid": str(uuid.uuid4()),
                        "entity_type": entity_type,
                        "entity_id": rec_id,
                        "canonical_identity_code": allocated_code,
                        "alias_code": clean_biz,
                        "alias_type": "HISTORICAL_DOC",
                        "source_system": "TRANSACTIONAL",
                        "company_id": cmp_id,
                        "branch_id": brn_id,
                        "notes": "Historical document number imported during Phase 1.2 migration",
                        "created_by": "SYSTEM_MIGRATION",
                        "is_active": True,
                        "is_deleted": False,
                        "version": 1,
                    })

        # Batch execute updates in chunks of 500
        chunk_size = 500
        target_t = table(tbl_name, column("id", sa.String), column("identity_code", sa.String))

        for i in range(0, len(updates), chunk_size):
            chunk = updates[i : i + chunk_size]
            stmt = (
                target_t.update()
                .where(target_t.c.id == bindparam("b_id"))
                .values(identity_code=bindparam("b_identity_code"))
            )
            conn.execute(stmt, chunk)

        # Batch execute allocation logs in chunks of 500
        for i in range(0, len(alloc_records), chunk_size):
            chunk = alloc_records[i : i + chunk_size]
            op.bulk_insert(alloc_table, chunk)

        # Batch execute alias records in chunks of 500
        for i in range(0, len(alias_records), chunk_size):
            chunk = alias_records[i : i + chunk_size]
            op.bulk_insert(alias_table, chunk)

        # Atomically advance sequence counter in numbering registry
        conn.execute(
            sa.text(
                "UPDATE smriti_numbering_registry SET sequence_value = :val "
                "WHERE entity_type = :etype AND prefix = :pfx"
            ),
            {"val": current_seq, "etype": entity_type, "pfx": prefix},
        )


def downgrade() -> None:
    conn = op.get_bind()

    # Safety Guard: Check if post-migration transactions were allocated
    non_backfill = conn.execute(
        sa.text(
            "SELECT COUNT(*) FROM smriti_identity_allocation_log "
            "WHERE entity_type IN ('SALES_INVOICE', 'PURCHASE_ORDER', 'POS_SHIFT') "
            "  AND purpose != 'MIGRATION_BACKFILL'"
        )
    ).scalar()

    if non_backfill and non_backfill > 0:
        raise RuntimeError(
            f"ABORT DOWNGRADE: {non_backfill} transactional documents have been allocated "
            f"identities post-migration. Reverting would corrupt transactional identity lineage."
        )

    # Clean rollback of backfill records
    conn.execute(
        sa.text(
            "DELETE FROM smriti_identity_alias "
            "WHERE entity_type IN ('SALES_INVOICE', 'PURCHASE_ORDER') "
            "  AND alias_type = 'HISTORICAL_DOC' AND source_system = 'TRANSACTIONAL'"
        )
    )

    conn.execute(
        sa.text(
            "DELETE FROM smriti_identity_allocation_log "
            "WHERE entity_type IN ('SALES_INVOICE', 'PURCHASE_ORDER', 'POS_SHIFT') "
            "  AND purpose = 'MIGRATION_BACKFILL'"
        )
    )

    conn.execute(
        sa.text(
            "UPDATE smriti_numbering_registry SET sequence_value = 0 "
            "WHERE entity_type IN ('SALES_INVOICE', 'PURCHASE_ORDER', 'POS_SHIFT')"
        )
    )

    # Drop columns and indexes in reverse order
    for spec in reversed(TRANSACTIONAL_SPECS):
        tbl = spec["table_name"]
        idx = f"uq_{tbl}_identity_code"
        op.drop_index(idx, table_name=tbl)
        op.drop_column(tbl, "identity_code")
