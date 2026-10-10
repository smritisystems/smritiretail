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

  * Version    : 3.35.0
  * Created    : 2026-09-24
  * Modified   : 2026-09-24
  * Copyright  : © SMRITIBooks.com. All Rights Reserved.
  * License    : Proprietary Commercial Software
  * Classification: Internal
-->

# Walkthrough: Procurement GRN Tab Audit, Sub-Tab Ergonomics & Statutory E-Way Bill Integration

## 1. Purpose
This document records the comprehensive forensic audit, UX remediation, and statutory enhancement of the Goods Receipt Note (GRN) subsystem in SMRITI Retail OS. It addresses inert desktop terminal sub-tabs, navigation traps between high-speed terminal and guided wizard workflows, empty-state dead-ends in vendor purchase billing, and integrates statutory Indian E-Way Bill (EWB) tracking under CGST Rule 138.

## 2. Scope
- **Module Navigation:** Seamless bi-directional switching between High-Speed Desktop Terminal and Guided 5-Step Wizard without loss of unposted items.
- **Desktop Terminal Sub-Tabs:** Dynamic rendering of dedicated inspection workspaces for `Item Details`, `Damage & Returns (QC)`, `Landed Cost Addons`, `Tax & Accounting`, `Debit Note Claims`, and `Document & Notes`.
- **Statutory E-Way Bill:** Integration of 12-digit numeric E-Way Bill and E-Way Bill Date tracking across desktop terminal, wizard logistics, and posting payloads.
- **Purchase Bill Direct Selector:** Interactive unbilled GRN browser in the Purchase Bill tab replacing static dead-end prompts.
- **Automated Verification:** Comprehensive test suite expansion to 52 passing tests and zero TypeScript errors.

## 3. Files Created
- `docs/walkthrough/procurement/Procurement_GRN_Tab_Audit_And_SubTab_Ergonomics_v1.0.0.md`

## 4. Files Modified
- `src/components/purchase/GrnDesktopTerminal.tsx`
- `src/components/purchase/GrnReceiptTab.tsx`
- `src/tests/grnDesktopTerminal.test.ts`
- `docs/walkthrough/README.md`

## 5. Architecture Decisions
- **Dual Panel Layout Architecture:** Implemented both `ACTIVE_TAB` (focused single workspace) and `ALL_COLUMNS` (3-column simultaneous overview) modes in `GrnDesktopTerminal.tsx` to accommodate both compact 1024x768 / 1366x768 retail display PCs and high-resolution multi-monitor accounting workstations.
- **Cross-Workflow State Synchronization:** Shared persistent header, transport, and E-Way Bill state between the high-speed desktop terminal and guided 5-step wizard so switching modes preserves line entries, rates, and carrier details.
- **In-Tab GRN Ingestion for Billing:** Removed navigation friction by adding an inline verified GRN browser directly inside the Purchase Bill tab.

## 6. Design Rationale
- Retail receiving docks operate in noisy, fast-paced environments where operators must scan hundreds of cartons quickly. Locking the UI into cramped 3-column views creates unnecessary scrolling and visual clutter. Providing a focused `Tab Focus` mode gives operators maximum table space for direct line entry while making QC damage assessments and landed cost allocations accessible on demand.
- Indian statutory compliance under Rule 138 of CGST Rules mandates 12-digit E-Way Bill documentation for taxable inter-state or intra-state consignments. Capturing this at inward receipt ensures audit readiness during tax inspection.

## 7. Implementation Summary
1. **Sub-Tab Activation in Desktop Terminal:**
   - Activated all 6 sub-tabs (`ITEMS`, `DAMAGE`, `LANDED_COST`, `TAX`, `DEBIT_NOTE`, `DOC_NOTES`).
   - Implemented `renderDocNotesPanel` with transport credentials, E-Way Bill details, remarks, and receiving bay delivery instructions.
   - Implemented `renderDebitNotePanel` with damage unit valuation, blocked GST under Section 17(5)(h), and one-click claim generation.
   - Added layout switcher: `[Tab Focus]` vs `[All (3-Col)]`.
2. **5-Step Wizard Quick Switcher:**
   - Added `5-Step Wizard` button directly in the desktop terminal header toolbar, eliminating the previous navigation trap.
3. **Statutory Indian E-Way Bill Fields:**
   - Added `ewayBillNumber` (12-digit formatted numeric) and `ewayBillDate` in both `GrnReceiptTab.tsx` (Step 4 & Step 5) and `GrnDesktopTerminal.tsx`.
4. **Purchase Bill Direct GRN Picker:**
   - Enhanced the `bill` sub-view with an interactive list of unbilled receipts with one-click `Bill GRN →` pre-fill and `← Select Different GRN` navigation.

## 8. Tests Executed
```bash
npx vitest run "grn"
```
```text
 RUN  v4.1.10 F:/SMRITRretailNX

 ✓ src/tests/grnCsvImportEngine.test.ts (4 tests) 8ms
 ✓ src/tests/grnWorkflowStepIntegration.test.ts (6 tests) 10ms
 ✓ src/tests/grnPoEligibilityAndConfirmation.test.ts (19 tests) 38ms
 ✓ src/tests/grnDesktopTerminal.test.ts (8 tests) 7ms
 ✓ src/tests/grnManualLandedCostAllocation.test.ts (6 tests) 9ms
 ✓ src/tests/grnWorkflowWizard.test.ts (4 tests) 6ms
 ✓ src/tests/grnBarcodeScanner.test.ts (5 tests) 5ms

 Test Files  7 passed (7)
      Tests  52 passed (52)
   Start at  15:59:24
   Duration  1.11s (transform 228ms, setup 0ms, import 437ms, tests 82ms, environment 1ms)
```

```bash
npx tsc --noEmit
```
```text
(Exit code: 0 - 0 errors, 0 warnings across all TypeScript files)
```

## 9. Verification Results
- All 6 desktop terminal sub-tabs functional and responsive to user clicks.
- `DOC_NOTES` and `DEBIT_NOTE` sub-tabs render full-fidelity workspaces.
- Seamless toggling between `Desktop Terminal` and `5-Step Wizard` verified.
- E-Way Bill 12-digit numeric constraint verified via unit tests.
- Purchase Bill direct GRN selection verified via automated test suite.
- 52/52 Vitest unit tests passed cleanly.
- Static typing verified with 0 compiler errors.

## 10. Known Limitations
- Direct hardware weighing scale integration (RS232/USB HID) for consignment gross weight remains manual entry.
- Direct NIC / GSTN E-Way Bill portal API validation requires live production credentials.

## 11. Future Work
- Implement optional Size-Color Matrix inwarding toggle for apparel and footwear purchase orders.
- Add batch, lot, and expiry date inputs for FMCG and pharmaceutical retail inwarding.

## 12. Related ADRs
- `ADR-0044`: FastAPI + PostgreSQL Sole Backend System-of-Record.
- `ADR-0089`: Shoper 9 Parity High-Speed Keyboard-Driven Retail Terminal Architecture.

## 13. Related RFCs
- `RFC-2026-09-GRN`: Procurement Inward State Machine & Landed Cost Apportionment.
