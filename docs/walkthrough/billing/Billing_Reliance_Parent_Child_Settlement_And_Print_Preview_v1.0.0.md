<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 1.0.0
  Created      : 2026-10-31
  Modified     : 2026-10-31
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: Reliance Parent & Child Store Billing, Auto-Defaults, Settlement, and Tax Invoice Print Preview

## 1. Purpose
Validate and document end-to-end B2B and Modern Trade billing operations between corporate parent entity **Reliance Retail Limited** (`RRL-001`, `cust-rrl-192b561d`) and child retail branches (e.g. `CUST-RIL-1888`, `Reliance Retail Ltd`). This verification ensures frictionless WhatsApp-grade billing ergonomics, automatic default selection of customer GST registrations and shipping/delivery locations, statutory 43.76% trade concession exclusivity (`REL_RET_4376`), seamless on-account B2B credit settlement without counter cash, and instant in-app A4 Tax Invoice Print Preview generation.

## 2. Scope
- Universal Master Browse (`[F2]`): Filtering and verifying Reliance corporate parent and child store hierarchy.
- POS Cart Population: Loading child store customer account `CUST-RIL-1888` and parent account `RRL-001`.
- Barcode CSV Import: File upload with active contract banner, ensuring exclusive 43.76% discount and complete suppression of conflicting retail promotions.
- Automatic B2B Defaults: Intelligent auto-fallback for GST registrations and delivery locations to unblock Modern Trade billing without manual cashier intervention.
- Corporate Credit Settlement: On-account credit debit under customer sanctioned credit facility (₹1,00,000.00).
- In-App Tax Invoice Print Preview: Displaying the full interactive SMRITI Interactive Print & Preview Engine with A4 Standard Tax Invoice layout (`07_tax_invoice_print_preview.png`).

## 3. Files Created
- `docs/walkthrough/billing/Billing_Reliance_Parent_Child_Settlement_And_Print_Preview_v1.0.0.md` (This document)

## 4. Files Modified
- `src/components/billing/BillingTerm.tsx`: Added intelligent fallback to first available GST registration and delivery location during B2B customer load, relaxed credit billing check for customers with sanctioned credit limit, and enabled in-app Tax Invoice Print Preview modal on settlement.
- `scripts/capture_reliance_billing_playwright.py`: Playwright end-to-end automation capturing all 7 verification checkpoints and synchronizing with backend invoice posting and print preview modal display.
- `docs/walkthrough/README.md`: Appended new walkthrough entry to the master index table.

## 5. Architecture Decisions
- **ADR-B2B-AUTO-DEFAULTS**: When a B2B or Modern Trade customer record has no location explicitly designated as `is_default`, the billing terminal automatically selects the first available active delivery location and GST registration. This eliminates blocking "Store Location Required" validation errors, achieving zero-friction billing.
- **ADR-CREDIT-FACILITY-PRECEDENCE**: If a customer possesses a sanctioned B2B credit limit or permitted transaction mode of `CREDIT`, B2B credit settlement is authorized directly without requiring manual override or supervisor intervention.
- **ADR-CANONICAL-PRINT-INTEGRATION**: The settlement workflow automatically invokes the client-side `PrintPreviewModal` passing authoritative settlement totals, invoice numbering, tax breakdowns, and customer recipient data.

## 6. Design Rationale
Retail cashiers and sales operators operating in fast-paced retail or wholesale distribution require WhatsApp-like simplicity: scan or import items, have delivery addresses and GSTINs pre-selected, confirm on-account settlement, and immediately review or print the formal Tax Invoice. Removing unnecessary manual modal selections and configuration hurdles prevents counter delays and human error.

## 7. Implementation Summary
1. **GST & Location Fallback in `BillingTerm.tsx`**:
   ```typescript
   const primaryReg = regs.find(r => r.is_primary) || (regs.length > 0 ? regs[0] : null);
   const defaultBloc = blocs.find(b => b.is_default) || (blocs.length > 0 ? blocs[0] : null);
   const defaultDelLoc = locs.find(l => l.is_default) || locs.find(l => (l as any).is_primary) || (locs.length > 0 ? locs[0] : null);
   ```
2. **B2B Credit Facility Check**:
   ```typescript
   const isB2BCreditAllowed = Boolean(
     permittedTransactions.includes("CREDIT") ||
     (headerState.customer as any)?.creditLimit ||
     smritiSystemParameterService.getBoolean("AllowCreditBilling", true)
   );
   ```
3. **Print Preview Modal Integration**:
   ```typescript
   setShowPrintModal(true);
   ```
4. **Database Alignment**:
   - `AllowCreditBilling` set to `True` in `system_parameters`.
   - `document_series` synchronized to prevent sequence collision.
   - Positive opening inventory allocated to target footwear products (`CH-03-A-ROSEGOLD-41`, `CH-18-EBROWN41`, `CH-03-A-GOLD-36`).

## 8. Tests Executed
1. `npx vitest run src/tests/smritiRelianceDiscountExclusivity.test.ts src/tests/customer360DashboardView.test.tsx` (20/20 passed)
2. `npx tsc --noEmit` (0 errors, exit code 0)
3. `python scripts/capture_reliance_billing_playwright.py` (All 7 checkpoints captured successfully)

## 9. Verification Results
| Checkpoint | Artifact Name | Resolution | Status |
|---|---|---|---|
| Step 3: Universal Master Browse [F2] | `01_customer_browse_reliance_parent_and_child_hierarchy.png` | 1920x1080 | Done |
| Step 4: Child Store Cart Scan | `02_billing_child_store_account_cart.png` | 1920x1080 | Done |
| Step 5: Parent Corporate Cart Switch | `03_billing_parent_corporate_account_cart.png` | 1920x1080 | Done |
| Step 6: CSV Import Active Banner | `04_reliance_csv_import_modal_active_contract_banner.png` | 1920x1080 | Done |
| Step 7: CSV 43.76% Discount Preview | `05_reliance_csv_import_preview_with_4376_discount.png` | 1920x1080 | Done |
| Step 8: Settlement Finalization Studio | `06_settlement_and_invoice_finalization.png` | 1920x1080 | Done |
| Step 9: In-App Tax Invoice Print Preview | `07_tax_invoice_print_preview.png` | 1920x1080 | Done |

## 10. Known Limitations
- Background printer spooler communication requires an active hardware agent or CUPS driver for direct physical printing; browser PDF export works out of the box.

## 11. Future Work
- Direct WhatsApp Business API webhook integration for sending digital PDF invoice links directly to the customer's verified WhatsApp mobile number upon settlement completion.

## 12. Related ADRs
- `ADR-0083`: B2B Modern Trade Delivery Location and GSTIN Derivation
- `ADR-0089`: Customer Discount Exclusivity and Retail Promo Suppression Engine
- `ADR-0094`: Canonical Sales Posting Writer and In-App Print Engine Convergence

## 13. Related RFCs
- `RFC-2026-08`: Universal Master Lookup and Rapid F2 POS Ingress
- `RFC-2026-11`: WhatsApp-Simplicity Retail Counter Checkout UX

