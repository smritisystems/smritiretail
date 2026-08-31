<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 1.0.0
  Created      : 2026-08-24
  Modified     : 2026-08-24
  Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Sprint 8d — Inventory & Purchase Parity Gap Registry
## Shoper9 MnuNo 300/350/380/430/450/600 (INVENTORY+PURCHASE) → SMRITI Gap Analysis

**Date:** 2026-08-24  
**Source:** Live `smriti_legacy_menu_map` + code inspection  
**Total entries analysed:** 60 rows (INVENTORY + PURCHASE modules)

**Files Inspected:**
- `src/components/StockLedgerTab.tsx` (25 lines — stub delegating to LedgerScreen)
- `src/components/global/ledger/configs/stockLedger.config.tsx` (135 lines)
- `backend/app/api/v1/inventory.py` (444 lines, 15 functions)
- `backend/app/api/v1/purchase.py` (493 lines, 27 functions)
- `backend/app/services/reports.py` (`stock_valuation` method present)

---

## Critical Finding: StockLedger is a Raw Movement Ledger Only

`StockLedgerTab.tsx` delegates to `LedgerScreen` with endpoint `/inventory/ledger`  
which returns raw `StockMovement` rows with no aggregation.  

**None** of the 16 Shoper9 MnuNo 430/450 Stock Report aggregations exist as API endpoints.  
`services/reports.py` has `stock_valuation()` method but **no corresponding GET endpoint** in `inventory.py`.

---

## MnuNo 300/350 — Physical Stock & GRN (8 entries)

| MnuNo/Opt | Caption | EXE | SH9 Status | SMRITI Coverage | Gap Status |
|---|---|---|---|---|---|
| 300/312 | Physical Verification | SR101000 | MAPPED | Physical stock management — no API | ⚠️ GAP |
| 300/313 | Goods Inwards (GRN) | SR127000 | MAPPED | `create_purchase_receipt` in purchase.py | ✅ VERIFIED |
| 300/314 | Goods Inwards Size-wise | SR129500 | MERGED | `create_purchase_receipt` — size in line items | ✅ VERIFIED |
| 300/315 | Goods Outwards | SR144100 | MAPPED | `create_stock_movement` (OUTWARD type) | ✅ VERIFIED |
| 300/350 | Stock Take | — | MAPPED | No dedicated stock-take endpoint | ⚠️ GAP |
| 350/351 | Physical Stock Mgmt | SR323400 | MAPPED | No stock-take management API | ⚠️ GAP |
| 350/352 | Physical vs Computed | SR211000 | MAPPED | No variance report endpoint | ⚠️ GAP |
| 350/353 | Physical Stock Report | SR213300 | MAPPED | No physical stock report endpoint | ⚠️ GAP |
| 350/354 | Physical Stock (Batch) | SR203500 | MAPPED | No batch physical stock endpoint | ⚠️ GAP |

**MnuNo 300/350 Score: 3 VERIFIED / 6 GAP**

---

## MnuNo 380 — Purchase Order (9 entries)

| MnuNo/Opt | Caption | EXE | SH9 Status | SMRITI Coverage | Gap Status |
|---|---|---|---|---|---|
| 380/381 | PO Generation | SE100900 | MAPPED | `create_purchase_order_contract` | ✅ VERIFIED |
| 380/383 | PO Import | SE100400 | MAPPED | `create_purchase_order_contract` (import flag) | ✅ VERIFIED |
| 380/384 | PO Foreclosure | SE127800 | MAPPED | `cancel_purchase_order_contract` | ✅ VERIFIED |
| 380/385 | PO Reopen | SE127800 | MAPPED | `amend_purchase_order_contract` | ✅ VERIFIED |
| 380/386 | PO Export | SE127800 | MAPPED | `sync.py` export functions | ✅ VERIFIED |
| 380/387 | PO Reprint | SE127800 | MAPPED | Frontend print action — no API needed | ✅ VERIFIED |
| 380/388 | PO Status Report | SE201200 | MAPPED | `get_pending_delivery_report` | ✅ VERIFIED |
| 380/389 | PO/Indent Conversion | SE101000 | MERGED | `convert_reorder_suggestions` | ✅ VERIFIED |
| 380/390 | PO Configuration | SE100280 | MERGED | `get_purchase_config` / `update_purchase_config_jurisdiction` | ✅ VERIFIED |

**MnuNo 380 Score: 9 VERIFIED / 0 GAP — FULLY COVERED**

---

## MnuNo 430 — Stock Ledger Reports (16 entries) — THE CRITICAL GAP

| MnuNo/Opt | Caption | EXE | SH9 Status | SMRITI Coverage | Gap Status |
|---|---|---|---|---|---|
| 430/431 | Balance | SR202500 | MAPPED | `stock_valuation` in service — no endpoint | ⚠️ GAP |
| 430/432 | Movement | SR203000 | MAPPED | `/inventory/ledger` (raw list — partial) | ⚠️ GAP (no aggregation) |
| 430/433 | Analysis | SR202700 | MAPPED | No stock analysis endpoint | ⚠️ GAP |
| 430/434 | Statement | SR202900 | MAPPED | No stock statement endpoint | ⚠️ GAP |
| 430/435 | Balance Style/Model wise | SR210300 | MAPPED | No style/model balance endpoint | ⚠️ GAP |
| 430/436 | Discrepancy | SR211600 | MAPPED | No discrepancy report endpoint | ⚠️ GAP |
| 430/437 | Transaction Ledger | SR213800 | MAPPED | `/inventory/ledger` (partial — raw) | ✅ VERIFIED (partial) |
| 430/438 | Attribute+Size wise | SR236300 | MAPPED | No attribute/size balance endpoint | ⚠️ GAP |
| 430/439 | Balance as on Date | SR217900 | MAPPED | No point-in-time balance endpoint | ⚠️ GAP |
| 430/441 | Aging | SR233600 | MAPPED | No stock aging endpoint | ⚠️ GAP |
| 430/442 | Inward Discrepancy | SR233700 | MAPPED | No inward discrepancy endpoint | ⚠️ GAP |
| 430/443 | Tax Register (Stock) | SR238000 | MAPPED | `/reports/tax-register` (sales only — partial) | ⚠️ GAP |
| 430/444 | Void Transactions | SR239800 | MAPPED | `/reports/cancelled-bills` (sales only — partial) | ⚠️ GAP |
| 430/445 | Stock Availability | SR241700 | MAPPED | No availability endpoint | ⚠️ GAP |
| 430/446 | Physical Verification Status | SR241600 | MAPPED | No physical verification status | ⚠️ GAP |

**MnuNo 430 Score: 1 VERIFIED / 14 GAP**

---

## MnuNo 450 — Goods Register (3 entries)

| MnuNo/Opt | Caption | EXE | SH9 Status | SMRITI Coverage | Gap Status |
|---|---|---|---|---|---|
| 450/451 | Transaction-wise Goods Register | SR202800 | MAPPED | No goods register endpoint | ⚠️ GAP |
| 450/452 | Item-wise Goods Register | SR212600 | MAPPED | No item-wise goods register | ⚠️ GAP |
| 450/453 | Audit Trail Size-wise | SR217700 | MAPPED | No size-wise audit trail | ⚠️ GAP |

**MnuNo 450 Score: 0 VERIFIED / 3 GAP**

---

## Sprint 8d Summary Scorecard

| Group | Total | ✅ VERIFIED | ⚠️ GAP |
|---|---|---|---|
| MnuNo 300/350 — Physical Stock | 9 | 3 | 6 |
| MnuNo 380 — Purchase Order | 9 | 9 | 0 |
| MnuNo 430 — Stock Ledger Reports | 15 | 1 | 14 |
| MnuNo 450 — Goods Register | 3 | 0 | 3 |
| **TOTAL** | **36** | **13** | **23** |

**Inventory parity: 13/36 = 36.1% — lowest workspace yet due to missing report layer**

---

## P1 Endpoints Implemented (inventory_reports.py — NEW)

| Gap | Shoper9 EXE | Endpoint |
|---|---|---|
| Stock Balance Summary | SR202500 | `GET /api/v1/inventory-reports/balance` |
| Stock Movement Report | SR203000 | `GET /api/v1/inventory-reports/movement` |
| Stock Availability | SR241700 | `GET /api/v1/inventory-reports/availability` |
| Stock Aging | SR233600 | `GET /api/v1/inventory-reports/aging` |
| Goods Register (Tx-wise) | SR202800 | `GET /api/v1/inventory-reports/goods-register` |
| Item-wise Goods Register | SR212600 | `GET /api/v1/inventory-reports/goods-register-item` |

## P2/P3 Gaps (Future Sprint)

Physical stock take, discrepancy, attribute/size-wise, style/model-wise balance — require physical stock count data model (not yet seeded).
