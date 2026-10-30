<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.33.3
  Created      : 2026-09-24
  Modified     : 2026-09-24
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: ProPOS Billing Terminal Clean Desktop Layout & Shoper 9 Parity Refactor

**Version:** 6.33.3  
**Area:** Billing / Retail POS (`src/components/billing/propos/`)  
**Status:** Completed & Verified  

---

## 1. Purpose
Refactor `ProPosBillingTerm.tsx` to eliminate visual clutter, remove multi-line address textareas and debug banners from the active billing surface, and achieve 1-to-1 visual and ergonomic parity with the clean desktop POS interface of legacy Shoper 9 (`SR200100`).

---

## 2. Scope
- **Component:** `src/components/billing/propos/ProPosBillingTerm.tsx`
- **Clean Header:** Replaced inline multiline B2B address fields (`Bill To` & `Ship To`), location dropdowns, and address edit links with a single-line compact header matching Shoper 9 (`Bill Type | Tx Type | Prefix / No | Customer [Add] [F2] | Sales Staff`).
- **Encapsulated Delivery Instructions:** Relocated B2B shipping location selectors and special delivery notes into a dedicated modal triggered via the new `[Delivery Instructions]` button on the remarks bar.
- **Removed Visual Clutter Banners:** Eliminated the stacked in-place editing banner, line inspector ribbon, and multi-attribute inspection strip that previously consumed ~100px of vertical table space.
- **Dual-Grid Column Alignment:** Standardized top 10-row grid and bottom docked direct entry strip to 13 aligned columns: `S No. | Stock No | Item Description | Rate | Qty | Value | Disc Code | Disc Qty | Disc. % | Disc.Amt | Total | SalesStaff | Del`.
- **Document Remarks Row:** Added `Document Remarks: [input]` flanked by `[Show Item Tags]` and `[Delivery Instructions]` buttons.
- **Shoper 9 9-Box Footer Metric Ribbon:** Reconstructed the bottom ribbon into 9 individual dark slate metric blocks (`No. of Items | Total Qty. | Sales Value | Item Lvl. Discount | Bill Discount | Total Tax | Total Addons | Total Deductions | Net Amount`).
- **Collapsible Summary Tray:** Provided `<` toggle chevron for the right-hand `Net Values` summary breakdown.

---

## 3. Files Created
- `docs/walkthrough/billing/Billing_ProPOS_Desktop_Clean_Layout_Refactor_v6.33.3.md`

---

## 4. Files Modified
- `src/components/billing/propos/ProPosBillingTerm.tsx`: Streamlined UI layout, added `documentRemarks` and `deliveryInstructions` states, aligned grid and entry row columns, added `SmritiDeliveryInstructionsModal` and `SmritiItemTagsModal`.

---

## 5. Architecture Decisions
1. **Separation of Concerns for Customer Data:** Customer address master data, GSTINs, and multi-branch shipping codes belong in `CustMasterWs.tsx` and dedicated modal popups (`CustBrowseDlg.tsx`, `DeliveryInstructionsModal`), not cluttering the rapid cashier scanning terminal.
2. **Ergonomic Keyboard Retention:** Preserved all legacy hotkeys (`Alt+1..6`, `F7`, `F8`, `F9`, `F10`, `F12`, `F6`, `F2`) while maintaining the column-for-column docked direct entry row for cashier muscle memory.
3. **Telemetry in Status Bar:** Active scanned item metadata (SKU, Stock quantity, MRP, HSN) and terminal shift indicators are rendered in the bottom status line (`Ready....`), preventing table layout shifts.

---

## 6. Design Rationale
In high-throughput retail checkout, cashier speed is directly correlated with visual simplicity. The legacy Shoper 9 billing interface succeeded because it kept the main screen focused entirely on line item scanning and totals, deferring master configuration to dialogs. SMRITI restores this ergonomic clarity while retaining modern capabilities (UPI QR, loyalty points, live GST engine).

---

## 7. Implementation Summary
- **Header:** Reduced from 140px multi-level block to 36px clean single-row strip.
- **Table:** Standardized 13-column layout with 10 stable display rows (including empty filler rows).
- **Direct Entry Dock:** Column-aligned beneath row 10 with automatic scanner intercept guard (preventing accidental barcode scanning into numeric Rate/Qty fields).
- **Remarks & Delivery:** Added single-line remarks input with modal triggers for tags and addresses.
- **Totals Ribbon:** 9 crisp slate-gray boxes matching Shoper 9 specifications.
- **Modals:** Added `SmritiDeliveryInstructionsModal` (B2B shipping selection) and `SmritiItemTagsModal` (serial/batch tags).

---

## 8. Tests Executed
```bash
npx tsc --noEmit
npx vitest run src/tests/billingTerm.test.ts src/tests/billingInputValidations.test.ts src/tests/billingCorporateWiring.test.ts src/tests/proPosKeys.test.ts src/tests/fullBilling.test.ts src/tests/smritiF2BillingSearch.test.ts
python scripts/ci_ux_field_governance_guard.py
```

---

## 9. Verification Results
- **TypeScript Compilation:** 0 errors (`tsc --noEmit` exit code 0).
- **Unit & Integration Tests:** 81/81 passed across 6 test suites.
- **CI UX Field Governance Guard:** 0 critical/error violations.
- **Code Reduction:** 567 insertions, 793 deletions (net -226 lines of clutter removed).

---

## 10. Known Limitations
None. All underlying B2B location wiring and checkout payloads (`billing_location_id`, `delivery_location_id`, `shipping_address`, `remarks`) remain 100% intact.

---

## 11. Future Work
- Connect `[Show Item Tags]` to batch-level expiry and serial tracking in WMS/Inventory.
- Secondary customer-facing pole display route `/pos/customer-display`.

---

## 12. Related ADRs
- `ADR-0042`: Retail POS Terminal Keyboard Ergonomics and Hotkey SSOT.
- `ADR-0048`: Separation of B2B Distributor Invoicing vs Retail POS Billing.

---

## 13. Related RFCs
- `RFC-2026-08`: Shoper 9 Legacy Parity & Visual Simplicity Governance.
