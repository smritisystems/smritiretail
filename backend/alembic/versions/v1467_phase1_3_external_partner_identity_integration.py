"""Phase 1.3: External & Partner Integration Identity

Revision ID: v1467_phase1_3_external_partner_identity_integration
Revises: v1466_phase1_2_transactional_identity_integration
Create Date: 2026-09-18 05:20:00.000000

Governance Standard: AGENTS.md Rules 1-12, UADHP-v1.0
Author: Jawahar Ramkripal Mallah, Chief Systems Architect & Creator
Copyright: © SMRITIBooks.com. All Rights Reserved.
License: Proprietary Commercial Software
Classification: Internal Core Architecture

Scope of Migration:
1. parties: Add identity_code VARCHAR(100) NULL with database-level UNIQUE B-tree index
   (uq_parties_identity_code).
2. eway_bills: Add identity_code VARCHAR(100) NULL with database-level UNIQUE B-tree index
   (uq_eway_bills_identity_code).
3. payment_transactions: Strictly preserved high-throughput settlement ledger boundary
   (NO sequential identity_code column, UUIDv7 technical PK only).
4. Register PARTY and EWAY_BILL taxonomies in smriti_identity_registry.
5. Deterministically backfill sequential identity codes:
   - parties: MST-PRT-00000001 ...
   - eway_bills: TAX-EWB-00000001 ...
6. Audit-log all backfilled allocations in smriti_identity_allocation_log (purpose='MIGRATION_BACKFILL').
7. Ingest external partner aliases into smriti_identity_alias:
   - parties: gstin, pan (STATUTORY_ID, GSTN / INCOME_TAX_DEPT), party_code (HISTORICAL_CODE, SMRITI)
   - eway_bills: eway_bill_no, irn (STATUTORY_ID, NIC_EWAY / GSTN_IRP)
   - payment_transactions: gateway_reference (GATEWAY_REF, GATEWAY)
8. Synchronize sequence counters in smriti_numbering_registry.
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.sql import table, column, bindparam
import uuid

# revision identifiers, used by Alembic.
revision = 'v1467_phase1_3_external_partner_identity_integration'
down_revision = 'v1466_phase1_2_transactional_identity_integration'
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()

    # =========================================================================
    # Step 1: Additive Columns & Database-Enforced Unique Indexes
    # =========================================================================
    # 1.1 parties
    party_col_exists = conn.execute(
        sa.text(
            "SELECT 1 FROM information_schema.columns "
            "WHERE table_name = 'parties' AND column_name = 'identity_code'"
        )
    ).scalar()

    if not party_col_exists:
        op.add_column('parties', sa.Column('identity_code', sa.String(length=100), nullable=True))

    party_idx_exists = conn.execute(
        sa.text(
            "SELECT 1 FROM pg_indexes "
            "WHERE tablename = 'parties' AND indexname = 'uq_parties_identity_code'"
        )
    ).scalar()

    if not party_idx_exists:
        op.create_index('uq_parties_identity_code', 'parties', ['identity_code'], unique=True)

    # 1.2 eway_bills
    ewb_col_exists = conn.execute(
        sa.text(
            "SELECT 1 FROM information_schema.columns "
            "WHERE table_name = 'eway_bills' AND column_name = 'identity_code'"
        )
    ).scalar()

    if not ewb_col_exists:
        op.add_column('eway_bills', sa.Column('identity_code', sa.String(length=100), nullable=True))

    ewb_idx_exists = conn.execute(
        sa.text(
            "SELECT 1 FROM pg_indexes "
            "WHERE tablename = 'eway_bills' AND indexname = 'uq_eway_bills_identity_code'"
        )
    ).scalar()

    if not ewb_idx_exists:
        op.create_index('uq_eway_bills_identity_code', 'eway_bills', ['identity_code'], unique=True)

    # Note: payment_transactions strictly receives NO sequential identity_code column
    # to protect the high-throughput settlement ledger boundary.

    # =========================================================================
    # Step 2: Register Taxonomies in smriti_identity_registry
    # =========================================================================
    # 2.1 Register PARTY
    party_reg_exists = conn.execute(
        sa.text("SELECT 1 FROM smriti_identity_registry WHERE entity_type = 'PARTY'")
    ).scalar()

    if not party_reg_exists:
        conn.execute(
            sa.text(
                "INSERT INTO smriti_identity_registry ("
                "  id, uuid, entity_type, identity_group, group_code, entity_code, display_name, description, "
                "  identity_code_prefix, database_table, primary_key_field, identity_code_field, business_code_field, "
                "  company_scoped, branch_scoped, is_active, status, version"
                ") VALUES ("
                "  'reg_party_master', :uuid, 'PARTY', 'MASTER_DATA', 'MST', 'PRT', 'Universal Legal Party Master', 'Legal entity master identity', "
                "  'MST-PRT', 'parties', 'id', 'identity_code', 'party_code', "
                "  true, false, true, 'ACTIVE', 1"
                ")"
            ),
            {"uuid": str(uuid.uuid4())},
        )

    # 2.2 Register EWAY_BILL
    ewb_reg_exists = conn.execute(
        sa.text("SELECT 1 FROM smriti_identity_registry WHERE entity_type = 'EWAY_BILL'")
    ).scalar()

    if not ewb_reg_exists:
        conn.execute(
            sa.text(
                "INSERT INTO smriti_identity_registry ("
                "  id, uuid, entity_type, identity_group, group_code, entity_code, display_name, description, "
                "  identity_code_prefix, database_table, primary_key_field, identity_code_field, business_code_field, "
                "  company_scoped, branch_scoped, is_active, status, version"
                ") VALUES ("
                "  'reg_eway_bill', :uuid, 'EWAY_BILL', 'TAX_AND_COMPLIANCE', 'TAX', 'EWB', 'Statutory Goods Transit E-Way Bill', 'Goods transit statutory permit', "
                "  'TAX-EWB', 'eway_bills', 'id', 'identity_code', 'eway_bill_no', "
                "  true, false, true, 'ACTIVE', 1"
                ")"
            ),
            {"uuid": str(uuid.uuid4())},
        )

    # 2.3 Ensure sequence rows exist in smriti_numbering_registry
    for entity_type, group_code, prefix, igroup in [
        ("PARTY", "MST", "MST-PRT", "MASTER_DATA"),
        ("EWAY_BILL", "TAX", "TAX-EWB", "TAX_AND_COMPLIANCE"),
    ]:
        seq_row_exists = conn.execute(
            sa.text(
                "SELECT 1 FROM smriti_numbering_registry "
                "WHERE entity_type = :etype AND prefix = :pfx"
            ),
            {"etype": entity_type, "pfx": prefix},
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
                    "id": f"num_{prefix.lower().replace('-', '_')}",
                    "uuid": str(uuid.uuid4()),
                    "etype": entity_type,
                    "igroup": igroup,
                    "gcode": group_code,
                    "pfx": prefix,
                },
            )

    # =========================================================================
    # Step 3: Deterministic Backfill for parties
    # =========================================================================
    party_seq_res = conn.execute(
        sa.text("SELECT sequence_value FROM smriti_numbering_registry WHERE entity_type = 'PARTY' AND prefix = 'MST-PRT'")
    ).scalar()
    current_party_seq = party_seq_res if party_seq_res is not None else 0

    party_rows = conn.execute(
        sa.text(
            "SELECT id, party_code, gstin, pan, company_id, branch_id "
            "FROM parties "
            "WHERE identity_code IS NULL "
            "ORDER BY COALESCE(created_at, '1970-01-01'::timestamptz) ASC, id ASC"
        )
    ).fetchall()

    if party_rows:
        party_updates = []
        party_allocs = []
        party_aliases = []
        seen_party_aliases = set()

        for r in party_rows:
            current_party_seq += 1
            allocated_code = f"MST-PRT-{current_party_seq:08d}"
            pid, pcode, gstin, pan, cid, bid = r[0], r[1], r[2], r[3], r[4], r[5]

            party_updates.append({"b_id": pid, "b_identity_code": allocated_code})

            party_allocs.append({
                "id": f"alloc_{uuid.uuid4().hex[:20]}",
                "uuid": str(uuid.uuid4()),
                "tenant_id": "",
                "entity_type": "PARTY",
                "group_code": "MST",
                "canonical_id": pid,
                "identity_code": allocated_code,
                "scope": "TENANT",
                "purpose": "MIGRATION_BACKFILL",
                "correlation_id": "PHASE_1_3_BACKFILL",
                "company_id": cid,
                "branch_id": bid,
                "created_by": "SYSTEM_MIGRATION",
                "is_active": True,
                "is_deleted": False,
                "version": 1,
            })

            # Ingest sovereign party_code
            if pcode and str(pcode).strip():
                clean_pcode = str(pcode).strip().upper()
                alias_key = ("PARTY", clean_pcode, cid or "")
                if alias_key not in seen_party_aliases:
                    seen_party_aliases.add(alias_key)
                    party_aliases.append({
                        "id": f"alias_{uuid.uuid4().hex[:20]}",
                        "uuid": str(uuid.uuid4()),
                        "entity_type": "PARTY",
                        "entity_id": pid,
                        "canonical_identity_code": allocated_code,
                        "alias_code": clean_pcode,
                        "alias_type": "HISTORICAL_CODE",
                        "source_system": "SMRITI",
                        "company_id": cid,
                        "branch_id": bid,
                        "notes": "Sovereign party code backfilled in Phase 1.3",
                        "created_by": "SYSTEM_MIGRATION",
                        "is_active": True,
                        "is_deleted": False,
                        "version": 1,
                    })

            # Ingest statutory GSTIN
            if gstin and str(gstin).strip():
                clean_gstin = str(gstin).strip().upper()
                alias_key = ("PARTY", clean_gstin, cid or "")
                if alias_key not in seen_party_aliases:
                    seen_party_aliases.add(alias_key)
                    party_aliases.append({
                        "id": f"alias_{uuid.uuid4().hex[:20]}",
                        "uuid": str(uuid.uuid4()),
                        "entity_type": "PARTY",
                        "entity_id": pid,
                        "canonical_identity_code": allocated_code,
                        "alias_code": clean_gstin,
                        "alias_type": "STATUTORY_ID",
                        "source_system": "GSTN",
                        "company_id": cid,
                        "branch_id": bid,
                        "notes": "Statutory GSTIN backfilled in Phase 1.3",
                        "created_by": "SYSTEM_MIGRATION",
                        "is_active": True,
                        "is_deleted": False,
                        "version": 1,
                    })

            # Ingest statutory PAN
            if pan and str(pan).strip():
                clean_pan = str(pan).strip().upper()
                alias_key = ("PARTY", clean_pan, cid or "")
                if alias_key not in seen_party_aliases:
                    seen_party_aliases.add(alias_key)
                    party_aliases.append({
                        "id": f"alias_{uuid.uuid4().hex[:20]}",
                        "uuid": str(uuid.uuid4()),
                        "entity_type": "PARTY",
                        "entity_id": pid,
                        "canonical_identity_code": allocated_code,
                        "alias_code": clean_pan,
                        "alias_type": "STATUTORY_ID",
                        "source_system": "INCOME_TAX_DEPT",
                        "company_id": cid,
                        "branch_id": bid,
                        "notes": "Statutory PAN backfilled in Phase 1.3",
                        "created_by": "SYSTEM_MIGRATION",
                        "is_active": True,
                        "is_deleted": False,
                        "version": 1,
                    })

        # Apply updates
        party_t = table("parties", column("id", sa.String), column("identity_code", sa.String))
        for i in range(0, len(party_updates), 500):
            chunk = party_updates[i : i + 500]
            stmt = (
                party_t.update()
                .where(party_t.c.id == bindparam("b_id"))
                .values(identity_code=bindparam("b_identity_code"))
            )
            conn.execute(stmt, chunk)

        # Insert allocation logs
        if party_allocs:
            alloc_t = table(
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
            for i in range(0, len(party_allocs), 500):
                conn.execute(alloc_t.insert(), party_allocs[i : i + 500])

        # Insert aliases
        if party_aliases:
            alias_t = table(
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
                column("notes", sa.String),
                column("created_by", sa.String),
                column("is_active", sa.Boolean),
                column("is_deleted", sa.Boolean),
                column("version", sa.Integer),
            )
            for i in range(0, len(party_aliases), 500):
                conn.execute(alias_t.insert(), party_aliases[i : i + 500])

        # Update numbering registry sequence value
        conn.execute(
            sa.text(
                "UPDATE smriti_numbering_registry "
                "SET sequence_value = :s, modified_at = NOW() "
                "WHERE entity_type = 'PARTY' AND prefix = 'MST-PRT'"
            ),
            {"s": current_party_seq},
        )

    # =========================================================================
    # Step 4: Deterministic Backfill for eway_bills
    # =========================================================================
    ewb_seq_res = conn.execute(
        sa.text("SELECT sequence_value FROM smriti_numbering_registry WHERE entity_type = 'EWAY_BILL' AND prefix = 'TAX-EWB'")
    ).scalar()
    current_ewb_seq = ewb_seq_res if ewb_seq_res is not None else 0

    ewb_rows = conn.execute(
        sa.text(
            "SELECT id, eway_bill_no, irn, company_id, branch_id "
            "FROM eway_bills "
            "WHERE identity_code IS NULL "
            "ORDER BY COALESCE(created_at, '1970-01-01'::timestamptz) ASC, id ASC"
        )
    ).fetchall()

    if ewb_rows:
        ewb_updates = []
        ewb_allocs = []
        ewb_aliases = []
        seen_ewb_aliases = set()

        for r in ewb_rows:
            current_ewb_seq += 1
            allocated_code = f"TAX-EWB-{current_ewb_seq:08d}"
            eid, ewb_no, irn, cid, bid = r[0], r[1], r[2], r[3], r[4]

            ewb_updates.append({"b_id": eid, "b_identity_code": allocated_code})

            ewb_allocs.append({
                "id": f"alloc_{uuid.uuid4().hex[:20]}",
                "uuid": str(uuid.uuid4()),
                "tenant_id": "",
                "entity_type": "EWAY_BILL",
                "group_code": "TAX",
                "canonical_id": eid,
                "identity_code": allocated_code,
                "scope": "COMPANY",
                "purpose": "MIGRATION_BACKFILL",
                "correlation_id": "PHASE_1_3_BACKFILL",
                "company_id": cid,
                "branch_id": bid,
                "created_by": "SYSTEM_MIGRATION",
                "is_active": True,
                "is_deleted": False,
                "version": 1,
            })

            # Ingest statutory eway_bill_no
            if ewb_no and str(ewb_no).strip():
                clean_ewb = str(ewb_no).strip().upper()
                alias_key = ("EWAY_BILL", clean_ewb, cid or "")
                if alias_key not in seen_ewb_aliases:
                    seen_ewb_aliases.add(alias_key)
                    ewb_aliases.append({
                        "id": f"alias_{uuid.uuid4().hex[:20]}",
                        "uuid": str(uuid.uuid4()),
                        "entity_type": "EWAY_BILL",
                        "entity_id": eid,
                        "canonical_identity_code": allocated_code,
                        "alias_code": clean_ewb,
                        "alias_type": "STATUTORY_ID",
                        "source_system": "NIC_EWAY",
                        "company_id": cid,
                        "branch_id": bid,
                        "notes": "Statutory E-Way Bill Number backfilled in Phase 1.3",
                        "created_by": "SYSTEM_MIGRATION",
                        "is_active": True,
                        "is_deleted": False,
                        "version": 1,
                    })

            # Ingest statutory IRN if present
            if irn and str(irn).strip():
                clean_irn = str(irn).strip().upper()
                alias_key = ("EWAY_BILL", clean_irn, cid or "")
                if alias_key not in seen_ewb_aliases:
                    seen_ewb_aliases.add(alias_key)
                    ewb_aliases.append({
                        "id": f"alias_{uuid.uuid4().hex[:20]}",
                        "uuid": str(uuid.uuid4()),
                        "entity_type": "EWAY_BILL",
                        "entity_id": eid,
                        "canonical_identity_code": allocated_code,
                        "alias_code": clean_irn,
                        "alias_type": "STATUTORY_ID",
                        "source_system": "GSTN_IRP",
                        "company_id": cid,
                        "branch_id": bid,
                        "notes": "Statutory IRN attached to E-Way Bill backfilled in Phase 1.3",
                        "created_by": "SYSTEM_MIGRATION",
                        "is_active": True,
                        "is_deleted": False,
                        "version": 1,
                    })

        # Apply updates
        ewb_t = table("eway_bills", column("id", sa.String), column("identity_code", sa.String))
        for i in range(0, len(ewb_updates), 500):
            chunk = ewb_updates[i : i + 500]
            stmt = (
                ewb_t.update()
                .where(ewb_t.c.id == bindparam("b_id"))
                .values(identity_code=bindparam("b_identity_code"))
            )
            conn.execute(stmt, chunk)

        # Insert allocation logs
        if ewb_allocs:
            alloc_t = table(
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
            for i in range(0, len(ewb_allocs), 500):
                conn.execute(alloc_t.insert(), ewb_allocs[i : i + 500])

        # Insert aliases
        if ewb_aliases:
            alias_t = table(
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
                column("notes", sa.String),
                column("created_by", sa.String),
                column("is_active", sa.Boolean),
                column("is_deleted", sa.Boolean),
                column("version", sa.Integer),
            )
            for i in range(0, len(ewb_aliases), 500):
                conn.execute(alias_t.insert(), ewb_aliases[i : i + 500])

        # Update numbering registry sequence value
        conn.execute(
            sa.text(
                "UPDATE smriti_numbering_registry "
                "SET sequence_value = :s, modified_at = NOW() "
                "WHERE entity_type = 'EWAY_BILL' AND prefix = 'TAX-EWB'"
            ),
            {"s": current_ewb_seq},
        )

    # =========================================================================
    # Step 5: Ingest External Gateway References from payment_transactions
    # =========================================================================
    pt_rows = conn.execute(
        sa.text(
            "SELECT id, gateway_reference, company_id, branch_id "
            "FROM payment_transactions "
            "WHERE gateway_reference IS NOT NULL AND TRIM(gateway_reference) != ''"
        )
    ).fetchall()

    if pt_rows:
        pt_aliases = []
        seen_pt_aliases = set()

        for r in pt_rows:
            ptid, gw_ref, cid, bid = r[0], str(r[1]).strip(), r[2], r[3]
            alias_key = ("PAYMENT_TRANSACTION", gw_ref, cid or "")
            if alias_key not in seen_pt_aliases:
                seen_pt_aliases.add(alias_key)
                pt_aliases.append({
                    "id": f"alias_{uuid.uuid4().hex[:20]}",
                    "uuid": str(uuid.uuid4()),
                    "entity_type": "PAYMENT_TRANSACTION",
                    "entity_id": ptid,
                    "canonical_identity_code": None,
                    "alias_code": gw_ref,
                    "alias_type": "GATEWAY_REF",
                    "source_system": "GATEWAY",
                    "company_id": cid,
                    "branch_id": bid,
                    "notes": "External processor gateway reference backfilled in Phase 1.3",
                    "created_by": "SYSTEM_MIGRATION",
                    "is_active": True,
                    "is_deleted": False,
                    "version": 1,
                })

        if pt_aliases:
            alias_t = table(
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
                column("notes", sa.String),
                column("created_by", sa.String),
                column("is_active", sa.Boolean),
                column("is_deleted", sa.Boolean),
                column("version", sa.Integer),
            )
            for i in range(0, len(pt_aliases), 500):
                conn.execute(alias_t.insert(), pt_aliases[i : i + 500])


def downgrade() -> None:
    conn = op.get_bind()

    # Drop unique indexes and columns
    op.drop_index('uq_parties_identity_code', table_name='parties')
    op.drop_column('parties', 'identity_code')

    op.drop_index('uq_eway_bills_identity_code', table_name='eway_bills')
    op.drop_column('eway_bills', 'identity_code')

    # Clean registry entries
    conn.execute(sa.text("DELETE FROM smriti_identity_registry WHERE entity_type IN ('PARTY', 'EWAY_BILL')"))
    conn.execute(sa.text("DELETE FROM smriti_numbering_registry WHERE entity_type IN ('PARTY', 'EWAY_BILL')"))
    conn.execute(sa.text("DELETE FROM smriti_identity_allocation_log WHERE correlation_id = 'PHASE_1_3_BACKFILL'"))
    conn.execute(sa.text("DELETE FROM smriti_identity_alias WHERE notes LIKE '%Phase 1.3%'"))
