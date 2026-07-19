-- Project      : SMRITI Retail OS
-- Author       : Jawahar Ramkripal Mallah
-- Email        : support@smritibooks.com
-- Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
-- Version      : 3.16.0
-- Created      : 2026-07-13
-- Modified     : 2026-07-13
-- Copyright    : © SMRITIBooks.com. All Rights Reserved.
-- License      : Proprietary Commercial Software

UPDATE attribute_definitions
SET valid_values = '["Black", "White", "Brown", "Red", "Blue", "CHIKKU"]'::jsonb
WHERE id = 'attr-color-84ec';

UPDATE attribute_definitions
SET valid_values = '["6", "7", "8", "9", "10", "11", "35", "36", "37", "38", "39", "40", "41"]'::jsonb
WHERE id = 'attr-size-f3c1';

INSERT INTO barcode_layouts (id, uuid, name, width_mm, height_mm, columns, is_default, elements_json, is_active, is_deleted, created_at, modified_at, created_by, updated_by, version)
VALUES ('lay-default-1', 'a0b1c2d3-e4f5-6a7b-8c9d-e0f1a2b3c4d5', 'Standard Product Label (50x25mm)', 50.00, 25.00, 1, true, '[{"type": "text", "x": 2, "y": 2, "field": "name", "label": "Product Name"}, {"type": "barcode", "x": 2, "y": 6, "field": "code", "label": "Barcode"}, {"type": "text", "x": 2, "y": 15, "field": "code", "label": "SKU Code"}, {"type": "text", "x": 2, "y": 19, "field": "price", "label": "Price"}, {"type": "text", "x": 18, "y": 19, "field": "mrp", "label": "MRP"}, {"type": "text", "x": 34, "y": 19, "field": "size", "label": "Size"}]', true, false, now(), now(), 'SYSADMIN', 'SYSADMIN', 1)
ON CONFLICT (id) DO NOTHING;

INSERT INTO barcode_layouts (id, uuid, name, width_mm, height_mm, columns, is_default, elements_json, is_active, is_deleted, created_at, modified_at, created_by, updated_by, version)
VALUES ('lay-premium-zpl', 'a0b1c2d3-e4f5-6a7b-8c9d-e0f1a2b3c4d9', 'Premium Footwear Label (100x50mm ZPL)', 100.00, 50.00, 1, false, '[]', true, false, now(), now(), 'SYSADMIN', 'SYSADMIN', 1)
ON CONFLICT (id) DO NOTHING;
