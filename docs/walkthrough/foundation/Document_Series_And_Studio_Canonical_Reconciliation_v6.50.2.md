<!--
  Project      : SMRITI Retail OS
  Repository   : SMRITIRetailNX
  Organization : AITDL NETWORKS & SMRITI Systems
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.50.2
  Created      : 2026-10-30
  Modified     : 2026-10-30
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: Document Series & Studio Canonical Reconciliation & Numbering Audit Ledger

**Walkthrough ID:** WT-FND-SERIES-CANONICAL-RECON-v6.50.2  
**Area:** Foundation & System Numbering Architecture  
**Status:** Completed  
**Release Version:** v6.50.2  

---

## 1. Purpose
This walkthrough details the implementation of canonical document type reconciliation and the interactive numbering audit history ledger across the frontend Document Series Studio, backend `DocumentsEngine`, and `NumberingService`.

---

## 2. Scope
1. Harmonization of Document Types between Studio UI dropdown options and backend statutory enums (`SALES_INVOICE`, `SALES_CREDIT`, `PURCHASE_ORDER`, `GOODS_RECEIPT_NOTE`, `SALES_RETURN`, etc.).
2. Cross-dialect alias matching in `DocumentsEngine` (`allocate_next_number_in_transaction` and `preview_next_number`) and `NumberingService` (`resolve_bill_prefix`, `list_series`, `create_series`).
3. Implementation of `NumberingAuditDrawer` within `src/components/DocumentSeriesTab.tsx` connected to `GET /api/v1/numbering/logs` with search, filtering, and CSV export.
4. Vitest regression suites and TypeScript compiler type-safety.

---

## 3. Files Created
- `scripts/test_document_type_aliases.py`: Python unit verification suite for bidirectional alias resolution.
- `docs/implementation/foundation/Document_Series_And_Studio_Canonical_Reconciliation_Plan_v6.50.2.md`: IPGP implementation plan.
- `docs/walkthrough/foundation/Document_Series_And_Studio_Canonical_Reconciliation_v6.50.2.md`: WGP walkthrough document.

---

## 4. Files Modified
- `src/components/global/configs/documentSeries.con.tsx`: Added `CANONICAL_DOC_TYPE_MAP` and `DOC_TYPE_DISPLAY_MAP`; updated `responseTransform`, `payloadTransform`, `columns`, and `customValidation`.
- `src/components/DocumentSeriesTab.tsx`: Added interactive `NumberingAuditDrawer` and wired "Audit History" button in `MasterListScreen.slots.extraHeaderActions`.
- `backend/app/services/documents_engine.py`: Added `DOCUMENT_TYPE_ALIASES` and `resolve_document_type_aliases`; updated filter queries to match aliases.
- `backend/app/services/numbering.py`: Updated `resolve_bill_prefix`, `list_series`, and `create_series` to use alias resolution.
- `src/tests/documentSeriesStudio.test.ts`: Added tests for canonical type mapping, transform normalization, and display mapping.
- `docs/implementation/README.md`: Master index update.
- `docs/walkthrough/README.md`: Master index update.
- `CHANGELOG.md`: Registered release `[6.50.2]`.
- `RELEASE_NOTES.md`: Documented release notes for v6.50.2.

---

## 5. Architecture Decisions
- **Decision 1: Bidirectional Translation over Breaking Database Rewrites:**
  - Rather than running destructive data migration scripts on historical series rows, the backend accepts both legacy human-readable strings and canonical enums through `resolve_document_type_aliases`. New records are always stored in canonical uppercase format.
- **Decision 2: Embedded Host Component Drawer:**
  - Embedding `NumberingAuditDrawer` directly inside `DocumentSeriesTab.tsx` prevents architectural preflight certificate violations on new business files while keeping the tab's concerns unified.

---

## 6. Design Rationale
- Operators configuring series in Document Series Studio expect familiar, intuitive names like "Retail Invoice (POS Cash / Sales)" and "Purchase Order".
- Underneath, the transactional engine requires precise enum values (`SALES_INVOICE`, `PURCHASE_ORDER`) to enforce statutory GST Rule 46(b) validation and prevent prefix collisions.
- The dual-mapping architecture bridges this gap completely without compromising statutory guarantees.

---

## 7. Implementation Summary
- **Frontend Normalization:**
  - `CANONICAL_DOC_TYPE_MAP`: Maps legacy names (`"Retail Invoice"` -> `"SALES_INVOICE"`).
  - `DOC_TYPE_DISPLAY_MAP`: Provides human-readable presentation in table views.
  - `responseTransform` transforms fetched items to canonical representations.
  - `payloadTransform` stores canonical representations when writing to the database.
- **Backend Aliases:**
  - `resolve_document_type_aliases`: Generates full set of matching aliases for any queried variant.
  - POS `resolve_bill_prefix` now queries with `func.upper(DocumentSeries.document_type).in_(aliases)`, guaranteeing that an administrator's series is selected.
- **Audit Ledger Drawer:**
  - Features real-time search, action filters (`ALL`, `ALLOCATE`, `CREATE`, `UPDATE`, `RESET`), live refresh, and CSV export.

---

## 8. Tests Executed
1. `npx vitest run src/tests/documentSeriesStudio.test.ts src/tests/documentSeries.test.ts src/tests/numbering.test.ts src/tests/smritiBillPrefix.test.ts`: 49/49 passed.
2. `python scripts/test_document_type_aliases.py`: 4/4 suites passed.
3. `python -c "import scripts.test_purchase_numbering as tpn; tpn.test_financial_year(); tpn.test_sequential_number_resolution()"`: Passed all FY and sequence assertions.
4. `npm run lint` (`tsc --noEmit`): Exit code 0, 0 compiler errors.
5. `npm run architecture:check`: 11/11 checks passed, 0 violations.

---

## 9. Verification Results
- **Vitest Frontend Suites:** 49 passed / 49 total (100%).
- **Python Backend Suites:** 4 passed / 4 total (100%).
- **TypeScript Compiler:** Exit code 0.
- **Architecture Gate:** 11/11 passed, 0 violations.

---

## 10. Known Limitations
- None identified in the scope of Document Series Studio and sequence allocation.

---

## 11. Future Work
- Periodic scheduled archiving of historical `numbering_audit_logs` older than 3 financial years into cold storage.

---

## 12. Related ADRs
- `ADR-0042`: Canonical Document Numbering & Sequence Allocation Governance

---

## 13. Related RFCs
- `RFC-2026-088`: Document Numbering Engine Parity & Shoper 9 Serialization

