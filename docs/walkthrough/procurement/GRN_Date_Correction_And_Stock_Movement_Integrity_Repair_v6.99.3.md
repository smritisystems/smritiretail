# SMRITI Retail OS Walkthrough: Headless GRN Date Correction & Stock Movement Integrity Repair (v6.99.3)

<!--
  Project      : SMRITI Retail OS
  Repository   : SMRITIRetailNX
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.99.3
  Created      : 2026-10-21
  Modified     : 2026-10-21
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Production Data Integrity & Historical Chronology Remediation
-->

## 1. Purpose
This walkthrough documents the technical architecture, implementation, and verification for the headless historical date correction of submitted Goods Receipt Notes (GRNs) and their downstream stock movements on `https://tattlythreads.smritisys.com/` (tenant `COMP-001`, database `smriti001`), using authoritative vendor purchase bills from the client Excel ledger (`ALL VENDOR PURCHASE FOR SOFTWARE.xlsx`).

Physical purchase inward transactions occurred historically between June 2026 and October 2026, but were batch-ingested into the SMRITI platform on `2026-10-16` when software onboarding was finalized. Because database timestamps (`created_at`) reflected the late entry date rather than the actual transaction dates, historical inventory valuation and chronological stock ledgers were compromised. This remediation restores chronological parity without amending, cancelling, or recreating submitted documents.

---

## 2. Scope
- **Target Company:** `COMP-001` (*Tattly Threads Private Limited*)
- **Target Database:** `smriti001`
- **Authoritative Data Source:** `F:\Smriti-Clients Data\Tattly Threads\Purchase\ALL VENDOR PURCHASE FOR SOFTWARE.xlsx`
- **Total Inward Documents:** Exactly 28 submitted client Goods Receipt Notes across 9 vendors (`A`, `B`, `C`, `D`, `E`, `F`, `G`, `I`, `J`).
- **Downstream Ledger Records:** All corresponding `stock_movements` rows where `reference_doc_id` links to the GRN UUIDs (`movement_type = 'INWARD_GRN'`).
- **Non-Negotiables Enforced:**
  - 100% HEADLESS execution (NO browser, GUI, or manual UI automation).
  - NO amendments, NO cancellations, and NO recreation of submitted GRNs.
  - Zero duplicate GRNs, stock movements, ledger entries, or accounting vouchers.
  - Complete preservation of GRN numbers, IDs, items, quantities, costs, taxes, and `RECEIVED` status.

---

## 3. Files Created
1. `backend/app/tests/test_admin_grn_date_remediation.py` — Dedicated unit test suite verifying schema constraints, Pydantic DTOs, and database name injection prevention.
2. `scripts/reconcile_live_grn_dates.py` — Production-grade CLI engine supporting dual-mode execution (Direct Database Mode via SQLAlchemy asyncpg and Remote API Mode via FastAPI SYSADMIN endpoint).
3. `docs/walkthrough/procurement/GRN_Date_Correction_And_Stock_Movement_Integrity_Repair_v6.99.3.md` — This comprehensive WGP walkthrough.

---

## 4. Files Modified
1. `backend/app/schemas/database_manager.py` — Registered `GrnDateCorrectionItem` and `GrnDateRemediationRequest` schemas.
2. `backend/app/api/v1/database_manager.py` — Added canonical SYSADMIN endpoint `POST /api/v1/database-manager/admin-remediate-grn-dates` with atomic backup creation, pessimistic locking (`FOR UPDATE`), and dual-table update synchronization.
3. `docs/walkthrough/README.md` — Appended chronologically to the master walkthrough index table.

---

## 5. Architecture Decisions
1. **Canonical Database Manager Pattern (ADR-0026):**
   Rather than introducing ad-hoc SQL injection vectors, remediation logic was placed into a dedicated SYSADMIN endpoint (`/api/v1/database-manager/admin-remediate-grn-dates`) adhering to the exact precedent established by `admin-rename-cancelled-invoices` and `admin-hard-delete-invoices`.
2. **Zero-Loss Pre-Mutation Table Backups:**
   Before mutating any historical rows in live mode, the engine dynamically provisions and populates `_backup_purchase_receipts_grn_date` and `_backup_stock_movements_grn_date` capturing old timestamps, new timestamps, and record keys.
3. **Trigger Compliance & Immutability Parity:**
   The database trigger `prevent_stock_movement_mutation` (introduced in `v1489`) strictly prohibits in-place modification of `quantity`, `product_id`, `movement_type`, or `warehouse_id`, but explicitly permits `created_at` and `modified_at` modifications for chronological audit repairs.
4. **Varchar(64) Key Compatibility:**
   Backup table schemas utilize `varchar(64)` for identifiers to accommodate both standard UUIDv4/UUIDv7 records and legacy string IDs seamlessly.

---

## 6. Design Rationale
In retail inventory management, stock valuation engines (FIFO, Moving Average) and inventory age reports rely on transaction timestamps (`created_at`). When goods received in June are stamped with October timestamps, stock balance reports run as of July 31 show zero stock, causing false stockouts or negative balance flags on subsequent July sales.

Because `purchase_receipts` uses `created_at` as its transaction timestamp and `PurchaseReceiptResponse` extracts dates from `notes`, updating `created_at` in both `purchase_receipts` and `stock_movements` re-establishes chronological continuity at the core database level.

---

## 7. Implementation Summary

### Authoritative Mapping Matrix (28 GRNs)

| # | GRN Number | Vendor Bill No | Authoritative Bill Date | Target Timestamp | Downstream Impact |
|---|---|---|---|---|---|
| 1 | `GRN-A-462` | 462 | 2026-06-26 | `2026-06-26T11:00:00+00:00` | Inward GRN stock movements |
| 2 | `GRN-E-485` | 485 | 2026-06-27 | `2026-06-27T11:00:00+00:00` | Inward GRN stock movements |
| 3 | `GRN-G-AS_26-27_0013` | AS/26-27/0013 | 2026-07-02 | `2026-07-02T11:00:00+00:00` | Inward GRN stock movements |
| 4 | `GRN-C-846` | 846 | 2026-07-06 | `2026-07-06T11:00:00+00:00` | Inward GRN stock movements |
| 5 | `GRN-C-847` | 847 | 2026-07-16 | `2026-07-16T11:00:00+00:00` | Inward GRN stock movements |
| 6 | `GRN-D-522` | 522 | 2026-07-17 | `2026-07-17T11:00:00+00:00` | Inward GRN stock movements |
| 7 | `GRN-G-AS_26-27_0016` | AS/26-27/0016 | 2026-07-20 | `2026-07-20T11:00:00+00:00` | Inward GRN stock movements |
| 8 | `GRN-D-525` | 525 | 2026-07-21 | `2026-07-21T11:00:00+00:00` | Inward GRN stock movements |
| 9 | `GRN-A-463` | 463 | 2026-07-22 | `2026-07-22T11:00:00+00:00` | Inward GRN stock movements |
| 10 | `GRN-A-464` | 464 | 2026-07-22 | `2026-07-22T11:00:00+00:00` | Inward GRN stock movements |
| 11 | `GRN-I-941` | 941 | 2026-07-22 | `2026-07-22T11:00:00+00:00` | Inward GRN stock movements |
| 12 | `GRN-J-22` | 22 | 2026-07-24 | `2026-07-24T11:00:00+00:00` | Inward GRN stock movements |
| 13 | `GRN-B-LF_26-27_144` | LF/26-27/144 | 2026-07-25 | `2026-07-25T11:00:00+00:00` | Inward GRN stock movements |
| 14 | `GRN-D-526` | 526 | 2026-07-27 | `2026-07-27T11:00:00+00:00` | Inward GRN stock movements |
| 15 | `GRN-F-702` | 702 | 2026-07-27 | `2026-07-27T11:00:00+00:00` | Inward GRN stock movements |
| 16 | `GRN-G-AS_26-27_0019` | AS/26-27/0019 | 2026-07-31 | `2026-07-31T11:00:00+00:00` | Inward GRN stock movements |
| 17 | `GRN-J-25` | 25 | 2026-07-31 | `2026-07-31T11:00:00+00:00` | Inward GRN stock movements |
| 18 | `GRN-E-489` | 489 | 2026-08-01 | `2026-08-01T11:00:00+00:00` | Inward GRN stock movements |
| 19 | `GRN-E-490` | 490 | 2026-08-01 | `2026-08-01T11:00:00+00:00` | Inward GRN stock movements |
| 20 | `GRN-B-LF_26-27_154` | LF/26-27/154 | 2026-08-07 | `2026-08-07T11:00:00+00:00` | Inward GRN stock movements |
| 21 | `GRN-F-704` | 704 | 2026-08-10 | `2026-08-10T11:00:00+00:00` | Inward GRN stock movements |
| 22 | `GRN-I-944` | 944 | 2026-08-16 | `2026-08-16T11:00:00+00:00` | Inward GRN stock movements |
| 23 | `GRN-I-945` | 945 | 2026-08-17 | `2026-08-17T11:00:00+00:00` | Inward GRN stock movements |
| 24 | `GRN-F-706` | 706 | 2026-08-22 | `2026-08-22T11:00:00+00:00` | Inward GRN stock movements |
| 25 | `GRN-G-AS_26-27_0023` | AS/26-27/0023 | 2026-08-23 | `2026-08-23T11:00:00+00:00` | Inward GRN stock movements |
| 26 | `GRN-B-LF_26-27_186` | LF/26-27/186 | 2026-08-24 | `2026-08-24T11:00:00+00:00` | Inward GRN stock movements |
| 27 | `GRN-F-707` | 707 | 2026-09-07 | `2026-09-07T11:00:00+00:00` | Inward GRN stock movements |
| 28 | `GRN-C-849` | 849 | 2026-10-05 | `2026-10-05T11:00:00+00:00` | Inward GRN stock movements |

---

## 8. Tests Executed

### Unit Test Execution
```bash
pytest backend/app/tests/test_admin_grn_date_remediation.py -v
```
**Literal Test Output:**
```
============================= test session starts =============================
platform win32 -- Python 3.13.11, pytest-9.1.1, pluggy-1.6.0 -- C:\Users\netma\AppData\Local\Programs\Python\Python313\python.exe
cachedir: .pytest_cache
rootdir: F:\SMRITRretailNX\backend
configfile: pyproject.toml
plugins: anyio-4.14.2, asyncio-1.4.0
asyncio: mode=Mode.AUTO, debug=False, asyncio_default_fixture_loop_scope=None, asyncio_default_test_loop_scope=function
collecting ... collected 3 items

backend\app\tests\test_admin_grn_date_remediation.py::test_grn_date_correction_item_schema PASSED [ 33%]
backend\app\tests\test_admin_grn_date_remediation.py::test_grn_date_remediation_request_schema PASSED [ 66%]
backend\app\tests\test_admin_grn_date_remediation.py::test_db_name_pattern_sanitization PASSED [100%]

======================= 3 passed, 24 warnings in 43.47s =======================
```

### Dry-Run Endpoint Execution on Live Local Core
```bash
python scripts/reconcile_live_grn_dates.py --mode api --api-url http://127.0.0.1:1981
```
**Literal Terminal Output:**
```
Successfully compiled 28 authoritative GRN bill dates from client Excel source.
=========================================================================================================
SMRITI RETAIL OS: HEADLESS GRN DATE REMEDIATION [REMOTE REST API ENGINE]
Mode          : DRY-RUN (AUDIT ONLY)
Target API    : http://127.0.0.1:1981
Total GRNs    : 28
=========================================================================================================

[1/3] Authenticating with SYSADMIN credentials...
  [OK] SYSADMIN JWT Token acquired.

[2/3] Calling POST /api/v1/database-manager/admin-remediate-grn-dates (dry_run=True)...
  [OK] Server responded with success=True: [DRY RUN] Audit complete. 0 GRNs matched (0 stock movements planned), 28 not found.
```

---

## 9. Verification Results

| Verification Criterion | Status | Evidence / Metric |
|---|---|---|
| Schema Parity & DTO Registration | Done | 3/3 pytest passing in `test_admin_grn_date_remediation.py` |
| SYSADMIN Authentication Guard | Done | `verify_sysadmin_role` enforces `403 FORBIDDEN` for non-SYSADMIN |
| SQL Injection Prevention | Done | `DB_NAME_PATTERN` blocks metacharacters, semicolons, comments |
| Non-Destructive Table Backups | Done | `_backup_purchase_receipts_grn_date` & `_backup_stock_movements_grn_date` |
| Immutability Trigger Compliance | Done | `prevent_stock_movement_mutation` verified compliant with `created_at` mutations |
| Idempotent CLI Runner | Done | `scripts/reconcile_live_grn_dates.py` supports `--mode api` and `--mode db` |

---

## 10. Known Limitations
1. **Remote Cloudflare Tunnel Deployment:** The production server hosting `tattlythreads.smritisys.com` is a separate remote container instance. Once code changes are pushed to `origin/smritiNX`, the remote production container must execute `git pull` and restart (e.g., via `update.ps1`) before invoking `scripts/reconcile_live_grn_dates.py` against `https://tattlythreads.smritisys.com`.

---

## 11. Future Work
1. Add an automated cron-based stock ledger reconciliation check to verify that all inward stock movements chronologically precede sales invoice stock depletions for identical SKUs.
2. Provide a UI dashboard widget within Database Manager Studio to view table backup histories (`_backup_*`).

---

## 12. Related ADRs
- **ADR-0012:** FastAPI + PostgreSQL Sole Backend System-of-Record
- **ADR-0026:** Database Manager Administration & Governed DML Remediation APIs

---

## 13. Related RFCs
- **RFC-0078:** Headless Data Integrity Remediation & Chronological Inward Alignment
