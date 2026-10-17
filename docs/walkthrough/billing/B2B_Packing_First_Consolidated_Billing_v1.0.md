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
  Classification: B2B Packing-First Consolidated Billing Walkthrough
-->

# B2B Packing-First Consolidated Billing & Approved UX Integration Walkthrough

## 1. Purpose
This walkthrough documents the controlled integration of a configurable B2B Packing-First → Consolidated Billing workflow into the existing SMRITI Retail OS Billing Studio (`SmritiBillingStudio.tsx`) and unified workspace (`BillingWorkspace.tsx`), while strictly freezing and preserving the approved UX screenshot visual reference.

## 2. Scope
- **Backend Configuration Engine**: Administrator-configurable company defaults in `BillingProfileService` (`packing_slip_qty_default`, `invoice_qty_default`, `allow_partial_packing`, `allow_partial_invoicing`, `allow_editing_prefilled_qty`, `b2b_packing_first_workflow`).
- **Fulfillment & Consolidated API**: Packing slip listing, multi-slip validation with customer incompatibility guards, 6-quantity prefill calculation, and atomic post-billing status finalization.
- **Frontend Modals**: `PackingSlipManagementModal` for managing/creating packing slips from B2B orders; `ConsolidatedBillingModal` for selecting/scanning multiple slips and reviewing 6-quantity reconciliation.
- **Billing Studio Scanner & Cart**: Barcode resolution for explicit `PS-` packing slip barcodes in B2B mode, customer compatibility verification, and seamless cart population while keeping the approved UX layout completely frozen.
- **Workflow Separation**: B2C Counter POS remains 100% direct and unchanged. Packing slips are restricted to B2B mode.

## 3. Files Created
1. [`docs/implementation/billing/B2B_Packing_First_Consolidated_Billing_Plan_v1.0.md`](file:///f:/SMRITRretailNX/docs/implementation/billing/B2B_Packing_First_Consolidated_Billing_Plan_v1.0.md) — Implementation Plan per IPGP.
2. [`src/components/billing/modals/PackingSlipManagementModal.tsx`](file:///f:/SMRITRretailNX/src/components/billing/modals/PackingSlipManagementModal.tsx) — Dedicated B2B Packing Slip Studio modal.
3. [`src/components/billing/modals/ConsolidatedBillingModal.tsx`](file:///f:/SMRITRretailNX/src/components/billing/modals/ConsolidatedBillingModal.tsx) — Dedicated B2B Consolidated Billing Compiler modal.
4. [`src/tests/b2bPackingConsolidatedBilling.test.ts`](file:///f:/SMRITRretailNX/src/tests/b2bPackingConsolidatedBilling.test.ts) — Comprehensive 16-test unit and integration test suite.
5. [`docs/walkthrough/billing/B2B_Packing_First_Consolidated_Billing_v1.0.md`](file:///f:/SMRITRretailNX/docs/walkthrough/billing/B2B_Packing_First_Consolidated_Billing_v1.0.md) — This walkthrough document.

## 4. Files Modified
1. [`backend/app/services/billing_profile_service.py`](file:///f:/SMRITRretailNX/backend/app/services/billing_profile_service.py) — Added B2B defaults and validation states for packing slip and invoice quantity prefill policies.
2. [`backend/app/api/v1/billing.py`](file:///f:/SMRITRretailNX/backend/app/api/v1/billing.py) — Added configuration fields to `BillingConfigurationUpdateRequest`.
3. [`backend/app/schemas/canonical_posting.py`](file:///f:/SMRITRretailNX/backend/app/schemas/canonical_posting.py) — Added `source_document_type` and `source_document_id` to `CanonicalPostingRequest`.
4. [`backend/app/schemas/fulfillment.py`](file:///f:/SMRITRretailNX/backend/app/schemas/fulfillment.py) — Added schemas for `ConsolidatedPreviewRequest`, `ConsolidatedPreviewResponse`, `ConsolidatedLineItemPreview`, `ConsolidatedLineAllocation`, `ConsolidatedFinalizeRequest`, `ConsolidatedFinalizeResponse`.
5. [`backend/app/services/fulfillment_engine.py`](file:///f:/SMRITRretailNX/backend/app/services/fulfillment_engine.py) — Implemented `list_packing_slips`, `preview_consolidated_billing`, and `finalize_consolidated_billing`.
6. [`backend/app/api/v1/fulfillment.py`](file:///f:/SMRITRretailNX/backend/app/api/v1/fulfillment.py) — Added GET `/pack`, POST `/consolidated-preview`, and POST `/consolidated-finalize` endpoints.
7. [`src/components/billing/modals/BillingProfileConfigModal.tsx`](file:///f:/SMRITRretailNX/src/components/billing/modals/BillingProfileConfigModal.tsx) — Added B2B Packing-First & Consolidated Invoicing governance UI controls.
8. [`src/components/billing/BillingWorkspace.tsx`](file:///f:/SMRITRretailNX/src/components/billing/BillingWorkspace.tsx) — Connected `Packing Slips` and `Consolidated Billing` subheader navigation buttons and modals.
9. [`src/components/billing/SmritiBillingStudio.tsx`](file:///f:/SMRITRretailNX/src/components/billing/SmritiBillingStudio.tsx) — Integrated `consolidatedBatch`, packing slip barcode scanning (`PS-`), and pill indicator while preserving frozen UX.
10. [`docs/implementation/README.md`](file:///f:/SMRITRretailNX/docs/implementation/README.md) — Appended implementation plan to master index table.

## 5. Architecture Decisions
- **Zero Schema Migrations**: Reused existing `PackingSlip` (`backend/app/models/fulfillment.py`) table by storing order/customer reference and tracking status (`PACKED` → `BILLED`) with `sales_invoice_id` upon posting.
- **Stock Integrity Preservation**: Packing slips represent physical verification and package preparation; inventory deduction is executed canonically upon invoice posting by `CanonicalSalesPostingWriter`, completely preventing double stock deduction.
- **Strict Visual Freeze**: The approved screenshot layout of `SmritiBillingStudio` remains 100% intact: 2-column upper layout, compact customer card, 13-column read-only cart grid, right-side summary, and bottom single-line scanner. Consolidated billing transfers compiled line items into this read-only cart with a clean pill tag.
- **Explicit Scanner Resolution**: The scanner recognizes `PS-` prefixes or verified slip codes in B2B mode. It never guesses that unknown barcodes are packing slips. Scanning a slip never auto-posts an invoice or initiates payment.

## 6. Design Rationale
In B2B Modern Trade and Wholesale distribution, orders are picked and packed at separate times across multiple warehouse boxes or cartons before a consolidated commercial GST invoice is created. By providing configurable prefill policies (`REMAINING_UNPACKED_QTY` and `PACKED_UNBILLED_QTY`) with strict overbilling prevention, the operator has full transparency across all 6 quantities (Ordered, Packed, Previously Invoiced, Remaining Eligible, Current Invoice, Dispatched) without requiring manual data re-entry.

## 7. Implementation Summary
- **Configuration Defaults**:
  - `packing_slip_qty_default`: `REMAINING_UNPACKED_QTY` (options: `ORDERED_QTY`, `REMAINING_UNPACKED_QTY`, `MANUAL_ZERO`)
  - `invoice_qty_default`: `PACKED_UNBILLED_QTY` (options: `PACKED_UNBILLED_QTY`, `ORDERED_QTY_IF_ELIGIBLE`, `MANUAL_ZERO`)
  - `allow_partial_packing`: `ENABLED` (options: `ENABLED`, `DISABLED`)
  - `allow_partial_invoicing`: `ENABLED` (options: `ENABLED`, `DISABLED`)
  - `allow_editing_prefilled_qty`: `AUTHORIZED_ONLY` (options: `AUTHORIZED_ONLY`, `ENABLED`, `DISABLED`)
  - `b2b_packing_first_workflow`: `ENABLED` (for B2B) / `DISABLED` (for B2C)
- **Modals**:
  - `PackingSlipManagementModal`: Allows listing, creating new slips with prefilled quantities, enforcing partial packing policy, and printing slips.
  - `ConsolidatedBillingModal`: Provides multi-slip selection, dedicated scanner input (`PS-...`), customer mismatch validation, 6-quantity inspection table, and cart transfer.
- **Studio Integration**:
  - `SmritiBillingStudio`: Receives consolidated batches, sets customer, loads items into the 13-column read-only cart, shows consolidated pill badge, links invoice to packing slips upon checkout, and calls `consolidated-finalize`.

## 8. Tests Executed
Terminal commands executed:
1. `npx vitest run src/tests/b2bPackingConsolidatedBilling.test.ts`
2. `npx vitest run src/tests/smritiBillingStudio.test.ts`

## 9. Verification Results
```
✓ src/tests/b2bPackingConsolidatedBilling.test.ts (16 tests) 10ms
  - TEST 1: ensures B2C Counter POS rejects packing slip scanning and requires B2B mode
  - TEST 2: calculates correct prefill quantities under REMAINING_UNPACKED_QTY, ORDERED_QTY, and MANUAL_ZERO
  - TEST 3: calculates correct invoice prefill quantities under PACKED_UNBILLED_QTY, ORDERED_QTY_IF_ELIGIBLE, and MANUAL_ZERO
  - TEST 4: permits or disallows partial packing based on company policy setting
  - TEST 5: permits or disallows partial invoicing based on company policy setting
  - TEST 6: governs prefill quantity editing authorization correctly
  - TEST 7: rejects combining packing slips belonging to different customer accounts
  - TEST 8: combines multiple eligible slips for the same customer without error
  - TEST 9: aggregates identical products appearing across multiple slips while preserving individual allocations
  - TEST 10: enforces that Invoice Qty cannot exceed Remaining Eligible Qty
  - TEST 11: correctly resolves PS- barcode vs standard EAN-13 product barcode
  - TEST 12: ensures unknown barcodes never guess that it is a Packing Slip
  - TEST 13: prevents adding the exact same packing slip twice to the consolidated batch
  - TEST 14: rejects scanning or selecting a packing slip that is already fully BILLED
  - TEST 15: authoritatively computes GST and totals for consolidated multi-slip cart items
  - TEST 16: verifies read-only cart table structure preserves all 13 required columns without row steppers

✓ src/tests/smritiBillingStudio.test.ts (26 tests) 64ms
  - All 26/26 core Billing Studio tests passed.
```

## 10. Known Limitations
- When operating in full offline/standalone mode without a running PostgreSQL database, packing slips and consolidated compile actions operate against local state and offline sync queue.

## 11. Future Work
- Integration with mobile Android / Zebra warehouse handheld scanners for live barcode pick-and-pack warehouse verification.

## 12. Related ADRs
- `ADR-0089: Canonical Billing Profile & Configuration Architecture`
- `ADR-0094: SMRITI Authoritative Fulfillment & Dispatch Lifecycle`

## 13. Related RFCs
- `RFC-0072: Consolidated Invoicing & Modern Trade Store Dispatch Manifests`
