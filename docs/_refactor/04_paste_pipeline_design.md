<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.17.0
  Created      : 2026-08-19
  Modified     : 2026-08-19
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
-->

# 04. Phase 4 — Unified Paste & Import Pipeline Design

---

## 1. Unified Pipeline Lifecycle

```
[Clipboard Paste / File Upload]
             ↓
[CAPTURE & DETECT DELIMITER (TSV / CSV)]
             ↓
[PARSE ROWS & DETECT HEADER ROW]
             ↓
[HEADER MAPPING ENGINE (One-to-Many Alias Registry)]
             ↓
[MANDATORY PREVIEW MODAL (Human Confirmation Gate)]
             ↓
[NORMALIZE VARIANT IDENTITY: TRIM & UPPERCASE (Style, Color, Size)]
             ↓
[DATABASE IDENTITY & BARCODE DIFF CHECK]
   ├── NEW        → Insert new item with unique variant_id
   ├── UPDATE     → Existing identity updated with new price/specs
   ├── DUPLICATE  → Same identity within company, flags conflict
   └── ERROR      → Barcode collision or missing required field
             ↓
[TRANSACTIONAL COMMIT via FastAPI /api/v1/products/]
```

---

## 2. Hard Invariants
1. **Mandatory Preview**: No import path commits without displaying column alignments and sample rows.
2. **Variant Identity Key**: Identity comparison evaluates `(company_id, LOWER(style_code), LOWER(color), LOWER(size))`.
3. **Surrogate Reference**: Downstream transactions reference `variant_id` (or `id`), never volatile text strings.
4. **Barcode Isolation**: Duplicate barcode on a different identity triggers an isolated `ERROR` row without failing the entire batch.
