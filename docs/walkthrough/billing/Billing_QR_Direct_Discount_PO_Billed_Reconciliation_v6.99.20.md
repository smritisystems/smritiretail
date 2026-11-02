<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.99.20
  Created      : 2026-11-03
  Modified     : 2026-11-03
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: Billing QR Codes, Direct Discount Editing, Dropdown Instant Display & PO Billed Item Tracking

**Version:** 6.99.20  
**Date:** 2026-11-03  
**Status:** Done  
**Verification Level:** Level A (Code Inspection, Full Vitest & Pytest Terminal Outputs, Production Build Verified)

---

## 1. Purpose
Resolve store operational feedback items from the store punchlist:
1. **Item 4 — QR Missing in Invoice**: Generate and render authentic, scannable QR codes across all tax invoice templates, replacing legacy static pseudo-hash rendering with the official statutory GST E-Invoice signed QR and NPCI UPI dynamic payment QR standard.
2. **Item 7 — Discount Not Editable on Billing Level**: Enable cashiers and billing operators to directly edit bill-level discounts (toggle between Flat ₹ and Percentage %) directly in the billing summary totals card, with immediate hotkey support (`Alt+D`).
3. **Item 8 — Drop Down Works Only When We Type Something**: Remove unnecessary minimum character barriers across stock lookups, customer typeaheads, and billing comboboxes, allowing dropdowns to immediately display top/recent records on click/focus without requiring typing.
4. **Item 2 — Cancellation Filter Missing from Smart Filter**: Fix the soft-delete filter in `SalesInvoiceRepository` so that searching for `Cancelled` or `Voided` records properly surfaces cancelled invoices instead of returning an empty list.
5. **Item 6 — Item If Billed, Still Shows in PO**: Implement line-level billed and pending quantity reconciliation in Purchase Order APIs, schemas, and GRN modal interfaces, preventing billed items from reappearing as fully unreceived.

---

## 2. Scope
- Universal Invoice QR Component: `src/components/common/UniversalInvoiceQr.tsx`
- Invoice Print Templates: `src/components/templates/TaxInvoiceA4.tsx`, `src/components/sales/DistTaxInvoice.tsx`, `src/components/billing/propos/ProPosTaxInvoiceRc.tsx`, `src/print_engine/templates/StandardInvoiceA4.tsx`
- Billing Terminal & POS: `src/components/billing/BillingTerm.tsx`, `src/components/billing/SmritiBillingStudio.tsx`
- Auto-populate & Search: `src/services/autoPopulateService.ts`, `src/components/sales/SalesOrderFormPremium.tsx`
- Backend Repositories & APIs: `backend/app/repositories/sales.py`, `backend/app/schemas/purchase.py`, `backend/app/api/v1/purchase.py`
- Purchase & GRN Workspaces: `src/components/purchase/AddProductToGrnModal.tsx`

---

## 3. Files Created
1. `src/components/common/UniversalInvoiceQr.tsx`
2. `src/tests/operationalPunchlistSolutions.test.tsx`
3. `backend/app/tests/test_operational_punchlist_backend.py`

---

## 4. Files Modified
1. `src/components/templates/TaxInvoiceA4.tsx`
2. `src/components/sales/DistTaxInvoice.tsx`
3. `src/components/billing/propos/ProPosTaxInvoiceRc.tsx`
4. `src/print_engine/templates/StandardInvoiceA4.tsx`
5. `src/components/billing/BillingTerm.tsx`
6. `src/components/billing/SmritiBillingStudio.tsx`
7. `src/services/autoPopulateService.ts`
8. `src/components/sales/SalesOrderFormPremium.tsx`
9. `src/components/purchase/AddProductToGrnModal.tsx`
10. `backend/app/repositories/sales.py`
11. `backend/app/schemas/purchase.py`
12. `backend/app/api/v1/purchase.py`

---

## 5. Architecture Decisions
1. **Universal QR Code Strategy**: Rather than rendering broken JWT string text or a pseudo-random hash grid, `UniversalInvoiceQr` dynamically detects if a signed JWT payload exists (`signed_qr_code`). If present, it creates an authentic B2B statutory GST E-Invoice QR. If absent, it generates an official NPCI deep link (`upi://pay?pa=...&pn=...&am=...&cu=INR&tn=...&tr=...`) fulfilling both B2C statutory compliance and instant customer UPI payment.
2. **Non-Destructive Manual Discount Override**: When a cashier enters a manual bill discount, `isManualBillPromoOverride` is flagged `true` to prevent auto-promotion rules from wiping out the cashier's custom discount, while providing a clear `✕` button to revert to system rules.
3. **Soft-Delete Aware Filter in Sales Repository**: Soft-deleted invoices with `status='Cancelled'` are now transparently queryable when a filter explicitly queries `Cancelled` or `Voided`, resolving the long-standing issue where cancelled documents vanished completely.
4. **Line-Level Billed Reconciliation**: Line items in purchase orders now compute `received_qty`, `billed_qty`, and `pending_qty` directly from linked `purchase_receipt_items` and `purchase_bills`, preventing over-receipt and duplicate billing.

---

## 6. Design Rationale
- Cashiers at retail checkout counters require rapid keyboard shortcuts (`Alt+D`) and direct inline inputs rather than multi-click promotional modal navigation.
- Search comboboxes should provide immediate visual discovery on click/focus rather than displaying "No items found" until the user types multiple characters.
- Inwarding goods against a PO must clearly distinguish between original ordered quantity, previously received/billed quantity, and remaining pending units.

---

## 7. Implementation Summary
- **UniversalInvoiceQr**: Created with customizable sizing, dynamic labels, and pixel-perfect print rendering.
- **BillingTerm**: Replaced read-only promo div with interactive flat/percent discount controls, keyboard shortcuts, and immediate customer typeahead on focus.
- **SalesOrderFormPremium**: Stock lookup modal now invokes `loadItems("")` immediately on open and handles search queries of any length.
- **SalesInvoiceRepository**: Added multi-status parsing and soft-delete awareness for cancelled and voided sales invoices.
- **Purchase API & Schemas**: Extended purchase order items with `received_qty`, `billed_qty`, `pending_qty`, and `is_billed`.

---

## 8. Tests Executed
1. `npx vitest run src/tests/operationalPunchlistSolutions.test.tsx`: 5/5 passed.
2. `npx vitest run src/tests/distTaxInvoicePrint.test.tsx src/tests/proposTaxInvoiceReceipt.test.tsx src/tests/reportingCenterHub.test.tsx`: 13/13 passed.
3. `pytest backend/app/tests/test_operational_punchlist_backend.py`: 3/3 passed.
4. `npm run build`: Production build succeeded in 1m 27s with 3,754 modules transformed and 0 errors.

---

## 9. Verification Results
- All unit and integration test assertions passed.
- Production bundle verification passed cleanly with zero type errors.

---

## 10. Known Limitations
- UPI payment dynamic QR generation relies on store profile UPI ID configuration; if unconfigured, it defaults to `billing@smritibooks`.

---

## 11. Future Work
- Integration with biometric UPI soundboxes for instant real-time payment confirmation at checkout.

---

## 12. Related ADRs
- `ADR-2026-08`: Universal E-Invoicing & Compliance Gateway Architecture.
- `ADR-2026-11`: Strangler-Fig Express Decommissioning & FastAPI Consolidation.

---

## 13. Related RFCs
- `RFC-2026-04`: ProPOS Dynamic Checkout & Keyboard Accelerator Standard.

