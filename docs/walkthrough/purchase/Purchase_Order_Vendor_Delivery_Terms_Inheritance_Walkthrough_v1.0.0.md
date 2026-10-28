# SMRITI Retail OS Walkthrough: Purchase Order Vendor Delivery Terms Inheritance & Commercial Alignment v1.0.0

## 1. Purpose
This walkthrough documents the design, implementation, and verification of the end-to-end `Delivery Terms` commercial specification across Vendor Master, Purchase Order Studios (Sizewise and Standard Matrix), Slide-over Drawers, and A4 Statutory Printout Templates. It resolves commercial incoherence where purchase orders previously printed hardcoded `"Delivery Terms: Ex-Factory"` alongside `"Freight Terms: Paid by Supplier"`, and enables dynamic inheritance and configuration directly from the Vendor Master profile.

## 2. Scope
- **Backend Schema & Service Layer**: Added `delivery_terms` to `VendorCommercialProfileDTO`, `SupplierResponse`, and `PurchaseOrderResponse`.
- **Database Serialization**: Extended `VendorService` (create/update/get) and `PurchaseService` (`list_suppliers`, `get_supplier`, `create_purchase_order`) to store and retrieve `delivery_terms` in `Party.metadata_json["commercial_terms"]` without database migration overhead.
- **Intelligent Fallback Engine**: Coordinated automatic deduction between freight terms and delivery terms: `"Paid by Supplier"` defaults to `"Door Delivery"`; `"Paid by Buyer"` / `"To-Pay"` defaults to `"Ex-Factory"`.
- **Frontend Vendor Master**: Added `Default Delivery Terms` selector beside `Default Freight Terms` in `VendorCommercialTab.tsx`, wired into `VendorMasterWs.tsx` state normalization and dirty checking.
- **Purchase Order Workspace**: Wired `CommercialDeliveryDrawer.tsx`, `PoSizewiseTab.tsx`, `PoGenerateTab.tsx`, and `poModeConversion.ts` to inherit vendor delivery terms upon supplier selection, allow custom drawer overrides, and persist them into `commercial_terms` and notes.
- **Print Engine & Preview Modals**: Updated `POPrintPreviewModal.tsx` and `PurchaseOrderPrintA4.tsx` to print dynamic vendor/order delivery terms instead of static `"Ex-Factory"`.

## 3. Files Created
- `scratch/test_vendor_delivery_terms.py`: Schema validation and commercial fallback automated test script.
- `docs/walkthrough/purchase/Purchase_Order_Vendor_Delivery_Terms_Inheritance_Walkthrough_v1.0.0.md`: This 13-section WGP walkthrough document.

## 4. Files Modified
- `backend/app/schemas/vendor.py`
- `backend/app/schemas/purchase.py`
- `backend/app/services/vendor_svc.py`
- `backend/app/services/purchase.py`
- `src/types/vendor.ts`
- `src/components/vendor/VendorMasterWs.tsx`
- `src/components/vendor/tabs/VendorCommercialTab.tsx`
- `src/components/purchase/types.ts`
- `src/components/purchase/CommercialDeliveryDrawer.tsx`
- `src/components/purchase/poModeConversion.ts`
- `src/components/purchase/PoSizewiseTab.tsx`
- `src/components/purchase/PoGenerateTab.tsx`
- `src/components/purchase/POPrintPreviewModal.tsx`
- `src/print_engine/templates/PurchaseOrderPrintA4.tsx`
- `src/tests/poPrintBrandingAndTerms.test.tsx`
- `src/tests/poSizewiseGrouping.test.tsx`
- `CHANGELOG.md`
- `docs/walkthrough/README.md`

## 5. Architecture Decisions
- **Decision 1: JSONB Commercial Terms Extension**: Reused `Party.metadata_json["commercial_terms"]` for `delivery_terms`. Because `metadata_json` is PostgreSQL JSONB, no risky table migration or downtime was required while guaranteeing complete transactional persistence.
- **Decision 2: Symmetric Smart Fallback**: Provided deterministic bidirectional inference: if `delivery_terms` is omitted or unconfigured, the system automatically checks the freight terms keyword (`buyer`/`to-pay` -> `"Ex-Factory"`, otherwise `"Door Delivery"`). This guarantees that PO prints never produce legally conflicting terms.
- **Decision 3: Non-Destructive Override Hierarchy**: Vendor Master defines the master default; PO Creation inherits it automatically; the Commercial Drawer allows per-order logistics overrides (`isOverridden` badge); and the Print Preview Modal renders the final resolved terms with fallback protection.

## 6. Design Rationale
In statutory procurement, "Paid by Supplier" (where the vendor pays transportation and assumes transit risk) is fundamentally incompatible with "Ex-Factory" (where the buyer takes handover at the factory gate). Allowing hardcoded "Ex-Factory" on supplier-paid purchase orders created confusion during dispatch and audit disputes. By introducing `delivery_terms` into the Vendor Master and establishing intelligent default mapping, procurement teams achieve accurate legal contracts with zero manual friction.

## 7. Implementation Summary
1. **Schema Upgrades**: Added `delivery_terms: Optional[str] = "Door Delivery"` across `VendorCommercialProfileDTO` and `SupplierResponse`.
2. **Service Layer**: Upgraded `_to_vendor_detail`, `create_vendor`, and `update_vendor` in `VendorService`. Enriched `list_suppliers` and `get_supplier` in `PurchaseService` with `delivery_terms`.
3. **UI Integration**: Extended `VendorCommercialTab.tsx` with a responsive 4-column layout including `Default Freight Terms` and `Default Delivery Terms`. Integrated dirty state tracking in `VendorMasterWs.tsx`.
4. **Studio Inheritance**: Added `deliveryTerms` handling to `PoSizewiseTab` and `PoGenerateTab` supplier selection events, drawer slide-overs, and order save payloads.
5. **Print Engine Alignment**: Replaced static `"Ex-Factory"` in `POPrintPreviewModal.tsx` and `PurchaseOrderPrintA4.tsx` with dynamic resolution cascading from order header &rarr; vendor profile &rarr; smart freight inference.

## 8. Tests Executed
1. `scratch/test_vendor_delivery_terms.py`:
   - `VendorCommercialProfileDTO` serialization.
   - `SupplierResponse` field verification.
   - `PurchaseOrderResponse` smart fallback validation (`"Paid by Supplier"` -> `"Door Delivery"`, `"Paid by Buyer (To Pay)"` -> `"Ex-Factory"`).
2. `src/tests/poPrintBrandingAndTerms.test.tsx`:
   - Explicit `deliveryTerms` rendering.
   - Smart fallback deduction under "Paid by Supplier" and "Paid by Buyer".
3. `src/tests/poLifecycle.test.ts`, `poSizewiseGrouping.test.tsx`, `poSizewiseUX.test.ts`, `poGenerate.test.ts`, `poGenerateUX.test.ts`, `poModeConversion.test.ts`:
   - 81/81 tests passing green.
4. `npx tsc --noEmit`: 0 static type errors across entire codebase.

## 9. Verification Results
- Python test suite: `ALL SCHEMA AND BACKEND TESTS PASSED SUCCESSFULLY!` (exit code 0).
- Vitest suite: 6 test files passed, 81 tests passed (0 failed).
- TypeScript compiler: 0 errors (exit code 0).

## 10. Known Limitations
- International Incoterms (CIF, CIP, DDP) are currently captured as string values in the delivery terms field rather than structured multi-field tax/port contracts.

## 11. Future Work
- Add statutory Incoterms 2020 validation rules for international import purchase orders (e.g. customs port code and marine cargo insurance policy numbers).

## 12. Related ADRs
- `ADR-0042`: Commercial Terms JSONB Metadata Storage Strategy in Party Model.
- `ADR-0056`: Two-Way Purchase Order Commercial Drawer Architecture.

## 13. Related RFCs
- `RFC-2026-PURCH-014`: Vendor Master Commercial Alignment & Statutory Purchase Order Presentation.

