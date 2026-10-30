"""
Project      : SMRITI Retail OS
Repository   : SMRITIRetailNX
Organization : AITDL NETWORKS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.40.1
Created      : 2026-09-18
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal Core Architecture

Revision ID: v1470_purchase_grn_debit_note_purchase_bill_identity
Revises: v1469_phase2_alias_atomic_upsert_and_hardening
Create Date: 2026-09-18 17:30:00.000000

Governance Standard: AGENTS.md Rules 1-12, UADHP-v1.0
Scope of Migration:
1. Add identity_code column to purchase_receipts table.
2. Register PURCHASE_RECEIPT (PUR-GRN), DEBIT_NOTE (PUR-DN), and PURCHASE_BILL (PUR-BIL)
   in smriti_identity_registry.
3. Seed sequence counters in smriti_numbering_registry.
"""

import uuid
from alembic import op
import sqlalchemy as sa


revision = 'v1470_purchase_grn_debit_note_purchase_bill_identity'
down_revision = 'v1469_phase2_alias_atomic_upsert_and_hardening'
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()

    # =========================================================================
    # Step 1: Add identity_code column to purchase_receipts table
    # =========================================================================
    op.execute(
        "ALTER TABLE IF EXISTS purchase_receipts "
        "ADD COLUMN IF NOT EXISTS identity_code VARCHAR(100);"
    )
    op.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS uq_purchase_receipts_identity_code "
        "ON purchase_receipts (identity_code) WHERE identity_code IS NOT NULL;"
    )

    # =========================================================================
    # Step 2: Register Procurement Taxonomies in smriti_identity_registry
    # =========================================================================
    taxonomies = [
        {
            "id": "idreg_pur_receipt",
            "entity_type": "PURCHASE_RECEIPT",
            "identity_group": "PROCUREMENT",
            "group_code": "PUR",
            "entity_code": "GRN",
            "display_name": "Goods Receipt Note / Purchase Receipt",
            "description": "Inward physical goods receipt and warehouse intake voucher",
            "identity_code_prefix": "PUR-GRN",
            "database_table": "purchase_receipts",
            "primary_key_field": "id",
            "identity_code_field": "identity_code",
            "business_code_field": "receipt_no",
        },
        {
            "id": "idreg_pur_debit_note",
            "entity_type": "DEBIT_NOTE",
            "identity_group": "PROCUREMENT",
            "group_code": "PUR",
            "entity_code": "DN",
            "display_name": "Supplier Debit Note / Purchase Return Note",
            "description": "Supplier debit note for returns, damaged goods, or invoice adjustments",
            "identity_code_prefix": "PUR-DN",
            "database_table": "debit_notes",
            "primary_key_field": "id",
            "identity_code_field": None,
            "business_code_field": "debit_note_no",
        },
        {
            "id": "idreg_pur_bill",
            "entity_type": "PURCHASE_BILL",
            "identity_group": "PROCUREMENT",
            "group_code": "PUR",
            "entity_code": "BIL",
            "display_name": "Supplier Purchase Bill",
            "description": "Supplier commercial billing invoice posted against GRN or PO",
            "identity_code_prefix": "PUR-BIL",
            "database_table": "purchase_bills",
            "primary_key_field": "id",
            "identity_code_field": None,
            "business_code_field": "bill_no",
        },
    ]

    for tax in taxonomies:
        reg_exists = conn.execute(
            sa.text("SELECT 1 FROM smriti_identity_registry WHERE entity_type = :etype"),
            {"etype": tax["entity_type"]}
        ).scalar()

        if not reg_exists:
            conn.execute(
                sa.text(
                    "INSERT INTO smriti_identity_registry ("
                    "  id, uuid, entity_type, identity_group, group_code, entity_code, display_name, description, "
                    "  system_id_strategy, system_id_format, system_id_immutable, "
                    "  identity_code_enabled, identity_code_format, identity_code_prefix, identity_code_strategy, identity_code_scope, identity_code_immutable, "
                    "  business_code_enabled, business_code_field, business_code_strategy, "
                    "  tenant_scoped, company_scoped, branch_scoped, warehouse_scoped, "
                    "  database_table, primary_key_field, identity_code_field, "
                    "  status, is_active, version, registry_version"
                    ") VALUES ("
                    "  :id, :uuid, :entity_type, :identity_group, :group_code, :entity_code, :display_name, :description, "
                    "  'UUIDv7', 'UUID_HYPHENATED', true, "
                    "  true, '{group_code}-{entity_code}-{seq:08d}', :identity_code_prefix, 'SEQUENTIAL', 'TENANT', true, "
                    "  true, :business_code_field, 'DOCUMENT_SERIES', "
                    "  true, true, false, false, "
                    "  :database_table, :primary_key_field, :identity_code_field, "
                    "  'ACTIVE', true, 1, 1"
                    ")"
                ),
                {
                    "id": tax["id"],
                    "uuid": str(uuid.uuid4()),
                    "entity_type": tax["entity_type"],
                    "identity_group": tax["identity_group"],
                    "group_code": tax["group_code"],
                    "entity_code": tax["entity_code"],
                    "display_name": tax["display_name"],
                    "description": tax["description"],
                    "identity_code_prefix": tax["identity_code_prefix"],
                    "database_table": tax["database_table"],
                    "primary_key_field": tax["primary_key_field"],
                    "identity_code_field": tax["identity_code_field"],
                    "business_code_field": tax["business_code_field"],
                }
            )

    # Align PURCHASE_ORDER to TENANT scope to match table-level unique constraint
    conn.execute(
        sa.text(
            "UPDATE smriti_identity_registry "
            "SET identity_code_scope = 'TENANT' "
            "WHERE entity_type = 'PURCHASE_ORDER'"
        )
    )

    # =========================================================================
    # Step 3: Ensure sequence rows exist in smriti_numbering_registry
    # =========================================================================
    for tax in taxonomies:
        seq_row_exists = conn.execute(
            sa.text(
                "SELECT 1 FROM smriti_numbering_registry "
                "WHERE entity_type = :etype AND prefix = :pfx"
            ),
            {"etype": tax["entity_type"], "pfx": tax["identity_code_prefix"]}
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
                    "id": f"num_{tax['identity_code_prefix'].lower().replace('-', '_')}",
                    "uuid": str(uuid.uuid4()),
                    "etype": tax["entity_type"],
                    "igroup": tax["identity_group"],
                    "gcode": tax["group_code"],
                    "pfx": tax["identity_code_prefix"],
                }
            )


def downgrade() -> None:
    conn = op.get_bind()
    conn.execute(
        sa.text(
            "DELETE FROM smriti_identity_registry "
            "WHERE entity_type IN ('PURCHASE_RECEIPT', 'DEBIT_NOTE', 'PURCHASE_BILL')"
        )
    )
    conn.execute(
        sa.text(
            "DELETE FROM smriti_numbering_registry "
            "WHERE entity_type IN ('PURCHASE_RECEIPT', 'DEBIT_NOTE', 'PURCHASE_BILL')"
        )
    )
    op.execute("ALTER TABLE IF EXISTS purchase_receipts DROP COLUMN IF EXISTS identity_code;")
