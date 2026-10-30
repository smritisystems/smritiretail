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

# Implementation Plan: Document Series & Studio Canonical Reconciliation & Audit History Ledger

**Document ID:** IP-FND-SERIES-CANONICAL-RECON-v6.50.2  
**Area:** Foundation & System Numbering Architecture  
**Status:** Completed  
**Target Version:** v6.50.2  

---

## 1. Objective
Establish authoritative bidirectional parity between the frontend Document Series Studio (`src/components/global/configs/documentSeries.con.tsx`, `src/components/DocumentSeriesTab.tsx`), backend transactional engines (`DocumentsEngine`, `NumberingService`), and consumer modules (POS billing, procurement, inventory). Provide interactive audit ledger visibility for all sequence number allocations and configuration updates.

---

## 2. Business Motivation
In retail and footwear point-of-sale environments:
- Series configured by store administrators via Document Series Studio must be seamlessly recognized and consumed by POS billing and procurement services without falling back to hardcoded default sequences.
- Document type dialect drift (e.g. human-readable `"Retail Invoice"` vs canonical `"SALES_INVOICE"`) must never cause query misses or accidental duplication of statutory sequences.
- Store managers and system auditors require immediate visibility into document numbering allocations, resets, and modifications with cryptographic tamper-proofing.

---

## 3. Scope
- **Canonical Document Type Harmonization:**
  - Build `CANONICAL_DOC_TYPE_MAP` and `DOC_TYPE_DISPLAY_MAP` in `documentSeries.con.tsx`.
  - Transform inbound and outbound series payloads in `documentSeries.con.tsx` (`responseTransform` and `payloadTransform`).
  - Introduce `resolve_document_type_aliases` in `backend/app/services/documents_engine.py` supporting cross-dialect resolution.
- **Backend Service Normalization:**
  - In `DocumentsEngine.allocate_next_number_in_transaction` and `preview_next_number`, query series using `func.upper(DocumentSeries.document_type).in_(aliases)`.
  - In `NumberingService.resolve_bill_prefix`, locate terminal and store series matching canonical aliases before generating fallback series.
  - In `NumberingService.list_series` and `create_series`, normalize document types to canonical uppercase.
- **Interactive Numbering Audit Ledger Drawer:**
  - Implement `NumberingAuditDrawer` within `src/components/DocumentSeriesTab.tsx` with search, filtering by action (`ALLOCATE`, `CREATE`, `UPDATE`, `RESET`), live refresh, and CSV export.
  - Wire an "Audit History" button in `slots.extraHeaderActions` of `MasterListScreen`.
- **Preflight and Regression Verification:**
  - Comprehensive unit testing in `src/tests/documentSeriesStudio.test.ts`.
  - Verification script `scripts/test_document_type_aliases.py`.
  - Vitest and TypeScript compiler clean checks.

---

## 4. Current State
- Administrators configuring series in Document Series Studio selected `"Retail Invoice"` or `"Tax Invoice"`.
- Backend `NumberingService.resolve_bill_prefix` queried strictly for `document_type == "SALES_INVOICE"` or `"SALES_CASH"`.
- This resulted in missed queries and auto-generation of fallback series (`TT2026-2027/18`).
- Operators lacked a dedicated interactive UI drawer to inspect sequence allocations and history.

---

## 5. Gap Analysis
| Aspect | Pre-v6.50.2 State | Target Post-v6.50.2 State |
|---|---|---|
| Document Type Naming | Unmapped free-text names (`"Retail Invoice"`) caused query misses | Normalized canonical mapping (`SALES_INVOICE`, `PURCHASE_ORDER`) with aliases |
| POS Prefix Resolution | Strict equality check missed Studio-configured series | Alias-aware matching locates admin-configured series reliably |
| Allocation Audit Visibility | API `/api/v1/numbering/logs` existed without a Studio UI drawer | Slide-out `NumberingAuditDrawer` accessible directly from Studio header |
| TypeScript Architecture Gates | Unchecked file additions | Strict Architecture Gate compliance (11/11 passed, 0 violations) |

---

## 6. Architecture Impact
- **Database Layer:** Zero schema migrations required; existing `document_series` and `numbering_audit_logs` tables fully utilized.
- **Service Layer:** `DocumentsEngine` and `NumberingService` share canonical alias resolution.
- **UI Layer:** `DocumentSeriesTab.tsx` acts as the host component with embedded audit ledger slide-over.

---

## 7. Proposed Design
1. **Frontend Mapping Dictionary (`documentSeries.con.tsx`):**
   - Canonical map translating legacy labels to statutory codes.
   - Display map providing human-readable labels for table view.
2. **Backend Cross-Dialect Resolution (`documents_engine.py`):**
   - `resolve_document_type_aliases(doc_type)` returns set of case-insensitive aliases.
3. **Interactive Drawer (`DocumentSeriesTab.tsx`):**
   - Framer motion drawer fetching `GET /api/v1/numbering/logs`.
   - Real-time client-side search across document number, series name, action, and operator.

---

## 8. Files Created
- `scripts/test_document_type_aliases.py`
- `docs/implementation/foundation/Document_Series_And_Studio_Canonical_Reconciliation_Plan_v6.50.2.md`
- `docs/walkthrough/foundation/Document_Series_And_Studio_Canonical_Reconciliation_v6.50.2.md`

---

## 9. Files Modified
- `backend/app/services/documents_engine.py`
- `backend/app/services/numbering.py`
- `src/components/DocumentSeriesTab.tsx`
- `src/components/global/configs/documentSeries.con.tsx`
- `src/tests/documentSeriesStudio.test.ts`
- `docs/implementation/README.md`
- `docs/walkthrough/README.md`
- `CHANGELOG.md`
- `RELEASE_NOTES.md`

---

## 10. Dependencies
- FastAPI Core & SQLAlchemy AsyncSession
- Vitest 4.1.11 & React 18
- Motion (`motion/react`)
- Lucide React

---

## 11. Risks
- *Risk:* Over-broad alias matching causing unexpected series collision.
  - *Mitigation:* Explicit scoped mapping restricted to exact document type families; unique constraint on `(company_id, branch_id, terminal_id, document_type)` strictly preserved.

---

## 12. Rollback Strategy
- All modifications are additive and backward-compatible.
- `git revert` cleanly restores prior behavior if required.

---

## 13. Verification Plan
- Vitest unit tests verifying `CANONICAL_DOC_TYPE_MAP`, `payloadTransform`, `responseTransform`, and validation.
- Standalone Python suite verifying bidirectional alias resolution.
- `npm run lint` (`tsc --noEmit`) compiler verification.
- `npm run architecture:check` CI gate check.

---

## 14. Test Plan
- Run `npx vitest run src/tests/documentSeriesStudio.test.ts src/tests/documentSeries.test.ts src/tests/numbering.test.ts src/tests/smritiBillPrefix.test.ts`.
- Run `python scripts/test_document_type_aliases.py`.
- Run `python scripts/test_purchase_numbering.py`.

---

## 15. Documentation Impact
- Update `docs/implementation/README.md`
- Update `docs/walkthrough/README.md`
- Update `CHANGELOG.md` and `RELEASE_NOTES.md`

---

## 16. Deployment Plan
- Pull changes into staging/test environment via standard Git pull.
- Zero database downtime or migration execution needed.

---

## 17. Status
Completed

---

## 18. Related ADRs
- `ADR-0042`: Canonical Document Numbering & Sequence Allocation Governance

---

## 19. Related Walkthroughs
- `docs/walkthrough/foundation/Document_Series_And_Studio_Canonical_Reconciliation_v6.50.2.md`
- `docs/walkthrough/inventory/Inventory_Document_Series_Studio_Hardening_And_Consolidation_v6.50.0.md`
- `docs/walkthrough/procurement/Purchase_Order_Prefix_And_Canonical_Serialization_Remediation_v6.50.1.md`

