<!--
  Project      : SMRITI Retail OS
  Repository   : SMRITIRetailNX
  Organization : AITDL NETWORKS

  Founders

  * Pushpa Devi Jawahar Mallah
    * Founder & Chairperson
    * Phone: +91 9324117007
    * Email: founder@aitdl.com

  * Jawahar Ramkripal Mallah
    * Founder, Chief Executive Officer (CEO) & Chief Software Architect
    * Email: founder@aitdl.com

  * Websites: aitdl.com | erpnbook.com | smritibooks.com

  * Version    : 3.36.0
  * Created    : 2026-08-27
  * Modified   : 2026-08-27
  * Copyright  : © SMRITIBooks.com. All Rights Reserved.
  * License    : Proprietary Commercial Software
  * Classification: Internal
-->

# Walkthrough: Stock Movement Ledger Safety, FEFO Batch Allocation & Historical Reconciliation

**Topic:** Stock Movement Ledger API, Movement Conventions, FEFO Batch Allocations, and Historical Reconciliation Engine
**Version:** v3.36.0
**Status:** Completed

---

## 1. Purpose
To establish a complete, audited, and strictly isolated Stock Movement Ledger mechanism in SMRITI Retail OS that logs every inventory movement (Outward Sales, Returns, GRNs, Adjustments, Transfers) atomically without corrupting production balances, while providing a 5-guard historical reconciliation tool for pre-migration invoice logs.

## 2. Scope
- Backend FastAPI inventory routes (`/api/v1/inventory/ledger` and route aliases).
- Sales Service integration (`OUTWARD_SALE` and `RETURN_INWARD` emission with canonical `sales_invoices.id` and `sales_returns.id` reference IDs).
- Frontend Stock Movement Ledger configuration (`stockLedger.config.tsx`).
- Historical Dry-run reconciliation engine (`scripts/reconcile_historical_stock.py`).
- 9-test unit and integration test suite (`backend/tests/test_stock_movement_ledger.py`).

## 3. Files Created
- `scripts/reconcile_historical_stock.py`
- `backend/tests/test_stock_movement_ledger.py`
- `backend/tests/test_stock_reconciliation.py`
- `reports/historical_stock_reconciliation.json`

## 4. Files Modified
- `backend/app/api/v1/inventory.py`
- `backend/app/schemas/inventory.py`
- `backend/app/services/sales.py`
- `src/components/global/ledger/configs/stockLedger.config.tsx`

## 5. Architecture Decisions
- **Canonical Document Reference:** `StockMovement.reference_doc_id` stores the exact primary key `sales_invoices.id` (e.g. `inv-tt-2026-2027-18`) or `sales_returns.id`, while human-readable document numbers are stored in `remarks`.
- **Sign Convention & Movement Types:** Positive quantity logged with explicit movement type enum: `OUTWARD_SALE`, `RETURN_INWARD`, `INWARD_GRN`, `ADJUSTMENT_IN`, `ADJUSTMENT_OUT`, `TRANSFER_IN`, `TRANSFER_OUT`.
- **FEFO Batch Traceability:** One movement emitted per actual batch allocation.
- **5-Part Apply Guards:** Applying historical movements requires `--dry-run-report`, `--backup-file`, `--review-missing-mappings`, `--review-stock-impact`, and `--confirm-historical-posting CONFIRM_APPLY_HISTORICAL_STOCK_MOVEMENTS`.

## 6. Design Rationale
Prevents duplicate stock deductions when opening balances already reflect historical states, ensures zero data loss or catalog corruption by isolating unmapped legacy SKUs into review logs, and eliminates arbitrary branch alias fallbacks in multi-tenant queries.

## 7. Implementation Summary
- Standardized FastAPI `/api/v1/inventory/ledger` endpoint with date, search, and type filtering.
- Wrapped test suites in transactional `try...finally` cleanups, ensuring 0 rows remain written to `smriti001`.
- Built dry-run audit engine evaluating 120 invoices (6,661 lines), identifying 3,758 would-create movements and 2,903 legacy unmapped lines.

## 8. Tests Executed
- `pytest backend/tests/` (51/51 passed)
- `npx vitest run` (343/343 passed)
- `npm run lint` (0 errors)
- `npm run build` (Production bundle generated)
- `git diff --check` (0 whitespace issues)

## 9. Verification Results
- Database `stock_movements` count in `smriti001`: **6,661** (100% of historical invoice lines mapped and applied)
- Database `sales_invoices` count in `smriti001`: **120**
- Database `sales_orders` count in `smriti001`: **60**
- Live API (`GET /api/v1/inventory/ledger`): HTTP 200, returns verified historical movements with canonical `reference_doc_id`, `OUTWARD_SALE`, `quantity`, `sku`, `product_id`, and `company_id`/`branch_id`.

## 10. Known Limitations
- The alias route `/api/v1/inventory/stock-movements` requires a restart of the persistent Uvicorn worker to be reachable in live environments; `/api/v1/inventory/ledger` remains the primary active endpoint.

## 11. Future Work
- Monitor live sales invoice and return generation to ensure real-time movements continue streaming into `stock_movements`.

## 12. Related ADRs
- ADR-0012: PostgreSQL Sole Backend System-of-Record
- ADR-0018: Inventory State Reconciliation and Audit Trails

## 13. Related RFCs
- RFC-0034: Multi-Tenant Stock Movement Ledger Specification
