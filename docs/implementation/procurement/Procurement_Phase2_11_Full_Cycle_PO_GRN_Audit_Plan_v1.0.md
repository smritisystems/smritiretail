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

  * Document ID: IP-PROC-011
  * Version    : 1.0.0
  * Created    : 2026-10-03
  * Modified   : 2026-10-03
  * Copyright  : © SMRITIBooks.com. All Rights Reserved.
  * License    : Proprietary Commercial Software
  * Classification: Internal
-->

# Implementation Plan: SMRITI Procurement Phase 2.11 — End-to-End Procurement Lifecycle Audit (PO to GRN to AP GL), 1-Click Receiving Wiring & Multi-Surface Reports Studio

> **Document ID:** `IP-PROC-011`  
> **Topic:** Full Procurement Lifecycle Audit, 1-Click Receiving Wiring, Accounts Payable GL Posting, and Multi-Surface Reports Studio  
> **Area:** Procurement / Accounts Payable / General Ledger / Multi-Surface Verification  
> **Target Release:** `v6.53.0`  
> **Status:** Completed  
> **Related Walkthrough:** [`WT-PROC-011`](../../walkthrough/procurement/Procurement_Phase2_11_Full_Cycle_PO_GRN_Audit_v1.0.md)  
> **Supersedes:** None (New Phase)  
> **Predecessor:** [`IP-PROC-010` (Phase 2.10 Challan 281 & Form 26Q)](./Procurement_Phase2_10_Challan_281_Form26Q_Return_Plan_v1.0.md)

---

## 1. Objective

To execute, verify, and permanently codify the complete, unbroken procurement lifecycle in SMRITI Retail OS from Supplier Master setup through Purchase Order (PO) generation, PO submission, PO confirmation, Pending Delivery monitoring, Goods Receipt Note (GRN) inward processing with landed freight capitalization, WMS warehouse stock increment, PO status transition to RECEIVED, Purchase Bill generation linked to GRN & PO with authoritative double-entry Accounts Payable GL posting (`Account 2010 AP`), and reporting across both headless Python automated integration testing and Playwright Chromium headless visual audit with artifact screenshots.

---

## 2. Business Motivation

In modern enterprise retail operations:
1. **Zero Discrepancy Inwarding:** Store managers and godown receivers require rapid 1-click navigation from approved Purchase Orders directly into the GRN Receiving Terminal without manual order re-entry or transcription error.
2. **Authoritative Accounts Payable:** Commercial liabilities must strictly reflect real inward goods received against verified Purchase Orders, with automatic posting to `Account 2010 (Accounts Payable)` and strict double-entry balance $\sum \text{Debit} = \sum \text{Credit}$.
3. **Statutory Inventory Capitalization (Ind AS 2):** Freight, handling, and landed costs must be proportionally allocated across received line items into inventory valuation asset accounts (`Account 1040: Inventory Asset`).
4. **Lifecycle Auditability:** Every stage of the procurement cycle must be verifiable without a browser (Python automated integration test) and with visual proof (Playwright headless Chromium screenshots) across multiple surfaces.

---

## 3. Scope

- **In Scope:**
  - Automated 12-step headless integration test (`backend/app/tests/test_procurement_cycle_e2e_audit.py`).
  - Playwright Chromium visual audit runner capturing 7 high-res screenshots (`scripts/capture_procurement_cycle_visual_audit.py`).
  - Purchase Bill GL posting and atomic cancellation lifecycle in `backend/app/services/purchase.py`.
  - Supplier outstanding reconciliation logic preventing double-counting between GRN and Purchase Bill liabilities.
  - 1-Click `📥 Receive (GRN)` toolbar button in `DocumentActionToolbar.tsx` for `CONFIRMED` purchase orders.
  - Dedicated 3-tab `ProcurementReportsModal.tsx` covering Pending Delivery, Supplier Outstanding, and Purchase Summary Register.
  - Dedicated reports launch points in PO Workspace and GRN Desktop Terminal.
  - Single Source of Truth version bump to `6.53.0`.
- **Out of Scope:**
  - Express backend modifications (Express is permanently retired).
  - Ad-hoc schema mutations outside SQLAlchemy ORM models.

---

## 4. Current State

Prior to Phase 2.11:
- PO creation and GRN processing existed in isolation, but lacked end-to-end integration test coverage validating the complete unbroken lifecycle through to Accounts Payable General Ledger entries and bill cancellation.
- Converting a GRN to a Purchase Bill caused double-counting on `Supplier.outstanding` because both GRN and Bill posted liability increments.
- Operators had no 1-click action to transition an approved PO directly into GRN inwarding.
- Procurement reports (Pending Delivery, Supplier Outstanding, Purchase Summary) were scattered across separate views without a consolidated executive modal studio.

---

## 5. Gap Analysis

| Requirement | Prior State | Phase 2.11 Implementation |
|---|---|---|
| **E2E Audit Test** | Individual unit tests only | Full 12-step headless integration test `test_procurement_cycle_e2e_audit.py` (**1/1 PASSED**) |
| **Visual Proof** | Fragmented ad-hoc screenshots | Playwright script capturing 7 high-res screenshots in `docs/walkthrough/procurement/evidence/` |
| **1-Click PO Receive** | Manual navigation to GRN, re-selecting PO | `onReceive` button on `DocumentActionToolbar` auto-navigating to GRN with pre-selected PO |
| **AP GL Posting** | Standalone bill creation without GRN link | Reconciled GRN liability, populated bill items from GRN, balanced GL entries (`DR 1040/1051/1052, CR 2010`) |
| **Reports Studio** | Disconnected report tables | Unified 3-tab `ProcurementReportsModal.tsx` with KPI summary ribbon and 1-click drilldowns |

---

## 6. Architecture Impact

- **Frontend Architecture:**
  - `DocumentActionToolbar.tsx`: Added `onReceive` callback triggered on `CONFIRMED` documents.
  - `POWorkspaceTab.tsx`: Integrated `ProcurementReportsModal` and `handleReceivePO` event bridge.
  - `GrnReceiptTab.tsx` & `GrnDesktopTerminal.tsx`: Added `onOpenReports` toolbar button and auto-PO selection from `sessionStorage`.
- **Backend Architecture:**
  - `PurchaseService.create_purchase_bill`: Added reconciliation logic deducting provisional GRN liability from `supplier.outstanding` before posting authoritative GL entry to prevent duplicate liability.
  - `PurchaseService.cancel_purchase_bill`: Added symmetrical reversing GL voucher generation (`PURCHASE_BILL_CANCEL`), decrementing `supplier.outstanding` and emitting outbox events.
  - `PurchaseService.get_outstanding_suppliers`: Upgraded to return suppliers with ledger AP liability (`supplier.outstanding > 0`) as well as open PO commitments.
  - `ReportsService.purchase_summary`: Populated `supplier_code`, `ordered_amount`, and `received_amount`.

---

## 7. Proposed Design

```
[Supplier Master] 
       │
       ▼
[PO Generation (DRAFT)] ──► [PO Submit (SUBMITTED)] ──► [PO Confirm (CONFIRMED)]
                                                               │
       ┌───────────────────────────────────────────────────────┴──────────────────────┐
       │                                                                              │
       ▼                                                                              ▼
[Pending Delivery Report]                                                    [1-Click Receive in GRN]
       │                                                                              │
       │                                                                              ▼
       │                                                                   [GRN Inwarding Terminal]
       │                                                                   (Landed Cost + Ind AS 2)
       │                                                                              │
       │                                                                              ▼
       │◄────────────────────── [PO State -> RECEIVED] ◄────────────────── [WMS Batch Stock Increment]
       │                        (Cleared from Pending Delivery)                       │
       │                                                                              │
       ▼                                                                              ▼
[Procurement Reports Studio] ◄────────────────────────────────────────── [Purchase Bill Generation]
  • Pending Delivery POs                                                              │
  • Supplier Outstanding                                                              ▼
  • Purchase Summary Register                                            [Authoritative GL Posting]
                                                                         • DR 1040 Inventory Asset
                                                                         • DR 1051/1052 Input GST
                                                                         • CR 2010 Accounts Payable
                                                                         • Supplier Outstanding = Total
```

---

## 8. Files Created

1. `backend/app/tests/test_procurement_cycle_e2e_audit.py` — 12-step end-to-end headless integration test.
2. `scripts/capture_procurement_cycle_visual_audit.py` — Playwright Chromium headless visual capture script.
3. `src/components/purchase/ProcurementReportsModal.tsx` — 3-tab Procurement Reports Studio with KPI ribbon.
4. `docs/implementation/procurement/Procurement_Phase2_11_Full_Cycle_PO_GRN_Audit_Plan_v1.0.md` — This implementation plan.
5. `docs/walkthrough/procurement/Procurement_Phase2_11_Full_Cycle_PO_GRN_Audit_v1.0.md` — 13-section walkthrough with visual evidence.

---

## 9. Files Modified

1. `package.json` — Bumped version to `6.53.0`.
2. `src/config/version.ts` — Bumped SSOT version to `6.53.0`.
3. `CHANGELOG.md` — Added `[6.53.0]` changelog release notes.
4. `backend/app/services/purchase.py` — Added Purchase Bill GL posting, cancellation reversal, supplier liability reconciliation, and enhanced outstanding report.
5. `backend/app/api/v1/purchase.py` — Registered `/bills/{bill_id}/cancel` endpoints.
6. `backend/app/schemas/reports.py` — Added `supplier_code`, `ordered_amount`, and `received_amount` to `PurchaseSummaryLine`.
7. `backend/app/services/reports.py` — Populated new `PurchaseSummaryLine` fields.
8. `src/components/common/lifecycle/DocumentActionToolbar.tsx` — Added `onReceive` button for `CONFIRMED` orders.
9. `src/components/purchase/POWorkspaceTab.tsx` — Wired `onReceive` to GRN Studio and mounted `ProcurementReportsModal`.
10. `src/components/purchase/GrnReceiptTab.tsx` — Added PO auto-selection and mounted `ProcurementReportsModal`.
11. `src/components/purchase/GrnDesktopTerminal.tsx` — Added `onOpenReports` toolbar button and options menu item.
12. `docs/implementation/README.md` — Appended master implementation index.
13. `docs/walkthrough/README.md` — Appended master walkthrough index.

---

## 10. Dependencies

- FastAPI backend running on port 8000.
- Vite frontend running on port 3000.
- PostgreSQL database with authoritative Chart of Accounts (`1040`, `1051`, `1052`, `2010`, `5030`).
- Playwright Chromium with system Chrome fallback.

---

## 11. Risks & Mitigation

| Risk | Impact | Mitigation Strategy |
|---|---|---|
| Double-counting supplier liability on GRN -> Bill | Critical | Reconcile provisional GRN balance before posting final AP GL voucher |
| GL Imbalance on Bill Cancel | High | Atomic reversing entry (`PURCHASE_BILL_CANCEL`) with identical debit/credit parity |
| Browser headless dependency failures | Medium | Automated script falls back to system installed Chrome (`C:\Program Files\Google\Chrome\Application\chrome.exe`) |

---

## 12. Rollback Strategy

All database operations use atomic transactions. In the event of an issue:
1. Git revert commits on `origin/smritiNX`.
2. Cancelled purchase bills generate compensating reversal journal vouchers restoring `supplier.outstanding` and GL balances without data deletion.

---

## 13. Verification Plan

1. **Automated Integration Test:**
   - Execute `test_procurement_cycle_e2e_audit.py` with pytest.
   - Verify all 12 steps pass with exit code 0.
2. **Regression Test Suite:**
   - Execute `test_purchase.py`, `test_purchase_bill_listing.py`, and `test_purchase_bill_gl_atomicity.py`.
   - Verify 75/75 tests pass.
3. **Headless Visual Audit:**
   - Execute `capture_procurement_cycle_visual_audit.py`.
   - Verify 7 screenshots captured and inspected in `docs/walkthrough/procurement/evidence/`.
4. **TypeScript Compilation:**
   - Run `npx tsc --noEmit` to verify zero compile errors.

---

## 14. Test Plan

- **Step 1:** Master Data Setup (Company, Branch, Warehouse, Manager User, Supplier, Products).
- **Step 2:** PO Creation in DRAFT status with subtotal ₹49,000 and grand total ₹54,880.
- **Step 3:** PO Submission -> status transitions to SUBMITTED.
- **Step 4:** PO Confirmation -> status transitions to CONFIRMED.
- **Step 5:** Pending Delivery Report verification (PO present with pending qty 100).
- **Step 6:** GRN Creation against PO with Landed Freight Cost (₹1,000).
- **Step 7:** Stock verification (prod_a = 50, prod_b = 50) and PO status transition to RECEIVED.
- **Step 8:** Pending Delivery Report verification (fulfilled PO cleared).
- **Step 9:** Purchase Bill Creation with status POSTED.
- **Step 10:** General Ledger Entry verification: Journal Voucher generated, sum(Debit) = sum(Credit) = ₹54,880, Credit line to Account 2010 AP = ₹54,880.
- **Step 11:** Supplier Outstanding liability verified at ₹54,880; Outstanding and Summary reports verified.
- **Step 12:** Purchase Bill Cancellation -> status CANCELLED, compensating reversal JV generated, supplier outstanding reverted to ₹0.00.

---

## 15. Documentation Impact

- Updated `CHANGELOG.md` with version `6.53.0`.
- Created Implementation Plan `IP-PROC-011`.
- Created Walkthrough `WT-PROC-011`.
- Updated master indexes `docs/implementation/README.md` and `docs/walkthrough/README.md`.

---

## 16. Deployment Plan

- Commit and push to `origin/smritiNX`.
- Deploy backend and frontend to staging/production.
- Automated migrations ensure schema compatibility.

---

## 17. Status

**Completed** — All code written, tested, visually verified, and audited.

---

## 18. Related ADRs

- `ADR-001`: FastAPI + PostgreSQL Canonical System of Record.
- `ADR-002`: Authoritative Double-Entry General Ledger Engine.
- `ADR-003`: Ind AS 2 Inventory Valuation & Landed Cost Capitalization.

---

## 19. Related Walkthroughs

- [`WT-PROC-011` (Full Procurement Cycle PO to GRN to AP GL Audit)](../../walkthrough/procurement/Procurement_Phase2_11_Full_Cycle_PO_GRN_Audit_v1.0.md)
- [`WT-PROC-010` (Challan 281 & Form 26Q)](../../walkthrough/procurement/Procurement_Phase2_10_Challan_281_Form26Q_Return_v1.0.md)
- [`WT-PROC-009` (Statutory TDS Engine)](../../walkthrough/procurement/Procurement_Phase2_9_Statutory_TDS_Withholding_Tax_v1.0.md)
