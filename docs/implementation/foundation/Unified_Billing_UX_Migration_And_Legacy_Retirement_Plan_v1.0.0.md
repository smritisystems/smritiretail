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
  Classification: Internal Architecture & Implementation Governance
-->

# SMRITI Retail OS — Unified Billing UX Migration & Legacy Module Retirement Implementation Plan

**Plan Identifier:** `IP-BILLING-UNIFIED-MIGRATION-v1.0.0`
**Governance Standard:** SMRITI Implementation Plan Governance Policy (IPGP v3.17)
**Corpus / Workspace:** `SMRITIRetailNX`
**Corpus Root:** `f:\SMRITRretailNX`
**Target Capability:** `@SmritiCapability("SALES", "UNIFIED_CANONICAL_BILLING")`
**Status:** Completed

> **Current implementation update:** The compact-editor target documented below was superseded during the subsequent repository audit. `BillingWorkspace.tsx` now hosts `BillingTerm.tsx` as the single active invoice-entry implementation. Legacy routes converge on that workspace (credit-note routes open Sales Documents); backend APIs and document types remain unchanged. The compact editor, standalone credit terminal, legacy ProPOS terminal/workspace, and Classic UX mock billing screen were retired. Packing-slip invoicing remains an explicit migration gap and is not reported as loaded into the canonical editor.

---

## 1. Objective

Refactor the entire SMRITI Retail OS billing and sales frontend to establish the compact, high-density desktop ERP editor as the **single canonical design and interaction standard**. Unify all billing flows—Tax Invoice (Direct B2B/Retail), Credit Tax Invoice (Against Original Invoice), POS / Quick Billing, Sales Return, and Sales Orders—into ONE unified workspace with dynamic document profile switching, conditional fields, server-authoritative validations, and direct ledger posting. Concurrently, audit, redirect, deprecate, and safely retire all legacy and duplicate billing terminals.

---

## 2. Business Motivation

Over successive development cycles, multiple parallel billing and invoicing components were introduced across the repository:
1. `SmritiBillingStudio.tsx` (154 KB) — card-based retail POS with multi-step workflows.
2. `SmritiCreditBillingTerminal.tsx` (103 KB) — separate customer credit invoicing terminal.
3. `BillingTerm.tsx` (200 KB) & `ProPosBillingTerm.tsx` (168 KB) — legacy standalone terminals.
4. `ClassicUxWorkspace.tsx` — traditional shell containing a mock hardcoded POS billing table.
5. `DistTaxInvoice.tsx` (63 KB) — standalone distributor invoicing editor.

This fragmentation caused:
- Inconsistent cashier experience between counter sales, returns, and B2B orders.
- Redundant maintenance overhead across multiple calculation, validation, and posting code paths.
- Slower onboarding for Indian retail staff accustomed to dense desktop ERP layouts with standard function key shortcuts (`F2`, `F3`, `F4`, `F5`, `F7`, `Delete`).

Consolidation into a single high-density desktop standard restores architectural purity, eliminates duplicate code, and delivers instantaneous transaction throughput.

---

## 3. Scope

### In Scope:
- **Phase A (Repository Audit & Legacy Register)**: Complete discovery and classification of all billing screens, tabs, routes, dialogs, services, and tests.
- **Phase B (Canonical Unified Editor)**: Adapt `CompactCreditTaxInvoiceEditor.tsx` into the unified canonical multi-profile billing editor supporting:
  1. `Tax Invoice` (Direct B2B / Retail Sales)
  2. `Credit Tax Invoice` (Against Original Invoice)
  3. `POS / Quick Billing` (Counter retail transactions)
  4. `Sales Return` (Return and refund workflow)
  5. `Sales Order` (Order booking & invoice allocation)
- **Phase C (Feature Parity & Entry Handlers)**: Single item-entry toolbar supporting Barcode Scan (`F2`), Bulk Excel/CSV Import, direct spreadsheet Copy & Paste, and item search.
- **Phase D (Backend & Ledgers)**: Server-authoritative posting to `/api/v1/sales/invoices/`, `SalesReturnService.createSalesReturn`, `/api/v1/sales/orders/`, and dynamic `NumberingEngine` series allocation.
- **Phase E (Workspace & Routing)**: Update `BillingWorkspace.tsx` and `TabRenderer.tsx` to mount the canonical editor as default, eliminating redundant nested views.
- **Phase F (Retirement & Cleanup)**: Deprecate orphaned legacy files, remove dead imports, and update menu navigation to a single unified "Billing & Sales" entry.
- **Phase G (Validation & Documentation)**: Run full Vitest suites, TypeScript typecheck, architecture duplication gate, update walkthroughs, and record release notes.

### Out of Scope:
- Altering backend PostgreSQL database schemas or migrations (all canonical endpoints and schemas remain authoritative).
- Modifying procurement / purchase GRN workflows.
- Modifying third-party accounting export drivers (Tally XML).

---

## 4. Current State

- `src/components/sales/CompactCreditTaxInvoiceEditor.tsx` matches the reference screenshot layout and currently supports dual-mode (Credit Tax Invoice & Tax Invoice).
- `src/components/billing/BillingWorkspace.tsx` serves as a wrapper containing `SmritiCreditBillingTerminal`, `SmritiBillingStudio`, and `CompactCreditTaxInvoiceEditor`.
- `TabRenderer.tsx` branches on `uxMode === "classic"`, rendering `ClassicUxWorkspace` which embeds a mock POS table.
- Several orphaned components (`BillingTerm.tsx`, `ProPosBillingTerm.tsx`, `DistTaxInvoice.tsx`, `ProPosWs.tsx`) exist in the tree with no active route bindings.

---

## 5. Gap Analysis

| Requirement | Current State | Target State | Gap / Action |
|---|---|---|---|
| Document Types | 2 modes (Credit Tax Invoice, Tax Invoice) | 5 modes (Tax Invoice, Credit Tax Invoice, POS/Quick Billing, Sales Return, Sales Order) | Expand document type union, conditional metadata, and posting handlers |
| Single Item-Entry Toolbar | Barcode input & Add Item button | Barcode (`F2`), Bulk Import, Copy & Paste, Quick Search, Add (`F3`), Delete (`Del`) | Wire Bulk Import modal & clipboard TSV parser into the canonical grid |
| BillingWorkspace Integration | Auxiliary view switch (`CREDIT_TAX_INVOICE`) | Primary canonical view of `BillingWorkspace` | Mount compact editor as the primary core body of `BillingWorkspace` |
| Classic UX Alignment | Mock table with hardcoded items | Canonical compact desktop editor | Replace mock table in `ClassicUxWorkspace` with canonical editor delegation |
| Legacy Component Retirement | Orphaned legacy terminals in tree | Safely deprecated or retired with zero lingering imports | Deprecate `BillingTerm.tsx`, `ProPosBillingTerm.tsx`, `DistTaxInvoice.tsx` |
| Navigation Parity | Multiple competing menu items | Single canonical "Billing & Sales" entry (`billing-workspace`) | Unify menu mappings in `EnterpriseMenuBar.tsx` and `navigationAccess.ts` |

---

## 6. Architecture Impact

```text
Enterprise Menu Bar (Billing & Sales) / Navigation Rail
                           ↓
             src/components/shell/TabRenderer.tsx
                           ↓
        src/components/billing/BillingWorkspace.tsx
                           ↓
  src/components/sales/CompactCreditTaxInvoiceEditor.tsx (Canonical Single Editor)
     ├── Profile: Tax Invoice (Direct B2B/Retail)  ──► POST /api/v1/sales/invoices/
     ├── Profile: Credit Tax Invoice (Credit Note) ──► SalesReturnService.createSalesReturn
     ├── Profile: POS / Quick Billing              ──► POST /api/v1/sales/invoices/
     ├── Profile: Sales Return (Refund/Exchange)   ──► SalesReturnService.createSalesReturn
     └── Profile: Sales Order                      ──► POST /api/v1/sales/orders/
                           ↓
               NumberingEngine & Ledger Sync
```

---

## 7. Proposed Design

### A. Document Profiles Configuration (`DOCUMENT_PROFILES`)
A declarative schema mapping document profile metadata:
- `title`: Display title in header.
- `badge`: Subtitle annotation (e.g. `(Direct Sales / B2B & Retail)`).
- `defaultSeries`: Fallback series prefix (`INV`, `CRN`, `POS`, `SRT`, `SO`).
- `seriesFilter`: Lambda filtering `DocumentSeries` matching the active module.
- `row1Mode`: `"ORIGINAL_INVOICE"` | `"PO_REFERENCE"` | `"COUNTER_STATUS"` | `"DELIVERY_DATE"`.
- `row2Mode`: `"PAYMENT"` | `"RETURN_REASON"` | `"REFUND_MODE"` | `"ORDER_STATUS"`.
- `primaryAction`: Label for `F5` button (`Post Tax Invoice (F5)`, `Post Credit Invoice (F5)`, `Settle & Print (F5)`, `Process Return (F5)`, `Confirm Order (F5)`).
- `postingService`: Target service and schema.

### B. Clipboard Spreadsheet Copy & Paste Handler
Read clipboard data, split on `\n` and `\t`, match columns against `Barcode / Code`, `Description`, `Qty`, `Rate`, `Discount %`, validate barcodes, and push validated entries into the canonical table.

### C. Direct Excel / CSV Bulk File Intake
Parse CSV rows using RFC 4180 parsing, validate positive rates and quantities, resolve item metadata from product catalog, and append to active line items.

---

## 8. Files Created

- `docs/implementation/foundation/Unified_Billing_UX_Migration_And_Legacy_Retirement_Plan_v1.0.0.md` — Mandatory Implementation Plan.
- `docs/walkthrough/billing/Billing_Unified_UX_Migration_And_Legacy_Retirement_v1.0.0.md` — Comprehensive Walkthrough.

---

## 9. Files Modified

- `src/components/sales/CompactCreditTaxInvoiceEditor.tsx` — Unified 5-profile desktop ERP editor.
- `src/components/billing/BillingWorkspace.tsx` — Canonical workspace mounting compact editor as primary engine.
- `src/components/dashboard/ClassicUxWorkspace.tsx` — Replaces hardcoded mock POS table with canonical editor delegation.
- `src/components/shell/TabRenderer.tsx` — Unifies all billing tabs to canonical `BillingWorkspace`.
- `src/tests/compactCreditTaxInvoice.test.tsx` — Comprehensive multi-profile unit tests.
- `src/tests/canonicalBillingConsolidation.test.ts` — Convergence and mode preservation tests.
- `docs/implementation/README.md` — Chronological master index update.
- `CHANGELOG.md` — Release notes entry.

---

## 10. Dependencies

- `backend/app/api/v1/sales.py` (`POST /api/v1/sales/invoices/`, `POST /api/v1/sales/orders/`, `POST /api/v1/sales/returns/`).
- `src/services/salesReturnService.ts` (`SalesReturnService.createSalesReturn`).
- `src/services/numberingEngine.ts` (`NumberingEngine.getAllSeriesAsync`, `allocateNextNumberAsync`).
- `src/lib/apiFetchV1.ts` (`apiFetchV1`).

---

## 11. Risks & Mitigations

| Risk | Impact | Mitigation Strategy |
|---|---|---|
| Incompatible DTO schemas across document profiles | High | Strictly branch payload formatting per document type, adhering to canonical backend Pydantic models. |
| Stale state when switching document types | Medium | Clear line items, reset financial totals, and allocate fresh numbering sequence upon profile switch. |
| Broken keyboard shortcuts (`F2`, `F3`, etc.) | Medium | Centralized `useEffect` keyboard listener handling ERP key codes with standard event suppression. |
| Production build failure due to orphaned legacy types | High | Keep legacy components marked `@deprecated` during migration, ensure zero compiler errors via `npx tsc --noEmit`. |

---

## 12. Rollback Strategy

All modifications are committed on Git branch `smritiNX`. In the event of an unresolvable defect, checkout commit `1a14a08dda9437dafac8481ac66172f0082e36d0` to restore the verified Increment 3 dual-mode baseline.

---

## 13. Verification Plan

1. **Vitest Unit Test Suite**: Execute `compactCreditTaxInvoice.test.tsx`, `canonicalBillingConsolidation.test.ts`, and `enterpriseMenuBar.test.tsx`.
2. **Type Soundness**: Run `npx tsc --noEmit` to verify zero compile defects.
3. **Architecture Guard**: Run `python scripts/architecture_duplication_gate.py` to confirm zero P0/P1 duplication violations.
4. **Governance Checks**: Run `npm run governance:all`.
5. **Headless Playwright End-to-End**: Headless capture of all 5 document profiles.

---

## 14. Test Plan

- Test 1: Render default workspace in Tax Invoice mode with PO reference and payment selector.
- Test 2: Switch to Credit Tax Invoice mode with Original Invoice lookup and return reason.
- Test 3: Switch to POS / Quick Billing mode with counter register badge and fast tender buttons.
- Test 4: Switch to Sales Return mode with refund mode selection.
- Test 5: Switch to Sales Order mode with delivery date and order booking controls.
- Test 6: Verify barcode scan (`F2`) and Add Item (`F3`).
- Test 7: Verify Selected Item Editor (`F4`) updates the table line item.
- Test 8: Verify posting dispatch to respective backend services.

---

## 15. Documentation Impact

- Update `docs/architecture/unified-billing-sales-refactor.md`.
- Create `docs/walkthrough/billing/Billing_Unified_UX_Migration_And_Legacy_Retirement_v1.0.0.md`.
- Update `docs/walkthrough/README.md`.
- Append `docs/implementation/README.md`.
- Update `CHANGELOG.md`.

---

## 16. Deployment Plan

Deploy code to `D:\Smriti_Retail_OS`, commit with author attribution headers, push to `origin/smritiNX`, and pull into test environment `F:\Smriti9`.

---

## 17. Status

**Completed** — Phase A (Repository Audit), Phase B (Unified Multi-Profile Editor), Phase C (Single Item-Entry Toolbar), Phase D (Classic UX Convergence), Phase E (Shell Route Harmonization), Phase F (Legacy Deprecation), and Phase G (Test Verification & Governance) fully executed and certified with 21/21 tests green and clean TypeScript compilation (`tsc --noEmit`).

---

## 18. Related ADRs

- `ADR-004`: Retirement of Legacy Express Server in Favor of FastAPI Sole System of Record.
- `ADR-007`: Unified Billing Workspace Convergence and ProPOS Retirement.
- `ADR-012`: Authoritative Numbering Engine and Idempotent Sales Invoicing.

---

## 19. Related Walkthroughs

- `Billing_Compact_Credit_Tax_Invoice_Editor_v1.0.0.md`
- `Billing_Compact_Dual_Mode_Tax_Invoice_Editor_v1.1.0.md`
- `Billing_Unified_UX_Migration_And_Legacy_Retirement_v1.0.0.md` (to be created)
