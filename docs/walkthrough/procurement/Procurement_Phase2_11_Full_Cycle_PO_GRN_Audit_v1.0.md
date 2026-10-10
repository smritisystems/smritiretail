<!--
  Project      : SMRITI Retail OS
  Repository   : SMRITIRetailNX
  Organization : AITDL NETWORKS

  Founders

  * Pushpa Devi Jawahar Mallah
    * Founder & Chairperson
    * Phone: [REDACTED_PUBLIC_PII]
    * Email: founder@aitdl.com

  * Jawahar Ramkripal Mallah
    * Founder, Chief Executive Officer (CEO) & Chief Software Architect
    * Email: founder@aitdl.com

  * Websites: aitdl.com | erpnbook.com | smritibooks.com

  * Document ID: WT-PROC-011
  * Version    : 1.0.0
  * Created    : 2026-10-03
  * Modified   : 2026-10-03
  * Copyright  : © SMRITIBooks.com. All Rights Reserved.
  * License    : Proprietary Commercial Software
  * Classification: Internal
-->

# Walkthrough: SMRITI Procurement Phase 2.11 — End-to-End Procurement Lifecycle Audit (PO to GRN to AP GL), 1-Click Receiving Wiring & Multi-Surface Reports Studio

> **Document ID:** `WT-PROC-011`  
> **Topic:** Comprehensive Audit of Complete Procurement Lifecycle (PO -> GRN -> AP GL -> Reports -> Reversal)  
> **Area:** Procurement / Accounts Payable / General Ledger / Multi-Surface Verification  
> **Target Release:** `v6.53.0`  
> **Status:** Completed  
> **Implementation Plan:** [`IP-PROC-011`](../../implementation/procurement/Procurement_Phase2_11_Full_Cycle_PO_GRN_Audit_Plan_v1.0.md)  
> **Predecessor Walkthrough:** [`WT-PROC-010`](./Procurement_Phase2_10_Challan_281_Form26Q_Return_v1.0.md)

---

## 1. Purpose

This walkthrough documents the full verification, implementation wiring, and multi-surface audit of the unbroken procurement lifecycle in SMRITI Retail OS:
- **Without Browser Audit:** Automated Python integration test (`backend/app/tests/test_procurement_cycle_e2e_audit.py`) executing all database, ORM, business service, and accounting operations across 12 distinct stages.
- **With Headless Browser Audit:** Automated Playwright Chromium visual audit (`scripts/capture_procurement_cycle_visual_audit.py`) recording 7 high-resolution screenshots across all user workspaces into `docs/walkthrough/procurement/evidence/`.
- **UX & Wiring Polish:** 1-Click `📥 Receive (GRN)` toolbar button for `CONFIRMED` purchase orders, and a dedicated 3-tab `ProcurementReportsModal.tsx` consolidating Pending Deliveries, Supplier Outstanding Payables, and the Purchase Summary Register.

---

## 2. Scope

1. **Procurement Workflow Stages:**
   - Supplier Master Setup with GST compliance.
   - Purchase Order Generation (DRAFT), Submission (SUBMITTED), and Confirmation (CONFIRMED).
   - Pending Delivery Tracking Report.
   - Goods Receipt Note (GRN) Inwarding with Landed Cost (Inward Freight) Capitalization (Ind AS 2).
   - WMS Batch Stock Increments and PO transition to `RECEIVED`.
   - Pending Delivery Clearing.
   - Purchase Bill Creation linked to GRN and PO.
   - Authoritative General Ledger Accounts Payable (`Account 2010 AP`) Double-Entry Booking.
   - Supplier Outstanding Balance Reconciliation (preventing GRN double-counting).
   - Procurement Reports Validation (Pending Delivery, Outstanding Payables, Summary Register).
   - Purchase Bill Cancellation and Symmetrical Compensating GL Reversal.
2. **Visual Proof & Evidence:** 7 captured PNG screenshots verifying every major UX touchpoint.

---

## 3. Files Created

| File | Purpose |
|---|---|
| `backend/app/tests/test_procurement_cycle_e2e_audit.py` | 12-step end-to-end headless integration test suite (**1/1 PASSED**) |
| `scripts/capture_procurement_cycle_visual_audit.py` | Playwright Chromium headless visual capture script |
| `src/components/purchase/ProcurementReportsModal.tsx` | 3-tab Procurement Reports Studio modal with KPI ribbon |
| `docs/implementation/procurement/Procurement_Phase2_11_Full_Cycle_PO_GRN_Audit_Plan_v1.0.md` | Formal 19-section Implementation Plan `IP-PROC-011` |
| `docs/walkthrough/procurement/Procurement_Phase2_11_Full_Cycle_PO_GRN_Audit_v1.0.md` | This walkthrough document `WT-PROC-011` |

---

## 4. Files Modified

| File | Changes Made |
|---|---|
| `package.json` | Bumped version from `6.52.0` to `6.53.0` |
| `src/config/version.ts` | Bumped single-source-of-truth `APP_VERSION` to `6.53.0` |
| `CHANGELOG.md` | Documented Phase 2.11 additions and fixes under `[6.53.0]` |
| `backend/app/services/purchase.py` | Added Purchase Bill GL posting, cancellation reversal, supplier liability reconciliation, and enhanced outstanding report |
| `backend/app/api/v1/purchase.py` | Added `/bills/{bill_id}/cancel` and `/invoices/{bill_id}/cancel` endpoints |
| `backend/app/schemas/reports.py` | Added `supplier_code`, `ordered_amount`, and `received_amount` to `PurchaseSummaryLine` |
| `backend/app/services/reports.py` | Populated new `PurchaseSummaryLine` fields |
| `src/components/common/lifecycle/DocumentActionToolbar.tsx` | Added `onReceive?: () => void` prop rendering `📥 Receive (GRN)` button for `CONFIRMED` orders |
| `src/components/purchase/POWorkspaceTab.tsx` | Wired `handleReceivePO` event bridge and mounted `ProcurementReportsModal` |
| `src/components/purchase/GrnReceiptTab.tsx` | Added auto-selection of PO from `sessionStorage` and mounted `ProcurementReportsModal` |
| `src/components/purchase/GrnDesktopTerminal.tsx` | Added `onOpenReports` toolbar button and options menu item |
| `docs/implementation/README.md` | Appended `IP-PROC-011` to master index |
| `docs/walkthrough/README.md` | Appended `WT-PROC-011` to master index |

---

## 5. Architecture Decisions

1. **Reconciliation of Provisional GRN Liability:**  
   Prior to Phase 2.11, posting a GRN incremented `supplier.outstanding` by `grand_total`. When a formal Purchase Bill was created against that GRN, the AP GL posting incremented `supplier.outstanding` again, causing duplicate liability.  
   *Decision:* When creating a Purchase Bill linked to a GRN (`receipt_id`), `create_purchase_bill` deducts the provisional GRN total from `supplier.outstanding` before `UnifiedAccountingLedgerService.post_purchase_bill_to_gl` posts the final AP balance:
   $$\text{supplier.outstanding} = \max(0, \text{current} - \text{grn.grand\_total}) + \text{bill.total\_amount}$$
2. **Unified Procurement Reports Studio:**  
   Rather than requiring users to navigate to separate menus for pending inwards, commercial payables, and purchase summary registers, a dedicated 3-tab studio modal (`ProcurementReportsModal.tsx`) provides an integrated executive ribbon and 1-click actions (`Receive in GRN` and `View Ledger`).

---

## 6. Design Rationale

- **1-Click Receiving (`DocumentActionToolbar`):**  
  Store receivers previously had to navigate to the GRN studio, search for the supplier, and look up the PO. The new `📥 Receive (GRN)` button sets `sessionStorage.setItem("smriti_grn_selected_po", orderId)` and dispatches a module navigation event, landing the receiver directly inside the GRN Desktop Terminal with the order lines pre-populated.
- **Fail-Safe Headless Execution:**  
  The visual capture script automatically detects whether Chrome or Chromium is available, falling back to system-installed Google Chrome (`C:\Program Files\Google\Chrome\Application\chrome.exe`) without requiring separate binary installations.

---

## 7. Implementation Summary

### Full Procurement Flow Verified

```
[1. Supplier Setup] ────► [2. PO Draft (₹54,880)] ────► [3. PO Submit] ────► [4. PO Confirm]
                                                                                     │
                                                                                     ▼
[7. PO -> RECEIVED] ◄──── [6. Stock +50/+50] ◄──── [5. GRN Inward (Freight ₹1,000)]
         │
         ▼
[8. Purchase Bill Posted] ────► [9. GL Accounts Payable (2010 AP)] ────► [10. Supplier Outstanding ₹54,880]
                                                                                     │
                                                                                     ▼
[12. Supplier Outstanding ₹0] ◄── [11. Bill Cancel & Reversal JV] ◄── [Reports Verified]
```

---

## 8. Tests Executed

### 1. Without-Browser Headless E2E Integration Audit
```powershell
.venv\Scripts\python.exe -m pytest backend/app/tests/test_procurement_cycle_e2e_audit.py -v -s
```
**Literal Test Output:**
```text
============================= test session starts =============================
platform win32 -- Python 3.11.9, pytest-8.2.1, pluggy-1.6.0 -- F:\SMRITRretailNX\.venv\Scripts\python.exe
cachedir: .pytest_cache
rootdir: F:\SMRITRretailNX\backend
configfile: pyproject.toml
plugins: anyio-4.15.1, asyncio-0.23.7, cov-5.0.0
asyncio: mode=Mode.AUTO
collecting ... collected 1 item

backend\app\tests\test_procurement_cycle_e2e_audit.py::test_full_procurement_cycle_po_to_grn_to_ap_gl_audit PASSED

======================= 1 passed, 18 warnings in 52.29s =======================
```

### 2. Purchase Test Regression Suite
```powershell
.venv\Scripts\python.exe -m pytest backend/app/tests/test_purchase.py backend/app/tests/test_purchase_bill_listing.py backend/app/tests/test_purchase_bill_gl_atomicity.py
```
**Literal Test Output:**
```text
============================= test session starts =============================
platform win32 -- Python 3.11.9, pytest-8.2.1, pluggy-1.6.0
rootdir: F:\SMRITRretailNX\backend
configfile: pyproject.toml
plugins: anyio-4.15.1, asyncio-0.23.7, cov-5.0.0
asyncio: mode=Mode.AUTO
collected 75 items

backend\app\tests\test_purchase.py ..................................... [ 49%]
.........................                                                [ 82%]
backend\app\tests\test_purchase_bill_listing.py ......                   [ 90%]
backend\app\tests\test_purchase_bill_gl_atomicity.py .......             [100%]

======================= 75 passed, 46 warnings in 62.18s =======================
```

---

## 9. Verification Results & Visual Evidence

All 7 visual evidence screenshots were captured headlessly via Chromium and validated:

### Step 1: Vendor 360 Master & Payables Overview
![Step 1 Vendor 360 Workspace](file:///f:/SMRITRretailNX/docs/walkthrough/procurement/evidence/procurement_cycle_step1_vendor_360.png)

### Step 2: Purchase Studio PO Generation (Sizewise Matrix)
![Step 2 PO Generation](file:///f:/SMRITRretailNX/docs/walkthrough/procurement/evidence/procurement_cycle_step2_po_generation.png)

### Step 3: Purchase Studio PO Workspace (Status Badges)
![Step 3 PO Workspace](file:///f:/SMRITRretailNX/docs/walkthrough/procurement/evidence/procurement_cycle_step3_po_workspace.png)

### Step 4: GRN Studio Desktop Terminal (Inward & Landed Cost)
![Step 4 GRN Desktop Terminal](file:///f:/SMRITRretailNX/docs/walkthrough/procurement/evidence/procurement_cycle_step4_grn_studio_inward.png)

### Step 5: GRN Inward History & Purchase Bill View
![Step 5 GRN Posted and Bill](file:///f:/SMRITRretailNX/docs/walkthrough/procurement/evidence/procurement_cycle_step5_grn_posted_and_bill.png)

### Step 6: Three-Way Matching Audit Modal (PO vs GRN vs Invoice)
![Step 6 Three-Way Match Modal](file:///f:/SMRITRretailNX/docs/walkthrough/procurement/evidence/procurement_cycle_step6_three_way_match.png)

### Step 7: Procurement Reports & Audit Studio Modal (All 3 Reports)
![Step 7 Procurement Reports Studio](file:///f:/SMRITRretailNX/docs/walkthrough/procurement/evidence/procurement_cycle_step7_procurement_reports.png)

---

## 10. Known Limitations

- Multi-currency purchase receipts use the base currency (INR) exchange rate locked at PO confirmation.
- OCR automated vendor invoice parsing remains scaffolding per SMRITI Backend System-of-Record Policy (Rule 3).

---

## 11. Future Work

- Integration with GST e-Way Bill auto-generation from GRN logistics details.
- Automated payment batch scheduling directly from the Supplier Outstanding report.

---

## 12. Related ADRs

- `ADR-001`: FastAPI + PostgreSQL Sole Backend System of Record.
- `ADR-002`: Authoritative Double-Entry General Ledger Invariant.
- `ADR-003`: Ind AS 2 Inventory Valuation & Landed Cost Capitalization.

---

## 13. Related RFCs

- `RFC-2026-08`: Purchase Order to Inward Goods Lifecycle Contract.
- `RFC-2026-09`: Accounts Payable General Ledger Reconciliation Standard.
