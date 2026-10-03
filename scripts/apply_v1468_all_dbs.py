"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 1.0.0
Created      : 2026-09-18
Modified     : 2026-09-18
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Canonical Schema Migration Runner
"""

import sys
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

DATABASES = ["smritisys", "smriti001", "smriti002"]
REVISION = "v1468_phase1_4_master_identity_index_and_resolver"
DOWN_REVISION = "v1467_phase1_3_external_partner_identity_integration"


async def apply_to_database(db_name: str):
    print(f"\n{'=' * 60}")
    print(f"APPLYING MIGRATION {REVISION} TO: {db_name}")
    print(f"{'=' * 60}")

    url = f"postgresql+asyncpg://postgres:postgres@localhost:5432/{db_name}"
    engine = create_async_engine(url)

    async with engine.begin() as conn:
        # Check current alembic version
        curr_ver = await conn.execute(text("SELECT version_num FROM alembic_version LIMIT 1"))
        ver = curr_ver.scalar()
        print(f"Current database version: {ver}")

        # Step 0: Make identity_code_field nullable on smriti_identity_registry
        await conn.execute(
            text("ALTER TABLE smriti_identity_registry ALTER COLUMN identity_code_field DROP NOT NULL;")
        )
        print("  [+] Altered smriti_identity_registry.identity_code_field to nullable")

        # 1. Register PAYMENT_TRANSACTION in smriti_identity_registry
        pay_exists = await conn.execute(
            text("SELECT 1 FROM smriti_identity_registry WHERE entity_type = 'PAYMENT_TRANSACTION'")
        )
        if not pay_exists.scalar():
            import uuid
            await conn.execute(
                text(
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
            print("  [+] Registered PAYMENT_TRANSACTION in smriti_identity_registry")
        else:
            print("  [.] PAYMENT_TRANSACTION already registered in smriti_identity_registry")

        # 2. Register STOCK_MOVEMENT in smriti_identity_registry
        mov_exists = await conn.execute(
            text("SELECT 1 FROM smriti_identity_registry WHERE entity_type = 'STOCK_MOVEMENT'")
        )
        if not mov_exists.scalar():
            import uuid
            await conn.execute(
                text(
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
            print("  [+] Registered STOCK_MOVEMENT in smriti_identity_registry")
        else:
            print("  [.] STOCK_MOVEMENT already registered in smriti_identity_registry")

        # 3. Create reverse lookup index on smriti_identity_allocation_log (canonical_id)
        alloc_idx = await conn.execute(
            text("SELECT 1 FROM pg_indexes WHERE tablename = 'smriti_identity_allocation_log' AND indexname = 'ix_smriti_alloc_log_canonical_id'")
        )
        if not alloc_idx.scalar():
            await conn.execute(
                text("CREATE INDEX ix_smriti_alloc_log_canonical_id ON smriti_identity_allocation_log (canonical_id);")
            )
            print("  [+] Created index ix_smriti_alloc_log_canonical_id on smriti_identity_allocation_log")
        else:
            print("  [.] Index ix_smriti_alloc_log_canonical_id already exists")

        # 4. Create functional lowercase index on smriti_identity_alias (LOWER(alias_code))
        alias_idx = await conn.execute(
            text("SELECT 1 FROM pg_indexes WHERE tablename = 'smriti_identity_alias' AND indexname = 'ix_smriti_alias_lower_code'")
        )
        if not alias_idx.scalar():
            await conn.execute(
                text("CREATE INDEX ix_smriti_alias_lower_code ON smriti_identity_alias (LOWER(alias_code));")
            )
            print("  [+] Created functional index ix_smriti_alias_lower_code on smriti_identity_alias")
        else:
            print("  [.] Index ix_smriti_alias_lower_code already exists")

        # 5. Update alembic_version
        await conn.execute(text(f"UPDATE alembic_version SET version_num = '{REVISION}'"))
        print(f"  [+] Updated alembic_version to: {REVISION}")

    await engine.dispose()
    print(f"SUCCESS: Database {db_name} upgraded to {REVISION}")


async def main():
    for db in DATABASES:
        await apply_to_database(db)


if __name__ == "__main__":
    asyncio.run(main())
