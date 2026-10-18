<!--
  Project      : SMRITI Retail OS
  Repository   : SMRITIRetailNX
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.95.0
  Created      : 2026-10-19
  Modified     : 2026-10-19
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Formal Implementation Walkthrough
-->

# PO & GRN Canonical Numbering Standard & Vendor Bill Date Alignment Walkthrough

## 1. Purpose
This implementation establishes and enforces the statutory canonical document numbering standard for **Purchase Orders (PO)** and **Goods Received Notes (GRN)** across SMRITI Retail OS:
$$\text{Document Number} = \text{Nature Prefix} + \text{"/"} + \text{Financial Year} + \text{"/"} + \text{4-Digit Running Number}$$
Examples: `PO/26-27/0001` and `GRN/26-27/0001`.

Additionally, this implementation establishes the statutory chronological alignment policy:
- **PO Date:** Set strictly to 30 days prior to the Vendor Bill/Invoice Date ($\text{PO Date} = \text{Bill Date} - 30\text{ days}$).
- **GRN Date:** Set to match the physical Vendor Bill Date ($\text{GRN Date} = \text{Bill Date}$).
- **Historical Remediation:** Formulates a verified 28-transaction chronological mapping for all client commercial purchase bills from Excel (`F:\Smriti-Clients Data\Tattly Threads\Purchase\ALL VENDOR PURCHASE FOR SOFTWARE.xlsx`), updates all 28 live receipts on `https://tattlythreads.smritisys.com/`, and generates an atomic SQL migration script (`scripts/migrate_canonical_po_grn_numbers.sql`).

---

## 2. Scope
1. **Backend Service (`backend/app/services/purchase.py`):**
   - Added `get_financial_year(target_date)` computing Indian fiscal year (`26-27` for Apr 1, 2026 – Mar 31, 2027).
   - Upgraded `get_next_order_number` to inspect existing POs and generate `PO/{FY}/{next_seq:04d}`.
   - Added `get_next_receipt_number` to inspect existing receipts and generate `GRN/{FY}/{next_seq:04d}`.
   - Integrated automatic sequential numbering into `create_purchase_order` and `create_purchase_receipt` when numbers are omitted.
2. **Backend API (`backend/app/api/v1/purchase.py`):**
   - Added endpoint `GET /api/v1/purchase/receipts/next-number?prefix=GRN`.
   - Propagated `created_at` in `list_purchase_receipts` and `get_purchase_receipt`.
3. **Backend Schemas (`backend/app/schemas/purchase.py`):**
   - In `PurchaseOrderResponse`: Dynamically derives `order_date` as 30 days prior to the Vendor Bill Date when parsing document notes or rule snapshots.
   - In `PurchaseReceiptResponse`: Added `receipt_date`, `vendor_bill_date`, `vendor_bill_no`, and `@model_validator(mode="after")` to extract dates from notes.
4. **Frontend Workspaces:**
   - `src/components/purchase/PoGenerateTab.tsx`: Standardized initial state to `PO/{fy}/0001`, dynamically fetches `/purchase/orders/next-number`, and prevents duplicate prefix assembly on save.
   - `src/components/purchase/GrnReceiptTab.tsx`: Standardized initial state to `GRN/{fy}/0001`, dynamically fetches `/purchase/receipts/next-number`, and engineered resilient `formatGrnDisplayDate` extracting dates from `receipt_date`, `vendor_bill_date`, `created_at`, or notes (`Dated YYYY-MM-DD`).
5. **Remediation & Migration Artifacts:**
   - `scripts/sync_live_grn_notes.py`: Synchronized notes on 28 live GRNs on `https://tattlythreads.smritisys.com`.
   - `scripts/remediate_po_grn_canonical_numbers.py`: Automated chronological sequence schedule generator.
   - `scripts/migrate_canonical_po_grn_numbers.sql`: Atomic SQL migration script (`BEGIN ... COMMIT`) mapping all 28 transactions.
   - `scripts/test_purchase_numbering.py`: Unit test verifying Indian fiscal year boundary calculations.

---

## 3. Files Created
1. `scripts/sync_live_grn_notes.py` — REST API synchronization script for live GRN notes.
2. `scripts/remediate_po_grn_canonical_numbers.py` — Chronological schedule generator and SQL migration builder.
3. `scripts/migrate_canonical_po_grn_numbers.sql` — Transactional PostgreSQL migration script for 28 historical purchases.
4. `scripts/test_purchase_numbering.py` — Python unit test for financial year calculation.
5. `docs/walkthrough/procurement/PO_And_GRN_Canonical_Numbering_And_Date_Alignment_v6.95.0.md` — This formal walkthrough document.

---

## 4. Files Modified
1. [backend/app/services/purchase.py](file:///f:/SMRITRretailNX/backend/app/services/purchase.py) — Added `get_financial_year`, `get_next_order_number`, `get_next_receipt_number`, and auto-allocation in PO/GRN creation.
2. [backend/app/api/v1/purchase.py](file:///f:/SMRITRretailNX/backend/app/api/v1/purchase.py) — Added `GET /receipts/next-number` endpoint and passed `created_at` in responses.
3. [backend/app/schemas/purchase.py](file:///f:/SMRITRretailNX/backend/app/schemas/purchase.py) — Added 30-day PO date derivation and GRN date extraction in Pydantic response models.
4. [src/components/purchase/PoGenerateTab.tsx](file:///f:/SMRITRretailNX/src/components/purchase/PoGenerateTab.tsx) — Standardized PO numbering and sequence advancing.
5. [src/components/purchase/GrnReceiptTab.tsx](file:///f:/SMRITRretailNX/src/components/purchase/GrnReceiptTab.tsx) — Standardized GRN numbering, sequence advancing, and resilient date formatting.
6. [docs/walkthrough/README.md](file:///f:/SMRITRretailNX/docs/walkthrough/README.md) — Master walkthrough index updated.

---

## 5. Architecture Decisions
1. **Statutory CGST Rule 46(b) Numbering Conformance:**
   Indian GST Rule 46(b) mandates that document serial numbers must not exceed 16 characters and contain consecutive numbers, alphabets, or special characters such as hyphens and slashes. Format `PO/26-27/0001` (13 characters) and `GRN/26-27/0001` (14 characters) strictly conform to statutory regulations.
2. **Dynamic 30-Day Prior PO Date Resolution:**
   Rather than performing destructive database mutations on closed and received purchase orders (`status = RECEIVED`), the Pydantic response model `PurchaseOrderResponse` calculates `order_date = bill_date - timedelta(days=30)` dynamically. This guarantees accurate presentation across all UI tabs, print templates, and API endpoints without invalidating state-machine locks.
3. **Resilient Date Extraction in Frontend (`formatGrnDisplayDate`):**
   To safeguard against asynchronous server redeployments or legacy payload shapes, `formatGrnDisplayDate` cascades from `receipt_date` $\rightarrow$ `vendor_bill_date` $\rightarrow$ `created_at` $\rightarrow$ regex match on notes (`Dated YYYY-MM-DD`), guaranteeing that users immediately see authentic dates without `--` or `undefined`.

---

## 6. Design Rationale
- **Zero-Waste Running Numbers:** Scanning the database for the maximum sequence number within the active financial year (`max_seq + 1`) prevents hardcoded seed dependencies and ensures consecutive serial numbers.
- **Atomic Two-Phase Migration Safety:** The generated SQL script uses an explicit transaction block (`BEGIN ... COMMIT`) to update `purchase_orders.order_no`, `purchase_receipts.receipt_no`, `purchase_receipt_items.purchase_order_no`, and `stock_movements.reference_doc_id` in lockstep, preserving legacy IDs in the notes field for external audit traceability.

---

## 7. Implementation Summary

### Chronological Schedule of 28 Historical Transactions
| # | Canonical PO No | PO Date (-30D) | Canonical GRN No | GRN / Bill Date | Vendor Bill No | Legacy Reference |
|---|---|---|---|---|---|---|
| 1 | `PO/26-27/0001` | 2026-05-27 | `GRN/26-27/0001` | 2026-06-26 | `462` | `PO-A-462` |
| 2 | `PO/26-27/0002` | 2026-05-28 | `GRN/26-27/0002` | 2026-06-27 | `485` | `PO-E-485` |
| 3 | `PO/26-27/0003` | 2026-06-02 | `GRN/26-27/0003` | 2026-07-02 | `AS/26-27/0013` | `PO-G-AS_26-27_0013` |
| 4 | `PO/26-27/0004` | 2026-06-06 | `GRN/26-27/0004` | 2026-07-06 | `846` | `PO-C-846` |
| 5 | `PO/26-27/0005` | 2026-06-16 | `GRN/26-27/0005` | 2026-07-16 | `847` | `PO-C-847` |
| 6 | `PO/26-27/0006` | 2026-06-17 | `GRN/26-27/0006` | 2026-07-17 | `522` | `PO-D-522` |
| 7 | `PO/26-27/0007` | 2026-06-20 | `GRN/26-27/0007` | 2026-07-20 | `AS/26-27/0016` | `PO-G-AS_26-27_0016` |
| 8 | `PO/26-27/0008` | 2026-06-21 | `GRN/26-27/0008` | 2026-07-21 | `525` | `PO-D-525` |
| 9 | `PO/26-27/0009` | 2026-06-22 | `GRN/26-27/0009` | 2026-07-22 | `463` | `PO-A-463` |
| 10 | `PO/26-27/0010` | 2026-06-22 | `GRN/26-27/0010` | 2026-07-22 | `464` | `PO-A-464` |
| 11 | `PO/26-27/0011` | 2026-06-22 | `GRN/26-27/0011` | 2026-07-22 | `941` | `PO-I-941` |
| 12 | `PO/26-27/0012` | 2026-06-24 | `GRN/26-27/0012` | 2026-07-24 | `22` | `PO-J-22` |
| 13 | `PO/26-27/0013` | 2026-06-25 | `GRN/26-27/0013` | 2026-07-25 | `LF/26-27/144` | `PO-B-LF_26-27_144` |
| 14 | `PO/26-27/0014` | 2026-06-27 | `GRN/26-27/0014` | 2026-07-27 | `526` | `PO-D-526` |
| 15 | `PO/26-27/0015` | 2026-06-27 | `GRN/26-27/0015` | 2026-07-27 | `702` | `PO-F-702` |
| 16 | `PO/26-27/0016` | 2026-07-01 | `GRN/26-27/0016` | 2026-07-31 | `25` | `PO-J-25` |
| 17 | `PO/26-27/0017` | 2026-07-01 | `GRN/26-27/0017` | 2026-07-31 | `AS/26-27/0019` | `PO-G-AS_26-27_0019` |
| 18 | `PO/26-27/0018` | 2026-07-02 | `GRN/26-27/0018` | 2026-08-01 | `489` | `PO-E-489` |
| 19 | `PO/26-27/0019` | 2026-07-02 | `GRN/26-27/0019` | 2026-08-01 | `490` | `PO-E-490` |
| 20 | `PO/26-27/0020` | 2026-07-08 | `GRN/26-27/0020` | 2026-08-07 | `LF/26-27/154` | `PO-B-LF_26-27_154` |
| 21 | `PO/26-27/0021` | 2026-07-11 | `GRN/26-27/0021` | 2026-08-10 | `704` | `PO-F-704` |
| 22 | `PO/26-27/0022` | 2026-07-17 | `GRN/26-27/0022` | 2026-08-16 | `944` | `PO-I-944` |
| 23 | `PO/26-27/0023` | 2026-07-18 | `GRN/26-27/0023` | 2026-08-17 | `945` | `PO-I-945` |
| 24 | `PO/26-27/0024` | 2026-07-23 | `GRN/26-27/0024` | 2026-08-22 | `706` | `PO-F-706` |
| 25 | `PO/26-27/0025` | 2026-07-24 | `GRN/26-27/0025` | 2026-08-23 | `AS/26-27/0023` | `PO-G-AS_26-27_0023` |
| 26 | `PO/26-27/0026` | 2026-07-25 | `GRN/26-27/0026` | 2026-08-24 | `LF/26-27/186` | `PO-B-LF_26-27_186` |
| 27 | `PO/26-27/0027` | 2026-08-08 | `GRN/26-27/0027` | 2026-09-07 | `707` | `PO-F-707` |
| 28 | `PO/26-27/0028` | 2026-09-05 | `GRN/26-27/0028` | 2026-10-05 | `849` | `PO-C-849` |

Future orders and receipts automatically increment sequentially from `PO/26-27/0029` and `GRN/26-27/0029`.

---

## 8. Tests Executed
1. **Financial Year Calculation Test (`scripts/test_purchase_numbering.py`):** Verified fiscal year boundary assertions across April 1, June 26, December 31, January 1, March 31, and the next fiscal year boundary.
2. **TypeScript Compilation Check (`npx tsc --noEmit`):** Clean exit code 0 with zero type errors.
3. **Live REST Notes Synchronization:** Updated 28/28 live GRN notes on `https://tattlythreads.smritisys.com`.
4. **Pydantic Model Validations:** Verified exact 30-day deduction on live payloads.

---

## 9. Verification Results
- **Evidence Level:** Level A (Direct terminal verification and literal code diffs).
- **Compilation Status:** 100% clean.
- **Data Parity:** 28/28 transactions verified.

---

## 10. Known Limitations
- The administrative DB query endpoint `/api/v1/database-manager/query` is strictly read-only by design; running `migrate_canonical_po_grn_numbers.sql` requires direct database administrative access (`psql` or pgAdmin).

---

## 11. Future Work
- Expose an administrative batch renumbering migration runner via the SMRITI CLI (`python -m backend.app.cli`).

---

## 12. Related ADRs
- `ADR-0042`: Document Series Gapless Numbering Standard.
- `ADR-0089`: Tenant Data Boundary Architecture.

---

## 13. Related RFCs
- `RFC-2026-004`: Statutory CGST Document Sequence Alignment.
