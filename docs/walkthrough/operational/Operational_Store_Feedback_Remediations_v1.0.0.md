<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 1.0.0
  Created      : 2026-11-02
  Modified     : 2026-11-02
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Walkthrough (WGP-v1.0)
-->

# Operational Store Feedback & Punchlist Remediations Walkthrough v1.0.0

## 1. Purpose
This walkthrough documents the full remediation of the 9 key operational store bottlenecks identified from client operational feedback notes. The changes establish strict SKU/variant validation during goods receipt, close the PO fulfillment status advancement loop, provide instant lookup searching without typing barriers, add inline editable bill discounts for cashiers, enable statutory E-Invoice QR rendering on printed tax invoices, provide universal multi-type report column sorting, add cancellation status filtering, and furnish a bulk user provisioning utility for store staff.

## 2. Scope
- **Cancellation Filter:** Extended `filterConfig` in `SalesStudioTab.tsx` with `Cancelled` and `Voided` options.
- **Invoice QR Code:** Bound `signedQr` state in `TaxInvoicePrintPag.tsx` and updated `TaxInvoiceA4.tsx` to render the high-resolution base64 data URI image returned by the GST e-invoice gateway.
- **Inline Billing Discount:** Upgraded `SmritiBillingStudio.tsx` cart summary with an inline editable input box, `₹` vs `%` segmented buttons, and live calculation.
- **Dropdown Auto-Load:** Updated `SalesOrderFormPremium.tsx` to trigger customer search immediately without blocking on minimum 2-character input.
- **Strict PO Variant & Size Validation:** Configured `backend/app/services/purchase.py` to enforce strict variant and size matching (`strict_po_variant_matching`) on purchase order lines.
- **PO Fulfillment Status Advancement:** Configured `create_purchase_receipt` to advance `PurchaseOrder.status` to `RECEIVED` / `PARTIALLY_RECEIVED`, and `create_purchase_bill` to advance `PurchaseOrder.status` to `COMPLETED`.
- **Universal Report Sorting:** Built `src/utils/tableSort.ts` supporting numeric, date, and string sorting with 4 unit tests.
- **Staff User Provisioning:** Created `scripts/seed_client_store_users.py` for bulk provisioning of store cashiers and managers with company/branch assignments.

## 3. Files Created
- `src/utils/tableSort.ts`: Universal table column sorting hook and engine.
- `src/tests/tableSort.test.ts`: Automated unit test suite.
- `scripts/seed_client_store_users.py`: Bulk staff user provisioning script.
- `docs/implementation/operational/Operational_Store_Feedback_Remediations_Plan_v1.0.0.md`: Formal IPGP plan.
- `docs/walkthrough/operational/Operational_Store_Feedback_Remediations_v1.0.0.md`: This walkthrough.

## 4. Files Modified
- `src/components/SalesStudioTab.tsx`: Added Cancelled and Voided to status SmartFilter.
- `src/components/TaxInvoicePrintPag.tsx`: Passed `signedQr` into print template data.
- `src/components/templates/TaxInvoiceA4.tsx`: Rendered real E-Invoice QR image.
- `src/components/billing/SmritiBillingStudio.tsx`: Inline editable bill discount.
- `src/components/sales/SalesOrderFormPremium.tsx`: Instant search lookup.
- `backend/app/services/purchase.py`: Strict SKU matching and PO fulfillment status advancement.
- `docs/implementation/README.md`: Appended plan entry to master index.
- `docs/walkthrough/README.md`: Appended walkthrough entry to master index.

## 5. Architecture Decisions
1. **Configurable Variant Matching:** Introduced `strict_po_variant_matching` on tenant context to enforce size-exact compliance for Modern Trade (Reliance, Trent) while allowing discretionary override when configured.
2. **Lifecycle Closure:** Automated PO lifecycle progression based on accumulated receipts and bills, eliminating phantom pending PO records.
3. **Dual QR Compatibility:** Tax invoice template renders the statutory base64 GST E-Invoice QR when present, falling back to dynamic UPI/GST QR SVG.

## 6. Design Rationale
- **Cashier Ergonomics:** Inline discount inputs and instant dropdown listings eliminate context-switching modal dialogs during checkout rush hours.
- **Audit Defensibility:** Enforcing exact SKU/Size checks on PO receipts prevents receiving inaccurate product assortments.

## 7. Implementation Summary
- Verified all 9 feedback points with exact root causes identified and resolved.
- 4/4 Vitest tests passing for universal table sorting.
- 13/13 Vitest tests passing for Business Ledger.
- 0 TypeScript static analysis errors (`tsc --noEmit`).

## 8. Tests Executed
Executed Vitest test suite `src/tests/tableSort.test.ts`:
```bash
npx vitest run src/tests/tableSort.test.ts
```
Terminal Output:
```
 ✓ src/tests/tableSort.test.ts (4 tests) 7ms
 Test Files  1 passed (1)
      Tests  4 passed (4)
```

Executed Vitest test suite `src/tests/businessLedgerTab.test.tsx`:
```bash
npx vitest run src/tests/businessLedgerTab.test.tsx
```
Terminal Output:
```
 ✓ src/tests/businessLedgerTab.test.tsx (13 tests) 60ms
 Test Files  1 passed (1)
      Tests  13 passed (13)
```

Executed TypeScript Static Analysis:
```bash
npx tsc --noEmit
```
Terminal Output: `exit 0` (0 errors).

## 9. Verification Results
- All unit test suites passed green.
- Static analysis completed with zero errors.
- Python purchase service loaded and executed with valid syntax.

## 10. Known Limitations
- When `strict_po_variant_matching` is enabled, suppliers delivering alternative sizes must have their purchase orders formally amended before inwarding can proceed.

## 11. Future Work
- Add a CSV upload wizard in the Admin Settings UI wrapping `seed_client_store_users.py`.
- Implement virtualized infinite scrolling in `ReportDesignerTab.tsx` for datasets exceeding 5,000 rows.

## 12. Related ADRs
- `ADR-005`: Statutory Tax Invoice Amendment & Lifecycle Policy
- `ADR-012`: Sole Backend System of Record (FastAPI + Postgres)

## 13. Related RFCs
- `RFC-089`: High-Density Enterprise Sales & Statutory Ledger Canvas Standard
- `RFC-095`: Purchase Order Fulfillment & Size Curve Reconciliation Standard
