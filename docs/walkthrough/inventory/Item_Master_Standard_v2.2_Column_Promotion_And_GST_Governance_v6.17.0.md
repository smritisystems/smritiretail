<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.17.0
  Created      : 2026-09-28
  Modified     : 2026-09-28
  Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: Item Master v2.2 Alignment — 13 Promoted Columns, IM-008/009, GST Slab Governance

**Version:** 6.17.0
**Date:** 2026-09-28
**Author:** Jawahar Ramkripal Mallah — Chief Systems Architect & Creator
**Commits:** `9dd5f6f9`, `d76cd55f`

---

## 1. Purpose

Align the SMRITI Item Master system with the authoritative reference defined in
`SMRITI_Item_Master_Creation_Standard_v2.2.xlsx`. This walkthrough formalises the
engineering work required to promote 8 footwear-specific attributes from an opaque
`attributes_json` blob into first-class, indexed, query-ready SQL columns; introduce
3 business-logic flags; add 2 workflow-tracking columns; enforce IM-008 (Y/N gate)
and IM-009 (service/inventory exclusion) at the import pipeline level; and add
statutory GST slab governance (0%, 5%, 12%, 18%) as an IM-001 controlled dimension.

---

## 2. Scope

| Layer | Files Touched |
|---|---|
| Data Model | `backend/app/models/item_master.py` |
| Schema / DTO | `backend/app/schemas/item_master.py` |
| Service Layer | `backend/app/services/item_master_svc.py` |
| Import Pipeline | `backend/app/api/v1/universal_import.py` |
| Database Migration | `backend/alembic/versions/v1495_item_master_v22_columns.py` |
| Excel Remediation | `scripts/remediate_item_master_standard.py` |
| Master Value Seeder | `scripts/seed_master_values_from_standard.py` |
| Reference Asset | `assets/Itemmasters/SMRITI_Item_Master_Creation_Standard_v2.2.xlsx` |

---

## 3. Files Created

| File | Purpose |
|---|---|
| `backend/alembic/versions/v1495_item_master_v22_columns.py` | Alembic migration: ADD COLUMN x13 + JSON backfill + indexes |

---

## 4. Files Modified

| File | Change Summary |
|---|---|
| `backend/app/models/item_master.py` | +13 new `Column()` definitions on `Item` model |
| `backend/app/schemas/item_master.py` | +13 Pydantic fields, IM-009 `model_validator`, `landed_cost_price` alias |
| `backend/app/services/item_master_svc.py` | Both `create_item()` paths now write the 13 new columns |
| `backend/app/api/v1/universal_import.py` | v2.2 field extraction, IM-008/009 enforcement, GST_RATE_PERCENT in IM-001, v2.1→v2.2 all references |
| `scripts/remediate_item_master_standard.py` | Added GST_RATE_PERCENT col T to Validation Lists; BLOCK DataValidation on col AA |
| `scripts/seed_master_values_from_standard.py` | Added `GST_RATE_PERCENT` → `gst_rate` dimension to seeder map |

---

## 5. Architecture Decisions

1. **Promote, not migrate away from `attributes_json`**: The JSONB blob is retained for
   non-standard pass-through keys. The 8 promoted fields get their own `VARCHAR(100)`
   columns — queryable, indexable, schema-enforced.

2. **IM-008 enforced at pipeline entry, not ORM layer**: Y/N parsing is a pure-Python
   gate raising `HTTPException 422` immediately on a bad value. This keeps the ORM
   clean of format concerns.

3. **IM-009 as a boolean coercion, not a validation error**: `is_service=True`
   automatically sets `is_inventory=False` rather than blocking the row. This matches
   the retailer UX expectation (service items silently become non-inventory).

4. **GST as an IM-001 controlled dimension**: Statutory slabs (0/5/12/18) are governed
   by `master_values` → `gst_rate` type, not hardcoded. Future slab changes (e.g.
   a new 3% slab for specific HSN) require only a DB record, not a code change.

5. **Alembic JSON backfill**: A single `UPDATE items SET col = attributes_json ->> 'key'`
   per column promotes existing data in one DDL transaction — zero-downtime, no ETL script.

---

## 6. Design Rationale

The v2.1 standard had 36 template columns but only ~12 mapped to DB columns. The rest
lived in `attributes_json`, making queries like "all LADIES HEEL shoes" require a JSONB
`@>` operator or GIN index rather than a simple `WHERE gender = 'LADIES'`. Promotion
enables:
- Direct `GROUP BY gender` analytics
- `ix_items_gender` and `ix_items_product_type` indexes for POS search
- IM-001 validation feedback at the correct field name, not an opaque JSON path

---

## 7. Implementation Summary

### Phase 1 — Model (`item_master.py`)
Added 13 columns to the `Item` SQLAlchemy model:

**Promoted attributes:** `gender`, `purchase_class`, `product_type`, `design_attribute`,
`heel_type`, `upper_material`, `outsole_material`, `collection_type`

**Business flags:** `is_inventory_yn` (default `True`), `is_billable_yn` (default `True`),
`is_service_yn` (default `False`)

**Workflow tracking:** `validation_status` (VARCHAR 30), `validation_message` (TEXT)

### Phase 2 — Schema (`item_master.py` schemas)
- `ItemCreateRequest` / `ItemUpdateRequest`: all 13 new fields with `Optional` typing
- `ItemResponse`: all 13 fields exposed in API response
- `IM-009 model_validator`: `is_service_yn=True` → `is_inventory_yn=False`
- `landed_cost_price` alias for `cost_price`

### Phase 3 — Service (`item_master_svc.py`)
Both `create_item()` construction paths (schema-based + kwargs-based) now
pass the 13 new fields to the `Item()` constructor.

### Phase 4 — Import Pipeline (`universal_import.py`)
- Replaced footwear `attributes_json` blob construction with named v2.2 variables
- `_yn_field()` helper: IM-008 Y/N BLOCK gate
- IM-009 coercion: `if v22_is_service: v22_is_inventory = False`
- 3-path column writes: cached-style, existing DB item, new item creation
- `create_item()` kwargs: all 13 new fields forwarded
- `product_type`, `purchase_class` removed from variant `attrs_json`
- `GST_RATE_PERCENT` added to `FIELD_EXTRACTION_MAP` + `FIELD_TO_DIMENSION_MAP`
- All `v2.1` → `v2.2` string references updated (4 paths + docstring + filename)

### Phase 5 — Migration (`v1495`)
```
ADD COLUMN gender           VARCHAR(30)
ADD COLUMN purchase_class   VARCHAR(100)
ADD COLUMN product_type     VARCHAR(100)
ADD COLUMN design_attribute VARCHAR(100)
ADD COLUMN heel_type        VARCHAR(100)
ADD COLUMN upper_material   VARCHAR(100)
ADD COLUMN outsole_material VARCHAR(100)
ADD COLUMN collection_type  VARCHAR(100)
ADD COLUMN is_inventory_yn  BOOLEAN DEFAULT true  NOT NULL
ADD COLUMN is_billable_yn   BOOLEAN DEFAULT true  NOT NULL
ADD COLUMN is_service_yn    BOOLEAN DEFAULT false NOT NULL
ADD COLUMN validation_status  VARCHAR(30)
ADD COLUMN validation_message TEXT
CREATE INDEX ix_items_gender ON items(gender)
CREATE INDEX ix_items_product_type ON items(product_type)
-- BACKFILL: 6 fields promoted from attributes_json blob
```

### Phase 6 — GST Slab Governance
- `remediate_item_master_standard.py`: Col T `GST_RATE_PERCENT` in Validation Lists;
  DataValidation BLOCK on `AA5:AA500` in Item Master Template
- `seed_master_values_from_standard.py`: `gst_rate` dimension added to header map
- `universal_import.py`: `GST_RATE_PERCENT` in IM-001 extraction + dimension maps
- DB: MasterType `gst_rate` + 4 MasterValues (0, 5, 12, 18) seeded directly

---

## 8. Tests Executed

| Test | Command | Result |
|---|---|---|
| Alembic migration apply | `alembic -x target=tenant -x db=smriti001 upgrade head` | `v1495 (head)` |
| Column verification (13/13) | `information_schema.columns` query | 13/13 present |
| GST slab seeder | `seed_gst.py` direct | 4 values seeded |
| Master values verification | `seed_master_values_from_standard.py` | 13 dimensions verified |

---

## 9. Verification Results

**Evidence — DB column query output (literal):**
```
v2.2 columns present: 13 / 13
  collection_type        character varying nullable=YES default=None
  design_attribute       character varying nullable=YES default=None
  gender                 character varying nullable=YES default=None
  heel_type              character varying nullable=YES default=None
  is_billable_yn         boolean         nullable=NO default=true
  is_inventory_yn        boolean         nullable=NO default=true
  is_service_yn          boolean         nullable=NO default=false
  outsole_material       character varying nullable=YES default=None
  product_type           character varying nullable=YES default=None
  purchase_class         character varying nullable=YES default=None
  upper_material         character varying nullable=YES default=None
  validation_message     text            nullable=YES default=None
  validation_status      character varying nullable=YES default=None
```

**Evidence — Alembic current:**
```
v1495 (head)
```

**Evidence — GST seeder:**
```
Created MasterType: gst_rate
gst_rate: seeded 4 slabs. Total: 4 active values.
```

**Evidence — Git push:**
```
43345145..d76cd55f  smritiNX -> smritiNX
```

---

## 10. Known Limitations

- `validation_status` / `validation_message` are persisted at import time but
  not yet auto-updated on subsequent edits through the REST API. A future
  re-validation trigger is recommended.
- The `GST_RATE_PERCENT` col T in the Excel Validation Lists sheet requires the
  file to be closed and `SMRITI_Item_Master_Creation_Standard_v2.2_gst.xlsx`
  renamed to `v2.2.xlsx` before the workbook-based seeder can pick it up.
- `outsole_material` backfill uses legacy key `"outsole"` from the blob.
  Any rows where the blob used `"outsole_material"` as the key will not be
  backfilled by this migration (they are a minority based on audit data).

---

## 11. Future Work

- REST API `PATCH /items/{id}` should write promoted columns and
  re-calculate `validation_status`.
- Add `ix_items_collection_type`, `ix_items_heel_type` indexes once
  query patterns justify the index cost.
- Implement `validation_status` state machine: DRAFT → VALIDATED → BLOCKED.
- Wire GST slab validation as a pre-save hook on `ItemCreateRequest`
  (currently a soft warning in the import pipeline only).

---

## 12. Related ADRs

- ADR: FastAPI + Postgres sole backend system-of-record
- ADR: IM-001 Two-Tier Controlled Field Governance

---

## 13. Related RFCs

- SMRITI Item Master Creation Standard v2.2 (Excel reference)
- SMRITI Item Master Creation Standard v2.1 (superseded by v2.2 for code paths)
