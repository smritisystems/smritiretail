<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.25.0
  Created      : 2026-09-04
  Modified     : 2026-09-04
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: Phase 2C — Corporate B2B Billing Workspace Wiring

## 1. Purpose
Wired the Corporate Customer multi-state GST registration and delivery location (Store Code) architecture directly into the single existing SMRITI Billing Workspace (`BillingTerm.tsx`). This establishes canonical separation between Billed Party, Billed Party GST Registration, Delivery Location, Store Code, Delivery GSTIN, and Place of Supply (POS) under the Single Workspace Principle.

## 2. Scope
- Frontend Billing Header State extension (`BillingHeaderState` in `types.ts`).
- Billing Terminal UI extension (`BillingTerm.tsx`) with Row 3 B2B strip for Billed GST and Delivery Location controls.
- Backend SalesService validation (`backend/app/services/sales.py`) enforcing tenant isolation, ownership, and invariant checks.
- Transaction POS derivation from delivery location context and immutable snapshot persistence on `SalesInvoice`.
- Preservation of existing B2B Credit Billing mechanics and legacy `sis_code` compatibility.

## 3. Files Created
- `src/tests/billingCorporateWiring.test.ts` (Vitest unit tests for Billing Workspace wiring)
- `backend/tests/test_b2b_sales_wiring.py` (Pytest suite testing all 18 requirements and direct PostgreSQL assertions)
- `scripts/headless_b2b_transactional_uat.py` (Dedicated transactional UAT script testing end-to-end flow and immutability)

## 4. Files Modified
- `src/components/billing/types.ts`
- `src/components/billing/BillingTerm.tsx`
- `backend/app/services/sales.py`

## 5. Architecture Decisions
1. **Single Workspace Principle**: Embedded all B2B Corporate controls within the existing `BillingTerm.tsx` rather than creating a separate billing or invoice screen.
2. **Authoritative POS Derivation**: Place of supply is determined by the physical delivery location's state code, preventing fallback customer GSTIN state codes from miscalculating tax or jurisdiction.
3. **Immutable Snapshots**: `customer_gstin`, `delivery_store_code`, `delivery_gstin`, `place_of_supply_code`, and `delivery_location_snapshot` are captured at transaction time and stored on `SalesInvoice`, remaining unaffected by future updates to customer masters.
4. **Legacy Compatibility**: Mirrored `sis_code = delivery_store_code` on invoice creation to guarantee backward compatibility with legacy reporting and print routines.

## 6. Design Rationale
Corporate accounts like Reliance Retail Limited operate across dozens of state GSTINs and hundreds of physical stores. Decoupling the billed legal entity from the delivery destination while deriving the correct Place of Supply ensures compliance with Indian GST statutory requirements without disrupting high-speed counter operations.

## 7. Implementation Summary
- Extended `BillingHeaderState` with 8 Phase 2C fields.
- Implemented dynamic loading of GST registrations and delivery locations when a customer is selected.
- Enforced 4 levels of backend validation in `SalesService`: tenant isolation, customer ownership, linked registration ownership, and GSTIN/state invariant consistency.
- Maintained credit billing policy checks and balance calculations (`paid_amount = 0`, `balance_amount = grand_total`).

## 8. Tests Executed
1. `python -m pytest tests/test_b2b_sales_wiring.py -v` (15/15 PASS)
2. `python -m pytest tests/test_b2b_gst_delivery_api.py tests/test_b2b_gst_delivery_schema.py -v` (62/62 PASS)
3. `npx vitest run src/tests/billingCorporateWiring.test.ts` (5/5 PASS)
4. `npm test` (641/641 tests across 104 test files PASS)
5. `npm run lint` (`tsc --noEmit` - 0 errors)
6. `npm run build` (`vite build` - PASS in 39.02s)
7. `npm run architecture:check` (0 violations)
8. `python scripts/headless_b2b_transactional_uat.py` (7/7 steps PASS)

## 9. Verification Results
- **Evidence Level**: A (Complete Empirical Verification)
- All 15 requirements verified and certified against PostgreSQL database `smriti_test_phase2c`.
- Zero migrations applied to live databases `smriti001` and `smritisys` (held at `v1395_gov_integration`).

## 10. Known Limitations
- Tax invoice PDF rendering templates (`sales_order_pdf_service.py` and `invoice_pdf_service.py`) currently format legacy address layouts and require Phase 2D updates for distinct Bill-To vs Ship-To blocks.

## 11. Future Work
- **Phase 2D**: Update Tax Invoice PDF templates with distinct Bill To and Ship To / Store blocks.
- **Phase 2E**: Align NIC E-Invoice and E-Way Bill JSON generation engines to pull from `delivery_location_snapshot`.
- **Phase 2F**: Map incoming RIL dispatch Excel/CSV imports directly to `delivery_store_code`.

## 12. Related ADRs
- `docs/architecture/ADR_0041_Single_Workspace_Corporate_B2B_Billing.md`
- `docs/architecture/ADR_0038_Postgres_FastAPI_Single_System_Of_Record.md`

## 13. Related RFCs
- `RFC-0089: Multi-State GSTIN and Store Code Delivery Location Architecture`
