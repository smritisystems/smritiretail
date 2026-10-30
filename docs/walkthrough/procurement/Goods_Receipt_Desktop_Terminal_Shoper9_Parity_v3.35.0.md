<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.35.0
  Created      : 2026-09-24
  Modified     : 2026-09-24
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: Goods Receipt (GRN) Desktop Terminal & Shoper 9 Parity Implementation

**Version:** 3.35.0  
**Area:** Procurement / Inward Goods Receipt (`src/components/purchase/`)  
**Status:** Completed & Verified  

---

## 1. Purpose
Implement a high-speed, modern desktop Goods Receipt (GRN) terminal in SMRITI Retail OS based on the user-provided UI specification, achieving full visual, ergonomic, and workflow parity with legacy retail ERPs (Shoper 9 `SR200100`) while preserving SMRITI's Ind-AS 2 landed cost engine and multi-tenant PostgreSQL backend.

---

## 2. Scope
- **Components:**
  - `src/components/purchase/GrnDesktopTerminal.tsx` (New Desktop Workspace)
  - `src/components/purchase/GrnReceiptTab.tsx` (Primary Workspace Routing & Integration)
  - `src/tests/grnDesktopTerminal.test.ts` (Automated Mathematical & Ergonomic Test Suite)
- **Top Header Bar:** Package brand icon, active financial date/store subtitle, and standard action buttons (`[Open]`, `[+ New]`, `[Save]`, `[Print]`, `[...]`).
- **Form Parameters Card:**
  - Left: Transaction Type (`Purchase`, `Inter-Branch Inward`, etc.), Reason Code (`ITFR`, `NORMAL`, etc.).
  - Middle: Supplier ID with Search lens, Supplier Name display, `[x] Add Tax to Cost` statutory checkbox, Ref/DC No with browse button, DC Date with calendar picker, Doc Remarks, Doc Prefix (`P17`), and Doc No (`41`).
  - Right: Quick Action Palette with 5 numbered rows (`1. Select Purchase Order`, `2. Load from PF File`, `3. Load from PDT File`, `4. Load Outward to Inward`, `5. Show Item Tags`).
- **Main Grid:** 15+ high-density numbered rows displaying all 16 statutory columns (`#`, `Stock No`, `Item Description`, `Doc Qty`, `Act Qty`, `Selling Price`, `Purchase Price`, `Value`, `Discount Rate/Amt`, `Tax Rate/Amt`, `Addon Before/After Tax`, `Deduction Before/After Tax`).
- **Docked Direct Entry Strip:** Column-for-column aligned direct input row under row 15 with autofocus, live barcode scanner lookup, and active blue focus styling on `Doc Qty`. Pressing Enter commits the line to the grid.
- **Summary & Calculation Card:** 3 summary blocks (`Total Doc Qty`, `Total Act Qty`, `Total Value`), 3 calculation matrices (`Discount`, `Deduction`, `Addon` with Rate and Amount), `Doc. Total`, and `DC/Inv. Total` with variance detection.
- **Real-Time Telemetry Bar:** Live line-item telemetry (`Current Balance`, `Reserved Stock`, `Available Balance`, `Last Purchase Price`) for the active highlighted SKU.
- **Bottom Action Footer:** `[+ Add]`, `[Edit]`, `[Delete]`, `[Reprint]`, `[Exit]`, `[✓ OK]`, `[✕ Cancel]`.

---

## 3. Files Created
- `src/components/purchase/GrnDesktopTerminal.tsx`: Core desktop Goods Receipt terminal component.
- `src/tests/grnDesktopTerminal.test.ts`: Unit test suite covering calculations, line totals, and Shoper 9 parity.
- `docs/walkthrough/procurement/Goods_Receipt_Desktop_Terminal_Shoper9_Parity_v3.35.0.md`: This document.

---

## 4. Files Modified
- `src/components/purchase/GrnReceiptTab.tsx`: Mounted `GrnDesktopTerminal` as the default presentation for Inward Studio (`subView === "create"`), provided dual-mode switching (`desktop` / `wizard`), and wired all backend save, print, and modal callbacks.
- `docs/walkthrough/README.md`: Appended new walkthrough entry to the master index.

---

## 5. Architecture Decisions
1. **Desktop-First Default with Guided Wizard Fallback:** The high-speed single-screen desktop interface is the default operational surface for warehouse receiving clerks. The existing 5-step wizard remains accessible via the Top Application Bar for complex auditing or trainee onboarding.
2. **Statutory Tax Capitalization (`Add Tax to Cost`):** Added the checkbox to allow capitalization of GST into landed inventory cost for non-creditable inward items or composition dealers, fulfilling Indian accounting standards.
3. **Ergonomic Direct Entry Dock:** Kept the docked scanning strip beneath the main grid to ensure cashiers and receivers never need to lift hands from the keyboard during carton intake.
4. **Preservation of Backend Outbox & Lineage:** The `[✓ OK]` button triggers `ConfirmGrnPostModal` and commits directly to `/purchase/receipts/`, ensuring complete compatibility with existing Alembic migrations and transactional PostgreSQL tables.

---

## 6. Design Rationale
Retail receiving speed requires minimal mouse travel and high information density. The previous 5-step wizard required 5 screen transitions to receive an order. The new Desktop Terminal consolidates PO selection, line receiving, discrepancy checking, and landed cost totals into a single cohesive layout matching cashier muscle memory.

---

## 7. Implementation Summary
- **Component Size:** 850 lines of modular TypeScript / Tailwind CSS.
- **Color Palette:** Clean enterprise slate and indigo (`#00288e`, `#f8fafc`, `#e2e8f0`).
- **Telemetry:** Real-time stock balance query with sub-millisecond local state synchronization.
- **Dual Mode:** Seamless toggling between `GrnDesktopTerminal` and `GrnWorkflowWizard`.

---

## 8. Tests Executed
```bash
npx tsc --noEmit
npx vitest run src/tests/grn
python scripts/ci_ux_field_governance_guard.py
```

---

## 9. Verification Results
- **TypeScript Compilation:** 0 errors (`tsc --noEmit` exit code 0).
- **Vitest Suites:** 49/49 passed across 7 test files (`grnDesktopTerminal.test.ts`, `grnBarcodeScanner.test.ts`, `grnPoEligibilityAndConfirmation.test.ts`, `grnWorkflowStepIntegration.test.ts`, `grnWorkflowWizard.test.ts`, `grnManualLandedCostAllocation.test.ts`, `grnCsvImportEngine.test.ts`).
- **CI Field Governance Guard:** 0 critical/error violations.

---

## 10. Known Limitations
None. All existing modals (3-Way Matching, RMA Management, Debit Note for PPV, CSV Import, Camera Scanner) remain fully functional.

---

## 11. Future Work
- Bluetooth wireless barcode batch gun direct serial stream listening.
- Auto-reconciliation of PT files directly from regional distribution center file drops.

---

## 12. Related ADRs
- `ADR-0042`: Retail POS & Warehouse Terminal Keyboard Ergonomics and Hotkey SSOT.
- `ADR-0049`: Inward Landed Cost & Freight Allocation Architecture.

---

## 13. Related RFCs
- `RFC-2026-09`: Goods Receipt Desktop Terminal & Shoper 9 Ergonomic Convergence.
