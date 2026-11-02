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

# Implementation Plan: Billing QR Codes, Direct Discount Editing, Dropdown Instant Display & PO Billed Item Tracking

**Version:** 6.99.20  
**Date:** 2026-11-03  
**Status:** Completed  

---

## 1. Objective
Fulfill store operational requirements for QR rendering on invoices, direct bill discount editing, dropdown instant options without character typing hurdles, cancelled sales invoice filtering, and purchase order billed item quantity reconciliation.

## 2. Business Motivation
Store cashiers and purchase managers reported friction during daily operations:
- Customers were unable to scan QR codes on printed receipts or tax invoices.
- Cashiers could not type a manual discount directly on the bill level without navigating multiple promotion menus.
- Dropdowns showed blank states until at least two characters were typed.
- Cancelled invoices disappeared entirely from smart search results.
- Inwarding purchase orders showed items as full pending quantity even after they were billed or received.

## 3. Scope
Frontend billing studios, print templates, typeahead services, purchase order schemas and APIs, and sales invoice repository queries.

## 4. Current State
- `TaxInvoiceA4.tsx` rendered an artificial pseudo-hash grid or an `<img>` tag with unparsed raw JWT text.
- `BillingTerm.tsx` only displayed bill discounts as a static label with an F6 modal link.
- `SalesOrderFormPremium.tsx` required `query.length >= 2` before fetching items.
- `SalesInvoiceRepository.search` filtered out all soft-deleted records regardless of status filter.
- `PurchaseOrderItemResponse` lacked `received_qty`, `billed_qty`, and `pending_qty` tracking.

## 5. Gap Analysis
- No unified QR generation component for E-Invoice and UPI.
- Lack of keyboard-accessible inline discount editor in billing summary.
- Unnecessary character count restrictions on comboboxes.
- Lack of cancelled invoice visibility in smart filters.
- Disconnected inward tracking between PO line items and actual receipts.

## 6. Architecture Impact
Enhanced `UniversalInvoiceQr` component deployed across print engines. Backend sales repository enhanced with status-aware soft-delete handling. Extended purchase order schemas and APIs with item-level reconciliation.

## 7. Proposed Design
- Implement `UniversalInvoiceQr` using `qrcode` library.
- Add inline editable discount inputs with `Alt+D` hotkey in `BillingTerm.tsx` and `SmritiBillingStudio.tsx`.
- Update customer and item search services to return default options when query is empty.
- Update `SalesInvoiceRepository.search` to query cancelled/voided soft-deleted invoices.
- Compute line-level `received_qty` and `pending_qty` from `PurchaseReceiptItem` in `get_purchase_order_contract`.

## 8. Files Created
- `src/components/common/UniversalInvoiceQr.tsx`
- `src/tests/operationalPunchlistSolutions.test.tsx`
- `backend/app/tests/test_operational_punchlist_backend.py`

## 9. Files Modified
- `src/components/templates/TaxInvoiceA4.tsx`
- `src/components/sales/DistTaxInvoice.tsx`
- `src/components/billing/propos/ProPosTaxInvoiceRc.tsx`
- `src/print_engine/templates/StandardInvoiceA4.tsx`
- `src/components/billing/BillingTerm.tsx`
- `src/components/billing/SmritiBillingStudio.tsx`
- `src/services/autoPopulateService.ts`
- `src/components/sales/SalesOrderFormPremium.tsx`
- `src/components/purchase/AddProductToGrnModal.tsx`
- `backend/app/repositories/sales.py`
- `backend/app/schemas/purchase.py`
- `backend/app/api/v1/purchase.py`

## 10. Dependencies
`qrcode` npm package (already in `package.json`).

## 11. Risks
Low risk: all changes are non-destructive, preserve fallback behaviors, and do not break existing database contracts.

## 12. Rollback Strategy
Revert modified components via Git commit revert.

## 13. Verification Plan
- Vitest test suite execution.
- Pytest backend test execution.
- Vite production build verification.

## 14. Test Plan
- Verify QR data URL generation for both E-Invoice signed payloads and UPI deep links.
- Test manual discount calculations (flat and percent).
- Test search comboboxes with empty and single-character queries.
- Test purchase order line reconciliation schema.

## 15. Documentation Impact
Update Walkthrough and Implementation Plan indexes, and `CHANGELOG.md`.

## 16. Deployment Plan
Commit and push to `origin/smritiNX` from DEV, and deploy to TEST clone `F:\Smriti9` via `git pull`.

## 17. Status
Completed.

## 18. Related ADRs
- `ADR-2026-08`: Universal E-Invoicing & Compliance Gateway Architecture.

## 19. Related Walkthroughs
- `docs/walkthrough/billing/Billing_QR_Direct_Discount_PO_Billed_Reconciliation_v6.99.20.md`

