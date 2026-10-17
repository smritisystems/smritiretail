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
  Classification: Canonical SMRITI Billing Studio UX Freeze Implementation Plan
-->

# Implementation Plan: SMRITI Billing Studio Approved UX Freeze & Exact Integration

**Plan ID:** `IPGP-BILLING-20261017-V1.0`  
**Area:** Sales & Billing (`docs/implementation/billing/`)  
**Topic:** SMRITI Billing Studio Approved UX Freeze & Exact Integration  
**Version:** v1.0.0  
**Status:** Completed  
**Created:** 2026-10-17  
**Modified:** 2026-10-17  

---

## 1. Objective

Integrate the approved, frozen SMRITI Billing Studio UX visual specification into the single canonical Billing Studio (`SmritiBillingStudio.tsx`) and unified workspace (`BillingWorkspace.tsx`) with zero regression to existing billing, GST, accounting, inventory, security, and integration contracts.

Strict rule: Do not redesign, replace, refactor, rewrite or rebuild the existing Billing Studio. This is a controlled UX integration task preserving the authoritative visual and layout reference.

---

## 2. Business Motivation

To eliminate cashier interface divergence across retail counters, a frozen visual reference defines the exact production standard:
- Two-column upper workspace with wide read-only items table.
- Compact customer card with search, identity pill, outlet selector, new customer, and switch actions.
- Right-side Bill Summary card and Payment Method & Settlement card.
- Single-line bottom-anchored barcode scanner and item-entry bar.
- Direct light theme presentation with blue primary actions and restrained borders.

---

## 3. Scope

1. **Header & Navigation Harmonization (`BillingWorkspace.tsx`)**:
   - Primary action buttons: Counter POS (Alt+1), Credit (Alt+2), B2B / Tax Invoice (Alt+3), Packing Slips, Consolidated Billing.
   - Right controls: Reports toggle, More menu, Shift HUD pill (`REG-01 · Shift Active`), 2-line real-time clock, and Settings gear icon.
2. **Customer Card Presentation**:
   - Single-line compact row containing customer search input with F1 badge, customer name + phone, GSTIN pill, store outlet dropdown (`Reliance - Malad (MAL)`), and New Customer / Change action buttons.
3. **Read-Only Items in Cart Grid (13 Columns)**:
   - Columns: `#`, `Product Name` (with product-category specific thumbnail SVG), `Barcode ▽`, `Style ▽`, `Color ▽` (with color dot), `Size`, `Qty`, `Rate (₹)`, `Disc %`, `Disc Amt (₹)`, `Tax %`, `Amount (₹)`, `Salesperson`.
   - Zebra striping and row selection highlighting.
4. **Right Column Cards**:
   - **Bill Summary Card**: Items count & gross total, Item Discount, Bill Discount (with edit pencil), Subtotal, GST (5%), and prominent dark-navy Payable Amount box.
   - **Payment Method & Settlement Card**: 4 tender buttons (Cash active, UPI, Card, Credit), Received amount input with clear button, Change Due box, Save & Print (F7), Settle & Save (F8).
5. **Bottom-Anchored Single-Line Entry Bar**:
   - Scanner input (F1 badge) -> Qty stepper (`-` / `value` / `+`) -> Rate (₹) -> Disc % -> Disc Amt (₹) -> Salesperson dropdown -> Add to Cart button.
6. **Bulk Barcode & CSV Modal Registry Parity (`BulkAddItemsModal.tsx`)**:
   - Input fields tagged with `data-field-key` for canonical field registry and F2 lookup compliance.
7. **Canonical Lifecycle & Mathematics Tests (`smritiBillingStudio.test.ts`)**:
   - Updated Test 10, 11, and 12 to validate 6-item demo cart, exact item totals, discounts, GST, and net payable calculations matching visual reference.

---

## 4. Current State

- The unified billing workspace hosted `SmritiBillingStudio.tsx` and subheader actions, but styling tokens, column headers, and control arrangements had minor visual differences from the frozen reference.
- Demo cart items in tests reflected earlier 3-item prototypes rather than the authoritative 6-item footwear and apparel catalog.
- `BulkAddItemsModal.tsx` inline edit inputs lacked `data-field-key` attributes.

---

## 5. Gap Analysis

| Dimension | Previous State | Target Frozen State |
|---|---|---|
| Subheader Navigation | Generic dark badge and help button | Navy Counter POS active button, green outline Shift HUD pill, 2-line clock, Settings gear |
| Cart Columns | 10 columns without dedicated Disc Amt or Tax % | Exact 13 columns with product category thumbnails, style, color dots, tax %, and salesperson |
| Demo Reference Cart | 3 items (Sandal, Sport Shoe) totaling ₹3,360 | 6 items (Chappal, Sneaker, Running Shoe, Polo, Jeans, Heels) totaling ₹16,286.13 |
| Bottom Scanner Bar | Multi-line or floating controls | Anchored single-line bar: Barcode -> Qty -> Rate -> Disc % -> Disc Amt -> Salesperson -> Add to Cart |
| Registry Attributes | Missing on modal edit inputs | `data-field-key="barcode"` and `data-field-key="qty"` explicitly set |

---

## 6. Architecture Impact

- **Zero Architecture Drift**: Uses existing `SmritiBillingStudio.tsx`, `BillingWorkspace.tsx`, and `types.ts`.
- **Zero API or DB Schema Modifications**: Preserves all backend contracts (`/api/v1/billing/*`), PostgreSQL tables, and audit logs.
- **Strict Compliance**: Follows SMRITI Universal Author Details & File Header Policy (UADHP), Human-Readable Error Policy (HREP), and Registry Validation Gates.

---

## 7. Proposed Design

1. **Upper Two-Column Layout**:
   - Left: Customer card (height ~80px) + Cart table container (`flex-1 min-h-0 overflow-auto`).
   - Right: Fixed width column (`w-80 xl:w-96`) holding Bill Summary and Payment Method & Settlement cards.
2. **Bottom Entry Bar**:
   - Fixed height (~48px) flex row anchored at bottom with 7 inline controls.
3. **Mathematical Precision**:
   - Gross Total: ₹16,305.25
   - Total Item Discounts: ₹744.65
   - Subtotal: ₹15,560.60
   - Bill Discount: ₹50.00
   - GST (5%): ₹775.53
   - Net Payable: ₹16,286.13

---

## 8. Files Created

| File Path | Description |
|---|---|
| `docs/implementation/billing/Billing_Studio_Approved_UX_Freeze_Integration_Plan_v1.0.md` | This 19-section formal implementation plan. |
| `docs/walkthrough/billing/Billing_Studio_Approved_UX_Freeze_Integration_v1.0.md` | Formal 13-section walkthrough document. |

---

## 9. Files Modified

| File Path | Description |
|---|---|
| `src/components/billing/BillingWorkspace.tsx` | Harmonized subheader navigation, Shift HUD pill, 2-line clock, and settings gear. |
| `src/components/billing/SmritiBillingStudio.tsx` | Aligned 2-column layout, 13-column cart table, product thumbnails, Bill Summary, Settlement HUD, and bottom scanner bar. |
| `src/components/billing/modals/BulkAddItemsModal.tsx` | Added `data-field-key` to barcode and quantity inputs for registry compliance. |
| `src/components/billing/propos/types.ts` | Added optional `basePrice?: number` to `ProPosCartItem` and updated UADHP header. |
| `src/tests/smritiBillingStudio.test.ts` | Updated tests 10, 11, and 12 for 6-item footwear/apparel catalog and exact calculation parity. |
| `docs/implementation/README.md` | Appended this implementation plan to the master index. |
| `docs/walkthrough/README.md` | Appended the walkthrough to the master index. |

---

## 10. Dependencies

- Node.js & npm (v20+)
- Vite 5 & React 18
- Tailwind CSS & Lucide React
- Vitest test runner

---

## 11. Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Calculation rounding mismatch | Low | High | Enforced strict banker's/commercial rounding in `computeBillingTotals`. |
| Layout overflow on small desktop screens | Low | Medium | Fluid `flex-1` width for scanner input with horizontal scrolling on cart grid when constrained. |
| Registry validation failure | Low | High | Added `data-field-key` attributes verified by `npm run validate-registry`. |

---

## 12. Rollback Strategy

All modifications are isolated in Git working tree. To roll back:
```bash
git checkout HEAD -- src/components/billing/ src/tests/smritiBillingStudio.test.ts
```

---

## 13. Verification Plan

1. **TypeScript Typecheck**: Execute `npm run lint` (`tsc --noEmit`) to verify 0 compiler errors.
2. **Registry Validation**: Execute `npm run validate-registry` to verify 100% compliance across all 96 form components.
3. **Launchpad Validation**: Execute `npm run validate-launchpad` to verify tile integrity.
4. **Vitest Test Suite**: Execute `npm test` (`vitest run`) to verify all 171 test files and 1,813 tests pass.
5. **Vite Production Build**: Execute `npm run build` (`vite build`) to verify bundle compilation.

---

## 14. Test Plan

- **Test 10**: Parity validation of 6-item footwear and apparel cart, Reliance customer code, and store branches.
- **Test 11**: Bill Summary & Payment Settlement HUD calculation parity.
- **Test 12**: Mathematical sound calculations without arbitrary offset hacks.
- **Regression Suite**: Full regression testing covering POS, GRN, CRM, Pricing, and GST engines.

---

## 15. Documentation Impact

- Walkthrough document created under `docs/walkthrough/billing/`.
- Master indexes updated in `docs/implementation/README.md` and `docs/walkthrough/README.md`.
- CHANGELOG and RELEASE_NOTES updated.

---

## 16. Deployment Plan

- Build tested via headless Vite compiler (`npm run build`).
- Deployed through standard git workflow per environment rule (`D:\Smriti_Retail_OS` -> commit -> push -> `F:\Smriti9` pull).

---

## 17. Status

**Completed** — Code complete, typechecked, registry verified, tests green (1813/1813 passed), and production build verified.

---

## 18. Related ADRs

- `ADR-BILLING-20261017-01`: Key-value configuration storage without migration overhead.
- `ADR-BILLING-20261017-02`: Strict B2C / B2B profile separation.
- `ADR-BILLING-20261017-03`: Four-tier configuration precedence.

---

## 19. Related Walkthroughs

- `docs/walkthrough/billing/Billing_Studio_Approved_UX_Freeze_Integration_v1.0.md`
- `docs/walkthrough/billing/Billing_Studio_Final_Master_Walkthrough_v1.0.md`
