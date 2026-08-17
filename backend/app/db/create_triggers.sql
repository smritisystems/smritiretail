-- Project      : SMRITI Retail OS
-- Author       : Jawahar Ramkripal Mallah
-- Email        : support@smritibooks.com
-- Websites     : smritibooks.com | erpnbook.com | aitdl.com
-- Version      : 3.21.0
-- Created      : 2026-08-16
-- Copyright    : © SMRITIBooks.com. All Rights Reserved.
-- License      : Proprietary Commercial Software

CREATE OR REPLACE FUNCTION fn_reconcile_inventory_state()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE products
    SET stock = COALESCE(stock, 0) + NEW.quantity
    WHERE id = NEW.product_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_inventory_state_reconciliation ON stock_movements;

CREATE TRIGGER trg_inventory_state_reconciliation
AFTER INSERT ON stock_movements
FOR EACH ROW
EXECUTE FUNCTION fn_reconcile_inventory_state();
