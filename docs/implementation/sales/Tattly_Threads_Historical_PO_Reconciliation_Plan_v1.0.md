<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 1.0.0
  Created      : 2026-08-26
  Modified     : 2026-08-26
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Phase 1 Historical PO Reconciliation Engineering Plan — Tattly Threads

## 1. Objective
Ingest all 60 Reliance Retail Purchase Orders (PO PDFs) into SMRITI Retail OS as canonical historical Sales Orders, populate deduplicated Item Master products, archive immutable legal terms snapshots, and reconcile invoice allocations across existing tax invoices `TT2026-2027/18` through `TT2026-2027/137` for client **Tattly Threads**.

---

## 2. Business Motivation
Tattly Threads holds 60 purchase orders from Reliance Retail Limited totaling 25,864 pairs of footwear valued at INR 31.73M. Invoices TT 18–137 billed 9,027 pairs (INR 10.60M), leaving 16,837 pairs (INR 21.13M) pending fulfillment. A rigorous, idempotent reconciliation establishes a single source of truth in PostgreSQL for ERP operations, audit readiness, and subsequent phase billing.

---

## 3. Scope
- Ingestion of 60 Reliance PO PDFs (`5182778151.pdf` – `5182778210.pdf`).
- Creation of 60 Sales Orders in `smriti001`.
- Insertion of 18,036 Sales Order Items linking to Item Master products.
- Deduplication of 450 unique SKU combinations into `products`.
- Archival of 60 Terms & Conditions snapshots in `terms_snapshots`.
- Matching and allocation of 120 tax invoices (`TT2026-2027/18` to `137`).
- Zero mutation of existing tax invoices.
- Zero stock movements or new tax invoices created in Phase 1.

---

## 4. Current State
- `sales_invoices` contained 120 historical tax invoices (`TT2026-2027/18` – `137`) with `po_reference` values.
- `sales_orders` had 0 records in `smriti001`.
- `products` had 154 items, missing 303 unique SKUs referenced in the POs.
- `terms_snapshots` had 0 Sales Order records.
- Invoice allocation records did not exist.

---

## 5. Gap Analysis
- Missing historical Sales Orders representing contractual commitments from Reliance Retail.
- Incomplete Item Master catalog preventing line-level analytics.
- Absence of structured invoice-to-PO allocation records tracking pending balance.

---

## 6. Architecture Impact
- Extended `sales_orders` and `sales_order_items` tables with canonical PO metadata.
- Created `sales_order_invoice_allocations` table for order-to-invoice tracking.
- Maintained strict tenant isolation in `smriti001`.

---

## 7. Proposed Design
- Direct PDF extraction via PyMuPDF parsing headers, line items, and legal clauses.
- Normalization into compound key `(EAN, Vendor_Style, Color, Size)` for deduplication.
- Batch database insertion with complete transactional rollback safety.

---

## 8. Files Created
- `scripts/reconcile_historical_pos.py`
- `scripts/test_po_extractor_all.py`
- `backend/tests/test_tattly_po_reconciliation.py`
- `docs/walkthrough/sales/Tattly_Threads_Historical_PO_Reconciliation_Phase1_v1.0.md`
- `docs/implementation/sales/Tattly_Threads_Historical_PO_Reconciliation_Plan_v1.0.md`
- `backups/smriti001_pre_phase1_po_recon.sql`

---

## 9. Files Modified
- `backend/app/models/sales.py`
- `docs/walkthrough/README.md`
- `docs/implementation/README.md`
- `CHANGELOG.md`

---

## 10. Dependencies
- Python 3.13 (`pymupdf`, `psycopg2`, `pytest`, `SQLAlchemy`, `FastAPI`).
- PostgreSQL 15 running in Docker container `smriti-db` on port 5432.

---

## 11. Risks
- Risk of conflicting SKU codes: Mitigated by unique tuple checking and code sanitization.
- Risk of duplicate records on re-run: Mitigated by idempotent `DELETE + INSERT` transaction pattern.

---

## 12. Rollback Strategy
- Database snapshot `backups/smriti001_pre_phase1_po_recon.sql` allows full point-in-time restore in seconds via `docker exec -i smriti-db psql -U postgres smriti001 < backup.sql`.

---

## 13. Verification Plan
- Execute `--dry-run` to audit all counts, values, and differences.
- Execute `--commit` to load data.
- Execute second `--commit` to assert zero duplicate additions (idempotency).

---

## 14. Test Plan
- Pytest suite `backend/tests/test_tattly_po_reconciliation.py` asserting:
  - 60 Sales Orders
  - 18,036 lines
  - 60 terms snapshots
  - 120 invoice allocations
  - Zero modifications to existing tax invoices
  - Zero stock movements

---

## 15. Documentation Impact
- Walkthrough created in `docs/walkthrough/sales/`.
- Indices updated in `docs/walkthrough/README.md` and `docs/implementation/README.md`.
- CHANGELOG updated.

---

## 16. Deployment Plan
- Run reconciliation engine directly on tenant database `smriti001`.

---

## 17. Status
**Completed**

---

## 18. Related ADRs
- `ADR-0012`: FastAPI + PostgreSQL Sole Backend System-of-Record.
- `ADR-0024`: Multi-Tenant Isolation & Partitioning.

---

## 19. Related Walkthroughs
- `docs/walkthrough/sales/Tattly_Threads_Historical_PO_Reconciliation_Phase1_v1.0.md`
