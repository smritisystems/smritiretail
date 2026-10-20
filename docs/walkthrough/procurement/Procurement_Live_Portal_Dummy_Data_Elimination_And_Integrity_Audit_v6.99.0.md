<!--
  Project      : SMRITI Retail OS
  Repository   : SMRITIRetailNX
  Organization : AITDL NETWORKS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.99.0
  Created      : 2026-10-21
  Modified     : 2026-10-21
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough — Procurement & Vendor Master: Live Portal Dummy Data Elimination & Data Integrity Audit

**Version:** 6.99.0  
**Date:** 2026-10-21  
**Area:** Procurement, PO Generation, Sizewise Workspace, PO Print Engine, GRN Terminal, Vendor 360, Supplier Scorecard, and Statement of Account  
**Status:** Completed & Verified  

---

## 1. Purpose

This engineering implementation identifies, audits, and permanently eliminates hardcoded dummy records, synthetic sample fixtures, simulated demo benchmarks, and fabricated accounting documents across the entire **Procurement & Vendor Master** ecosystem in SMRITI Retail OS. 

Prior to this audit, several procurement and vendor workspaces silently defaulted to prototype mock objects (e.g. `Apex Fabrics Ltd`, `A. S. Shoes`, `Kapoor Textiles Ltd.`, synthetic invoice numbers `LEDGER-${vendor.code}`, fake accounting vouchers `PB-CURR-001`, and hardcoded dummy buyer coordinates `27AABCT9981K1Z2`) whenever backend endpoints returned empty datasets or encountered transient connectivity errors. This work replaces all prototype artifacts with authoritative database-backed structures, strict tenant isolation, dynamic buyer profile resolution, and honest, informative empty states.

---

## 2. Scope

The audit and remediation covered the following key functional surfaces and files:

1. **Purchase Requisitions Workspace (`src/components/purchase/PurchaseRequisitionWorkspace.tsx`):**
   - Eliminated initial sample footwear requisition item `Classic Formal Leather Shoe - Tan` (`SKU-FOOT-001`).
   - Initialized line items cleanly to `[]` and added honest empty-state UI guidance.
2. **Supplier RFQ Workspace (`src/components/purchase/SupplierRfqWorkspace.tsx`):**
   - Eliminated initial sample item `Classic Formal Leather Shoe - Tan` (`SKU-FOOT-001`).
   - Initialized RFQ line items cleanly to `[]`.
3. **PO Generation Tab (`src/components/purchase/PoGenerateTab.tsx`):**
   - Eradicated hardcoded prototype fallback suppliers (`Apex Fabrics Ltd`, `Campus Activewear Ltd`, `Bata Footwear India Ltd`).
   - Eliminated dummy fallback GSTIN (`27AAAAC0553K1Z8`), placeholder city/state (`Mumbai, Maharashtra`), and dummy phone number (`+91 22 1234 5678`).
   - Bound supplier coordinates strictly to `selectedSupplier` properties with truthful fallbacks (`"Not Registered"`, `"No Phone"`).
4. **PO Sizewise Tab (`src/components/purchase/PoSizewiseTab.tsx`):**
   - Eradicated hardcoded fallback supplier `A. S. Shoes` (`SUP-548042`, GSTIN `27ABEPA1910C1ZK`).
   - Defaulted suppliers list truthfully to `[]` when API returns empty.
5. **PO Print Engine & Preview Modal (`src/components/purchase/POPrintPreviewModal.tsx`):**
   - Eliminated synthetic footwear attributes (`"Genuine Calf Leather / Microfiber"`, `"Anti-Skid TPR / Goodyear Welt"`), fake size ratios (`eu40 = cartons * 1`), and hardcoded prices (`1999`, `1800`).
   - Bound upper material, outsole, and heels dynamically to `resolveFootwearAttributes()`.
   - Eliminated hardcoded company profile (`name: "SMRITI Retail OS"`, `gstin: "27AABCT9981K1Z2"`, `pan: "AABCT9981K"`).
   - Bound company coordinates dynamically to tenant context (`customCompanyProfile` or `getTenantCompanyContext()`).
   - Eliminated forced 120-day override on payment terms; respects `header.paymentTerms` or supplier contract.
   - Eliminated hardcoded DC gate `"Gate 1 - Central Footwear Bay"`.
   - Converted modal to an isomorphic React component compatible with SSR / test environments.
6. **Supplier Scorecard Modal (`src/components/purchase/SupplierScorecardModal.tsx`):**
   - Eliminated `SAMPLE_DEMO_PROFILES` (`Kapoor Textiles Ltd.`, `Mehta Synthetics Pvt.`, `Sharma Accessories Co.`) and `makeSampleDemoOrders` (`PO-001` through `PO-007`).
   - Removed `dataMode` and "Show Demo Benchmark" toggle button.
   - Bound scorecard strictly to database records `dbSuppliers` and `dbOrders`.
   - Rendered honest empty state (`"No Supplier Records Found"`) when database has no records.
7. **Vendor Payables Tab (`src/components/vendor/tabs/VendorPayablesTab.tsx`):**
   - Eliminated synthetic invoice row injection `invoiceNo: "LEDGER-${vendor.code}"` into the subledger bills table.
   - Initialized `loading` to `false` and rendered honest empty state explaining unitemized master profile opening balances.
8. **Vendor Scorecard Tab (`src/components/vendor/tabs/VendorScorecardTab.tsx`):**
   - Eliminated phantom 100% Grade AAA ratings and Tier 1 Preferred Partner classification for new/zero-order vendors.
   - Classified zero-order vendors as `UNRATED` / `TIER 0 — NEW VENDOR (NO ORDERS RECORDED)` with `0%` / `—` KPI metrics.
   - Made contractual SLA progress bars reflect dynamic payment terms days instead of hardcoded 120 days.
   - Dynamically computed SLA verdict (`ON TIME`, `DELAYED`, `PENDING`) in PO delivery lifecycle table instead of forcing hardcoded "ON TIME".
   - Generalized peer benchmark title from hardcoded "Footwear Suppliers" to "Suppliers".
9. **Vendor Statement of Account Modal (`src/components/vendor/tabs/VendorStatementOfAccountModal.tsx`):**
   - Removed synthesized client-side statement fallback generating fake voucher `PB-CURR-001` and company `CMP-NX-PREVIEW` on error.
   - Added `error` state and rendered honest error alert when backend accounting ledger is unreachable.
   - Safeguarded running balance calculations and upgraded audit seal hash to `V6.99`.
10. **GRN Receipt Tab (`src/components/purchase/GrnReceiptTab.tsx`):**
    - Dynamically resolved `vendor_gstin` in `ThreeWayMatchingModal` context from `suppliersList` and `selectedOrder` instead of passing blank `""`.

---

## 3. Files Created

- `src/tests/procurementDataIntegrityAndDummyElimination.test.tsx` (100% pass across 8 test suites verifying elimination of dummy data, fallback mocks, and truthful grading).
- `docs/walkthrough/procurement/Procurement_Live_Portal_Dummy_Data_Elimination_And_Integrity_Audit_v6.99.0.md` (this document).

---

## 4. Files Modified

1. `src/components/purchase/PurchaseRequisitionWorkspace.tsx`
2. `src/components/purchase/SupplierRfqWorkspace.tsx`
3. `src/components/purchase/PoGenerateTab.tsx`
4. `src/components/purchase/PoSizewiseTab.tsx`
5. `src/components/purchase/POPrintPreviewModal.tsx`
6. `src/components/purchase/SupplierScorecardModal.tsx`
7. `src/components/vendor/tabs/VendorStatementOfAccountModal.tsx`
8. `src/components/vendor/tabs/VendorPayablesTab.tsx`
9. `src/components/vendor/tabs/VendorScorecardTab.tsx`
10. `src/components/purchase/GrnReceiptTab.tsx`
11. `docs/walkthrough/README.md`
12. `CHANGELOG.md`

---

## 5. Architecture Decisions

### AD-PROC-01: Sovereign Isolation of Tenant Corporate Coordinates
PO printing must never inject hardcoded buyer corporate identities (`SMRITI Retail OS`, `27AABCT9981K1Z2`). All print templates and preview modals resolve corporate details hierarchically:
1. `customCompanyProfile` passed explicitly as a prop.
2. `getTenantCompanyContext()` / local tenant settings.
3. If no corporate identity is configured, SMRITI's statutory Fail-Closed protection engages: `CORPORATE IDENTITY NOT CONFIGURED — PRINTING BLOCKED`.

### AD-PROC-02: Zero-Order Vendor Honest Grading (Tier 0 — Unrated)
Under no circumstances may an unrated or newly onboarded supplier with 0 purchase orders be awarded 100/100, Grade AAA, and Tier 1 Preferred Partner status. The SLA engine must classify zero-order vendors as `UNRATED` / `TIER 0 — NEW VENDOR (NO ORDERS RECORDED)` with neutral visual badges and `—` scores.

### AD-PROC-03: Prohibition of Fabricated Subledger Invoices
When a vendor has an opening balance liability in their master record but no itemized purchase bills exist in `purchase_bills`, the system must never synthesize a dummy invoice `LEDGER-${vendor.code}`. Instead, the UI informs the user that an opening balance exists on the master profile and the subledger bills table displays an honest empty state.

---

## 6. Design Rationale

During early UI prototyping, fallback mocks allowed developers to preview layouts without an active backend. However, in production, these fallbacks silently leak into real operator screens, giving false impressions of business relationships, printing erroneous tax IDs, and misclassifying vendor performance. Eradicating all prototype fixtures enforces complete transparency and guarantees that every displayed metric reflects physical reality in PostgreSQL.

---

## 7. Implementation Summary & Traceability Table

| Screen / Field | Component | API Endpoint | Response Field | Database Model | PostgreSQL Column | Remediation Summary |
|---|---|---|---|---|---|---|
| PO Generate Supplier Fallbacks | `PoGenerateTab.tsx` | `GET /purchase/suppliers/` | `items[]` | `Supplier` | `name`, `code`, `gst_number` | Removed fallback `Apex Fabrics`, `Campus Activewear`, `Bata Footwear`, and dummy GSTIN `27AAAAC0553K1Z8`. |
| PO Sizewise Supplier Fallback | `PoSizewiseTab.tsx` | `GET /purchase/suppliers/` | `items[]` | `Supplier` | `name`, `code`, `gst_number` | Removed fallback `A. S. Shoes` (`SUP-548042`, `27ABEPA1910C1ZK`). |
| PO Print Buyer Profile | `POPrintPreviewModal.tsx` | `GET /api/v1/company/profile` | `company_name`, `gstin` | `Company` | `name`, `gstin`, `pan` | Eliminated hardcoded `27AABCT9981K1Z2` & `AABCT9981K`. Bound to dynamic tenant context. |
| PO Print Material Attributes | `POPrintPreviewModal.tsx` | `GET /inventory/` | `attributes_json` | `Product` | `attributes_json` | Eliminated hardcoded `"Genuine Calf Leather"` & `"Anti-Skid TPR"`. Bound to `resolveFootwearAttributes()`. |
| Supplier Scorecard Benchmark | `SupplierScorecardModal.tsx` | `GET /purchase/reports/outstanding` | `items[]` | `Supplier`, `PurchaseOrder` | Aggregated SLA fields | Removed "Show Demo Benchmark" toggle and mock profiles (`Kapoor`, `Mehta`, `Sharma`). |
| Vendor 360 Payables Invoices | `VendorPayablesTab.tsx` | `GET /purchase/bills/` | `items[]` | `PurchaseBill` | `bill_no`, `total_amount` | Eliminated synthetic row fabrication `LEDGER-${vendor.code}` when bills list is empty. |
| Vendor 360 SLA Grade | `VendorScorecardTab.tsx` | `GET /purchase/reports/outstanding` | `total_orders`, `otd_pct` | `PurchaseOrder` | `status`, `delivery_date` | Replaced phantom 100% Grade AAA with `UNRATED` / Tier 0 for 0-order suppliers. |
| Statement of Account | `VendorStatementOfAccountModal.tsx` | `GET /purchase/vendors/{id}/statement` | `lines[]`, `summary` | Double-entry GL 2010 | Journal voucher lines | Removed synthesized client-side statement `PB-CURR-001` and company `CMP-NX-PREVIEW` on error. |
| Requisitions Initial Items | `PurchaseRequisitionWorkspace.tsx` | Form state | N/A | `PurchaseRequisition` | `items` | Eliminated sample SKU `SKU-FOOT-001` from initial state. Initialized to `[]`. |
| RFQ Initial Items | `SupplierRfqWorkspace.tsx` | Form state | N/A | `SupplierRfq` | `items` | Eliminated sample SKU `SKU-FOOT-001` from initial state. Initialized to `[]`. |

---

## 8. Tests Executed

### Automated Frontend Test Suites (Vitest)
```bash
npx vitest run src/tests/poPrintBrandingAndTerms.test.tsx \
               src/tests/poSizewiseGrouping.test.tsx \
               src/tests/poGenerate.test.ts \
               src/tests/procurementAndReportsAudit.test.ts \
               src/tests/customerDataIntegrityAndDummyElimination.test.tsx \
               src/tests/procurementDataIntegrityAndDummyElimination.test.tsx
```
**Terminal Output:**
```text
 RUN  v4.1.11 F:/SMRITRretailNX

 ✓ src/tests/poPrintBrandingAndTerms.test.tsx (9 tests) 106ms
 ✓ src/tests/customerDataIntegrityAndDummyElimination.test.tsx (6 tests) 62ms
 ✓ src/tests/poSizewiseGrouping.test.tsx (10 tests) 85ms
 ✓ src/tests/poGenerate.test.ts (3 tests) 8ms
 ✓ src/tests/procurementAndReportsAudit.test.ts (3 tests) 8ms
 ✓ src/tests/procurementDataIntegrityAndDummyElimination.test.tsx (8 tests) 85ms

 Test Files  6 passed (6)
      Tests  39 passed (39)
   Start at  00:36:00
   Duration  2.44s
```

### Static Analysis & TypeScript Verification
```bash
npx tsc --noEmit
```
**Terminal Output:** Exit code 0 (0 errors).

### Version SSOT Verification
```bash
python scripts/validate_version_ssot.py
```
**Terminal Output:**
```text
--- SMRITI Version SSOT Inspection ---
package.json          : 6.99.0
backend/core/config.py: 6.99.0
src/config/version.ts : 6.99.0
CHANGELOG.md (head)   : 6.99.0

[PASS] Version SSOT consistent across all boundaries: 6.99.0
```

### Backend Purchase Test Suite (Pytest)
```bash
pytest backend/app/tests/test_purchase.py -v
```
**Terminal Output:**
```text
================= 62 passed, 24 warnings in 156.10s (0:02:36) =================
```

### Production Build Verification
```bash
npm run build
```
**Terminal Output:**
```text
✓ 3742 modules transformed.
✓ built in 1m 1s
```

---

## 9. Verification Results

| Target Check | Expected | Actual | Status |
|---|---|---|---|
| PO Workspace Dummy Suppliers | 0 fake suppliers in PO generation/sizewise | 0 found | Done |
| PO Print Buyer Identity | Dynamic tenant coordinates; no fake GSTINs | Verified dynamic | Done |
| Vendor Payables Fake Invoices | No `LEDGER-${vendor.code}` generated | 0 synthesized | Done |
| Vendor Scorecard Zero-Order | Tier 0 Unrated (not Grade AAA) | Verified `UNRATED` | Done |
| Statement of Account Fallback | No fake `PB-CURR-001` or `CMP-NX-PREVIEW` | Honest error state | Done |
| Automated Frontend Tests | 39/39 passed | 39/39 passed | Done |
| Automated Backend Tests | 62/62 passed | 62/62 passed | Done |
| TypeScript Compiler Check | 0 errors | 0 errors | Done |
| Production Vite Build | Exit code 0 | Exit code 0 | Done |

---

## 10. Known Limitations

- Subledger purchase bills require explicit posting via GRN or Purchase Bill Studio before itemized invoice aging schedules populate. Unitemized opening balances from the master profile are displayed as informational banners rather than synthesized into document rows.

---

## 11. Future Work

- Implement multi-currency FX revaluation for foreign supplier purchases.
- Add real-time automated GSTIN status verification hook against NIC / GST portal on vendor creation.

---

## 12. Related ADRs

- `ADR-0038`: Strangler-Fig FastAPI PostgreSQL Sole Backend Architecture
- `ADR-0042`: Fail-Closed Printing & Statutory Company Profile Verification
- `ADR-0056`: Canonical Document Numbering & Indian Fiscal Year Alignment

---

## 13. Related RFCs

- `RFC-2026-07`: Sovereign Multi-Tenant Data Boundary Protection
- `RFC-2026-12`: Truthful Supplier Scorecard & Double-Entry AP Reconciliation
