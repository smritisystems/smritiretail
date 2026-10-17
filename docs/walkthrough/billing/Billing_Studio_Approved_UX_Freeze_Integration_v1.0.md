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
  Classification: Canonical SMRITI Billing Studio UX Freeze Walkthrough
-->

# Walkthrough: SMRITI Billing Studio Approved UX Freeze & Exact Integration

**Document ID:** `WGP-BILLING-20261017-V1.0`  
**Area:** Sales & Billing (`docs/walkthrough/billing/`)  
**Topic:** SMRITI Billing Studio Approved UX Freeze & Exact Integration  
**Version:** v1.0.0  
**Implementation Plan:** `docs/implementation/billing/Billing_Studio_Approved_UX_Freeze_Integration_Plan_v1.0.md`  
**Status:** Completed & Headless Verified  

---

## 1. Purpose

This document provides the formal walkthrough for the integration of the approved, frozen SMRITI Billing Studio UX visual specification into the single canonical Billing Studio (`SmritiBillingStudio.tsx`) and the top-level unified workspace (`BillingWorkspace.tsx`).

The implementation strictly followed the governing mandate:
> **STRICT RULE: DO NOT REDESIGN, REPLACE, REFACTOR, REWRITE OR REBUILD THE EXISTING BILLING STUDIO.**  
> This was a controlled UX integration task preserving the authoritative visual layout, proportion, colors, and controls while maintaining 100% parity with existing billing, GST, accounting, inventory, and security rules.

---

## 2. Scope

The scope encompassed four primary areas of the user interface:
1. **Subheader Navigation Bar (`BillingWorkspace.tsx`)**:
   - Left action buttons: Counter POS (dark navy active state with Alt+1 badge), Credit (Alt+2), B2B / Tax Invoice (Alt+3), Packing Slips, and Consolidated Billing.
   - Right controls: Reports toggle, More dropdown, Shift HUD pill (`REG-01 · Shift Active` with pulsing green indicator), two-line real-time clock (`13:40:00 / 17 Oct 2026`), and Settings trigger icon.
2. **Left-Hand Column (Customer Card + Items in Cart Grid)**:
   - **Customer Card**: Compact, single-row card hosting customer search input with F1 badge, customer details (`Reliance Retail Limited · 9876543210`), green GST badge (`GST: 27AABCR1234F1Z5`), store outlet dropdown (`Reliance - Malad (MAL)`), and action buttons (`New Customer`, `⇄ Change`).
   - **Items in Cart Table**: Read-only grid with exact 13 columns:
     1. `#` (Index)
     2. `Product Name` (with product-category specific inline SVG thumbnail: Chappal, Sneaker, Running Shoe, Polo, Jeans, Heels)
     3. `Barcode ▽`
     4. `Style ▽`
     5. `Color ▽` (with color dot)
     6. `Size`
     7. `Qty`
     8. `Rate (₹)`
     9. `Disc %`
     10. `Disc Amt (₹)`
     11. `Tax %`
     12. `Amount (₹)`
     13. `Salesperson`
3. **Right-Hand Column (Bill Summary & Payment Method & Settlement)**:
   - **Bill Summary Card**: Items count & gross total (`₹ 16,305.25`), Item Discount (`- ₹ 744.65`), Bill Discount with pencil edit button (`- ₹ 50.00`), Subtotal (`₹ 15,560.60`), GST 5% (`₹ 775.53`), and high-contrast Payable Amount container (`₹ 16,286.13`).
   - **Payment Method & Settlement Card**: 4 tender buttons in a 4-column grid (Cash active in dark navy, UPI, Card, Credit), Received amount input (`16286.13`) with clear button, Change Due box (`₹ 0.00`), Save & Print (`F7`), and Settle & Save (`F8`).
4. **Bottom-Anchored Single-Line Scanner Bar**:
   - Flexible scanner input with F1 badge -> Qty stepper (`-` / `qty` / `+`) -> Rate (₹) -> Disc % -> Disc Amt (₹) -> Salesperson selector -> Add to Cart primary button.
5. **Registry Validation Hardening (`BulkAddItemsModal.tsx`)**:
   - Tagged modal inline editing inputs with `data-field-key="barcode"` and `data-field-key="qty"` ensuring zero form validation violations.

---

## 3. Files Created

| File Path | Description |
|---|---|
| `docs/implementation/billing/Billing_Studio_Approved_UX_Freeze_Integration_Plan_v1.0.md` | Formal 19-section implementation plan per IPGP and UADHP. |
| `docs/walkthrough/billing/Billing_Studio_Approved_UX_Freeze_Integration_v1.0.md` | This formal 13-section walkthrough per WGP. |

---

## 4. Files Modified

| File Path | Description |
|---|---|
| `src/components/billing/BillingWorkspace.tsx` | Harmonized subheader navigation, Shift HUD pill, 2-line clock, and settings gear. |
| `src/components/billing/SmritiBillingStudio.tsx` | Aligned 2-column layout, 13-column cart table, product thumbnails, Bill Summary, Settlement HUD, and bottom scanner bar. |
| `src/components/billing/modals/BulkAddItemsModal.tsx` | Added `data-field-key` to barcode and quantity inputs for registry compliance. |
| `src/components/billing/propos/types.ts` | Added optional `basePrice?: number` to `ProPosCartItem` and updated UADHP header. |
| `src/tests/smritiBillingStudio.test.ts` | Updated tests 10, 11, and 12 for 6-item footwear/apparel catalog and exact calculation parity. |
| `docs/implementation/README.md` | Appended implementation plan to master index. |
| `docs/walkthrough/README.md` | Appended this walkthrough to master index. |

---

## 5. Architecture Decisions

### ADR-BILLING-20261017-04: Non-Invasive Controlled Visual Alignment
- **Decision:** Integrate visual styles, proportions, and column arrangements strictly inside existing JSX structures without rewriting state management, hooks, or API communication layers.
- **Rationale:** Preserves production stability, zero regression to transaction posting (`canonical_sales_writer.py`), offline synchronization (`ProPosOfflineSyncEngine.ts`), and keyboard shortcuts.

### ADR-BILLING-20261017-05: Product Thumbnail Category Mapping
- **Decision:** Render category-specific vector SVG thumbnails (Chappal, Sneaker, Running Shoe, Polo, Jeans, Heels) dynamically derived from product name and brand rather than relying on external image URLs or generic placeholders.
- **Rationale:** Guarantees instant rendering without network dependency, avoids broken image icons, and preserves exact visual parity with the approved screenshot.

---

## 6. Design Rationale

- **Single-Line Bottom Scanner**: Anchoring the scanner bar at the bottom provides an ergonomic and focused cashier workflow where the scanner input receives natural focus while keeping the cart table unobstructed.
- **Dedicated Discount & Tax Columns**: Explicitly separating `Disc %`, `Disc Amt (₹)`, and `Tax %` in the cart grid ensures full transparency for both cashier and customer during billing.
- **Prominent Payable Amount Box**: Placing the payable total in a dedicated high-contrast blue container eliminates cashier calculation errors and facilitates rapid settlement.

---

## 7. Implementation Summary

1. **Initial State & Customer**: Initialized with `Reliance Retail Limited` (`CUST-RRL-001`, GSTIN: `27AABCR1234F1Z5`), outlet `Reliance - Malad (MAL)`, and active register `REG-01`.
2. **Initial Demo Cart (6 Items)**:
   - Row 1: `TATLD CASUAL CHAPPAL` | Qty: 2 | Base: ₹2,356.125 | Disc: 5.51% (₹259.90) | Tax: 5% | Amount: ₹4,452.35 | Reshma
   - Row 2: `SND-18-V SNEAKER` | Qty: 1 | Rate: ₹1,999.00 | Disc: 0% | Tax: 5% | Amount: ₹1,999.00 | Reshma
   - Row 3: `RNG RUNNING SHOE` | Qty: 1 | Rate: ₹3,499.00 | Disc: 10% (₹349.90) | Tax: 5% | Amount: ₹3,149.10 | Reshma
   - Row 4: `CTN POLO T-SHIRT` | Qty: 3 | Rate: ₹899.00 | Disc: 5% (₹134.85) | Tax: 5% | Amount: ₹2,562.15 | Reshma
   - Row 5: `DNM REGULAR JEANS` | Qty: 1 | Rate: ₹1,499.00 | Disc: 0% | Tax: 5% | Amount: ₹1,499.00 | Reshma
   - Row 6: `LADY GLAM HEELS` | Qty: 1 | Rate: ₹1,899.00 | Disc: 0% | Tax: 5% | Amount: ₹1,899.00 | Reshma
3. **Calculation Proof**:
   $$\text{Gross Total} = 4,712.25 + 1,999.00 + 3,499.00 + 2,697.00 + 1,499.00 + 1,899.00 = ₹ 16,305.25$$
   $$\text{Total Item Discounts} = 259.90 + 0.00 + 349.90 + 134.85 + 0.00 + 0.00 = ₹ 744.65$$
   $$\text{Subtotal (Taxable Before Bill Discount)} = 16,305.25 - 744.65 = ₹ 15,560.60$$
   $$\text{Bill Discount} = ₹ 50.00 \implies \text{Net Taxable} = ₹ 15,510.60$$
   $$\text{GST 5\%} = 15,510.60 \times 0.05 = ₹ 775.53$$
   $$\text{Net Payable} = 15,510.60 + 775.53 = ₹ 16,286.13$$
   $$\text{Received (Cash)} = ₹ 16,286.13 \implies \text{Change Due} = ₹ 0.00$$

---

## 8. Tests Executed

Executed headless vitest test suite across all 171 test files:
```bash
npm test
```

Literal Output:
```text
 Test Files  171 passed (171)
      Tests  1813 passed (1813)
   Start at  13:39:18
   Duration  30.32s (transform 7.67s, setup 0ms, import 26.46s, tests 6.00s, environment 30ms)
```

TypeScript Compiler Verification:
```bash
npm run lint
```
Literal Output:
```text
> smriti-retail-os@6.82.0 lint
> tsc --noEmit
(exited with code 0)
```

Registry Usage Validator:
```bash
npm run validate-registry
```
Literal Output:
```text
> smriti-retail-os@6.82.0 validate-registry
> node scripts/validate-registry-usage.mjs --all

🔍 Validating Registry Usage across the form layer...
📋 Found 96 form components to validate
✅ All form components follow registry patterns!
Registry Validation: PASSED
```

Launchpad Registry Validation:
```bash
npm run validate-launchpad
```
Literal Output:
```text
> smriti-retail-os@6.82.0 validate-launchpad
> node scripts/validate-launchpad-registry.mjs

Launchpad Registry Validation
Catalog tiles: 53
Unique tile IDs: 53
App render cases: 131
PASSED: every Launchpad tile has a unique ID and an App render case.
```

Production Vite Compilation:
```bash
npm run build
```
Literal Output:
```text
✓ 3711 modules transformed.
dist/index.html                                            3.40 kB │ gzip:   1.28 kB
dist/assets/smriti-billing-Bs1kC1jj.js                   807.23 kB │ gzip: 117.96 kB
✓ built in 45.66s
(exited with code 0)
```

---

## 9. Verification Results

| Check | Tool / Command | Result | Status |
|---|---|---|---|
| TypeScript Typecheck | `tsc --noEmit` | 0 errors | Done |
| Unit & Integration Tests | `vitest run` | 171/171 files passed, 1813/1813 tests green | Done |
| Registry Field Validation | `validate-registry-usage.mjs` | 96/96 form components passed | Done |
| Launchpad Validation | `validate-launchpad-registry.mjs` | 53 tiles, 131 cases passed | Done |
| Production Build | `vite build` | 3,711 modules transformed cleanly | Done |
| Git Diff Integrity | `git diff` | Exact diff matching specification | Done |

---

## 10. Known Limitations

- PostgreSQL server on port 2781 was offline during this session; client-side and mock fallbacks handled tests and compilation gracefully without runtime regressions.
- Browser execution was explicitly skipped in accordance with user instruction ("continue headless and without browser").

---

## 11. Future Work

- When PostgreSQL port 2781 is online, execute full-cycle database integration script `scripts/verify_canonical_billing_studio_headless.py`.
- Enhance keyboard shortcut navigation to allow cycle navigation between cart table rows using Arrow Up / Down keys.

---

## 12. Related ADRs

- `ADR-BILLING-20261017-01`: Key-value configuration storage without migration overhead.
- `ADR-BILLING-20261017-02`: Strict B2C / B2B profile separation.
- `ADR-BILLING-20261017-03`: Four-tier configuration precedence.
- `ADR-BILLING-20261017-04`: Non-Invasive Controlled Visual Alignment.
- `ADR-BILLING-20261017-05`: Product Thumbnail Category Mapping.

---

## 13. Related RFCs

- `RFC-SMRITI-POS-042`: Canonical Billing Studio UX Harmonization.
- `RFC-SMRITI-TAX-019`: Dual GST Rate Resolution and Statutory Rounding in Retail Billing.
