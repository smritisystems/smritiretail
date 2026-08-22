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

# Walkthrough: Zero-Touch Automated GST & Customer Classification Engine

## 1. Purpose
To deliver a fail-safe, zero-touch GST calculation and classification system where business owners can configure store details once and cashiers cannot produce invalid tax invoices.

## 2. Scope
- Automated customer classification (Registered B2B vs. Unregistered B2C).
- Automated place of supply (POS) and tax split (CGST+SGST vs. IGST).
- Automated price mode handling (Tax-Inclusive MRP vs. Tax-Exclusive Base Rate).
- ProPOS Billing Terminal live feedback badge and receipt tax breakdown.

## 3. Files Created
1. `backend/app/core/gst_engine.py`
2. `backend/app/tests/test_gst_engine.py`
3. `src/utils/gstEngine.ts`
4. `src/tests/gstEngine.test.ts`
5. `docs/implementation/sales/Zero_Touch_Automated_GST_Customer_Classification_Engine_v3.26.0.md`
6. `docs/walkthrough/sales/Zero_Touch_Automated_GST_Customer_Classification_Engine_v3.26.0.md`

## 4. Files Modified
1. `backend/app/schemas/sales.py`
2. `backend/app/services/sales.py`
3. `src/components/billing/propos/types.ts`
4. `src/components/billing/propos/SmritiProPosBillingTerminal.tsx`
5. `src/components/billing/propos/SmritiCustomerBrowseModal.tsx`
6. `src/components/billing/propos/SmritiProPosTaxInvoiceReceipt.tsx`
7. `docs/implementation/README.md`
8. `docs/walkthrough/README.md`
9. `CHANGELOG.md`

## 5. Architecture Decisions
- Centralized tax calculation in pure functions (`backend/app/core/gst_engine.py` and `src/utils/gstEngine.ts`) with no side-effects or external network calls.
- Immutably persist `taxable_value`, `cgst_amount`, `sgst_amount`, `igst_amount`, and `line_total` in Postgres `sales_invoice_items`.
- Lock all GST rate and calculation inputs on the POS billing interface to prevent cashier tampering.

## 6. Design Rationale
Eliminating operator decision-making at checkout reduces retail billing queues and ensures 100% statutory compliance for GSTR-1, GSTR-3B, e-Invoicing, and CA audit reconciliations.

## 7. Implementation Summary
- Added `validate_gstin`, `extract_state_code_from_gstin`, `calculate_line_item_tax`, and `determine_gstr1_table`.
- Enhanced `SalesService.create_sales_invoice` to auto-resolve store state vs. customer POS state, evaluate `is_interstate`, and split taxes.
- Added live `Tax Jurisdiction` badge to the ProPOS billing terminal header.
- Updated print receipt to display buyer GSTIN, Place of Supply, and CGST/SGST or IGST tax analysis table.

## 8. Tests Executed
- Backend: `pytest backend/app/tests/test_gst_engine.py -v` (7 passed in 3.58s).
- Frontend: `npx vitest run src/tests/gstEngine.test.ts` (5 passed in 605ms).
- Frontend: `npx vitest run src/tests/validatorsAndFormatters.test.ts` (6 passed in 964ms).

## 9. Verification Results
All automated unit and regression tests passed with zero errors.

## 10. Known Limitations
- E-commerce out-of-state consumer addresses must be selected during online checkout to determine destination POS state code.

## 11. Future Work
- Integration with live NIC / GSTN sandbox gateway for on-the-fly GSTIN business name verification.

## 12. Related ADRs
- ADR-001 (Sole FastAPI + PostgreSQL System of Record Architecture)

## 13. Related RFCs
- RFC-GST-001 (Universal GST Rate Engine & Jurisdiction Resolution)
