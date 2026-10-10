<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 4.15.0
  Created      : 2026-09-10
  Modified     : 2026-09-10
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Billing Statutory GST Auto-Derivation Convergence Walkthrough v4.15.0

## 1. Purpose
This walkthrough documents the architectural review, governance alignment, and user interface convergence for Statutory GST Treatment in SMRITI Retail OS. It replaces ambiguous manual concepts like editable "Tax Jurisdiction" with a deterministic, read-only transaction-derived GST classification engine that strictly decouples statutory tax law (IGST/CGST/SGST place of supply) from civil court dispute jurisdiction ("Subject to Mumbai Jurisdiction").

## 2. Scope
- UI relabeling and read-only badge rendering in `SmritiProPosBillingTerminal` (`src/components/billing/propos/ProPosBillingTerm.tsx`).
- Dynamic tax regime badge rendering in `TaxInvoiceItemGrid` (`src/components/sales/components/TaxInvoiceItemGrid.tsx`).
- Derivation alignment in `DistTaxInvoice` (`src/components/sales/DistTaxInvoice.tsx`) and dynamic state name resolution in `TaxInvoiceDoc` (`src/components/sales/components/TaxInvoiceDoc.tsx`).
- Unit and contract test coverage in `src/tests/distTaxInvoiceStitchFlow.test.ts`.

## 3. Files Created
None (modifications and test assertions applied to existing canonical modules).

## 4. Files Modified
- [`src/components/billing/propos/ProPosBillingTerm.tsx`](file:///f:/SMRITRretailNX/src/components/billing/propos/ProPosBillingTerm.tsx): Renamed `Tax Jurisdiction` to `GST Treatment: Auto-derived` with read-only state routing pill (`Maharashtra → Assam · IGST`).
- [`src/components/sales/components/TaxInvoiceItemGrid.tsx`](file:///f:/SMRITRretailNX/src/components/sales/components/TaxInvoiceItemGrid.tsx): Added `isInterstate` and `placeOfSupplyCode` props; removed hardcoded `Tax Regime: GST 18% Inter-State IGST` string in favor of dynamic regime rendering.
- [`src/components/sales/DistTaxInvoice.tsx`](file:///f:/SMRITRretailNX/src/components/sales/DistTaxInvoice.tsx): Updated `deriveCustomerInvoiceDefaults` to check destination against seller origin state (`27`) and passed dynamic interstate flags to item grid.
- [`src/components/sales/components/TaxInvoiceDoc.tsx`](file:///f:/SMRITRretailNX/src/components/sales/components/TaxInvoiceDoc.tsx): Imported `GST_STATE_MAP` to dynamically display full state name and code in Place of Supply (POS) card.
- [`src/tests/distTaxInvoiceStitchFlow.test.ts`](file:///f:/SMRITRretailNX/src/tests/distTaxInvoiceStitchFlow.test.ts): Updated tests to assert dynamic state name (`Assam (18)`) and dynamic Tax Regime badge rendering.

## 5. Architecture Decisions
1. **Master Records as Sole Source of Truth**:
   - Company & Warehouse Master provide legal seller state and dispatch depot origin.
   - Customer Master provides multi-state GSTINs (`CustomerGSTRegistration`), registered billing locations (`CustomerBillingLocation`), and store delivery locations (`CustomerDeliveryLocation`).
2. **Transaction-Derived Tax Treatment**:
   - Cashiers and billing operators never manually type or select a "Tax Jurisdiction".
   - Place of Supply is determined by delivery store state (or buyer primary GST state).
   - If `Supplier State == POS State`, transaction is Intra-State (CGST + SGST).
   - If `Supplier State != POS State`, transaction is Inter-State (IGST).
3. **Decoupling of Civil Dispute Forum from Tax Treatment**:
   - "Subject to Mumbai Jurisdiction" is a civil court forum clause belonging to company terms of sale / footer policies, completely distinct from GST place of supply.

## 6. Design Rationale
Prior UI displays used the term "Tax Jurisdiction", creating confusion between civil litigation venue and statutory tax treatment. Furthermore, static badges like `Tax Regime: GST 18% Inter-State IGST` failed to reflect intra-state sales or items with different GST rates (5%, 12%, 28%). Dynamic auto-derivation ensures exact statutory fidelity without operator intervention.

## 7. Implementation Summary
- `ProPosBillingTerm.tsx` now computes state routing dynamically via `GST_STATE_MAP` and renders a read-only badge.
- `TaxInvoiceItemGrid.tsx` computes the active line tax slab and regime dynamically.
- `TaxInvoiceDoc.tsx` resolves POS state names cleanly from `GST_STATE_MAP`.
- All changes are non-breaking and verified across 40 frontend unit tests and 30 backend pytest suites.

## 8. Tests Executed
1. `npx vitest run src/tests/gstEngine.test.ts src/tests/distTaxInvoiceStitchFlow.test.ts src/tests/billingTerm.test.ts src/tests/customerMasterAndActiveField.test.ts src/tests/customerLocationHydration.test.ts src/tests/customerStateSync.test.ts` (40 passed).
2. `npx tsc --noEmit` (0 errors).
3. `python -m pytest backend/tests/test_b2b_credit_sales_contract.py backend/tests/test_customer_po_billing_lifecycle.py backend/app/tests/test_gst_engine.py -q` (30 passed).

## 9. Verification Results
- All unit, contract, and markup tests passed with 100% green status.
- Zero TypeScript diagnostics.
- Diffs verified and compliant with Rule 1 of AGENTS.md.

## 10. Known Limitations
- Multi-tax mixed invoices (e.g. 5% item + 18% item in same bill) display line-level tax amounts accurately; the item grid top banner summarizes the primary active item rate.

## 11. Future Work
- Add company invoice policy editor in Settings to allow tenant customization of the dispute jurisdiction footer (e.g. "Subject to Nagpur Jurisdiction").

## 12. Related ADRs
- `ADR-042`: Canonical GST Calculation and Storage Policy.
- `ADR-058`: Strangler-Fig FastAPI Sole Backend Architecture.

## 13. Related RFCs
- `RFC-109`: Multi-State Corporate B2B Billing and Store Code Routing.
