"""
v1000_inventory_kernel_v1.py — Alembic Migration DDL for Inventory Kernel v1.0.0

Level 1 Inventory Kernel — Core Data Model Tables:
  1. inventory_location_nodes       (InventoryLocationNode)
  2. inventory_identity_records     (InventoryIdentityRecord)
  3. inventory_ledger_entries       (InventoryLedgerEntry)       — append-only
  4. reservation_ledger_entries     (ReservationLedgerEntry)     — append-only
  5. cost_layer_ledger_entries      (CostLayerLedgerEntry)
  6. inventory_snapshot_records     (InventorySnapshotRecord)    — read-only projections
  7. document_posting_profiles      (DocumentPostingProfileRecord)

Revision ID: v1000_inventory_kernel_v1
Revises:     v900_replenishment_reorder
Create Date: 2026-08-03

Author       : Jawahar Ramkripal Mallah
Organization : SmritiSys
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

from alembic import op
import sqlalchemy as sa

revision = 'v1000_inventory_kernel_v1'
down_revision = 'v900_replenishment_reorder'
branch_labels = None
depends_on = None


def upgrade() -> None:

    # ─────────────────────────────────────────────────────────────────────────
    # 1. inventory_location_nodes
    #    Hierarchical network graph node (Warehouse, Store, Chain, Marketplace,
    #    Supplier, Factory, Transit, Consignment Partner, etc.)
    # ─────────────────────────────────────────────────────────────────────────
    op.execute("""
    CREATE TABLE IF NOT EXISTS inventory_location_nodes (
        id              VARCHAR(50)  PRIMARY KEY,
        uuid            VARCHAR(36)  NOT NULL UNIQUE,
        tenant_id       VARCHAR(50),
        company_id      VARCHAR(50)  REFERENCES companies(id) ON DELETE RESTRICT,
        branch_id       VARCHAR(50)  REFERENCES branches(id)  ON DELETE RESTRICT,

        code            VARCHAR(50)  NOT NULL,
        name            VARCHAR(200) NOT NULL,
        location_type   VARCHAR(50)  NOT NULL,
        ownership_type  VARCHAR(50)  NOT NULL DEFAULT 'COMPANY',
        parent_id       VARCHAR(50)  REFERENCES inventory_location_nodes(id) ON DELETE RESTRICT,
        tree_path       VARCHAR(512) NOT NULL DEFAULT '/',
        depth           INTEGER      NOT NULL DEFAULT 0,
        roles           TEXT[]       NOT NULL DEFAULT '{}',
        capabilities    TEXT[]       NOT NULL DEFAULT '{}',
        territory_path  VARCHAR(255),
        address         TEXT,
        is_active       BOOLEAN      NOT NULL DEFAULT TRUE,
        kpis            JSONB        NOT NULL DEFAULT '{}'::jsonb,

        created_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
        modified_at     TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
        created_by      VARCHAR(50),
        updated_by      VARCHAR(50),
        is_deleted      BOOLEAN      DEFAULT FALSE NOT NULL,
        deleted_at      TIMESTAMP WITH TIME ZONE,
        deleted_by      VARCHAR(50),
        version         INTEGER      DEFAULT 1 NOT NULL,
        workflow_status VARCHAR(50),
        document_number VARCHAR(100)
    );
    """)

    op.execute("CREATE INDEX IF NOT EXISTS idx_inv_loc_tree_path    ON inventory_location_nodes (tree_path);")
    op.execute("CREATE INDEX IF NOT EXISTS idx_inv_loc_type_owner   ON inventory_location_nodes (location_type, ownership_type);")
    op.execute("CREATE INDEX IF NOT EXISTS idx_inv_loc_company      ON inventory_location_nodes (company_id);")
    op.execute("CREATE INDEX IF NOT EXISTS idx_inv_loc_parent       ON inventory_location_nodes (parent_id);")

    # ─────────────────────────────────────────────────────────────────────────
    # 2. inventory_identity_records
    #    Centralized SKU / Batch / Serial / Lot identity master.
    #    Rule IIR-007: Once created, identity attributes are IMMUTABLE.
    # ─────────────────────────────────────────────────────────────────────────
    op.execute("""
    CREATE TABLE IF NOT EXISTS inventory_identity_records (
        id                  VARCHAR(50)  PRIMARY KEY,
        uuid                VARCHAR(36)  NOT NULL UNIQUE,
        tenant_id           VARCHAR(50),
        company_id          VARCHAR(50)  REFERENCES companies(id) ON DELETE RESTRICT,
        branch_id           VARCHAR(50)  REFERENCES branches(id)  ON DELETE RESTRICT,

        product_id          VARCHAR(50)  NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
        sku                 VARCHAR(100) NOT NULL,
        batch_no            VARCHAR(100),
        serial_no           VARCHAR(100),
        lot_no              VARCHAR(100),
        variant_attributes  JSONB        NOT NULL DEFAULT '{}'::jsonb,
        uom                 VARCHAR(30)  NOT NULL DEFAULT 'PCS',
        packaging_profile   VARCHAR(50),
        primary_barcode     VARCHAR(100),
        rfid_tag            VARCHAR(100),
        manufacturing_date  TIMESTAMP WITH TIME ZONE,
        expiry_date         TIMESTAMP WITH TIME ZONE,
        is_quarantined      BOOLEAN      NOT NULL DEFAULT FALSE,
        compliance_status   VARCHAR(50)  NOT NULL DEFAULT 'PASSED',

        created_at          TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
        modified_at         TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
        created_by          VARCHAR(50),
        updated_by          VARCHAR(50),
        is_active           BOOLEAN      DEFAULT TRUE NOT NULL,
        is_deleted          BOOLEAN      DEFAULT FALSE NOT NULL,
        deleted_at          TIMESTAMP WITH TIME ZONE,
        deleted_by          VARCHAR(50),
        version             INTEGER      DEFAULT 1 NOT NULL,
        workflow_status     VARCHAR(50),
        document_number     VARCHAR(100)
    );
    """)

    op.execute("CREATE INDEX IF NOT EXISTS idx_inv_identity_sku_batch ON inventory_identity_records (sku, batch_no);")
    op.execute("CREATE INDEX IF NOT EXISTS idx_inv_identity_serial     ON inventory_identity_records (serial_no);")
    op.execute("CREATE INDEX IF NOT EXISTS idx_inv_identity_product    ON inventory_identity_records (product_id);")
    op.execute("CREATE INDEX IF NOT EXISTS idx_inv_identity_barcode    ON inventory_identity_records (primary_barcode);")
    op.execute("CREATE INDEX IF NOT EXISTS idx_inv_identity_expiry     ON inventory_identity_records (expiry_date);")

    # ─────────────────────────────────────────────────────────────────────────
    # 3. inventory_ledger_entries
    #    Immutable append-only physical stock movement ledger.
    #    Rule LIM-006: NEVER update or delete rows. Corrections via reversal entries only.
    # ─────────────────────────────────────────────────────────────────────────
    op.execute("""
    CREATE TABLE IF NOT EXISTS inventory_ledger_entries (
        id                  VARCHAR(50)  PRIMARY KEY,
        uuid                VARCHAR(36)  NOT NULL UNIQUE,
        tenant_id           VARCHAR(50),
        company_id          VARCHAR(50)  REFERENCES companies(id) ON DELETE RESTRICT,
        branch_id           VARCHAR(50)  REFERENCES branches(id)  ON DELETE RESTRICT,

        entry_no            VARCHAR(100) NOT NULL UNIQUE,
        transaction_id      VARCHAR(100) NOT NULL,
        document_no         VARCHAR(100),
        from_location_id    VARCHAR(50)  REFERENCES inventory_location_nodes(id) ON DELETE RESTRICT,
        to_location_id      VARCHAR(50)  REFERENCES inventory_location_nodes(id) ON DELETE RESTRICT,
        product_id          VARCHAR(50)  NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
        sku                 VARCHAR(100) NOT NULL,
        quantity            NUMERIC(12, 4) NOT NULL,
        batch_no            VARCHAR(100),
        serial_no           VARCHAR(100),
        unit_cost           NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
        movement_type       VARCHAR(50)  NOT NULL,
        ownership_type      VARCHAR(50)  NOT NULL DEFAULT 'COMPANY',
        posting_profile_id  VARCHAR(50),
        posting_timestamp   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        is_reversal         BOOLEAN      NOT NULL DEFAULT FALSE,
        reversal_entry_id   VARCHAR(50),
        remarks             TEXT,

        created_at          TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
        modified_at         TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
        created_by          VARCHAR(50),
        updated_by          VARCHAR(50),
        is_active           BOOLEAN      DEFAULT TRUE NOT NULL,
        is_deleted          BOOLEAN      DEFAULT FALSE NOT NULL,
        deleted_at          TIMESTAMP WITH TIME ZONE,
        deleted_by          VARCHAR(50),
        version             INTEGER      DEFAULT 1 NOT NULL,
        workflow_status     VARCHAR(50),
        document_number     VARCHAR(100)
    );
    """)

    op.execute("CREATE INDEX IF NOT EXISTS idx_inv_ledger_loc_prod   ON inventory_ledger_entries (to_location_id, from_location_id, product_id);")
    op.execute("CREATE INDEX IF NOT EXISTS idx_inv_ledger_timestamp  ON inventory_ledger_entries (posting_timestamp);")
    op.execute("CREATE INDEX IF NOT EXISTS idx_inv_ledger_txn        ON inventory_ledger_entries (transaction_id);")
    op.execute("CREATE INDEX IF NOT EXISTS idx_inv_ledger_product    ON inventory_ledger_entries (product_id);")
    op.execute("CREATE INDEX IF NOT EXISTS idx_inv_ledger_company    ON inventory_ledger_entries (company_id);")

    # Immutability Guard: prevent UPDATE and DELETE on ledger entries
    op.execute("""
    CREATE OR REPLACE FUNCTION fn_inventory_ledger_immutability_guard()
    RETURNS TRIGGER AS $$
    BEGIN
        RAISE EXCEPTION
            'INVENTORY KERNEL RULE LIM-006 VIOLATION: InventoryLedgerEntry is immutable. '
            'Entry % cannot be modified or deleted. Post a compensating reversal entry instead.',
            OLD.entry_no;
    END;
    $$ LANGUAGE plpgsql;
    """)

    op.execute("""
    DROP TRIGGER IF EXISTS trg_inventory_ledger_immutability ON inventory_ledger_entries;
    """)

    op.execute("""
    CREATE TRIGGER trg_inventory_ledger_immutability
        BEFORE UPDATE OR DELETE ON inventory_ledger_entries
        FOR EACH ROW EXECUTE FUNCTION fn_inventory_ledger_immutability_guard();
    """)

    # ─────────────────────────────────────────────────────────────────────────
    # 4. reservation_ledger_entries
    #    Immutable append-only ATP reservation ledger.
    # ─────────────────────────────────────────────────────────────────────────
    op.execute("""
    CREATE TABLE IF NOT EXISTS reservation_ledger_entries (
        id                  VARCHAR(50)  PRIMARY KEY,
        uuid                VARCHAR(36)  NOT NULL UNIQUE,
        tenant_id           VARCHAR(50),
        company_id          VARCHAR(50)  REFERENCES companies(id) ON DELETE RESTRICT,
        branch_id           VARCHAR(50)  REFERENCES branches(id)  ON DELETE RESTRICT,

        entry_no            VARCHAR(100) NOT NULL UNIQUE,
        reservation_id      VARCHAR(100) NOT NULL,
        location_id         VARCHAR(50)  NOT NULL REFERENCES inventory_location_nodes(id) ON DELETE RESTRICT,
        product_id          VARCHAR(50)  NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
        sku                 VARCHAR(100) NOT NULL,
        channel_id          VARCHAR(50),
        reserved_qty        NUMERIC(12, 4) NOT NULL DEFAULT 0.0000,
        released_qty        NUMERIC(12, 4) NOT NULL DEFAULT 0.0000,
        allocated_qty       NUMERIC(12, 4) NOT NULL DEFAULT 0.0000,
        event_type          VARCHAR(50)  NOT NULL,
        status              VARCHAR(30)  NOT NULL DEFAULT 'ACTIVE',
        expires_at          TIMESTAMP WITH TIME ZONE,
        posting_timestamp   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,

        created_at          TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
        modified_at         TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
        created_by          VARCHAR(50),
        updated_by          VARCHAR(50),
        is_active           BOOLEAN      DEFAULT TRUE NOT NULL,
        is_deleted          BOOLEAN      DEFAULT FALSE NOT NULL,
        deleted_at          TIMESTAMP WITH TIME ZONE,
        deleted_by          VARCHAR(50),
        version             INTEGER      DEFAULT 1 NOT NULL,
        workflow_status     VARCHAR(50),
        document_number     VARCHAR(100)
    );
    """)

    op.execute("CREATE INDEX IF NOT EXISTS idx_res_ledger_reservation ON reservation_ledger_entries (reservation_id);")
    op.execute("CREATE INDEX IF NOT EXISTS idx_res_ledger_loc_prod    ON reservation_ledger_entries (location_id, product_id);")
    op.execute("CREATE INDEX IF NOT EXISTS idx_res_ledger_status      ON reservation_ledger_entries (status);")
    op.execute("CREATE INDEX IF NOT EXISTS idx_res_ledger_company     ON reservation_ledger_entries (company_id);")

    # ─────────────────────────────────────────────────────────────────────────
    # 5. cost_layer_ledger_entries
    #    Dedicated cost layers for FIFO, Moving Average, Weighted Average,
    #    Standard Cost, and Batch Costing.
    # ─────────────────────────────────────────────────────────────────────────
    op.execute("""
    CREATE TABLE IF NOT EXISTS cost_layer_ledger_entries (
        id                  VARCHAR(50)  PRIMARY KEY,
        uuid                VARCHAR(36)  NOT NULL UNIQUE,
        tenant_id           VARCHAR(50),
        company_id          VARCHAR(50)  REFERENCES companies(id) ON DELETE RESTRICT,
        branch_id           VARCHAR(50)  REFERENCES branches(id)  ON DELETE RESTRICT,

        entry_no            VARCHAR(100) NOT NULL UNIQUE,
        location_id         VARCHAR(50)  NOT NULL REFERENCES inventory_location_nodes(id) ON DELETE RESTRICT,
        product_id          VARCHAR(50)  NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
        sku                 VARCHAR(100) NOT NULL,
        costing_method      VARCHAR(30)  NOT NULL DEFAULT 'FIFO',
        unit_cost           NUMERIC(15, 2) NOT NULL,
        original_qty        NUMERIC(12, 4) NOT NULL,
        remaining_qty       NUMERIC(12, 4) NOT NULL,
        batch_no            VARCHAR(100),
        posting_timestamp   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,

        created_at          TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
        modified_at         TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
        created_by          VARCHAR(50),
        updated_by          VARCHAR(50),
        is_active           BOOLEAN      DEFAULT TRUE NOT NULL,
        is_deleted          BOOLEAN      DEFAULT FALSE NOT NULL,
        deleted_at          TIMESTAMP WITH TIME ZONE,
        deleted_by          VARCHAR(50),
        version             INTEGER      DEFAULT 1 NOT NULL,
        workflow_status     VARCHAR(50),
        document_number     VARCHAR(100)
    );
    """)

    op.execute("CREATE INDEX IF NOT EXISTS idx_cost_layer_loc_prod   ON cost_layer_ledger_entries (location_id, product_id);")
    op.execute("CREATE INDEX IF NOT EXISTS idx_cost_layer_method     ON cost_layer_ledger_entries (costing_method);")
    op.execute("CREATE INDEX IF NOT EXISTS idx_cost_layer_company    ON cost_layer_ledger_entries (company_id);")

    # ─────────────────────────────────────────────────────────────────────────
    # 6. inventory_snapshot_records
    #    Periodic read-only cached projections for high-speed queries and
    #    replay starting points. MUST NEVER be manually edited.
    # ─────────────────────────────────────────────────────────────────────────
    op.execute("""
    CREATE TABLE IF NOT EXISTS inventory_snapshot_records (
        id                  VARCHAR(50)  PRIMARY KEY,
        uuid                VARCHAR(36)  NOT NULL UNIQUE,
        tenant_id           VARCHAR(50),
        company_id          VARCHAR(50)  REFERENCES companies(id) ON DELETE RESTRICT,
        branch_id           VARCHAR(50)  REFERENCES branches(id)  ON DELETE RESTRICT,

        snapshot_code       VARCHAR(100) NOT NULL UNIQUE,
        snapshot_date       TIMESTAMP WITH TIME ZONE NOT NULL,
        snapshot_type       VARCHAR(30)  NOT NULL DEFAULT 'DAILY',
        location_id         VARCHAR(50)  NOT NULL REFERENCES inventory_location_nodes(id) ON DELETE RESTRICT,
        product_id          VARCHAR(50)  NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
        sku                 VARCHAR(100) NOT NULL,
        on_hand_qty         NUMERIC(12, 4) NOT NULL DEFAULT 0.0000,
        reserved_qty        NUMERIC(12, 4) NOT NULL DEFAULT 0.0000,
        available_qty       NUMERIC(12, 4) NOT NULL DEFAULT 0.0000,
        unit_cost           NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
        total_inventory_val NUMERIC(15, 2) NOT NULL DEFAULT 0.00,

        created_at          TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
        modified_at         TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
        created_by          VARCHAR(50),
        updated_by          VARCHAR(50),
        is_active           BOOLEAN      DEFAULT TRUE NOT NULL,
        is_deleted          BOOLEAN      DEFAULT FALSE NOT NULL,
        deleted_at          TIMESTAMP WITH TIME ZONE,
        deleted_by          VARCHAR(50),
        version             INTEGER      DEFAULT 1 NOT NULL,
        workflow_status     VARCHAR(50),
        document_number     VARCHAR(100)
    );
    """)

    op.execute("CREATE INDEX IF NOT EXISTS idx_inv_snap_loc_date  ON inventory_snapshot_records (location_id, snapshot_date);")
    op.execute("CREATE INDEX IF NOT EXISTS idx_inv_snap_product   ON inventory_snapshot_records (product_id);")
    op.execute("CREATE INDEX IF NOT EXISTS idx_inv_snap_company   ON inventory_snapshot_records (company_id);")

    # ─────────────────────────────────────────────────────────────────────────
    # 7. document_posting_profiles
    #    Declarative document-type-to-movement-type profile mappings.
    # ─────────────────────────────────────────────────────────────────────────
    op.execute("""
    CREATE TABLE IF NOT EXISTS document_posting_profiles (
        id                  VARCHAR(50)  PRIMARY KEY,
        uuid                VARCHAR(36)  NOT NULL UNIQUE,
        tenant_id           VARCHAR(50),
        company_id          VARCHAR(50)  REFERENCES companies(id) ON DELETE RESTRICT,
        branch_id           VARCHAR(50)  REFERENCES branches(id)  ON DELETE RESTRICT,

        profile_code        VARCHAR(50)  NOT NULL UNIQUE,
        document_type       VARCHAR(50)  NOT NULL,
        from_location_role  VARCHAR(50),
        to_location_role    VARCHAR(50),
        movement_type       VARCHAR(50)  NOT NULL,
        ownership_type      VARCHAR(50)  NOT NULL DEFAULT 'COMPANY',
        is_active           BOOLEAN      NOT NULL DEFAULT TRUE,
        description         TEXT,

        created_at          TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
        modified_at         TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
        created_by          VARCHAR(50),
        updated_by          VARCHAR(50),
        is_deleted          BOOLEAN      DEFAULT FALSE NOT NULL,
        deleted_at          TIMESTAMP WITH TIME ZONE,
        deleted_by          VARCHAR(50),
        version             INTEGER      DEFAULT 1 NOT NULL,
        workflow_status     VARCHAR(50),
        document_number     VARCHAR(100)
    );
    """)

    op.execute("CREATE INDEX IF NOT EXISTS idx_doc_posting_doc_type ON document_posting_profiles (document_type);")
    op.execute("CREATE INDEX IF NOT EXISTS idx_doc_posting_company  ON document_posting_profiles (company_id);")

    # ─────────────────────────────────────────────────────────────────────────
    # Seed standard Document Posting Profiles
    # ─────────────────────────────────────────────────────────────────────────
    op.execute("INSERT INTO document_posting_profiles (id, uuid, profile_code, document_type, from_location_role, to_location_role, movement_type, ownership_type, is_active, description) VALUES ('DPP-GRN', gen_random_uuid()::text, 'GRN-INBOUND', 'PURCHASE_RECEIPT', NULL, 'WAREHOUSE', 'PURCHASE', 'COMPANY', TRUE, 'Goods Receipt Note — inbound stock') ON CONFLICT (profile_code) DO NOTHING;")
    op.execute("INSERT INTO document_posting_profiles (id, uuid, profile_code, document_type, from_location_role, to_location_role, movement_type, ownership_type, is_active, description) VALUES ('DPP-SALE', gen_random_uuid()::text, 'SALE-OUTBOUND', 'SALES_INVOICE', 'WAREHOUSE', NULL, 'SALE', 'COMPANY', TRUE, 'Sales Invoice — outbound stock dispatch') ON CONFLICT (profile_code) DO NOTHING;")
    op.execute("INSERT INTO document_posting_profiles (id, uuid, profile_code, document_type, from_location_role, to_location_role, movement_type, ownership_type, is_active, description) VALUES ('DPP-POS', gen_random_uuid()::text, 'POS-OUTBOUND', 'POS_RECEIPT', 'STORE', NULL, 'POS_SALE', 'COMPANY', TRUE, 'POS checkout — quick-sale outbound') ON CONFLICT (profile_code) DO NOTHING;")
    op.execute("INSERT INTO document_posting_profiles (id, uuid, profile_code, document_type, from_location_role, to_location_role, movement_type, ownership_type, is_active, description) VALUES ('DPP-TR-OUT', gen_random_uuid()::text, 'TRANSFER-OUTBOUND', 'TRANSFER_ORDER', 'SOURCE', 'TRANSIT', 'TRANSFER_OUT', 'COMPANY', TRUE, 'Transfer Order — outbound from source') ON CONFLICT (profile_code) DO NOTHING;")
    op.execute("INSERT INTO document_posting_profiles (id, uuid, profile_code, document_type, from_location_role, to_location_role, movement_type, ownership_type, is_active, description) VALUES ('DPP-TR-IN', gen_random_uuid()::text, 'TRANSFER-INBOUND', 'TRANSFER_ORDER', 'TRANSIT', 'TARGET', 'TRANSFER_IN', 'COMPANY', TRUE, 'Transfer Order — inbound at target') ON CONFLICT (profile_code) DO NOTHING;")
    op.execute("INSERT INTO document_posting_profiles (id, uuid, profile_code, document_type, from_location_role, to_location_role, movement_type, ownership_type, is_active, description) VALUES ('DPP-ADJ', gen_random_uuid()::text, 'ADJUSTMENT', 'STOCK_COUNT_AUDIT', NULL, 'WAREHOUSE', 'ADJUSTMENT', 'COMPANY', TRUE, 'Physical stock count variance adjustment') ON CONFLICT (profile_code) DO NOTHING;")
    op.execute("INSERT INTO document_posting_profiles (id, uuid, profile_code, document_type, from_location_role, to_location_role, movement_type, ownership_type, is_active, description) VALUES ('DPP-SALERET', gen_random_uuid()::text, 'SALE-RETURN', 'SALES_RETURN', NULL, 'WAREHOUSE', 'SALE_RETURN', 'COMPANY', TRUE, 'Sales Return — stock restoration') ON CONFLICT (profile_code) DO NOTHING;")
    op.execute("INSERT INTO document_posting_profiles (id, uuid, profile_code, document_type, from_location_role, to_location_role, movement_type, ownership_type, is_active, description) VALUES ('DPP-PURCHRET', gen_random_uuid()::text, 'PURCHASE-RETURN', 'PURCHASE_RETURN', 'WAREHOUSE', NULL, 'PURCHASE_RETURN', 'COMPANY', TRUE, 'Purchase Debit Note — stock deduction') ON CONFLICT (profile_code) DO NOTHING;")
    op.execute("INSERT INTO document_posting_profiles (id, uuid, profile_code, document_type, from_location_role, to_location_role, movement_type, ownership_type, is_active, description) VALUES ('DPP-CONS-OUT', gen_random_uuid()::text, 'CONSIGNMENT-OUT', 'CONSIGNMENT_DISPATCH', 'WAREHOUSE', 'PARTNER', 'TRANSFER_OUT', 'COMPANY', TRUE, 'Consignment dispatch to partner') ON CONFLICT (profile_code) DO NOTHING;")
    op.execute("INSERT INTO document_posting_profiles (id, uuid, profile_code, document_type, from_location_role, to_location_role, movement_type, ownership_type, is_active, description) VALUES ('DPP-CONS-IN', gen_random_uuid()::text, 'CONSIGNMENT-RETURN', 'CONSIGNMENT_RETURN', 'PARTNER', 'WAREHOUSE', 'TRANSFER_IN', 'COMPANY', TRUE, 'Unsold consignment return to warehouse') ON CONFLICT (profile_code) DO NOTHING;")


def downgrade() -> None:
    # Drop triggers first
    op.execute("DROP TRIGGER IF EXISTS trg_inventory_ledger_immutability ON inventory_ledger_entries;")
    op.execute("DROP FUNCTION IF EXISTS fn_inventory_ledger_immutability_guard();")

    # Drop tables in reverse dependency order
    op.execute("DROP TABLE IF EXISTS document_posting_profiles CASCADE;")
    op.execute("DROP TABLE IF EXISTS inventory_snapshot_records CASCADE;")
    op.execute("DROP TABLE IF EXISTS cost_layer_ledger_entries CASCADE;")
    op.execute("DROP TABLE IF EXISTS reservation_ledger_entries CASCADE;")
    op.execute("DROP TABLE IF EXISTS inventory_ledger_entries CASCADE;")
    op.execute("DROP TABLE IF EXISTS inventory_identity_records CASCADE;")
    op.execute("DROP TABLE IF EXISTS inventory_location_nodes CASCADE;")
