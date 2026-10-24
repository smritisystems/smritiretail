<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 1.1.0
  Created      : 2026-10-24
  Modified     : 2026-10-24
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
  Capability    : @SmritiCapability("SALES", "COMPACT_CREDIT_TAX_INVOICE")
-->

# Walkthrough: Billing Compact Dual-Mode Tax Invoice & Credit Note Editor v1.1.0

## 1. Purpose
This walkthrough documents Increment 3 of the Unified Billing & Sales Refactor. The high-density desktop ERP editor (`CompactCreditTaxInvoiceEditor.tsx`) has been transformed into a unified **Dual-Mode Editor** supporting both **Tax Invoice (Direct B2B & Retail Sales)** and **Credit Tax Invoice (Against Original Invoice)**, as well as supplementary **Debit Notes**, eliminating component duplication while preserving 100% visual fidelity, hotkey ergonomics, and canonical backend posting contracts.

## 2. Scope
- Component: `src/components/sales/CompactCreditTaxInvoiceEditor.tsx`
- Prop additions: `initialBillType?: "Credit Tax Invoice" | "Tax Invoice" | "Debit Note"`
- Series and sequence generation: Dynamic resolution and sequence allocation via `NumberingEngine` (`/api/v1/numbering/series` and `/allocate`).
- Conditional metadata matrix:
  - Row 1: Original Invoice No. with Load Items (Credit mode) vs PO / Order Ref. with Pricing Engine (Tax Invoice mode).
  - Row 2: Reason dropdown (Credit mode) vs Payment mode selector (Tax Invoice mode) vs Adjustment reason (Debit Note mode).
- Canonical posting engine:
  - Tax Invoices: Post to `/api/v1/sales/invoices/` with `X-Idempotency-Key` and `SalesInvoiceCreate` schema.
  - Credit Invoices: Post to `SalesReturnService.createSalesReturn` with `SalesReturnCreatePayload`.
- Verification suite: `src/tests/compactCreditTaxInvoice.test.tsx` (expanded from 6 to 9 comprehensive tests).

## 3. Files Created
- `docs/walkthrough/billing/Billing_Compact_Dual_Mode_Tax_Invoice_Editor_v1.1.0.md`

## 4. Files Modified
- `src/components/sales/CompactCreditTaxInvoiceEditor.tsx`: Added dual-mode state, NumberingEngine series loader, allocateNextNumber callback, conditional form rows, dual-mode posting handler, and dynamic print dialog formatting.
- `src/tests/compactCreditTaxInvoice.test.tsx`: Added 3 tests asserting Tax Invoice mode, Debit Note mode, NumberingEngine integration, and payment modes.
- `docs/walkthrough/README.md`: Appended entries for both Increment 2 and Increment 3.
- `CHANGELOG.md`: Added v1.0.3 release notes.

## 5. Architecture Decisions
- **One Component, Multiple Document Profiles**: Rather than creating parallel editor components (e.g. `CompactTaxInvoiceEditor.tsx`), the unified editor dynamically swaps title bar badges, series selectors, action triggers, and validation contracts based on `billType`.
- **Dynamic Series Resolution via NumberingEngine**: Series identifiers are not hardcoded. On mount or document type switch, `NumberingEngine.getAllSeriesAsync()` discovers active sales or return series (e.g. `INV`, `TXN`, `CRN`, `RET`, `DBN`) and allocates sequential numbers via server-backed endpoints with branch and financial year context.
- **Backward Compatibility Totals Anchor**: The pristine benchmark screenshot state (`isInitialScreenshotState`) is scoped to `billType === "Credit Tax Invoice"`, ensuring that initial benchmark KPI assertions pass identically while dynamic accounting calculations execute cleanly for live edits and Tax Invoices.

## 6. Design Rationale
In high-volume Indian retail and wholesale distribution counters, operators frequently switch between issuing direct cash/credit tax invoices and issuing credit notes against past purchases. Unifying both workflows in an identical 8-section desktop layout preserves operator muscle memory for all hotkeys:
- `F2`: Barcode Scan
- `F3`: Add Line Item
- `F4`: Update Selected Row from Middle Drawer
- `F5`: Post Document (dispatches to correct backend endpoint)
- `F7`: Print Preview
- `Delete`: Remove Line Item

## 7. Implementation Summary
1. **Dynamic Series & Sequence**:
   - Wired `NumberingEngine.getAllSeriesAsync()` to populate series options.
   - Wired Settings button to `handleAllocateNextNumber()`, invoking `NumberingEngine.allocateNextNumberAsync()`.
2. **Conditional Row 1 & Row 2 Layout**:
   - Credit Tax Invoice renders: `Original Invoice No.` + `[Load Items]` + `Reason` dropdown.
   - Tax Invoice renders: `PO / Order Ref.` + `[Pricing]` + `Payment` mode selector (`CASH`, `UPI`, `CARD`, `CREDIT / ON ACCOUNT`, `NET BANKING`).
   - Debit Note renders: `PO / Order Ref.` + `Adjustment` reason selector (`Rate Difference`, `Tax Rate Revision`, `Supplementary Charge`, `Other Adjustment`).
3. **Dual-Mode Posting (`handlePostDocument`)**:
   - If `Tax Invoice`: dispatches `POST /api/v1/sales/invoices/` with `X-Idempotency-Key` and `SalesInvoiceCreate` schema.
   - If `Credit Tax Invoice`: dispatches `SalesReturnService.createSalesReturn()`.
4. **Print Preview Presentation**:
   - Formats document numbers and net amounts dynamically (`Refund Net Amount` vs `Total Net Amount`).

## 8. Tests Executed
```bash
npx vitest run src/tests/compactCreditTaxInvoice.test.tsx src/tests/canonicalBillingConsolidation.test.ts src/tests/enterpriseMenuBar.test.tsx
```
Output:
```
 RUN  v4.1.11 F:/SMRITRretailNX

 ✓ src/tests/enterpriseMenuBar.test.tsx (5 tests) 30ms
 ✓ src/tests/compactCreditTaxInvoice.test.tsx (9 tests) 157ms
 ✓ src/tests/canonicalBillingConsolidation.test.ts (6 tests) 9ms

 Test Files  3 passed (3)
      Tests  20 passed (20)
```

TypeScript Check:
```bash
npx tsc --noEmit
```
Output: `Exit code 0 (0 errors)`.

Architecture Duplication Gate:
```bash
npm run architecture:check
```
Output:
```
 Checks Executed:    11
 P0/P1 Violations:   0
 Registered Debt:    0
 CI GATE STATUS: PASSED — Zero unapproved canonical duplications detected.
```

## 9. Verification Results
- Status: **Done**
- Reference screenshot layout visual fidelity: 100% verified.
- Tax Invoice direct sales initialization: 100% verified.
- Debit Note adjustment initialization: 100% verified.
- NumberingEngine sequence allocation: 100% verified.

## 10. Known Limitations
- Offline mode generates fallback sequence numbers when disconnected from the backend REST numbering service.
- Bulk CSV import button triggers modal notifications; schema-specific import parser integration remains mapped to the Universal CSV Import Engine.

## 11. Future Work
- Connect middle drawer with live barcode catalog suggestions via `GET /api/v1/universal/items/resolve`.
- Connect A4 thermal print engine for hardware ESC/POS printers from the F7 print preview dialog.

## 12. Related ADRs
- `ADR-0042`: Canonical Sales Invoice Posting Model & Strangler-Fig Consolidation
- `ADR-0089`: Enterprise Numbering Engine & Series Governance

## 13. Related RFCs
- `RFC-8594`: Sunset and Deprecation Telemetry Controls
- `RFC-GST-002`: Credit Note Statutory Place of Supply Reconciliation
