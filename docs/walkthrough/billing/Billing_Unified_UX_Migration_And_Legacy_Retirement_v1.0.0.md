<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 1.0.0
  Created      : 2026-10-24
  Modified     : 2026-10-24
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Canonical Walkthrough & Architecture Governance
-->

# SMRITI Retail OS — Unified Billing UX Migration & Legacy Module Retirement Walkthrough

**Document Identifier:** `WGP-BILLING-UNIFIED-UX-MIGRATION-v1.0.0`
**Governance Standard:** SMRITI Walkthrough Governance Policy (WGP v3.17)
**Corpus / Workspace:** `SMRITIRetailNX`
**Corpus Root:** `f:\SMRITRretailNX`
**Target Capability:** `@SmritiCapability("SALES", "UNIFIED_CANONICAL_BILLING")`
**Status:** Completed
**Verification Level:** Level A (Code Complete, Test Validated, Clean Compilation, Architectural Verification)

---

## 1. Purpose

The objective of this engineering initiative is to establish **EXACTLY ONE primary Billing Workspace** across SMRITI Retail OS while completely eliminating duplicate billing windows, redundant launchpad tiles, obsolete menu registrations, and fractured cashier implementations.

Under the core architectural principle:
> **ONE BILLING WINDOW. ONE BILLING ENTRY. ALL REQUIRED WORKFLOWS. ZERO UNNECESSARY DUPLICATION.**

The unified Billing Workspace (`src/components/billing/BillingWorkspace.tsx`) hosting the robust transactional terminal engine (`src/components/billing/BillingTerm.tsx`) is selected as the sole canonical billing entry point. All authorized billing and invoicing workflows—Retail POS Counter Sale, Tax Invoice (Direct B2B/Retail), Credit Sale (B2B Wholesale), Distributor Sale, and Sales Returns—remain fully accessible through mode and workflow controls inside this single workspace, backed by authoritative server-side APIs, PostgreSQL persistence, GST computations, ledger postings, and inventory movements.

---

## 2. Scope

### In Scope:
- **Phase A (Repository & Route Audit):** Exhaustive audit across frontend routes, menus, tabs, launchpad tiles, workspace definitions, and billing components.
- **Phase B (Canonical Selection & Container Unification):** Retaining `BillingWorkspace.tsx` and `BillingTerm.tsx` as the single canonical workspace and terminal implementation supporting all transaction modes (`RETAIL_POS`, `CREDIT_BILLING`, `B2B_DISTRIBUTOR`) and document types (`Cash`, `Credit`, `Card`, `UPI`, `Split`).
- **Phase C (Duplicate Terminal Decommissioning):** Permanent removal of duplicate and redundant billing implementations:
  1. `src/components/billing/SmritiCreditBillingTerminal.tsx` (deleted)
  2. `src/components/billing/propos/ProPosBillingTerm.tsx` (deleted)
  3. `src/components/billing/propos/ProPosWs.tsx` (deleted)
  4. `src/components/sales/CompactCreditTaxInvoiceEditor.tsx` (deleted)
- **Phase D (Menu & Launchpad Deduplication):**
  1. Main Enterprise Menu (`EnterpriseMenuBar.tsx`): Retained single canonical entry `{ id: "billing-workspace", label: "Billing & Sales", moduleId: "billing-workspace" }` under `Transactions -> Sales Desks`. Consolidated duplicate top-level `Sales` menu.
  2. Fiori Launchpad Catalog (`launchpadCatalog.ts`): Decommissioned duplicate `propos-workspace` tile, retaining single canonical tile `billing-workspace` ("Desktop Billing Terminal").
  3. Classic UX Workspace (`ClassicUxWorkspace.tsx`): Sidebar and tab strip route directly to `billing-workspace`.
  4. Regular UX Dashboard (`RegularUxDashboard.tsx`): POS action tile links directly to `billing-workspace`.
- **Phase E (Route & Alias Convergence):**
  Unified route mapping in `TabRenderer.tsx`, `navigationResolver.ts`, and `navigationAccess.ts` ensuring all historical module aliases (`billing`, `pos`, `billing-workspace`, `credit-billing`, `credit-sale`, `credit-tax-invoice`, `credit-note`, `tax-invoice`, `dist-invoice`, `create-tax-invoice`, `sales-return`, `propos`, `propos-workspace`) resolve cleanly to `BillingWorkspace`.
- **Phase F (Test Coverage & Architectural Integrity):**
  100% green automated test suites across 6 verification test files (78 tests total) and zero TypeScript compilation errors.

### Out of Scope:
- Backend schema alterations (FastAPI endpoints `/api/v1/sales/invoices/`, `/api/v1/pos/orders/`, and PostgreSQL tables remain the canonical transactional system of record).
- Purchase, GRN, and inventory audit workflows (governed under procurement).

---

## 3. Files Created

1. `docs/implementation/foundation/Unified_Billing_UX_Migration_And_Legacy_Retirement_Plan_v1.0.0.md` — 19-section implementation plan conforming to IPGP v3.17.
2. `docs/walkthrough/billing/Billing_Unified_UX_Migration_And_Legacy_Retirement_v1.0.0.md` — This canonical walkthrough document conforming to WGP v3.17.
3. `src/tests/canonicalBillingConsolidation.test.ts` — Comprehensive unit test suite validating tri-modal union, route parity, single menu entry, and legacy permission fallback.

---

## 4. Files Modified / Deleted

### Files Deleted:
1. `src/components/billing/SmritiCreditBillingTerminal.tsx` — Deleted redundant standalone credit terminal.
2. `src/components/billing/propos/ProPosBillingTerm.tsx` — Deleted redundant ProPOS terminal implementation.
3. `src/components/billing/propos/ProPosWs.tsx` — Deleted redundant ProPOS workspace wrapper.
4. `src/components/sales/CompactCreditTaxInvoiceEditor.tsx` — Deleted redundant experimental compact editor.
5. `src/tests/compactCreditTaxInvoice.test.tsx` — Deleted test file corresponding to deleted compact editor.

### Files Modified:
1. `src/components/billing/BillingWorkspace.tsx`:
   - Host container normalized to single `WORKSPACE` view using `BillingTerm.tsx`.
   - Normalizes auxiliary views (`CREDIT_BILLING`, `B2B_DISTRIBUTOR`, `CREDIT_TAX_INVOICE`) into the canonical workspace.
   - Provides `getBillingDefaults` for pre-selecting transaction (`Cash` vs `Credit`) and channel (`POS_RETAIL` vs `B2B_WHOLESALE`).
2. `src/components/billing/BillingTerm.tsx`:
   - Canonical transactional billing engine supporting POS quick billing, B2B wholesale, credit sales, split tenders, barcode scanning, customer loyalty, and GST calculations.
3. `src/components/billing/SmritiBillingStudio.tsx`:
   - Updated delegation to route into `BillingWorkspace`.
4. `src/components/dashboard/ClassicUxWorkspace.tsx`:
   - Sidebar tree category `POS Billing` and tab strip mapped to canonical `billing-workspace`.
5. `src/components/launchpad/launchpadCatalog.ts`:
   - Removed duplicate `propos-workspace` tile, leaving single primary `billing-workspace` tile.
6. `src/components/shell/EnterpriseMenuBar.tsx`:
   - Consolidated duplicate `Sales` top-level menu into `Transactions -> Sales Desks -> Billing & Sales`.
   - Added zero-width layout fallback for headless jsdom testing environments.
7. `src/components/shell/TabRenderer.tsx`:
   - Harmonized all 13 billing-related module aliases to map to `billing-workspace`.
8. `src/components/shell/navigationAccess.ts`:
   - Updated `MODULE_ALIASES` to cross-reference `billing-workspace` aliases.
   - Guarded unconstrained navigation when `resolvedNavigationIds === null`.
9. `src/components/shell/navigationResolver.ts`:
   - Unified contextual navigation resolver for sales and billing workflows.
10. `src/context-actions/ContextRegistry.ts`:
    - Added safety guards around `localStorage` operations for SSR and headless test environments.
11. `src/tests/fioriLaunchpad.test.ts`:
    - Updated tile count and assertions following removal of duplicate `propos-workspace`.
12. `src/tests/uxSwitcher.test.tsx`:
    - Updated top-level menu assertions to match consolidated menu bar and `Workspace style` modal labels.

---

## 5. Architecture Decisions

### ADR-015: Single Canonical High-Density Multi-Profile Billing Workspace
- **Context:** Multiple fragmented billing interfaces (`SmritiCreditBillingTerminal`, `ProPosBillingTerm`, `ProPosWs`, `DistTaxInvoice`, `CompactCreditTaxInvoiceEditor`, and `BillingTerm`) created maintenance overhead, duplicate code paths, and inconsistent cashier experiences.
- **Decision:** Retain `BillingWorkspace.tsx` hosting `BillingTerm.tsx` as the single canonical desktop billing terminal across all retail and wholesale workflows.
- **Consequences:** Single source of truth for POS tenders, barcode resolution, cart state, GST calculations, split payments, customer credit, and invoice generation. Eliminates UI drift and redundant windows.

### ADR-016: Unified Route Harmonization and Zero Broken Aliases
- **Context:** Existing bookmarks, permissions, shortcuts, and documentation may refer to legacy routes like `pos`, `credit-billing`, `tax-invoice`, or `propos`.
- **Decision:** Converge all legacy routes through `TabRenderer.tsx` and `navigationResolver.ts` directly into `billing-workspace`, pre-configuring the appropriate mode and default transaction type without creating separate windows.

---

## 6. Design Rationale

1. **Cashier Speed & Ergonomics:** Fast retail counters require keyboard-first navigation (`F2` Item Search, `F3` Clear, `F4` Hold, `F5` Recall, `F10` Save & Tender, `F8` Print) with instant barcode lookup and split payment support.
2. **Tri-Modal Transaction Agility:** Cashiers can seamlessly switch between `RETAIL_POS` (walk-in cash/card counter sales), `CREDIT_BILLING` (customer credit accounts), and `B2B_DISTRIBUTOR` (wholesale invoices with GSTN) within the same workspace without context loss.
3. **Zero Navigation Duplication:** Users see exactly ONE `Billing & Sales` menu entry under `Transactions` and exactly ONE `Desktop Billing Terminal` tile on the launchpad.

---

## 7. Implementation Summary

1. **Single Entry Point Enforcement:**
   `EnterpriseMenuBar.tsx` provides a single entry point: `Billing & Sales` (`billing-workspace`) under `Transactions -> Sales Desks`. Duplicate top-level menus and redundant launchpad tiles were eliminated.
2. **Canonical Engine Wiring:**
   `BillingWorkspace.tsx` hosts `BillingTerm.tsx` in unified `WORKSPACE` view mode. Mode parameters (`RETAIL_POS`, `CREDIT_BILLING`, `B2B_DISTRIBUTOR`) adjust document types, payment options, and channel settings inside the same terminal.
3. **Legacy Terminal Deletion:**
   The four obsolete duplicate implementations (`SmritiCreditBillingTerminal.tsx`, `ProPosBillingTerm.tsx`, `ProPosWs.tsx`, and `CompactCreditTaxInvoiceEditor.tsx`) were removed from disk.
4. **Safety & Fallback Guards:**
   `navigationAccess.ts` and `ContextRegistry.ts` safely handle unconstrained permissions (`null`) and headless environments without throwing `ReferenceError`.

---

## 8. Tests Executed

### Vitest Test Suite Execution:
```powershell
npx vitest run src/tests/canonicalBillingConsolidation.test.ts src/tests/fioriLaunchpad.test.ts src/tests/uxSwitcher.test.tsx src/tests/posCashierLoyaltyWiring.test.ts src/tests/posCashierTendersAndWallet.test.ts src/tests/smritiF2BillingSearch.test.ts
```

Terminal Output:
```text
 RUN  v4.1.11 F:/SMRITRretailNX

 ✓ src/tests/posCashierTendersAndWallet.test.ts (13 tests) 13ms
 ✓ src/tests/fioriLaunchpad.test.ts (12 tests) 33ms
 ✓ src/tests/smritiF2BillingSearch.test.ts (22 tests) 17ms
 ✓ src/tests/uxSwitcher.test.tsx (8 tests) 138ms
 ✓ src/tests/posCashierLoyaltyWiring.test.ts (13 tests) 13ms
 ✓ src/tests/canonicalBillingConsolidation.test.ts (10 tests) 12ms

 Test Files  6 passed (6)
      Tests  78 passed (78)
   Start at  19:52:37
   Duration  4.09s (transform 2.59s, setup 0ms, import 4.43s, tests 226ms, environment 1ms)
```

### TypeScript Validation:
```powershell
npx tsc --noEmit
```
Terminal Output: Clean exit (code 0), 0 errors.

---

## 9. Verification Results

| Target Component / Module | Test Suite / Verification Mechanism | Evidence Status |
|:---|:---|:---:|
| `BillingWorkspace` — Mode & Route Harmonization | `canonicalBillingConsolidation.test.ts` (10 tests) | **Done** (10/10 passed) |
| `FioriLaunchpad` — Single Billing Tile | `fioriLaunchpad.test.ts` (12 tests) | **Done** (12/12 passed) |
| `GlobalHeader` & `EnterpriseMenuBar` | `uxSwitcher.test.tsx` (8 tests) | **Done** (8/8 passed) |
| `BillingTerm` — Loyalty Wiring | `posCashierLoyaltyWiring.test.ts` (13 tests) | **Done** (13/13 passed) |
| `BillingTerm` — Tenders & Wallet | `posCashierTendersAndWallet.test.ts` (13 tests) | **Done** (13/13 passed) |
| `BillingTerm` — F2 Search Engine | `smritiF2BillingSearch.test.ts` (22 tests) | **Done** (22/22 passed) |
| TypeScript Compiler Validation | `npx tsc --noEmit` | **Done** (0 errors) |

---

## 10. Known Limitations

1. **Hardware Keyboard Wedges:** Barcode scanners must operate in standard HID keyboard wedge mode sending keystrokes followed by `Enter`.
2. **Receipt ESC/POS Driver:** Thermal printing triggers standard browser print dialog (`window.print()`); direct raw USB ESC/POS printing requires native print daemon.

---

## 11. Future Work

1. Native WebUSB / WebSerial direct thermal printer driver for 80mm/58mm ESC/POS hardware.
2. Background sync queue with IndexedDB storage for offline POS billing during extended internet outages.

---

## 12. Related ADRs

- `ADR-004`: Retirement of Legacy Express Server in Favor of FastAPI Sole System of Record.
- `ADR-007`: Unified Billing Workspace Convergence and ProPOS Retirement.
- `ADR-012`: Authoritative Numbering Engine and Idempotent Sales Invoicing.
- `ADR-015`: Single Canonical High-Density Multi-Profile Billing Workspace.
- `ADR-016`: Unified Route Harmonization and Zero Broken Aliases.

---

## 13. Related RFCs

- `RFC-2026-071`: High-Density ERP Cashier Ergonomics & Function Key Navigation Standard.
- `RFC-2026-084`: Canonical Multi-Profile Sales Document Unification.
