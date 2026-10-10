# Walkthrough: SMRITI POS Line-Level Sales Staff Attribution & Shift-End Cashier Handover (v6.31.0)

## 1. Purpose
Executes Phase 2 and Phase 3 of the SMRITI vs. Shoper 9 Competitive Parity Roadmap:
1. **Line-Level Sales Staff Attribution & Commission Tracking (Phase 2):** Solves multi-department retail checkout (apparel, footwear, cosmetics) where different sales staff attend to different items in the same cart.
2. **Shift-End Cashier Handover Reconciliation & Thermal Balance Sheet (Phase 3):** Bridges the final operational gap identified in Shoper 9 by automating PostgreSQL denomination ledger persistence (`pos_shift_denomination_counts`) and providing a dedicated 80mm / 40-column ESC/POS styled cashier handover balance sheet with dual cashier/manager signatures.

---

## 2. Scope
- **Database & Migration:** Added `salesperson_id` (VARCHAR(50)) and `salesperson_name` (VARCHAR(255)) to `sales_invoice_items` via Alembic migration `v1459_line_level_salesperson_attribution.py`.
- **Backend Posting Contract:** Updated `CanonicalPostingLineItem`, `POSCheckoutItem`, and `CanonicalSalesPostingWriter` to propagate line-level salesperson identity with automatic fallback to invoice header staff.
- **Shift Denomination Persistence:** Updated `POSService.close_shift` to automatically write counted physical denominations into `pos_shift_denomination_counts`.
- **Incentive Engine:** Implemented `SmritiSalesStaffIncentiveService` for category-specific commissions, tiered volume slabs, and turnover aggregation.
- **Printable Handover Slip:** Implemented `ProPosShiftHandoverSlip.tsx` and integrated it into `ProPosShiftCloseDl.tsx`.
- **Frontend POS Grid:** Updated `ProPosBillingTerm.tsx` to display line-level staff tags and pass line attendant data to `/pos/checkout`.

---

## 3. Files Created
1. `backend/alembic/versions/v1459_line_level_salesperson_attribution.py`
2. `src/services/smritiSalesStaffIncentiveService.ts`
3. `src/components/billing/propos/ProPosShiftHandoverSlip.tsx`
4. `src/tests/smritiSalesStaffAttribution.test.ts`
5. `docs/walkthrough/billing/Billing_POS_Staff_Attribution_And_Shift_Handover_v6.31.0.md`

---

## 4. Files Modified
1. `backend/app/models/sales.py`
2. `backend/app/schemas/canonical_posting.py`
3. `backend/app/schemas/pos.py`
4. `backend/app/services/canonical_sales_writer.py`
5. `backend/app/services/pos.py`
6. `src/components/billing/propos/ProPosShiftCloseDl.tsx`
7. `src/components/billing/propos/ProPosBillingTerm.tsx`
8. `docs/walkthrough/README.md`
9. `CHANGELOG.md`

---

## 5. Architecture Decisions
1. **Header-to-Line Fallback Inheritance:** Line-level `salesperson_id` defaults to the bill header `salesperson_id` if omitted, ensuring 100% backward compatibility with single-cashier transactions and legacy sales data.
2. **PostgreSQL Shift Denomination Durability:** Instead of storing shift denominations solely as an ephemeral JSON blob on `shifts`, each denomination is unpacked into `pos_shift_denomination_counts` for auditing and manager sign-off reconciliation.
3. **80mm Thermal Print Media Isolation:** `ProPosShiftHandoverSlip` uses strict CSS print queries (`print:hidden`, `@media print`) ensuring that when the cashier triggers handover printing, only the 300px/80mm receipt prints cleanly on thermal roll paper.

---

## 6. Design Rationale
- In department stores (e.g. Reliance Trends, Lifestyle, Shoppers Stop), cashiers bill multi-department baskets. If commission is tracked only at the invoice header, staff in shoes or cosmetics receive zero credit when an apparel associate bills the customer. Line-level attribution solves this pain point with zero cashier friction.
- Shoper 9's historical advantage was its printable cashier handover sheet with denomination counting and dual signature lines. Integrating this into `ProPosShiftCloseDl.tsx` eliminates the need for manual pen-and-paper cash tallying at shift close.

---

## 7. Implementation Summary
- **Migration `v1459`:** Applied `salesperson_id` and `salesperson_name` to `sales_invoice_items` with index `idx_sales_invoice_items_salesperson`.
- **FastAPI / SQLAlchemy:** Extended `SalesInvoiceItem` model and `CanonicalPostingLineItem` schema.
- **Service Layer:** `CanonicalSalesPostingWriter` records line-level attendant; `POSService.close_shift` iterates through counted denominations and inserts `POSShiftDenominationCount` records.
- **Frontend:** Integrated `ProPosShiftHandoverSlip` in `ProPosShiftCloseDl.tsx` with high-contrast denomination counts, system expected cash, shortage/overage variance, and manager signature blocks.

---

## 8. Tests Executed
1. `src/tests/smritiSalesStaffAttribution.test.ts` (3 tests)
2. `src/tests/smritiPosParkedCart.test.ts` (7 tests)
3. `src/tests/smritiPromotionClawback.test.ts` (5 tests)
4. `src/tests/smritiSalesPromotionEngine.test.ts` (15 tests)
5. `src/tests/smritiAutoSelectPromotion.test.ts` (14 tests)

---

## 9. Verification Results
- Vitest Suite: 44/44 tests green (917ms).
- Python AST compilation: 0 errors across 6 backend modules.
- TypeScript compilation: 0 errors (`tsc --noEmit` exit code 0).

---

## 10. Known Limitations
- Shift denomination physical print layout relies on browser print engine; direct ESC/POS byte streaming via raw WebUSB / serial port will be added in future hardware driver phases.

---

## 11. Future Work
- Integration with biometric fingerprint readers for manager shift handover authorization.
- Staff commission monthly payout export to payroll journal vouchers.

---

## 12. Related ADRs
- ADR-005: Immutability and Transaction Audit Lineage
- ADR-014: Canonical Sales Posting Architecture

---

## 13. Related RFCs
- RFC-109: Multi-Department Sales Staff Attribution & Commission Accounting
