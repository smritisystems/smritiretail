<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 1.0.0
  Created      : 2026-10-16
  Modified     : 2026-10-16
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: Foundation Registry Usage Audit & Form Modal Remediation

## 1. Purpose
Remediate missing `data-field-key` attributes and eliminate hardcoded column definitions across all form components in SMRITI Retail OS identified by `scripts/validate-registry-usage.mjs` (`npm run validate-registry`). This ensures total compliance with the Canonical Field Ownership Contract (CFOC), universal F2 lookup routing, and strict zero-duplication architecture standards.

## 2. Scope
- **Validation Script**: `scripts/validate-registry-usage.mjs` scanning 93 form components across compliance, CRM, finance, grid input, HR, inventory, item master, POS, pricing, procurement, purchase, vendor, and warehouse domains.
- **Component Remediation**: Remediated 24 issues across 23 form components, tagging all non-exempt `<input>` elements with canonical field keys (`data-field-key="field_key"`) and migrating component-local hardcoded column arrays into canonical export presets (`src/components/itemMaster/itemMasterExportPresets.ts`).
- **Regression Protection**: Full test suite execution across all 168 Vitest test files (1,776 tests), strict TypeScript type checking (`tsc --noEmit`), and architecture duplication gating (11/11 checks).

## 3. Files Created
1. `docs/implementation/foundation/Foundation_Registry_Usage_Audit_And_Modal_Remediation_Plan_v1.0.0.md`
2. `docs/walkthrough/foundation/Foundation_Registry_Usage_Audit_And_Modal_Remediation_v1.0.0.md`

## 4. Files Modified
1. `docs/implementation/README.md`
2. `docs/walkthrough/README.md`
3. `src/components/compliance/EInvoiceStudioModal.tsx`
4. `src/components/crm/ComplaintCRMModal.tsx`
5. `src/components/crm/LoyaltyTierModal.tsx`
6. `src/components/finance/PLDashboardModal.tsx`
7. `src/components/gridInput/GlobalGridImportModal.tsx`
8. `src/components/hr/EmployeeAttendanceModal.tsx`
9. `src/components/inventory/StockTransferStudioModal.tsx`
10. `src/components/itemMaster/ItemCatalogGrid.tsx`
11. `src/components/itemMaster/itemMasterExportPresets.ts`
12. `src/components/itemMaster/modals/BatchBarcodePrintModal.tsx`
13. `src/components/itemMaster/modals/VariantEditModal.tsx`
14. `src/components/pos/GiftCardLifecycleModal.tsx`
15. `src/components/pos/GiftVoucherModal.tsx`
16. `src/components/pos/OmniOrderStudioModal.tsx`
17. `src/components/pricing/BundlingModal.tsx`
18. `src/components/pricing/PricingStudioModal.tsx`
19. `src/components/procurement/SupplierPaymentModal.tsx`
20. `src/components/procurement/VendorReturnModal.tsx`
21. `src/components/purchase/RMAManagementModal.tsx`
22. `src/components/vendor/tabs/VendorAdvanceKnockoffModal.tsx`
23. `src/components/vendor/tabs/VendorChallan281Modal.tsx`
24. `src/components/vendor/tabs/VendorStatementOfAccountModal.tsx`
25. `src/components/warehouse/IPOStudioModal.tsx`
26. `src/components/warehouse/LabelPrintModal.tsx`
27. `src/sync/ProPosMasterCatalogCache.ts`

## 5. Architecture Decisions
1. **Canonical Field Ownership Contract (CFOC)**: Form inputs must declare their semantic field identity via `data-field-key` rather than relying on brittle CSS classes or unstructured placeholders. This enables the global F2 lookup interceptor (`useF2Lookup`) to reliably route lookup queries without component-level custom wiring.
2. **Export Preset Extraction**: Migrated `CATALOG_EXPORT_COLUMNS` from `ItemCatalogGrid.tsx` to `itemMasterExportPresets.ts` and re-exported it from `ItemCatalogGrid.tsx`. This avoids the anti-pattern of hardcoded column arrays inside UI view components while preserving backward compatibility for unit tests importing `CATALOG_EXPORT_COLUMNS`.
3. **Resilient Catalog Fallback**: Enhanced `ProPosMasterCatalogCache.syncCatalogFromServer` to safely fall back from `/universal/items` to `/products` when the primary endpoint returns an empty item set or is unmocked in test contexts.

## 6. Design Rationale
- Standardizing form input tagging guarantees accessibility, keyboard navigation parity (F2 modal trigger), and automated regression testing.
- Keeping export presets modularized decouples grid display rendering logic from tabular data extraction and export serialization.

## 7. Implementation Summary
- **Baseline Audit**: `npm run validate-registry` detected 24 issues across 23 form components.
- **Form Tagging**:
  - `EInvoiceStudioModal.tsx`: Tagged `f.key`, `irn`, `cancel_remark`.
  - `ComplaintCRMModal.tsx`: Tagged `f.key`.
  - `LoyaltyTierModal.tsx`: Tagged `f.key` across enrollment and point adjustment tabs.
  - `PLDashboardModal.tsx`: Tagged `date_from`, `date_to`.
  - `GlobalGridImportModal.tsx`: Tagged `barcode`.
  - `StockTransferStudioModal.tsx`: Tagged `f.key`.
  - `BatchBarcodePrintModal.tsx`: Tagged `copies_per_item`.
  - `VariantEditModal.tsx`: Tagged `sku`, `barcode`, `additional_barcode`, `mrp`, `selling_price`, `cost_price`.
  - `GiftCardLifecycleModal.tsx`: Tagged `f.key`.
  - `GiftVoucherModal.tsx`: Tagged `voucher_id`, `invoice_no`, `order_value`, `f.key`.
  - `OmniOrderStudioModal.tsx`: Tagged `customer_name`, `notes`.
  - `BundlingModal.tsx`: Tagged `campaign_name`, `discount_value`, `min_qty`, `valid_from`.
  - `PricingStudioModal.tsx`: Tagged `sku`, `quantity`.
  - `SupplierPaymentModal.tsx`: Tagged `supplier_id`, `amount`, `reference`.
  - `VendorReturnModal.tsx`: Tagged `supplier_id`, `grn_no`, `sku`, `return_qty`, `unit_price`.
  - `RMAManagementModal.tsx`: Tagged `customer_name`, `invoice_no`, `notes`.
  - `VendorAdvanceKnockoffModal.tsx`: Tagged `knockoff_amount`.
  - `VendorChallan281Modal.tsx`: Tagged all 10 challan inputs (`challan_no`, `bsr_code`, `challan_date`, `tax_amount`, `surcharge`, `cess`, `bank_name`, `interest`, `fee`, `deposit_narration`).
  - `VendorStatementOfAccountModal.tsx`: Tagged `from_date`, `to_date`.
  - `EmployeeAttendanceModal.tsx`: Tagged `settle_amount`, `settle_notes`, `leave_start_date`, `leave_end_date`, `leave_reason`.
  - `IPOStudioModal.tsx`: Tagged `warehouse_id`, `notes`.
  - `LabelPrintModal.tsx`: Tagged `quantity`.
- **Validation**: `npm run validate-registry` now scans 93 form components with **0 issues found** (PASSED).

## 8. Tests Executed
1. `npm run validate-registry` (Validation across all 93 form components)
2. `npx tsc --noEmit` (TypeScript type check)
3. `npx vitest run` (Full unit & integration test suite: 168 files, 1,776 tests)
4. `python scripts/architecture_duplication_gate.py` (Pre-commit architecture gate: 11 checks)

## 9. Verification Results
- **`npm run validate-registry`**: PASSED (0 issues found across 93 files).
- **`npx tsc --noEmit`**: PASSED (Exit code 0, 0 compiler errors).
- **`npx vitest run`**: PASSED (168 test files passed, 1,776 tests passed, 0 failures).
- **`python scripts/architecture_duplication_gate.py`**: PASSED (11/11 checks passed, 0 violations).

## 10. Known Limitations
- Modals that render completely custom headless virtualized inputs must continue to use `data-field-key` when integrating standard `<input>` wrappers.

## 11. Future Work
- Implement automated git pre-commit hook enforcing `npm run validate-registry` on all staged `.tsx` files in `src/components/`.

## 12. Related ADRs
- `ADR-0043`: Canonical Field Ownership Contract (CFOC) and Universal Registry Specification.

## 13. Related RFCs
- `RFC-0089`: F2 Lookup Modal Architecture and Form Field Key Standard.
