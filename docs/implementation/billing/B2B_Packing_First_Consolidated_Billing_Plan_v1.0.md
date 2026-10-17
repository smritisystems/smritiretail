<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.92.0
  Created      : 2026-10-17
  Modified     : 2026-10-17
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: B2B Packing-First Consolidated Billing Implementation Plan
-->

# B2B Packing-First Consolidated Billing & Approved UX Integration Plan

## 1. Objective
Integrate a configurable B2B Packing-First → Consolidated Billing workflow into the existing SMRITI Retail OS Billing Studio (`SmritiBillingStudio.tsx`) and unified workspace (`BillingWorkspace.tsx`), while strictly freezing and preserving the approved UX screenshot visual reference.

## 2. Business Motivation
Wholesale and Modern Trade B2B clients frequently pick and pack goods across multiple physical batches, cartons, or warehouses prior to legal tax invoice issuance. A B2B distributor must be able to create multiple Packing Slips against customer sales orders, scan or select multiple eligible packing slips, receive configurable prefilled packing and invoice quantities, review line items and quantities, and post a single consolidated tax invoice without re-entering items or deducting inventory twice.

## 3. Scope
- **Company Configuration Engine**: Extend `BillingProfileService` with administrator-configurable B2B defaults: `packing_slip_qty_default`, `invoice_qty_default`, `allow_partial_packing`, `allow_partial_invoicing`, `allow_editing_prefilled_qty`, and `b2b_packing_first_workflow`.
- **B2C & B2B Separation**: B2C Counter POS remains 100% unchanged. Packing slips are accessible and resolvable only in B2B / Tax Invoice mode.
- **Packing Slip Scanning**: Barcode scanner detects explicit `PS-` prefixes or verified packing slip identifiers, validates customer and billing eligibility, prevents duplicate scans, never guesses that unknown product barcodes are packing slips, and never auto-submits invoices upon scanning.
- **Consolidated Billing Workflow**: Multi-slip selection, customer compatibility checks, 6-quantity tracking (Ordered, Packed, Previously Invoiced, Remaining Eligible, Current Invoice, Dispatched), quantity validation guards, and seamless loading into the approved Billing Studio cart.
- **Approved UX Preservation**: Billing Studio's 2-column layout, compact customer card, 13-column read-only cart, right-side Bill Summary & Payment panels, and single-line bottom scanner bar remain identical to the approved visual specification.

## 4. Current State
- `SmritiBillingStudio.tsx` supports `RETAIL_POS`, `CREDIT_BILLING`, and `B2B_DISTRIBUTOR` modes with frozen visual layout.
- `BillingWorkspace.tsx` navigation contains `Packing Slips` and `Consolidated Billing` subheader buttons that currently show placeholder toast notifications.
- `backend/app/models/fulfillment.py` defines `PackingSlip` and `PackingSlipItem`.
- `backend/app/services/billing_profile_service.py` governs company profile policies and feature overrides.
- `src/components/billing/modals/BillingProfileConfigModal.tsx` provides administrator configuration UI.

## 5. Gap Analysis
1. Missing administrator-configurable B2B defaults in `BillingProfileService` and `BillingProfileConfigModal` for packing slip and invoice quantity prefill policies.
2. Missing dedicated frontend Packing Slip Studio modal and Consolidated Billing modal in `BillingWorkspace`.
3. Barcode scanner in `SmritiBillingStudio` only resolves product catalog items; it does not yet detect packing slip codes (`PS-...`) for B2B billing or validate customer compatibility.
4. Missing automated test coverage specifically for multi-slip consolidation, quantity prefill policies, customer mismatch rejection, and overbilling prevention.

## 6. Architecture Impact
- Reuses existing `PackingSlip` model (`backend/app/models/fulfillment.py`) without requiring any database schema migrations.
- Stores order/customer reference and updates `status` (`PACKED` → `BILLED`) and `sales_invoice_id` upon posting.
- Integrates with `CanonicalSalesPostingWriter` using `source_document_type = "PACKING_SLIP_CONSOLIDATED"`.
- Zero change to B2C direct counter billing.

## 7. Proposed Design
1. **B2B Configuration Defaults**:
   - `packing_slip_qty_default`: `REMAINING_UNPACKED_QTY` (options: `ORDERED_QTY`, `REMAINING_UNPACKED_QTY`, `MANUAL_ZERO`)
   - `invoice_qty_default`: `PACKED_UNBILLED_QTY` (options: `PACKED_UNBILLED_QTY`, `ORDERED_QTY_IF_ELIGIBLE`, `MANUAL_ZERO`)
   - `allow_partial_packing`: `ENABLED` (options: `ENABLED`, `DISABLED`)
   - `allow_partial_invoicing`: `ENABLED` (options: `ENABLED`, `DISABLED`)
   - `allow_editing_prefilled_qty`: `AUTHORIZED_ONLY` (options: `AUTHORIZED_ONLY`, `ENABLED`, `DISABLED`)
   - `b2b_packing_first_workflow`: `ENABLED` (for B2B) / `DISABLED` (for B2C)
2. **Packing Slip Management Modal (`PackingSlipManagementModal.tsx`)**:
   - Lists slips, allows packing new slip from orders with prefilled quantities, enforces partial packing policy, saves slip, and prints slip.
3. **Consolidated Billing Modal (`ConsolidatedBillingModal.tsx`)**:
   - Multi-slip picker, dedicated scanner input (`PS-...`), customer mismatch validation, line-item preview with 6 separate quantities, and transfer to Billing Studio cart.
4. **Billing Studio Scanner Integration**:
   - In B2B mode, scanner routes `PS-` barcodes to consolidated slip intake, verifies customer compatibility, and adds items without auto-posting.

## 8. Files Created
- `docs/implementation/billing/B2B_Packing_First_Consolidated_Billing_Plan_v1.0.md`
- `src/components/billing/modals/PackingSlipManagementModal.tsx`
- `src/components/billing/modals/ConsolidatedBillingModal.tsx`
- `src/tests/b2bPackingConsolidatedBilling.test.ts`
- `docs/walkthrough/billing/B2B_Packing_First_Consolidated_Billing_v1.0.md`

## 9. Files Modified
- `backend/app/services/billing_profile_service.py`
- `backend/app/api/v1/billing.py`
- `backend/app/schemas/canonical_posting.py`
- `backend/app/services/fulfillment_engine.py`
- `backend/app/api/v1/fulfillment.py`
- `src/components/billing/modals/BillingProfileConfigModal.tsx`
- `src/components/billing/BillingWorkspace.tsx`
- `src/components/billing/SmritiBillingStudio.tsx`
- `docs/implementation/README.md`
- `docs/walkthrough/README.md`
- `CHANGELOG.md`
- `RELEASE_NOTES.md`

## 10. Dependencies
- React 18, Lucide React, Vitest.
- FastAPI, SQLAlchemy, Pydantic v2.

## 11. Risks
- *Risk:* Overlapping or competing layout changes in Billing Studio.
  *Mitigation:* Keep Billing Studio layout frozen exactly to the approved screenshot; use modal dialogs for multi-slip selection and management, transferring items into the existing read-only cart.
- *Risk:* Double stock deduction between packing and invoicing.
  *Mitigation:* Packing records physical packing status; canonical stock deduction and ledger posting occur strictly upon invoice checkout.

## 12. Rollback Strategy
All changes are modular, component-based, and config-governed. Reverting to the prior commit restores previous subheader toast buttons with zero database schema alterations.

## 13. Verification Plan
- Unit tests for all prefill policies, customer incompatibility rejection, scan resolution, and quantity limits.
- Full Vitest suite execution.
- TypeScript compiler verification (`tsc --noEmit`).
- Production build verification (`npm run build`).

## 14. Test Plan
- `src/tests/b2bPackingConsolidatedBilling.test.ts`:
  1. Packing Slip prefill policies (`ORDERED_QTY`, `REMAINING_UNPACKED_QTY`, `MANUAL_ZERO`).
  2. Invoice quantity prefill policies (`PACKED_UNBILLED_QTY`, `ORDERED_QTY_IF_ELIGIBLE`, `MANUAL_ZERO`).
  3. Disallow partial packing when policy is `DISABLED`.
  4. Disallow partial invoicing when policy is `DISABLED`.
  5. Permission check for prefilled quantity editing (`AUTHORIZED_ONLY`).
  6. Rejection of slips belonging to different customers.
  7. Rejection of unknown product barcodes (never guessed as packing slip).
  8. Rejection of packing slip scans in B2C mode.
  9. Overbilling prevention (`Invoice Qty > Remaining Eligible Qty`).
  10. Multi-slip line aggregation with individual source slip tracking.

## 15. Documentation Impact
- Update `docs/implementation/README.md`.
- Create `docs/walkthrough/billing/B2B_Packing_First_Consolidated_Billing_v1.0.md`.
- Update `docs/walkthrough/README.md`.
- Update `CHANGELOG.md` and `RELEASE_NOTES.md`.

## 16. Deployment Plan
- Push code to remote branch `smritiNX`.
- Headless automated testing in CI/CD pipeline.

## 17. Status
Approved for Implementation.

## 18. Related ADRs
- `ADR-0089: Canonical Billing Profile & Configuration Architecture`
- `ADR-0094: SMRITI Authoritative Fulfillment & Dispatch Lifecycle`

## 19. Related Walkthroughs
- `docs/walkthrough/billing/Billing_Studio_Approved_UX_Freeze_Integration_v1.0.md`
- `docs/walkthrough/billing/B2B_Packing_First_Consolidated_Billing_v1.0.md`
