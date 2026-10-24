<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Version      : 1.0.0
  Created      : 2026-09-29
  Modified     : 2026-09-29
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
-->

# Vendor 360 UX-DB Wiring Fix v1.0

## 1. Purpose
Fix five UX-to-DB wiring gaps in Vendor 360: (1) contacts/addresses/banks silently discarded on save, (2) Procurement tab doing client-side PO filtering, (3) Payables tab showing mock data, (4) Scorecard tab using hardcoded PO records.

## 2. Scope
- backend/app/services/vendor_svc.py — update_vendor()
- src/components/vendor/tabs/VendorProcurementTab.tsx
- src/components/vendor/tabs/VendorPayablesTab.tsx
- src/components/vendor/tabs/VendorScorecardTab.tsx

## 3. Files Created
None.

## 4. Files Modified
| File | Change |
|------|--------|
| backend/app/services/vendor_svc.py | Contacts/addresses/bank accounts upsert-by-id + soft-delete in update_vendor() |
| VendorPayablesTab.tsx | Replaced SupplierPaymentEngine mock with live /purchase/orders/ and /purchase/supplier-payments/ API calls |
| VendorProcurementTab.tsx | Server-side ?supplier_id= filter; legacy ID fallback |
| VendorScorecardTab.tsx | Live PO fetch replacing two hardcoded mock PO records; loading + empty states |

## 5. Architecture Decisions
- AD-1: Upsert-by-id + soft-delete for sub-entities — preserves FK references from purchase transactions
- AD-2: Dual supplier_id lookup: Universal Party UUID first, then legacy sup-{code} fallback
- AD-3: Payables aging computed as po.created_at + payment_terms_days

## 6. Design Rationale
No schema changes. No new endpoints. No API contract changes. VendorUpdateRequest already accepted Optional[List[...]] for contacts/addresses/banks — backend was silently ignoring them.

## 7. Implementation Summary
- update_vendor(): three new blocks after commercial profile update; soft-delete removed entries; upsert matched by id; insert new entries
- VendorProcurementTab: apiFetchV1('/purchase/orders/?supplier_id='+vendor.id) with fallback to sup-{code}
- VendorPayablesTab: useEffect fetches live orders + payments; classifies aging per due date; deducts payments oldest-first; falls back to outstanding_liability when no POs
- VendorScorecardTab: useEffect fetches orders and maps to PurchaseOrderRecord[]; scorecard engine runs on real data; returns null (empty state) when no POs

## 8. Tests Executed
No automated tests run in this session. Manual browser test pending in F:\Smriti9 test environment.

## 9. Verification Results
Status: Partially Verified

Commit: c21a19e49916c8f4bff6e5b1fa0fda91bda9cebb on branch smritiNX
- vendor_svc.py: 102 line additions (git show confirmed)
- VendorPayablesTab.tsx: 289 line changes (git show confirmed)
- VendorProcurementTab.tsx: 24 line changes (git show confirmed)
- VendorScorecardTab.tsx: 120 line changes (git show confirmed)
- Runtime test: Unverified — requires browser test with real vendor data

## 10. Known Limitations
- Payables due date uses po.created_at + terms_days; custom due date fields not yet considered
- Scorecard received_qty derived from PO items; should use GRN data when available
- outstanding_liability fallback in Payables is not reconciled with actual payments

## 11. Future Work
- Integration tests for VendorService.update_vendor() covering contact upsert, address soft-delete, bank account replacement
- Backend endpoint GET /purchase/vendors/{id}/payables-summary for server-side aging
- Update Scorecard to use GRNItem.received_qty once GRN-PO item linkage exists

## 12. Related ADRs
ADR-VEND-01: Universal Party Master and Vendor 360 Architecture

## 13. Related RFCs
None active.
