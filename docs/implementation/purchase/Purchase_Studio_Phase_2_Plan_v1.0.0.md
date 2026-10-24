<!--
  Project      : SMRITI Retail OS
  Repository   : SMRITIRetailNX
  Organization : AITDL NETWORKS

  Founders

  * Pushpa Devi Jawahar Mallah
    * Founder & Chairperson
    * Email: founder@aitdl.com

  * Jawahar Ramkripal Mallah
    * Founder, Chief Executive Officer (CEO) & Chief Software Architect
    * Email: founder@aitdl.com

  * Websites: aitdl.com | erpnbook.com | smritibooks.com

  * Version    : 1.0.0
  * Created    : 2026-09-30
  * Modified   : 2026-09-30
  * Copyright  : © SMRITIBooks.com. All Rights Reserved.
  * License    : Proprietary Commercial Software
  * Classification: Internal
-->

# Implementation Plan: Purchase Studio Phase 2 — Interaction Polish, Governed Dialogs & Toolbar Architecture

## 1. Objective
Advance the Purchase Studio Sizewise Matrix (`PoSizewiseTab.tsx`) into its second architectural maturity phase by replacing primitive browser mechanisms with governed SMRITI platform controls. This entails: (1) implementing an accessible in-app confirmation modal system to replace native `window.confirm` dialogs, (2) integrating the 7-action toolbar budget with a clean overflow popover, (3) establishing robust mathematical guards across all financial and size distribution calculations, (4) enforcing a protected footwear scale re-mapping confirmation workflow, (5) wiring genuine backend PO replication in "Copy Previous PO", and (6) upgrading direct `window.print()` triggers to the authoritative `POPrintPreviewModal`.

## 2. Business Motivation
Operators in matrix-heavy procurement (apparel and footwear retail) execute high-volume purchase order transactions where unintentional destructive actions (such as clearing a matrix row, re-mapping a footwear scale, or overwriting working lines) lead to significant data loss, operator frustration, and costly order errors. Native browser dialogs (`window.confirm`) violate modern enterprise UX standards, disrupt keyboard flow, cannot be themed or automated cleanly, and offer no granular context. Simultaneously, un-governed toolbars create visual clutter, while raw browser print shortcuts bypass statutory GST layout rules. Phase 2 eliminates these pain points and aligns the matrix workspace with enterprise retail standards.

## 3. Scope
The Phase 2 package encompasses 6 cohesive enhancements to `PoSizewiseTab.tsx`:
1. **Governed Confirmation Dialogs:** Accessible in-app UI modal for destructive or mutating operations (row deletion on populated items, scale re-mapping, PO replication overwrite).
2. **Toolbar 7-Action Budget & Overflow Popover:** Strict 7-action budget on the matrix toolbar (`Search/Scan`, `Add Item`, `Import Excel`, `Size Scale`, `Price List`, `Active Row Delete`, and `More Actions...`). Secondary items (`Copy Previous PO`, `Export Matrix CSV`, `Clear All Lines`) reside within the overflow menu.
3. **Defensive Summary Guards:** Fail-safe arithmetic across `calculateSizewiseSummaryTotals` guarding against division-by-zero, `NaN`, `undefined` quantities, negative rates, or null lines.
4. **Footwear Scale Re-mapping Protection:** Protected confirmation workflow alerting operators when switching scale presets (e.g., UK Footwear 6-11 to EU Footwear 36-44) with non-empty item rows, detailing affected items and re-mapping rules.
5. **Real "Copy Previous PO" Ingestion:** Full backend order hydration from `/api/v1/purchase/orders/` retrieving items from the previous approved order and mapping them into horizontal sizewise lines.
6. **Statutory Print Modal Integration:** Replacing raw `window.print()` calls with the canonical `POPrintPreviewModal` configured for footwear and size-pivot layouts.

## 4. Current State
- `PoSizewiseTab.tsx` completed Phase 1 (clean empty state, universal F2 dispatcher wiring, read-only document identity, row action gating, consolidated save path).
- `handleCopyPreviousPO` currently issues a notification stub without populating line items.
- Size scale changes execute immediately without checking if existing line items lose their size allocations.
- Print actions call native `window.print()`, bypassing the SMRITI Print Engine template system (`POPrintPreviewModal`).
- The toolbar lacks an overflow budget mechanism.

## 5. Gap Analysis
| Capability | Current State (Phase 1) | Target State (Phase 2) |
|---|---|---|
| User Confirmation | Native alerts / unconfirmed mutations | Theme-governed, accessible in-app `ConfirmDialog` |
| Scale Switching | Instant re-map, potential silent data drop | Protected confirmation modal listing affected items |
| Previous PO Copy | Notification stub | Full backend fetch + items hydration into matrix lines |
| Print Workflow | Raw `window.print()` | Governed `POPrintPreviewModal` with A4 templates |
| Toolbar Layout | Free-form flex row | 7-action budget with `MoreActions` overflow menu |
| Summary Math | Standard calculations | Hardened calculations with `isFinite`, fallback zeroing |

## 6. Architecture Impact
- **Zero Backend/Database Impact:** Frontend client-side enhancements only; communicates with existing FastAPI `/api/v1/purchase/orders/` endpoints.
- **Component Reuse:** Leverages existing `POPrintPreviewModal.tsx` from `src/components/purchase/` rather than creating duplicate print templates.
- **Accessibility & UX Consistency:** Governed modals conform to SMRITI modal guidelines (esc key, focus trap, backdrop blur, enterprise styling).

## 7. Proposed Design
```text
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│ Header: Purchase Order | PO-37067 · 30/09/2026                 [+ New] [Open] [🖨️ Print Preview]│
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│ Type: PO | PO Number: [ PO-37067 ] | Date: 30/09/2026 | Supplier: Nagreeka | Delivery: ...   │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│ [ 1. Items ]  [ 2. Delivery & Tax ]  [ 3. Other Details ]                                   │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│ Toolbar (7-Action Budget):                                                                   │
│ [Scan / F2] [+ Add] [Import] [Scale: Footwear EU ▾] [Price: Default ▾] [🗑 Delete] [••• More]│
│                                                                        ┌────────────────────┐│
│                                                                        │ 📋 Copy Previous PO││
│                                                                        │ 📥 Export Grid CSV ││
│                                                                        │ 🧹 Clear All Rows  ││
│                                                                        └────────────────────┘│
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│ [Size-wise Grid with Hardened Financial Summary & Confirmation Dialog Protection]           │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
```

## 8. Files Created
- `docs/implementation/purchase/Purchase_Studio_Phase_2_Plan_v1.0.0.md`

## 9. Files Modified
- `src/components/purchase/PoSizewiseTab.tsx`
- `src/tests/poSizewiseUX.test.ts`
- `docs/implementation/README.md`

## 10. Dependencies
- `src/components/purchase/POPrintPreviewModal.tsx`
- `src/lib/apiFetchV1.ts`
- `lucide-react` / `@material-symbols`

## 11. Risks
- Re-mapping size quantities across scales with differing size counts could confuse operators if not explicitly previewed; mitigated by clear modal confirmation.
- Copying from legacy POs whose items lack size breakdown; mitigated by fallback distribution to default middle sizes or generic line items.

## 12. Rollback Strategy
- All Phase 2 edits are contained in `PoSizewiseTab.tsx` and its test suite. Can be rolled back cleanly via git checkout without affecting database schemas or APIs.

## 13. Verification Plan
- Automated unit test suite execution (`src/tests/poSizewiseUX.test.ts`) covering calculation guards and modal trigger invariants.
- Full TypeScript compiler verification (`npx tsc --noEmit`).
- Git whitespace check (`git diff --check HEAD`).

## 14. Test Plan
- Unit tests for arithmetic edge cases (`NaN`, division by zero, empty lines).
- Unit tests for scale change confirmation decision tree.
- Unit tests for previous PO item rehydration logic.

## 15. Documentation Impact
- Phase 2 Walkthrough (`Purchase_Studio_Phase_2_v1.0.0.md`).
- Master Walkthrough Index update (`docs/walkthrough/README.md`).
- Master Implementation Index update (`docs/implementation/README.md`).

## 16. Deployment Plan
- Frontend client update; deployed via standard Vite production bundle.

## 17. Status
- Completed

## 18. Related ADRs
- `ADR-F2-001`: Universal F2 Lookup Architecture & Dispatcher Protocol.
- `ADR-DOC-002`: Authoritative Document Series & Sequence Allocation.
- `ADR-MODAL-003`: SMRITI Accessible Governed Modal Pattern.

## 19. Related Walkthroughs
- `docs/walkthrough/purchase/Purchase_Studio_Phase_1_v1.0.0.md`
- `docs/walkthrough/purchase/Purchase_Studio_Phase_2_v1.0.0.md`
