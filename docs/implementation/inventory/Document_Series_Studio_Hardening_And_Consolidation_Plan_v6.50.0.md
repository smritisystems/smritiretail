<!--
  Project      : SMRITI Retail OS
  Repository   : SMRITIRetailNX
  Organization : AITDL NETWORKS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.50.0
  Created      : 2026-10-30
  Modified     : 2026-10-30
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Implementation Plan: Document Series & Numbering Studio Hardening & Unified Serialization Engine

**Document ID:** IP-INV-SERIES-STUDIO-v6.50.0  
**Area:** Inventory & System Numbering Architecture  
**Status:** In Progress  
**Target Version:** v6.50.0  

---

## 1. Objective
Harden and consolidate the **Document Series & Numbering Studio** across backend and frontend layers to guarantee:
1. Category-aware Article series coexistence without database unique constraint collisions.
2. Exact bill number segment arrangement alignment (`PREFIX_NUM_SUFFIX`, `PREFIX_YEAR_SEP_NUM`, `PREFIX_SEP_NUM`, `NUM_ONLY`) during transactional sequence allocation in `DocumentsEngine`.
3. Safe transactional non-committing numbering allocations in `NumberingService`.
4. Consumer alignment for Purchase Orders and Goods Receipt Notes (GRN) to respect Studio configurations.
5. High-fidelity Studio UI ergonomics with dynamic `terminalId` targeting and real-time statutory GST Rule 46(b) 16-character length validation in the Live Preview drawer.
6. Safe non-browser Node/test environment execution in `apiFetchV1`.

---

## 2. Business Motivation
In enterprise footwear and retail operations:
- Multiple category-specific Article series (e.g. `SANDAL` range 10,000–19,999, `SHOES` range 20,000–29,999, `APPAREL` range 30,000–39,999) must coexist under the same branch and tenant without database unique constraint violations.
- Statutory GST compliance strictly limits Tax Invoices and Credit Notes to 16 alphanumeric characters. Real-time visual feedback prevents operator errors during series onboarding.
- Multi-step business transactions (POS billing, PO receiving) require atomic transaction boundaries; allocating sequence numbers must not commit midway.

---

## 3. Scope
- **Database Schema & Index Migration (`backend/alembic/versions/v1564_document_series_category_unique_index.py`):**
  Drop index `uq_document_series_company_type_terminal_active` and recreate as `uq_document_series_company_type_terminal_cat_active` including `COALESCE(category, '')`.
- **Backend Documents Engine (`backend/app/services/documents_engine.py`):**
  Unify `allocate_next_number_in_transaction` to use `NumberingService._assemble_doc_no` respecting `series.number_format`.
- **Backend Numbering Service (`backend/app/services/numbering.py`):**
  Support `commit=True/False` parameter in `allocate_voucher_number` for transactional outer callers.
- **Backend Purchase Service (`backend/app/services/purchase.py`):**
  Align PO/GRN numbering generation with `DocumentsEngine` if a series is configured.
- **Frontend Master Studio Config (`src/components/global/configs/documentSeries.con.tsx`):**
  Add `terminalId` input field when `isCommonAcrossTerminals` is false, and add a live 16-character GST Rule 46(b) indicator in `LiveSeriesPreview`.
- **Frontend API Client (`src/lib/apiFetchV1.ts`):**
  Guard `localStorage` access against non-browser Node/Vitest test runtimes.
- **Frontend Numbering Service (`src/services/numberingEngine.ts`):**
  Align synchronous `formatPreview` with segment arrangement formatting.
- **Unit & Integration Test Verification:**
  Update and verify frontend Vitest suites and backend Pytest suites.

---

## 4. Current State
- `v1546` added a partial unique index on `(company_id, document_type, COALESCE(terminal_id, 'COMMON'))` omitting `category`, blocking multiple active Article category series.
- `DocumentsEngine.allocate_next_number_in_transaction` hardcodes `doc_no = f"{series.prefix or ''}{padded_seq}{series.suffix or ''}"`, ignoring `number_format`.
- `NumberingService.allocate_voucher_number` calls `await self.db.commit()`, preventing rollback of outer multi-table transactions.
- `PurchaseService` hardcodes regex parsing and scans database rows, ignoring Studio configurations.
- `apiFetchV1.ts` directly reads `localStorage`, throwing `ReferenceError` during Node/Vitest runs.

---

## 5. Gap Analysis
| Component | Existing Behavior | Target Canonical Behavior |
|---|---|---|
| Migration Unique Index | Collides when 2+ Article series created | Partitions by `(company_id, document_type, terminal_id, category)` |
| `DocumentsEngine` Allocation | Direct concatenation | Respects `number_format` via `_assemble_doc_no` |
| `NumberingService` Allocation | Internal commit forced | Configurable `commit: bool = True` parameter |
| `PurchaseService` Numbering | Unconnected regex scanner | Connects to `DocumentsEngine` for PO / GRN |
| Studio Live Preview | Capacity only | Capacity + GST Rule 46(b) $\le 16$ char validation |
| Studio Terminal Field | No terminal ID input in drawer | Conditional `terminalId` field when terminal-specific |
| `apiFetchV1.ts` | Unguarded `localStorage` | Environment-safe accessor |

---

## 6. Architecture Impact
Zero breaking changes to existing database data. The migration replaces the overly strict partial unique index with an index that correctly accounts for `category`. Downstream consumers gain deterministic formatted outputs matching Studio previews.

---

## 7. Proposed Design
1. **Index Update (v1564):**
   ```sql
   DROP INDEX IF EXISTS uq_document_series_company_type_terminal_active;
   CREATE UNIQUE INDEX IF NOT EXISTS uq_document_series_company_type_terminal_cat_active
   ON document_series (company_id, document_type, COALESCE(terminal_id, 'COMMON'), COALESCE(category, ''))
   WHERE is_deleted = false AND is_active = true AND company_id IS NOT NULL;
   ```
2. **DocumentsEngine Formatting Fix:**
   Replace raw concatenation at line 329 with:
   ```python
   doc_no = NumberingService._assemble_doc_no(
       series.prefix,
       padded_seq,
       series.suffix,
       series.financial_year,
       getattr(series, "number_format", None)
   )
   ```
3. **Safe Storage in `apiFetchV1.ts`:**
   ```typescript
   const getStorageItem = (key: string): string | null => {
     if (typeof window !== "undefined" && window.localStorage) {
       try { return window.localStorage.getItem(key); } catch { return null; }
     }
     return null;
   };
   ```

---

## 8. Files Created
1. `backend/alembic/versions/v1564_document_series_category_unique_index.py`
2. `docs/implementation/inventory/Document_Series_Studio_Hardening_And_Consolidation_Plan_v6.50.0.md`
3. `docs/walkthrough/inventory/Inventory_Document_Series_Studio_Hardening_And_Consolidation_v6.50.0.md`

---

## 9. Files Modified
1. `backend/app/services/documents_engine.py`
2. `backend/app/services/numbering.py`
3. `backend/app/services/purchase.py`
4. `src/lib/apiFetchV1.ts`
5. `src/services/numberingEngine.ts`
6. `src/components/global/configs/documentSeries.con.tsx`
7. `src/tests/documentSeriesStudio.test.ts`
8. `docs/implementation/README.md`
9. `docs/walkthrough/README.md`

---

## 10. Dependencies
- Alembic migration framework
- PostgreSQL partial index support
- React 18, Vite, Vitest, Pytest

---

## 11. Risks & Mitigations
- **Risk:** Existing active rows might have duplicate `(company_id, document_type, terminal_id, category)`.
  **Mitigation:** The migration includes an idempotent deduplication query preserving the newest active record.
- **Risk:** Format change in `DocumentsEngine` might affect tests expecting old raw concatenation.
  **Mitigation:** `PREFIX_NUM_SUFFIX` remains the default, producing identical outputs unless a different format is chosen.

---

## 12. Rollback Strategy
Revert migration `v1564` to recreate the previous index; restore `DocumentsEngine` raw concatenation if required.

---

## 13. Verification Plan
- Run Alembic migration syntax check.
- Run frontend Vitest test suites (`documentSeries.test.ts`, `documentSeriesStudio.test.ts`, `smritiBillPrefix.test.ts`).
- Run backend Pytest suites (`test_numbering_duplicate_prevention.py`, `test_numbering_auth_contract.py`).

---

## 14. Test Plan
- Verify category coexistence: create active series for `SANDAL` and `SHOES` with terminal `COMMON`.
- Verify segment format allocation: allocate under `PREFIX_YEAR_SEP_NUM` and confirm `INV/2026-2027/0001` is produced.
- Verify GST Rule 46(b) live preview: confirm warning triggers when formatted number length $> 16$.

---

## 15. Documentation Impact
- Update `docs/implementation/README.md`
- Create `docs/walkthrough/inventory/Inventory_Document_Series_Studio_Hardening_And_Consolidation_v6.50.0.md`
- Update `docs/walkthrough/README.md`

---

## 16. Deployment Plan
Commit to development branch `smritiNX`, push to remote, and execute `alembic upgrade head`.

---

## 17. Status
In Progress

---

## 18. Related ADRs
- ADR-0042: Canonical PostgreSQL Numbering Authority & Gapless Serialization

---

## 19. Related Walkthroughs
- `docs/walkthrough/inventory/Inventory_Document_Series_Studio_Article_Configuration_v6.49.0.md`
- `docs/walkthrough/billing/Billing_Numbering_Duplicate_Prevention_v6.32.0.md`

