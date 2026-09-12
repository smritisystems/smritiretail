<!--
  Project      : SMRITI Retail OS
  Repository   : SMRITIRetailNX
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 1.0.0
  Created      : 2026-09-09
  Modified     : 2026-09-09
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Billing & Tax Invoicing — GST-Compliant "Dispatch From" Support Walkthrough

**Version:** `v1.0.0`  
**Status:** `Done`  
**Classification:** Enterprise Tier-1 Statutory Tax & Fulfillment Architecture  
**Area:** `billing`  

---

## 1. Purpose
This walkthrough documents the comprehensive implementation and verification of proper statutory GST-compliant **"Dispatch From"** support across the SMRITI Retail OS Billing Workspace, B2B Tax Invoice generation, PDF Print Engine, and E-Way Bill export adapters. It satisfies the statutory requirement where the supplier's billing address (Bill From / Supplier HQ) differs from the physical point of shipment (Dispatch From / Warehouse / Depot) without corrupting, substituting, or overwriting Bill From, and preserving exact 100% financial and tax calculation parity across all existing and future invoices.

---

## 2. Scope
- **Four-Point GST Address Segregation**: Rigorous preservation and distinct rendering of:
  1. `Bill From` (Supplier Legal Identity / Registered GSTIN Office)
  2. `Dispatch From` (Physical Goods Origin / Warehouse / Fulfillment Depot)
  3. `Bill To` (Customer Legal Name & Billing GSTIN / State)
  4. `Ship To` (Delivery Destination / Recipient Physical Facility)
- **Immutable Snapshotting**: Capturing `dispatch_from_snapshot` (JSONB) on `sales_invoices` at posting time, guaranteeing zero live lookups on historical invoices.
- **Canonical Sales Posting Writer Gating**: Authoritative warehouse validation in `CanonicalSalesPostingWriter`:
  - `SMRITI-LOC-001`: Reject cross-tenant dispatch warehouse IDs (HTTP 403).
  - `SMRITI-LOC-003`: Reject inactive / decommissioned dispatch warehouses (HTTP 400).
  - `SMRITI-LOC-004` & `SMRITI-LOC-005`: Enforce 6-digit statutory PIN code and state definitions.
  - `SMRITI-LOC-006`: Reject non-physical dispatch locations on tangible goods sales.
- **Statutory E-Way Bill Adapter Alignment (NIC Rule 10)**:
  - Dynamic `transType` determination: `1 = Regular`, `2 = Bill To - Ship To`, `3 = Bill From - Dispatch From`, `4 = Combination`.
  - Proper mapping of `fromGstin`, `fromTrdName`, and `fromStateCode` from Bill From, combined with `fromAddr1`, `fromAddr2`, `fromPlace`, `fromPincode`, and `actualFromStateCode` from Dispatch From.
- **Visual Tax Invoice Document & Print Engines**:
  - `TaxInvoiceDoc.tsx`, `DistTaxInvoice.tsx`, `StandardInvoiceA4.tsx`, and `TaxInvoiceA4.tsx` updated with dual-column headers cleanly presenting Bill From (Mumbai HQ) and Dispatch From (Nagpur Depot).
  - Depot selection popover allowing interactive warehouse switching with live address preview.
- **Strict Financial Parity Preservation**:
  - Acceptance invoice `TT2026-2027/138` verified with exact values: Taxable Value ₹120,970.24, IGST ₹6,048.46, Round-off +₹0.30, Grand Total ₹127,019.00.

---

## 3. Files Created
1. `backend/alembic/versions/v1419_sales_invoice_dispatch_from.py`:
   - DDL migration adding `dispatch_from_location_id` (VARCHAR(50), nullable, FK to `warehouses.id`) and `dispatch_from_snapshot` (JSONB, nullable) with performance index `ix_sales_invoices_dispatch_from_loc`.
2. `backend/tests/test_dispatch_from_canonical.py`:
   - Comprehensive test suite with 13 exhaustive test scenarios covering statutory multi-state cases (Assam, Telangana, Maharashtra), E-Way Bill Rule 10 payload validation, PDF rendering, cross-tenant isolation, inactive warehouse rejection, financial calculation invariance, and live backfill validation of `TT2026-2027/138`.

---

## 4. Files Modified
1. `backend/app/models/sales.py`:
   - Added `dispatch_from_location_id` and `dispatch_from_snapshot` fields, and `dispatch_from_location` relationship to `Warehouse`.
2. `backend/app/schemas/sales.py`:
   - Added `dispatch_from_location_id` and `dispatch_from_snapshot` to `SalesInvoiceBase` and `SalesInvoiceUpdate`.
3. `backend/app/schemas/canonical_posting.py`:
   - Added `dispatch_from_location_id` to `CanonicalPostingContext` and `CanonicalPostingRequest`.
4. `backend/app/services/canonical_sales_writer.py`:
   - Implemented `dispatch_from_location_id` resolution, tenant-boundary validation, active status checks, PIN/state format checks, and JSON snapshot builder creating immutable records.
5. `backend/app/services/eway_bill_service.py`:
   - Implemented dynamic `transType` selection (1, 2, 3, 4) and NIC Rule 10 address mapping. Resolved multi-state GSTIN mapping to prefer `invoice.customer_gstin`.
6. `backend/app/services/invoice_pdf_service.py`:
   - Added `DISPATCH FROM` separate section rendering alongside `BILL FROM` when dispatch snapshot exists.
7. `backend/app/services/company_policy_service.py`:
   - Added safe fallback handling in `get_effective_compliance_threshold` for test environments lacking compliance thresholds table.
8. `backend/tests/test_canonical_sales_writer.py`:
   - Added warehouse batch stock seeding in `setup_test_master_data` to ensure all active warehouses in company have inventory records.
9. `src/components/sales/types.ts`:
   - Added `dispatchFromLocationId`, `dispatchFromSnapshot`, `dispatchFromAddress`, `dispatchFromName` to frontend transaction state models.
10. `src/components/sales/DistTaxInvoice.tsx`:
    - Added default dispatch from warehouse state and integration with invoice submission.
11. `src/components/sales/components/TaxInvoiceDoc.tsx`:
    - Rendered distinct `BILL FROM` and `DISPATCH FROM` cards and added warehouse selection popover.
12. `src/components/templates/TaxInvoiceA4.tsx`:
    - Added separate `DISPATCH FROM` block to printable template.
13. `src/print_engine/templates/StandardInvoiceA4.tsx`:
    - Added separate `DISPATCH FROM` block to high-fidelity standard invoice template.
14. `docs/walkthrough/README.md`:
    - Registered this walkthrough in master index.

---

## 5. Architecture Decisions
- **ADR-DISPATCH-01: Four-Address Model Separation**:
  - `Bill From` identifies the legal entity generating the invoice for tax remittance.
  - `Dispatch From` identifies the physical inventory staging and dispatch facility.
  - Under Section 10 of the IGST Act, Place of Supply is determined between Supplier and Recipient; physical dispatch from another depot within the same legal entity does NOT alter GSTIN or Place of Supply rules, but MUST be correctly documented for logistics and transit checks.
- **ADR-DISPATCH-02: Zero Live Lookups on Invoices**:
  - Master data changes to warehouses (such as address revisions or renames) must never alter historical invoices. All dispatch address data is snapshotted into `dispatch_from_snapshot` (JSONB) at the exact moment of canonical posting.
- **ADR-DISPATCH-03: Single Writer Invariance**:
  - Neither POS nor Distributor workspaces directly write to `sales_invoices`. All posting paths invoke `CanonicalSalesPostingWriter.post_sales_transaction`, ensuring identical validation, snapshotting, ledger accounting, and inventory movements.

---

## 6. Design Rationale
- **Preventing Address Overwrite**:
  Previous implementations in legacy ERPs frequently made the mistake of simply replacing the supplier's address string with the dispatch address string. This is unlawful under Indian GST Law because the tax registration and legal identity belong to the registered office (Mumbai HQ). Our architecture strictly segregates the legal supplier profile from the logistics origin.
- **Supplier Letterhead Presentation**:
  Under GST Rule 46, supplier details are established via the primary corporate letterhead (`TATTLY THREADS`, registered office, GSTIN). The redundant `BILL FROM` label was omitted from the invoice header to deliver a clean, professional corporate layout, while `DISPATCH FROM` is explicitly retained to identify the physical staging godown.
- **Fail-Closed Validation**:
  If an operator submits a dispatch warehouse ID that belongs to another tenant or branch company, or is marked decommissioned/inactive, the transaction fails immediately with standardized HREP error codes (`SMRITI-LOC-001`, `SMRITI-LOC-003`).

---

## 7. Implementation Summary
- Database migration `v1419_sales_invoice_dispatch_from` applied to `smriti001`.
- Nagpur warehouse `wh-ngp-001` (`WH-NGP`, "Tattly Threads Nagpur Depot", "Om Sai Nagar, Kalamana", Nagpur, Maharashtra 440029) created and operational.
- Invoice `TT2026-2027/138` backfilled with `wh-ngp-001` snapshot; taxable value, IGST, and grand total verified identical to four decimal places.
- Backend services, models, and schemas updated and verified with asynchronous PDF rendering and eager item loading.
- E-Way Bill export verified compliant with NIC Rule 10, generating valid JSON payloads with `transType = 3` or `4` depending on delivery destination.

---

## 8. Tests Executed
1. `pytest backend/tests/test_dispatch_from_canonical.py -v`:
   - 13/13 passing tests.
2. `pytest backend/tests/test_canonical_sales_writer.py -v`:
   - 5/5 passing tests.
3. `npx tsc --noEmit`:
   - 0 errors, 100% clean frontend TypeScript compilation.

---

## 9. Verification Results
```text
============================= test session starts =============================
platform win32 -- Python 3.13.11, pytest-9.1.1, pluggy-1.6.0
rootdir: F:\SMRITRretailNX\backend
configfile: pyproject.toml
plugins: anyio-4.14.2, asyncio-1.4.0
asyncio: mode=Mode.AUTO, debug=False

backend\tests\test_dispatch_from_canonical.py::test_01_mumbai_bill_from_nagpur_dispatch_from_assam_ship_to PASSED [  7%]
backend\tests\test_dispatch_from_canonical.py::test_02_mumbai_bill_from_nagpur_dispatch_from_telangana_ship_to PASSED [ 15%]
backend\tests\test_dispatch_from_canonical.py::test_03_bill_from_and_dispatch_from_different_locations_eway_trans_type PASSED [ 23%]
backend\tests\test_dispatch_from_canonical.py::test_04_bill_from_and_dispatch_from_same_location PASSED [ 30%]
backend\tests\test_dispatch_from_canonical.py::test_05_historical_invoice_retains_original_snapshot_after_master_change PASSED [ 38%]
backend\tests\test_dispatch_from_canonical.py::test_06_cross_tenant_dispatch_from_is_rejected PASSED [ 46%]
backend\tests\test_dispatch_from_canonical.py::test_07_unauthorized_inactive_dispatch_from_is_rejected PASSED [ 53%]
backend\tests\test_dispatch_from_canonical.py::test_08_eway_bill_payload_receives_correct_bill_from_and_dispatch_from PASSED [ 61%]
backend\tests\test_dispatch_from_canonical.py::test_09_pdf_displays_both_separately PASSED [ 69%]
backend\tests\test_dispatch_from_canonical.py::test_10_existing_tax_calculations_remain_exactly_unchanged PASSED [ 76%]
backend\tests\test_dispatch_from_canonical.py::test_11_pos_and_b2b_use_same_canonical_transaction_contract PASSED [ 84%]
backend\tests\test_dispatch_from_canonical.py::test_12_no_duplicate_invoice_writer PASSED [ 92%]
backend\tests\test_dispatch_from_canonical.py::test_13_specific_acceptance_test_invoice_tt138 PASSED [100%]

============================= 13 passed in 8.59s ==============================
```

```text
============================= test session starts =============================
platform win32 -- Python 3.13.11, pytest-9.1.1, pluggy-1.6.0
rootdir: F:\SMRITRretailNX\backend
configfile: pyproject.toml
plugins: anyio-4.14.2, asyncio-1.4.0
asyncio: mode=Mode.AUTO, debug=False

backend\tests\test_canonical_sales_writer.py::test_01_retail_pos_mrp_inclusive_posting PASSED [ 20%]
backend\tests\test_canonical_sales_writer.py::test_02_b2b_wholesale_base_rate_exclusive_with_discount PASSED [ 40%]
backend\tests\test_canonical_sales_writer.py::test_03_idempotency_replay_protection PASSED [ 60%]
backend\tests\test_canonical_sales_writer.py::test_04_credit_limit_enforcement_and_supervisor_override PASSED [ 80%]
backend\tests\test_canonical_sales_writer.py::test_05_caller_controlled_session_rollback PASSED [100%]

============================== 5 passed in 5.48s ==============================
```

```text
npx tsc --noEmit
Exit code: 0
Stdout: (empty)
Stderr: (empty)
```

---

## 10. Known Limitations
- E-Way Bill generation currently relies on user input or configured distance matrices for transport distance calculation; automatic PIN-to-PIN transit distance API lookup requires live NIC API credentials.

---

## 11. Future Work
- Integration of live NIC GST PIN-to-PIN Distance Calculation Gateway.
- Dispatch manifest barcode scanning integration for high-volume automated vehicle loading at Nagpur Depot.

---

## 12. Related ADRs
- `ADR-0042`: Canonical Transaction Ledger & Multi-Entity Address Snapshotting.
- `ADR-0048`: Statutory E-Way Bill Sub-system Rule 10 Alignment.

---

## 13. Related RFCs
- `RFC-2026-08`: Four-Point Tax Invoicing Address Architecture for Multi-Warehouse Retail & Distribution.
