"""
Project      : SMRITI Retail OS
Organization : SmritiSys
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.29.0
Created      : 2026-08-02
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal

Merge RC2 Inventory Kernel — Consolidate Alembic Heads
======================================================

Revision ID  : merge_rc2_inventory_kernel
Revises      : 35d215f3c4b8, v1332_gst_rate_slabs
Create Date  : 2026-08-02

Purpose
-------
This merge revision resolves the two independent Alembic HEAD branches that
existed at RC2 close:

    35d215f3c4b8  (Inventory trigger fix, parent: 89221f5f1969)
    v1332_gst_rate_slabs  (GST rate constraint, parent: v1331_scdm_policy_snapshot)

After this migration, `alembic heads` returns exactly ONE revision:

    merge_rc2_inventory_kernel  (head)

This is the canonical single-head required for:
    - Docker container startup (alembic upgrade head)
    - CI/CD pipeline determinism
    - Fresh install correctness
    - Customer upgrade safety

Architecture Upgrade — Platform Trigger Evolution
-------------------------------------------------
This revision also evolves the DB trigger from inventory-specific to a
platform-level Inventory State Engine trigger:

    BEFORE: reconcile_product_stock_trigger()
            trg_reconcile_product_stock

    AFTER : inventory_state_reconciliation_trigger()
            trg_inventory_state_reconciliation

The new name reflects that the trigger belongs to the Inventory State Engine
and will eventually reconcile reserved, allocated, transit, channel, and
damaged stock — not only physical on-hand stock.

Platform Rule (FROZEN — Inventory Kernel v1.0)
----------------------------------------------
No engine may update `products.stock` directly except through the
Inventory State reconciliation pipeline. This trigger is the sole
canonical write path to physical on-hand stock.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "merge_rc2_inventory_kernel"
down_revision: Union[str, Sequence[str], None] = ("35d215f3c4b8", "v1332_gst_rate_slabs")
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """
    Upgrade: Evolve DB trigger to platform-level Inventory State reconciliation trigger.

    1. Drop legacy trigger binding (trg_reconcile_product_stock)
    2. Drop legacy trigger function (reconcile_product_stock_trigger)
    3. Create evolved platform trigger function (inventory_state_reconciliation_trigger)
       - Reads movement behavior flags from movement_type
       - Currently updates physical on-hand stock only (RC2 baseline)
       - Architecture is forward-compatible for reserved/transit/channel updates
    4. Bind evolved trigger (trg_inventory_state_reconciliation)
    """

    # Step 1: Drop legacy trigger binding
    op.execute(sa.text(
        "DROP TRIGGER IF EXISTS trg_reconcile_product_stock ON stock_movements;"
    ))

    # Step 2: Drop legacy trigger function
    op.execute(sa.text(
        "DROP FUNCTION IF EXISTS reconcile_product_stock_trigger();"
    ))

    # Step 3: Create platform-level Inventory State reconciliation trigger function
    #
    # Movement types that affect PHYSICAL ON-HAND stock (RC2 frozen taxonomy):
    #   Physical:  PURCHASE, PURCHASE_RETURN, SALE, SALE_RETURN,
    #              TRANSFER_IN, TRANSFER_OUT, ADJUSTMENT, PRODUCTION, OPENING
    #   Legacy:    IN, OUT, TRANSFER, RETURN
    #              (retained for backward compatibility with existing movement records)
    #
    # Direction encoding:
    #   +delta : PURCHASE, IN, PRODUCTION, OPENING, PURCHASE_RETURN,
    #            SALE_RETURN, RETURN, TRANSFER_IN
    #   -delta : SALE, OUT, TRANSFER_OUT, TRANSFER
    #   ±delta : ADJUSTMENT (quantity already carries sign)
    #
    # Future RC3+ movement types (RESERVE, UNRESERVE, ALLOCATE, etc.) will
    # affect reserved/channel/transit columns — NOT products.stock — and will
    # be dispatched through this same trigger using the MovementTypeRegistry.
    op.execute(sa.text("""
        CREATE OR REPLACE FUNCTION inventory_state_reconciliation_trigger()
        RETURNS TRIGGER AS $$
        DECLARE
            delta            numeric := 0;
            movement_type    text;
            -- Physical ON-HAND movement types (RC2 Frozen Taxonomy)
            physical_inbound  text[] := ARRAY[
                'PURCHASE', 'SALE_RETURN',
                'TRANSFER_IN', 'PRODUCTION', 'OPENING',
                'IN', 'RETURN'
            ];
            physical_outbound text[] := ARRAY[
                'SALE', 'PURCHASE_RETURN', 'TRANSFER_OUT',
                'OUT', 'TRANSFER'
            ];
            physical_adjustment text[] := ARRAY['ADJUSTMENT'];
        BEGIN
            -- ---------------------------------------------------------------
            -- INSERT: new movement record posted
            -- ---------------------------------------------------------------
            IF TG_OP = 'INSERT' THEN
                movement_type := COALESCE(UPPER(NEW.movement_type), '');

                IF movement_type = ANY(physical_inbound) THEN
                    delta := ABS(NEW.quantity);
                ELSIF movement_type = ANY(physical_outbound) THEN
                    delta := -ABS(NEW.quantity);
                ELSIF movement_type = ANY(physical_adjustment) THEN
                    delta := NEW.quantity;  -- signed; caller controls direction
                END IF;

            -- ---------------------------------------------------------------
            -- UPDATE: quantity or movement_type corrected
            -- ---------------------------------------------------------------
            ELSIF TG_OP = 'UPDATE' THEN
                movement_type := COALESCE(UPPER(NEW.movement_type), '');

                IF movement_type = ANY(physical_inbound) THEN
                    delta := ABS(NEW.quantity) - ABS(OLD.quantity);
                ELSIF movement_type = ANY(physical_outbound) THEN
                    delta := -(ABS(NEW.quantity) - ABS(OLD.quantity));
                ELSIF movement_type = ANY(physical_adjustment) THEN
                    delta := NEW.quantity - OLD.quantity;
                END IF;

            -- ---------------------------------------------------------------
            -- DELETE: movement record voided / rolled back
            -- ---------------------------------------------------------------
            ELSIF TG_OP = 'DELETE' THEN
                movement_type := COALESCE(UPPER(OLD.movement_type), '');

                IF movement_type = ANY(physical_inbound) THEN
                    delta := -ABS(OLD.quantity);
                ELSIF movement_type = ANY(physical_outbound) THEN
                    delta := ABS(OLD.quantity);
                ELSIF movement_type = ANY(physical_adjustment) THEN
                    delta := -OLD.quantity;
                END IF;
            END IF;

            -- Apply delta to products.stock only when non-zero
            IF delta <> 0 THEN
                UPDATE products
                SET stock = stock + delta
                WHERE id = COALESCE(NEW.product_id, OLD.product_id);
            END IF;

            RETURN NULL;  -- AFTER trigger; return value ignored
        END;
        $$ LANGUAGE plpgsql;
    """))

    # Step 4: Bind evolved platform trigger
    op.execute(sa.text("""
        CREATE TRIGGER trg_inventory_state_reconciliation
        AFTER INSERT OR UPDATE OR DELETE ON stock_movements
        FOR EACH ROW
        EXECUTE FUNCTION inventory_state_reconciliation_trigger();
    """))


def downgrade() -> None:
    """
    Downgrade: Restore legacy trigger (reconcile_product_stock_trigger).
    NOTE: This restores the RC2 pre-merge state. Both Alembic heads will
    reappear after downgrading both branches independently.
    """

    # Remove evolved trigger
    op.execute(sa.text(
        "DROP TRIGGER IF EXISTS trg_inventory_state_reconciliation ON stock_movements;"
    ))
    op.execute(sa.text(
        "DROP FUNCTION IF EXISTS inventory_state_reconciliation_trigger();"
    ))

    # Restore legacy trigger function (matches 35d215f3c4b8 upgrade state)
    op.execute(sa.text("""
        CREATE OR REPLACE FUNCTION reconcile_product_stock_trigger()
        RETURNS TRIGGER AS $$
        DECLARE
            delta numeric := 0;
            movement_type text;
            physical_types text[] := ARRAY[
                'IN', 'OUT', 'TRANSFER', 'ADJUSTMENT',
                'PRODUCTION', 'PURCHASE', 'SALES', 'RETURN'
            ];
        BEGIN
            IF TG_OP = 'INSERT' THEN
                movement_type := COALESCE(UPPER(NEW.movement_type), '');
                IF movement_type = ANY(physical_types) THEN
                    IF movement_type = 'IN' THEN delta := NEW.quantity;
                    ELSIF movement_type = 'OUT' THEN delta := -ABS(NEW.quantity);
                    ELSIF movement_type = 'ADJUSTMENT' THEN delta := NEW.quantity;
                    ELSIF movement_type = 'TRANSFER' THEN delta := -ABS(NEW.quantity);
                    ELSIF movement_type = 'PRODUCTION' THEN delta := NEW.quantity;
                    ELSIF movement_type = 'PURCHASE' THEN delta := NEW.quantity;
                    ELSIF movement_type = 'SALES' THEN delta := -ABS(NEW.quantity);
                    ELSIF movement_type = 'RETURN' THEN delta := NEW.quantity;
                    END IF;
                END IF;
            ELSIF TG_OP = 'UPDATE' THEN
                movement_type := COALESCE(UPPER(NEW.movement_type), '');
                IF movement_type = ANY(physical_types) THEN
                    IF movement_type = 'IN' THEN delta := NEW.quantity - OLD.quantity;
                    ELSIF movement_type = 'OUT' THEN delta := ABS(OLD.quantity) - ABS(NEW.quantity);
                    ELSIF movement_type = 'ADJUSTMENT' THEN delta := NEW.quantity - OLD.quantity;
                    ELSIF movement_type = 'TRANSFER' THEN delta := ABS(OLD.quantity) - ABS(NEW.quantity);
                    ELSIF movement_type = 'PRODUCTION' THEN delta := NEW.quantity - OLD.quantity;
                    ELSIF movement_type = 'PURCHASE' THEN delta := NEW.quantity - OLD.quantity;
                    ELSIF movement_type = 'SALES' THEN delta := ABS(OLD.quantity) - ABS(NEW.quantity);
                    ELSIF movement_type = 'RETURN' THEN delta := NEW.quantity - OLD.quantity;
                    END IF;
                END IF;
            ELSIF TG_OP = 'DELETE' THEN
                movement_type := COALESCE(UPPER(OLD.movement_type), '');
                IF movement_type = ANY(physical_types) THEN
                    IF movement_type = 'IN' THEN delta := -OLD.quantity;
                    ELSIF movement_type = 'OUT' THEN delta := ABS(OLD.quantity);
                    ELSIF movement_type = 'ADJUSTMENT' THEN delta := -OLD.quantity;
                    ELSIF movement_type = 'TRANSFER' THEN delta := ABS(OLD.quantity);
                    ELSIF movement_type = 'PRODUCTION' THEN delta := -OLD.quantity;
                    ELSIF movement_type = 'PURCHASE' THEN delta := -OLD.quantity;
                    ELSIF movement_type = 'SALES' THEN delta := ABS(OLD.quantity);
                    ELSIF movement_type = 'RETURN' THEN delta := -OLD.quantity;
                    END IF;
                END IF;
            END IF;

            IF delta <> 0 THEN
                UPDATE products
                SET stock = stock + delta
                WHERE id = COALESCE(NEW.product_id, OLD.product_id);
            END IF;

            RETURN NULL;
        END;
        $$ LANGUAGE plpgsql;
    """))

    op.execute(sa.text("""
        CREATE TRIGGER trg_reconcile_product_stock
        AFTER INSERT OR UPDATE OR DELETE ON stock_movements
        FOR EACH ROW
        EXECUTE FUNCTION reconcile_product_stock_trigger();
    """))
