"""Phase 1.4: Master Identity Index & Universal Cross-Domain Entity Resolver

Revision ID: v1468_phase1_4_master_identity_index_and_resolver
Revises: v1467_phase1_3_external_partner_identity_integration
Create Date: 2026-09-18 12:00:00.000000

Governance Standard: AGENTS.md Rules 1-12, UADHP-v1.0
Author: Jawahar Ramkripal Mallah, Chief Systems Architect & Creator
Copyright: © SMRITIBooks.com. All Rights Reserved.
License: Proprietary Commercial Software
Classification: Internal Core Architecture

Scope of Migration:
1. Make identity_code_field nullable on smriti_identity_registry to properly model ledger boundary tables
   where identity_code_enabled=False.
2. Register PAYMENT_TRANSACTION in smriti_identity_registry (FIN-PAY, high-throughput ledger boundary,
   identity_code_enabled=False, system_id_strategy='UUIDv7', business_code_field='transaction_no').
3. Register STOCK_MOVEMENT in smriti_identity_registry (INV-MOV, high-throughput ledger boundary,
   identity_code_enabled=False, system_id_strategy='UUIDv7').
4. Create performance index ix_smriti_alloc_log_canonical_id on smriti_identity_allocation_log (canonical_id)
   to accelerate reverse identity lookups and unscoped Tier 3 technical ID resolution.
5. Create functional performance index ix_smriti_alias_lower_code on smriti_identity_alias (LOWER(alias_code))
   to accelerate case-insensitive external reference matching.
"""

from alembic import op
import sqlalchemy as sa
import uuid

# revision identifiers, used by Alembic.
revision = 'v1468_phase1_4_master_identity_index_and_resolver'
down_revision = 'v1467_phase1_3_external_partner_identity_integration'
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()

    # =========================================================================
    # Step 0: Make identity_code_field nullable for ledger boundary tables
    # =========================================================================
    op.alter_column('smriti_identity_registry', 'identity_code_field', nullable=True)

    # =========================================================================
    # Step 1: Register High-Throughput Ledger Taxonomies in smriti_identity_registry
    # =========================================================================

    # 1.1 Register PAYMENT_TRANSACTION
    pay_exists = conn.execute(
        sa.text("SELECT 1 FROM smriti_identity_registry WHERE entity_type = 'PAYMENT_TRANSACTION'")
    ).scalar()

    if not pay_exists:
        conn.execute(
            sa.text(
                "INSERT INTO smriti_identity_registry ("
                "  id, uuid, entity_type, entity_code, identity_group, group_code, display_name, description, "
                "  system_id_strategy, system_id_format, system_id_immutable, "
                "  identity_code_enabled, identity_code_format, identity_code_prefix, identity_code_strategy, identity_code_scope, identity_code_immutable, "
                "  business_code_enabled, business_code_field, business_code_strategy, "
                "  tenant_scoped, company_scoped, branch_scoped, warehouse_scoped, "
                "  database_table, primary_key_field, identity_code_field, "
                "  user_visible, searchable, status, registry_version, is_active, is_deleted, version"
                ") VALUES ("
                "  'reg_fin_payment_tx', :uuid, 'PAYMENT_TRANSACTION', 'PAY', 'FINANCIAL', 'FIN', 'Payment Settlement Transaction', 'High-throughput financial tender settlement transaction ledger', "
                "  'UUIDv7', 'UUID_HYPHENATED', true, "
                "  false, '{group_code}-{entity_code}-{seq:08d}', 'FIN-PAY', 'TECHNICAL_UUID', 'TENANT', true, "
                "  true, 'transaction_no', 'SYSTEM_GENERATED', "
                "  true, true, true, false, "
                "  'payment_transactions', 'id', NULL, "
                "  true, true, 'ACTIVE', 1, true, false, 1"
                ")"
            ),
            {"uuid": str(uuid.uuid4())},
        )

    # 1.2 Register STOCK_MOVEMENT
    mov_exists = conn.execute(
        sa.text("SELECT 1 FROM smriti_identity_registry WHERE entity_type = 'STOCK_MOVEMENT'")
    ).scalar()

    if not mov_exists:
        conn.execute(
            sa.text(
                "INSERT INTO smriti_identity_registry ("
                "  id, uuid, entity_type, entity_code, identity_group, group_code, display_name, description, "
                "  system_id_strategy, system_id_format, system_id_immutable, "
                "  identity_code_enabled, identity_code_format, identity_code_prefix, identity_code_strategy, identity_code_scope, identity_code_immutable, "
                "  business_code_enabled, business_code_field, business_code_strategy, "
                "  tenant_scoped, company_scoped, branch_scoped, warehouse_scoped, "
                "  database_table, primary_key_field, identity_code_field, "
                "  user_visible, searchable, status, registry_version, is_active, is_deleted, version"
                ") VALUES ("
                "  'reg_inv_stock_movement', :uuid, 'STOCK_MOVEMENT', 'MOV', 'INVENTORY', 'INV', 'Stock Inventory Movement', 'High-throughput perpetual inventory stock movement ledger', "
                "  'UUIDv7', 'UUID_HYPHENATED', true, "
                "  false, '{group_code}-{entity_code}-{seq:08d}', 'INV-MOV', 'TECHNICAL_UUID', 'TENANT', true, "
                "  false, NULL, 'NONE', "
                "  true, true, true, false, "
                "  'stock_movements', 'id', NULL, "
                "  true, false, 'ACTIVE', 1, true, false, 1"
                ")"
            ),
            {"uuid": str(uuid.uuid4())},
        )

    # =========================================================================
    # Step 2: Create Reverse-Lookup and Performance Optimization Indexes
    # =========================================================================

    # 2.1 Index on smriti_identity_allocation_log (canonical_id)
    alloc_idx_exists = conn.execute(
        sa.text(
            "SELECT 1 FROM pg_indexes "
            "WHERE tablename = 'smriti_identity_allocation_log' AND indexname = 'ix_smriti_alloc_log_canonical_id'"
        )
    ).scalar()

    if not alloc_idx_exists:
        op.create_index(
            'ix_smriti_alloc_log_canonical_id',
            'smriti_identity_allocation_log',
            ['canonical_id'],
            unique=False,
        )

    # 2.2 Functional Lowercase Index on smriti_identity_alias (LOWER(alias_code))
    alias_lower_idx_exists = conn.execute(
        sa.text(
            "SELECT 1 FROM pg_indexes "
            "WHERE tablename = 'smriti_identity_alias' AND indexname = 'ix_smriti_alias_lower_code'"
        )
    ).scalar()

    if not alias_lower_idx_exists:
        op.execute(
            "CREATE INDEX ix_smriti_alias_lower_code ON smriti_identity_alias (LOWER(alias_code));"
        )


def downgrade() -> None:
    conn = op.get_bind()

    # Drop indexes
    op.execute("DROP INDEX IF EXISTS ix_smriti_alias_lower_code;")
    op.execute("DROP INDEX IF EXISTS ix_smriti_alloc_log_canonical_id;")

    # Remove registered taxonomies
    conn.execute(
        sa.text("DELETE FROM smriti_identity_registry WHERE entity_type IN ('PAYMENT_TRANSACTION', 'STOCK_MOVEMENT')")
    )
