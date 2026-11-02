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
  Classification: Implementation Plan (IPGP-v1.0)
-->

# Operational Store Feedback & Punchlist Remediations Implementation Plan v1.0.0

## 1. Objective
Remediate the 9 key operational bottlenecks identified from live store operator feedback: report sorting, missing cancellation filter in SmartFilter, client staff user provisioning, missing QR code on printed tax invoices, performance optimizations, PO billed/received status advancement, inline bill discount editing, dropdown lookup auto-loading, and strict SKU/size validation during GRN inwarding.

## 2. Business Motivation
Store operators, cashiers, and logistics managers face daily operational friction when:
1. POs continue to show billed or received line items because PO statuses never advance to `RECEIVED` or `COMPLETED`.
2. Goods receipt accepts wrong sizes or arbitrary merchandise because GRN validation only checked generic product IDs.
3. Cashiers cannot apply or negotiate discretionary bill discounts without navigating modal popups.
4. Tax invoices print without the statutory GST E-Invoice QR code.
5. Search dropdowns show empty results until typing 2 characters.
6. Cancelled bills cannot be filtered in Sales Studio.

## 3. Scope
- **Item 1 (Sorting):** Universal multi-type table sorting engine (`src/utils/tableSort.ts`) supporting numeric, date, and alphabetical sorting.
- **Item 2 (Cancellation Filter):** Add `Cancelled` and `Voided` status options to `SmartFilter` in `SalesStudioTab.tsx`.
- **Item 3 (Staff Provisioning):** Dedicated bulk user provisioning utility (`scripts/seed_client_store_users.py`) for tenant company/branch assignments.
- **Item 4 (Invoice QR Code):** Real GST E-Invoice signed QR and UPI QR rendering in `TaxInvoiceA4.tsx` and `TaxInvoicePrintPag.tsx`.
- **Item 5 (Performance):** Code splitting, pagination, and sorting optimization.
- **Item 6 (PO Fulfillment):** Automatic advancement of `PurchaseOrder.status` to `RECEIVED` / `PARTIALLY_RECEIVED` upon GRN commitment and `COMPLETED` upon bill commitment.
- **Item 7 (Billing Discount):** Direct inline editable bill discount input with `₹` and `%` segmented toggle directly in `SmritiBillingStudio.tsx`.
- **Item 8 (Dropdown Lookups):** Instant search loading without forcing minimum 2-character input in `SalesOrderFormPremium.tsx`.
- **Item 9 (Strict GRN SKU/Size Validation):** Configurable strict variant matching (`strict_po_variant_matching`) requiring exact variant/size parity against PO lines.

## 4. Current State
- `SmartFilter` in Sales Studio only contained Draft, Submitted, Converted, Confirmed.
- `TaxInvoiceA4.tsx` rendered a static 21x21 mock SVG instead of the actual `signed_qr_code` base64 image returned by the GST e-invoice gateway.
- `SmritiBillingStudio.tsx` buried bill discount behind an 11px pencil modal icon.
- `purchase.py` allowed any item matching parent `product_id` to be received on a PO line regardless of size/color, and never updated PO status when received or billed.

## 5. Gap Analysis
- Missing status options in filter configurations.
- Unrendered state variables in print templates.
- Lack of inline POS checkout controls for cashier speed.
- Disconnected fulfillment lifecycle loop between Purchase Orders, GRNs, and Bills.
- Loose `or_` conditions in backend validation permitting variant substitution.

## 6. Architecture Impact
- **Non-Breaking Database Changes:** Reused existing `PurchaseOrder.status`, `PurchaseReceipt`, and `PurchaseBill` entities without migration drift.
- **Configurable Governance:** Introduced `strict_po_variant_matching` parameter on tenant context to allow enterprise stores to enforce or relax variant substitution.

## 7. Proposed Design
- Status SmartFilter includes `Cancelled` and `Voided`.
- Tax invoice templates check `data.signedQr || data.signed_qr_code` and render the high-resolution base64 data URI image.
- Billing Studio surfaces inline discount controls: `[ ₹ | % ] [ input ] (₹ calculated)`.
- Backend purchase service updates `PurchaseOrder.status` dynamically during GRN and Bill commits.

## 8. Files Created
- `src/utils/tableSort.ts`: Universal table column sorting hook and engine.
- `src/tests/tableSort.test.ts`: 4 automated unit tests for sorting engine.
- `scripts/seed_client_store_users.py`: Bulk staff user provisioning utility.
- `docs/implementation/operational/Operational_Store_Feedback_Remediations_Plan_v1.0.0.md`: This plan.
- `docs/walkthrough/operational/Operational_Store_Feedback_Remediations_v1.0.0.md`: Formal WGP walkthrough.

## 9. Files Modified
- `src/components/SalesStudioTab.tsx`: Added Cancelled & Voided to status filter.
- `src/components/TaxInvoicePrintPag.tsx`: Passed `signedQr` into print template.
- `src/components/templates/TaxInvoiceA4.tsx`: Rendered real E-Invoice QR image.
- `src/components/billing/SmritiBillingStudio.tsx`: Inline editable bill discount.
- `src/components/sales/SalesOrderFormPremium.tsx`: Instant search lookup.
- `backend/app/services/purchase.py`: Strict SKU matching + PO fulfillment advancement.
- `src/components/reports/SmritiReportEngine.tsx`: Multi-type column sorting with numeric, date, and text support.
- `src/components/ReportDesignerTab.tsx`: Multi-type column sorting across Purchase Inward Register (detailed & summary), Tax Register, and Bill-wise Sales.
- `src/components/purchase/AddProductToGrnModal.tsx`: Strict PO line scoping with explicit SKU, size, and color parameters.
- `src/components/purchase/GrnReceiptTab.tsx`: Bound selected PO lines and existing GRN state to inward modal.

## 10. Dependencies
- React, TypeScript, Vite, FastAPI, SQLAlchemy, Vitest.

## 11. Risks
- *Risk:* Stores with loose PO practices unable to receive alternative sizes.
  *Mitigation:* Configurable via `strict_po_variant_matching` parameter (defaults to `True` for modern trade compliance).

## 12. Rollback Strategy
- Standard git revert restoring previous commit without database migrations.

## 13. Verification Plan
- Unit tests verifying `sortTableData`.
- Full TypeScript static check (`npx tsc --noEmit`).
- Production build verification (`npm run build`).

## 14. Test Plan
- Run `npx vitest run src/tests/tableSort.test.ts` (4/4 passed).
- Run `npx vitest run src/tests/businessLedgerTab.test.tsx` (13/13 passed).

## 15. Documentation Impact
- Update `docs/walkthrough/README.md`.
- Update `docs/implementation/README.md`.

## 16. Deployment Plan
- Commit and push to branch `smritiNX`.

## 17. Status
Completed

## 18. Related ADRs
- `ADR-005`: Statutory Tax Invoice Amendment & Lifecycle Policy
- `ADR-012`: Sole Backend System of Record (FastAPI + Postgres)

## 19. Related Walkthroughs
- `docs/walkthrough/operational/Operational_Store_Feedback_Remediations_v1.0.0.md`

