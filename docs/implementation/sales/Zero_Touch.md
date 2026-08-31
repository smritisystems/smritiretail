<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.26.0
  Created      : 2026-08-22
  Modified     : 2026-08-22
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Zero-Touch Automated GST & Customer Classification Engine Implementation Plan

## 1. Objective
Provide a 100% automated, zero-touch tax classification and calculation architecture that completely eliminates cashier mistakes for B2B vs. B2C and Intra-State vs. Inter-State billing.

## 2. Business Motivation
Store cashiers often lack detailed knowledge of Indian GST laws, state codes, CGST/SGST/IGST tax splits, and gross/net calculations. This engine automates all tax decisions so business owners can "set up once and forget".

## 3. Scope
- Centralized Python GST calculation engine (`backend/app/core/gst_engine.py`).
- Centralized TypeScript GST calculation engine (`src/utils/gstEngine.ts`).
- Automatic GSTIN format validation and state extraction (`gstin[:2]`).
- Automatic Place of Supply (POS) comparison (`Store State` vs `POS State`).
- Automatic pricing mode resolution (Tax-Inclusive MRP for B2C vs Tax-Exclusive Base Rate for B2B).
- Automatic GSTR-1 classification (`B2B`, `B2CL`, `B2CS`).
- ProPOS Billing Terminal live tax status badge and cashier guardrails.
- Thermal/A4 tax invoice receipt dynamic tax breakdown table.

## 4. Current State
Previously, sales invoicing applied a flat tax formula without distinguishing between tax-inclusive retail MRP vs. tax-exclusive wholesale base rate, and did not automatically separate CGST+SGST vs. IGST on invoice item lines.

## 5. Gap Analysis
- Missing automated derivation of state code from GSTIN.
- Missing automatic switch between inclusive (B2C) and exclusive (B2B) calculations.
- Missing live visual indicators on the POS billing screen for cashier reassurance.

## 6. Architecture Impact
- Pure, reusable domain logic separated in `gst_engine.py` / `gstEngine.ts`.
- Database line items (`sales_invoice_items`) now persist `taxable_value`, `cgst_amount`, `sgst_amount`, `igst_amount`, and `line_total` immutably.

## 7. Proposed Design
- Deterministic 2x2 matrix: (B2B/B2C) x (Intra-State/Inter-State).
- Read-only tax calculation fields on POS billing screen to prevent cashier tampering.

## 8. Files Created
- `backend/app/core/gst_engine.py`
- `backend/app/tests/test_gst_engine.py`
- `src/utils/gstEngine.ts`
- `src/tests/gstEngine.test.ts`
- `docs/implementation/sales/Zero_Touch.md`
- `docs/walkthrough/sales/Zero_Touch.md`

## 9. Files Modified
- `backend/app/schemas/sales.py`
- `backend/app/services/sales.py`
- `src/components/billing/propos/types.ts`
- `src/components/billing/propos/ProPosBillingTerm.tsx`
- `src/components/billing/propos/CustBrowseDlg.tsx`
- `src/components/billing/propos/ProPosTaxInvoiceRc.tsx`
- `docs/implementation/README.md`
- `docs/walkthrough/README.md`
- `CHANGELOG.md`

## 10. Dependencies
- Pydantic V2, SQLAlchemy, FastAPI.
- React 18, Lucide React, Vitest.

## 11. Risks
- None. All calculations use decimal precision and round-half-up banking rules.

## 12. Rollback Strategy
Revert the modified files via Git if needed.

## 13. Verification Plan
- Run backend pytest test suite (`pytest backend/app/tests/test_gst_engine.py`).
- Run frontend vitest test suite (`npx vitest run src/tests/gstEngine.test.ts`).

## 14. Test Plan
- Unit tests covering GSTIN validation, state extraction, inclusive MRP calculations, exclusive B2B calculations, and GSTR-1 categorization.

## 15. Documentation Impact
- Added implementation plan and walkthrough documentation.

## 16. Deployment Plan
- Deploy backend and frontend changes together.

## 17. Status
Completed.

## 18. Related ADRs
- N/A

## 19. Related Walkthroughs
- `docs/walkthrough/sales/Zero_Touch.md`
