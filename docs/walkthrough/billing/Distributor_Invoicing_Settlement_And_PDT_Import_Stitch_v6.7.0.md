<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.7.0
  Created      : 2026-08-22
  Modified     : 2026-08-22
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: Distributor Invoicing, Multi-Tender Settlement & PDT Import Integration (Stitch UX)

**Version:** 6.7.0  
**Date:** 2026-08-22  
**Area:** Billing & POS  
**Author:** Jawahar Ramkripal Mallah  

---

## 1. Purpose
To implement the authentic Distributor Invoicing Terminal, Multi-Tender Settlement / Payment Studio, and PDT Import Dialog based on the user's pristine UX design specifications in `F:\SMRITI\Distributor\stitch_barcode_label_designer_and_printer`.

---

## 2. Scope
- **Distributor Invoicing Workspace (`SmritiBillingTerminal.tsx`)**:
  - **Header Section**: `Bill Type` (`Product`, `Service`), `Transaction` (`Credit`, `Cash`), `Doc Prefix` (`D1DS13`), `Doc No.`, `Import` & `Recall` action buttons, `Customer` search with embedded `F2` trigger & `Add` button, and `Sales Staff` selector.
  - **Detail Section (Direct Entry + Table)**:
    - **F11 Direct Entry Row**: 11-column inline input grid (`Stock No`, `Item Description`, `Rate`, `Qty`, `Value`, `Disc Code`, `Disc Qty`, `Disc %`, `Disc Amt`, `Total`, `Staff`) with Enter-to-add action.
    - **Main 12-Column Line Items Table**: High-density grid with alternating row striping and delete action.
  - **Footer Section**:
    - **Left Tabbed Card**: `Transporter Details` (Transporter table with rate/amount inputs), `Payment Details`, `AddOns & Deductions`, and `Document Remarks`.
    - **Right Totals Grid**: `Sales`, `Discounts`, `Sales Tax`, `Add-ons`, and `Deductions`.
    - **High-Visibility Blue Summary Bar**: 9 cells with large `Net Amount` display highlighted in `#a7c8ff`.
  - **Global Keybinding Bar**:
    - `Ready... F2: Search | F11: Direct Entry | F6: Discounts | F7/F8: Settlement | F12: Suspend | Ctrl+4: AddOns`.
- **Multi-Tender Settlement & Payment Studio (`SmritiInvoiceSettlementModal.tsx`)**:
  - Split-view layout: Left invoice summary & dynamic multi-row payment entry table (`Cash`, `Credit Card`, `Debit Card`, `UPI`, `Cheque`, `Credit Note`); Right calculation breakdown (`Bill Amount`, `Total Tendered`, `Balance/Change`, `Round Off`), cash denomination counter (`2000` to `Coins`), and action bar (`Cancel [Esc]`, `Hold/Suspend [F12]`, `Complete Settlement [F8/Enter]`).
- **PDT Import Dialog (`PdtImportModal.tsx`)**:
  - Radio toggle: `Import from File` (with Template dropdown & Browse parser) vs `Import from Transaction` (with Type, Prefix & Bill No).

---

## 3. Files Created
- `src/components/billing/SmritiInvoiceSettlementModal.tsx`: Split-view settlement studio with multi-tender payment grid and denomination counter.
- `docs/walkthrough/billing/Distributor_Invoicing_Settlement_And_PDT_Import_Stitch_v6.7.0.md`: WGP Walkthrough document.

---

## 4. Files Modified
- `src/components/billing/types.ts`: Added models for Transporter, Addons, Settlement, Denominations, and PDT Templates.
- `src/components/billing/SmritiBillingTerminal.tsx`: Complete overhaul to match Stitch Invoicing Terminal specification.
- `src/components/billing/PdtImportModal.tsx`: Updated with file template selector, browse parser, and transaction import.
- `src/components/billing/propos/SmritiProPosWorkspace.tsx`: Added `Distributor Invoicing` tab to the primary billing suite.
- `src/components/PosTerminalTab.tsx`: Passed products, profiles, and shifts to `SmritiProPosWorkspace`.
- `src/components/barcode/barcodeTransactionStore.ts`: Exported `barcodeTransactionStore` helper object.
- `src/tests/smritiBillingTerminal.test.ts`: Added 5 unit tests for line items, transporter totals, split payments, cash denominations, and PDT parsing (5/5 PASS).
- `CHANGELOG.md`: Appended v6.7.0 release notes.
- `docs/walkthrough/README.md`: Appended master index entry.

---

## 5. Architecture Decisions
- **ADR-DISTRIB-INVOICE-01 (Dual Billing Modalities)**: Cashiers can switch seamlessly between Speed Retail POS and Distributor Invoicing without restarting registers or losing active transaction state.
- **ADR-DISTRIB-INVOICE-02 (F11 Direct Entry Row Architecture)**: The F11 row operates as an ephemeral buffer that validates, computes taxes, and appends to the immutable bill line item grid upon pressing Enter.

---

## 6. Design Rationale
Implements the exact layout and industrial logic aesthetic (`#041632`, `#3e5f90`, `#fbf8fb`, `#a7c8ff`) defined in `F:\SMRITI\Distributor\stitch_barcode_label_designer_and_printer`.

---

## 7. Implementation Summary
- Integrated all components, keyboard event listeners, and modals.
- Verified zero build warnings and clean automated test suite execution.

---

## 8. Tests Executed
```powershell
npx vitest run src/tests/smritiBillingTerminal.test.ts
npx vitest run src/tests/tagLabelPrinting.test.ts
```

---

## 9. Verification Results
```text
 RUN  v4.1.10 F:/SMRITRretailNX

 ✓ src/tests/smritiBillingTerminal.test.ts (5 tests) 6ms
 ✓ src/tests/tagLabelPrinting.test.ts (14 tests) 10ms

 Test Files  2 passed (2)
      Tests  19 passed (19)
```

---

## 10. Known Limitations
- None.

---

## 11. Future Work
- Direct weighing scale serial port integration on the F11 qty input.

---

## 12. Related ADRs
- `ADR-0024-Distributor-Invoicing-Stitch-Integration`
- `ADR-DISTRIB-INVOICE-01`

---

## 13. Related RFCs
- `RFC-2026-Distributor-Invoicing-Settlement`
