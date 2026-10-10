<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.27.3
  Created      : 2026-09-16
  Modified     : 2026-09-16
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: Billing Default Tax-Exclusive Calculation & Canonical Invoice TT2026-2027/138 Standard

## 1. Purpose
This walkthrough documents the investigation into why SMRITI billing calculations appeared exclusive versus inclusive of taxes, and the implementation of canonical wholesale/commercial tax-exclusive billing as the system default modeled after real-world invoice standard `invoice_TT2026-2027-138.pdf` (Tattly Threads to Reliance Retail Limited).

## 2. Scope
- Analysis of prior dual-mode logic (`effTaxInclusive = !isB2B`) in `ProPosBillingTerm.tsx`.
- Realignment of the default calculation mode to `"exclusive"` (`Rate/MRP -> Trade Disc% -> Taxable Base -> + GST -> Total`).
- Preservation of operator flexibility via an interactive POS Toolbar toggle pill (`Exclusive (Base+GST) [Default]` vs `Inclusive (MRP Gross)`).
- Table column alignment in the Accepted Items grid to match the standard invoice columns (`Stock No | Item Description | Rate / MRP | Qty | Disc. % | Taxable | Tax % | Tax Amt | Total | Staff | Del`).
- Alignment of receipt modal (`ProPosTaxInvoiceRc.tsx`) to accurately display `calculatedTaxable` and GST breakdown.
- Development and execution of unit test suite `ttInvoiceBillingCalculation.test.ts` matching exact row values from `invoice_TT2026-2027-138.pdf`.

## 3. Files Created
- `src/tests/ttInvoiceBillingCalculation.test.ts` (250 LOC) — Unit test suite verifying canonical lines and cumulative totals.

## 4. Files Modified
- `src/components/billing/propos/ProPosBillingTerm.tsx` — Added `taxMode` state defaulting to `"exclusive"`, dynamic recalculation effect, toolbar toggle, updated item grid headers/cells, and Net Values summary breakdown.
- `src/components/billing/propos/ProPosTaxInvoiceRc.tsx` — Fixed receipt printout taxable total extraction and GST breakdown.

## 5. Architecture Decisions
- **Default Exclusive Precedence**: By default, commercial retail distribution operates where MRP/Rate is the baseline list price, trade discounts are subtracted to establish the statutory Taxable Base, and GST (CGST+SGST or IGST) is added on top.
- **Dynamic Mode Re-computation**: Toggling between Exclusive and Inclusive mode immediately recalculates the active cart without losing scanned items or requiring re-entry.
- **Statutory GST Preservation**: Interstate transactions (Place of Supply != Maharashtra 27) automatically route GST to IGST; intrastate transactions automatically split 50/50 between CGST and SGST.

## 6. Design Rationale
In wholesale dispatches (such as Tattly Threads to Reliance Retail), contracts mandate trade discounts on MRP, resulting in a taxable amount upon which statutory GST must be levied and recovered from the buyer. Previously, walk-in customers defaulted to inclusive (treating MRP as gross net payable and back-calculating taxes), which confused operators expecting the wholesale commercial invoice format. Setting `"exclusive"` as the default satisfies commercial B2B/distribution requirements while retaining a 1-click toggle for consumer retail checkout.

## 7. Implementation Summary
1. **Root-Cause Analysis**:
   - `isB2B` was calculated as `Boolean(customer.gstin && gstAnalysis.isValid)`.
   - `effTaxInclusive` was set to `!isB2B`.
   - Walk-in customers with no GSTIN received reverse tax extraction (`Taxable = Rate / (1 + Tax%)`), keeping Total = Rate.
   - For standard distribution invoicing per `TT2026-2027/138`, GST must be charged on top of the discounted rate (`Total = Taxable + Tax`).
2. **Terminal Engine Hardening**:
   - Introduced `taxMode: "exclusive" | "inclusive"` defaulting to `"exclusive"`.
   - Updated cart recalculations to apply `taxMode === "inclusive"`.
   - Updated table headers to display `Rate / MRP`, `Taxable`, `Tax %`, and `Tax Amt`.
   - Updated Net Values summary panel to explicitly distinguish `Gross MRP Sales`, `Discounts`, `Taxable Value`, and `GST Tax`.

## 8. Tests Executed
- `npx vitest run src/tests/ttInvoiceBillingCalculation.test.ts` — 9/9 tests passed (0 failures).
- `npx vitest run` — 131/131 test files passed (870/870 tests passed).
- `npm run lint` (`tsc --noEmit`) — Exited with code 0 (0 errors).
- `python scripts/architecture_duplication_gate.py` — Passed (10/10 checks, 0 unapproved duplications).

## 9. Verification Results
- All 6 target rows from `invoice_TT2026-2027-138.pdf` match down to 2 decimal places:
  - Row 1: `SND-06-G BLUE 36` (MRP ₹1,899, Disc 43.76%, Taxable ₹2,136.00, IGST ₹106.80, Total ₹2,242.80)
  - Row 6: `CH-22-F BLACK 36` (MRP ₹1,699, Disc 43.76%, Taxable ₹1,911.04, IGST ₹95.55, Total ₹2,006.59)
  - Row 16: `CH-05-B BLACK 36` (MRP ₹2,199, Disc 43.76%, Taxable ₹2,473.44, IGST ₹123.67, Total ₹2,597.11)
  - Row 26: `SND-07-G BLACK 36` (MRP ₹2,599, Disc 43.76%, Taxable ₹1,461.68, IGST ₹73.08, Total ₹1,534.76)
  - Row 53: `SH-02-I BLACK 36` (MRP ₹2,499, Disc 43.76%, Taxable ₹2,810.88, IGST ₹140.54, Total ₹2,951.42)
  - Row 58: `CH-23-F BLACK 36` (MRP ₹1,599, Disc 43.76%, Taxable ₹899.28, IGST ₹44.96, Total ₹944.24)
- Cumulative Totals:
  - Taxable Value: ₹120,970.24
  - 5% IGST: ₹6,048.46
  - Raw Grand Total: ₹127,018.70
  - Round Off: +₹0.30
  - Final Net Invoiced Amount: ₹127,019.00

## 10. Known Limitations
- When manually editing discount percentage on the row in the terminal, precision beyond 2 decimal places (e.g. 43.764%) is truncated to 2 decimals unless entered via CSV batch import.

## 11. Future Work
- Integration with backend `system_parameters` (`BILLING.TAX_MODE_DEFAULT`) to allow franchise administrators to persist their preferred default mode at the terminal level.

## 12. Related ADRs
- `docs/architecture/decisions/ADR-005_One_Way_Projections_And_Statutory_Snapshot_Rule.md`

## 13. Related RFCs
- RFC-2026-GST-R46 Statutory Tax Invoice Serialization and Line Structure
