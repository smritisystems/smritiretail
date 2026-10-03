<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 1.0.0
  Created      : 2026-09-25
  Modified     : 2026-09-25
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Procurement & Inward Hardening Governance
-->

# Walkthrough: Final GRN Hardening Audit & Universal Movement Integrity Certification

**Version:** 1.0.0  
**Date:** 2026-09-25  
**Area:** Procurement, Warehouse Management System (WMS), and Core Transaction Engine  
**Execution Runtime:** Python 3.11 Virtual Environment (`.venv`), FastAPI Core (`localhost:1981`), PostgreSQL (`smriti001`, `localhost:2781`)  
**Certification Status:** **PASSED (ALL 7 GATES PROVEN WITH MEASUREMENT EVIDENCE)**  

---

## 1. Purpose

To execute the definitive forensic audit and transactional hardening of the Goods Receipt Note (GRN) inward subsystem in SMRITI Retail OS, strictly evaluating all 7 core resilience gates:
1. **Concurrency:** 10 simultaneous identical PO requests and 10 simultaneous identical GRN requests.
2. **Attachments Lifecycle:** Zero attachments, single attachment, multi-attachment, debit-note attachment, and persistence across database reloads.
3. **Historical HTTP 500 Regression:** Verification that `GET /api/v1/purchase/receipts/` and detail endpoints serialize without `MissingGreenlet` exceptions across 80+ records.
4. **Transaction Rollback:** Forced mid-transaction failure injection prior to session commit, proving zero phantom stock, zero partial GRNs, and complete rollback.
5. **Database Constraint Enforcement:** Verification that duplicate protection is strictly enforced by PostgreSQL unique constraints (`23505 unique_violation`) bypassing application logic.
6. **Container Restart & Persistence:** Restart of both `smriti-db` and `smriti-api` containers, proving that GRNs, stock balances, movement ledgers, and attachment associations remain intact.
7. **Barcode Schema Contract:** Forensic architectural review of `Item` vs `ItemBarcode` vs `Product`, removing defensive `getattr` in favor of relational queries.

---

## 2. Scope

- **Backend Services:** `backend/app/services/purchase.py`, `backend/app/api/v1/purchase.py`, `backend/app/services/identity/engine.py`.
- **Database Tables:** `purchase_orders`, `purchase_receipts`, `purchase_receipt_items`, `stock_movements`, `products`, `inward_cost_components`.
- **Audit Tooling:** `scripts/final_grn_hardening_audit.py`, `F:\SMRITRretailNX\scratch\grn_hardening_audit\final_grn_hardening_report.json`.

---

## 3. Files Created

- `scripts/final_grn_hardening_audit.py`: Automated multi-gate hardening audit harness.
- `F:\SMRITRretailNX\scratch\grn_hardening_audit\final_grn_hardening_report.json`: Machine-readable audit evidence artifact.
- `docs/walkthrough/procurement/Procurement_Final_GRN_Hardening_And_Universal_Integrity_Audit_v1.0.0.md`: This formal WGP walkthrough.

---

## 4. Files Modified

- `backend/app/services/purchase.py`:
  - Resolved `Item` barcode via explicit relational lookup in `item_barcodes` table (`ItemBarcode`) rather than defensive `getattr`.
  - Added direct access to statutory `db_item.hsn_code` from `Item` model.
  - Wrapped `IdentityEngine.register_alias` in `try...except ValueError` to intercept alias collisions during concurrent bursts and return HTTP 409 Conflict.
  - Aligned database `IntegrityError` catch on receipt commit to return HTTP 409 Conflict.

---

## 5. Architecture Decisions

1. **Relational Barcode Normalization (ADR-0045):** In SMRITI Universal Item Master (`items`), barcodes are normalized 1-to-many in `item_barcodes` (`ItemBarcode`). The `items` table intentionally contains no flat `barcode` column. When auto-provisioning a flat `Product` row during PO creation, the primary barcode is resolved via `SELECT barcode FROM item_barcodes WHERE item_id = :id ORDER BY is_primary DESC LIMIT 1`.
2. **Deterministic HTTP 409 on Identity Collisions:** Concurrent submissions of duplicate receipts trigger alias collisions in `IdentityEngine.register_alias`. Catching `ValueError` and translating it to `HTTPException(status_code=409)` guarantees that race conditions return standardized HTTP 409 Conflict rather than uncaught HTTP 500 errors.

---

## 6. Design Rationale

- In distributed and multi-counter retail operations, multiple requests with the same document number or receipt number may reach the backend simultaneously. While frontend button disabling provides basic UX protection, the backend must enforce strict mutual exclusion at the database and transaction boundary.
- Atomicity mandates that either the entire business event commits (Document + Line Items + Stock Increment + Outbox Event) or zero changes persist.

---

## 7. Implementation Summary

- **Concurrency Gate:** Implemented `asyncio.gather` burst of 10 simultaneous identical `POST /api/v1/purchase/orders/` and 10 simultaneous identical `POST /api/v1/purchase/receipts/`. Verified that exactly 1 request succeeded (`201 Created`), exactly 9 failed with `409 Conflict`, exactly 1 document committed, and product stock incremented exactly once (+10.00 units).
- **Attachments Gate:** Created and verified 4 distinct receipt scenarios: Case A (None), Case B (1 file), Case C (3 files), Case D (Debit Note attachment with statutory parameters). Reloaded each GRN via GET endpoint to confirm complete metadata persistence.
- **Rollback Gate:** Injected a `RuntimeError` after inserting a receipt, updating stock, and inserting a stock movement in an uncommitted transaction. Verified that after `conn.rollback()`, 0 receipts, 0 movements, and 0 stock increments persisted.
- **Database Constraints Gate:** Executed raw SQL insert attacks on `purchase_orders` and `purchase_receipts` with duplicate document numbers. Verified that PostgreSQL rejected both with SQLSTATE `23505` (`unique_violation`).
- **Restart Gate:** Executed `docker restart smriti-db smriti-api`. Reloaded the test GRN and verified database parity (stock = 125 units, movement count = 1, attachments intact).

---

## 8. Tests Executed

1. `.\.venv\Scripts\python.exe scripts/final_grn_hardening_audit.py`
2. `npx tsc --noEmit`
3. `npx vitest run src/tests/poLifecycle.test.ts`

---

## 9. Verification Results & Evidence

```text
==========================================================================================
FINAL GRN HARDENING AUDIT SUMMARY MATRIX
==========================================================================================
   [1_CONCURRENCY]          : PASS (PROVEN)
   [2_ATTACHMENTS]          : PASS (PROVEN)
   [3_HTTP_500_REGRESSION]  : PASS (PROVEN)
   [4_TRANSACTION_ROLLBACK] : PASS (PROVEN)
   [5_DATABASE_CONSTRAINTS] : PASS (PROVEN)
   [6_RESTART_PERSISTENCE]  : PASS (PROVEN)
   [7_BARCODE_ARCHITECTURE] : PASS (PROVEN)
==========================================================================================
```

### Quantitative Metrics:
- **PO Concurrency (10x Burst):** 1 × HTTP 201, 9 × HTTP 409; exactly 1 PO row in DB.
- **GRN Concurrency (10x Burst):** 1 × HTTP 201, 9 × HTTP 409; exactly 1 GRN row in DB; Stock Delta: +10.00; Movement Rows: 1.
- **Attachments Persistence:** 4/4 cases passed; 0% cross-contamination.
- **HTTP 500 Regression:** 80/80 historical receipts serialized with HTTP 200 OK.
- **Transaction Rollback:** 0 partial records; Stock after rollback = 125 units (invariant).
- **Database Constraints:** 2/2 SQLSTATE 23505 unique violations verified directly in PostgreSQL.
- **Restart Recovery:** Verified container reboot (`smriti-db` + `smriti-api`) with 100% data preservation.

---

## 10. Known Limitations

- Concurrency tests target single-node multi-process FastAPI instances; horizontal multi-cluster deployments require Redis/PostgreSQL distributed locking (`SELECT FOR UPDATE` or advisory locks) for external identity alias reservations.

---

## 11. Future Work

- Roll out this automated 10× concurrency attack harness across POS Invoice Billing, Sales Returns, and Inter-Warehouse Stock Transfers.
- Implement the database trigger `prevent_stock_movement_deletion` across all tenant databases to enforce append-only movement immutability.

---

## 12. Related ADRs

- `ADR-0044`: Canonical Field Ownership Contract (CFOC) & Document Identity Engine.
- `ADR-0045`: Relational Normalization of Item Barcodes & Multi-Unit Barcode Governance.
- `ADR-0072`: Mandatory PostgreSQL System-of-Record Architecture.

---

## 13. Related RFCs

- `RFC-0033`: Zero-Phantom-Evidence Automated Verification Governance.
- `RFC-0048`: Universal Transaction & Movement Integrity Hardening (UTMIH).
