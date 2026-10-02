<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.49.8
  Created      : 2026-10-02
  Modified     : 2026-10-02
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Implementation Plan: Procurement Phase 2.6 — Vendor 360 Supplier Advance Prepayment & Bill Knock-off UI Integration

**Document Reference:** `IP-PROC-006`  
**Related Architecture RFC:** `RFC-PROC-2026-006`  
**Related Walkthrough:** `docs/walkthrough/procurement/Procurement_Phase2_6_Vendor360_Advance_Knockoff_UI_v1.0.md`  
**Target Version:** `6.49.8`  
**Module:** Procurement & Vendor 360 Payables Workspace  
**Status:** Completed  

---

## 1. Objective
Integrate real-time supplier advance prepayment tracking (General Ledger Account `2050 Supplier Advance Liability`) and 1-click bill knock-off settlement directly into the **Vendor 360 Payables Workspace** (`VendorPayablesTab.tsx`). Empower procurement managers and accounts payable operators to visually inspect unallocated advance balances, review confirmed purchase bills, and execute non-cash journal knock-off transactions (`DR 2010 Accounts Payable / CR 2050 Supplier Advance Liability`) seamlessly from the vendor overview.

---

## 2. Business Motivation
In enterprise retail procurement, advance payments are routinely disbursed to garment manufacturers and merchandise vendors against purchase orders before goods arrival. 
Previously, `VendorPayablesTab.tsx` synthesized liabilities from purchase orders and was unaware of:
1. Actual confirmed purchase bills (`PurchaseBill` records posted against GRNs).
2. Dedicated supplier advance disbursements (`payment_type = "ADVANCE"`) and their remaining unallocated balances.
3. The ability to settle an advance deposit against a confirmed bill directly from the Vendor 360 screen.

Without this capability, operators had to manually reconcile advances offline, resulting in duplicate vendor payments, unapplied advance deposits, and fragmented subledger records. Phase 2.6 bridges the backend GL knock-off engine (Phase 2.5) with the Vendor 360 operational workspace.

---

## 3. Scope
- **Backend API & Service Additions:**
  - Add `GET /api/v1/bills` and `GET /api/v1/purchase/bills` to list purchase bills filtered by `supplier_id` and `status`.
  - Expose `due_date` and `paid_amount` on `PurchaseBillResponse`.
  - Mount `(supplier_payment, "/purchase", ["Supplier Payments"])` alias in `backend/app/main.py`.
- **Frontend Vendor 360 Enhancements:**
  - Update `VendorPayablesTab.tsx` to fetch actual `PurchaseBill` records and live `SupplierPayment` advances.
  - Render an interactive **Available Advance Credit Chip** (`₹XX,XXX.XX`) in the financial metrics strip.
  - Implement a dedicated **Supplier Advances (Account 2050)** table displaying original disbursement, allocated amounts, and remaining unallocated balance.
  - Implement a 1-click **Knock Off Advance Modal** (`VendorAdvanceKnockoffModal.tsx`) with real-time selection of open advances and bills, max amount clamping, double-entry voucher preview, and immediate backend execution.
- **Headless Visual Evidence & Automated Tests:**
  - Python Playwright headless Chromium script capturing high-resolution visual evidence of the Vendor 360 advance balance and knock-off dialog.
  - Unit and integration tests for purchase bill listing and schema verification.

---

## 4. Current State
- Backend `SupplierPaymentService.knockoff_advance` (`POST /api/v1/supplier-payments/advance/knockoff`) is implemented and tested green (Phase 2.5).
- `PurchaseBill` model exists in Postgres with `total_amount`, `paid_amount`, `bill_date`, and `due_date`.
- However, `VendorPayablesTab.tsx` only queries `/purchase/orders` and does not display `PurchaseBill` records or advance balances.
- No `GET /api/v1/purchase/bills` route existed to fetch bills for a specific supplier.

---

## 5. Gap Analysis
| Feature | Current State | Phase 2.6 Target State |
| :--- | :--- | :--- |
| **Purchase Bill API Listing** | Only `POST /bills` exists | `GET /bills` with `supplier_id` & `status` filters |
| **Purchase Bill Schema** | Lacks `due_date` & `paid_amount` | Full parity with model fields |
| **Vendor 360 Advance Visibility** | Advance payments hidden in flat payments list | Dedicated Advance Prepayments table with unallocated balances |
| **Vendor 360 Advance Summary** | No advance summary card | Highlighted "Available Advance Balance" card & credit badge |
| **Vendor 360 Knock-off Action** | No UI to trigger advance knock-off | 1-Click "Knock Off Advance" modal with double-entry GL preview |

---

## 6. Architecture Impact
- **Ledger Invariant Preserved:** The knock-off operation generates a balanced double-entry Journal Voucher (`DR 2010 / CR 2050`) with strictly `0.00` cash movement.
- **Subledger Synchronization:** Decrements `supplier.outstanding` liability and increments `bill.paid_amount`, transitioning bill to `PAID` when fully settled.
- **Component Hierarchy:**
  ```text
  VendorMasterWs.tsx
     └── VendorPayablesTab.tsx
            ├── Metrics Strip (AP 2010, Advance 2050, Net Position)
            ├── Aging Buckets Strip
            ├── Active Purchase Bills Table (with "Knock Off" button)
            ├── Supplier Advance Deposits Table (with "Knock Off Bill" button)
            └── VendorAdvanceKnockoffModal.tsx (Modal Dialog & GL Preview)
  ```

---

## 7. Proposed Design
1. **Purchase Bill Listing Endpoint:**
   - In `backend/app/services/purchase.py`: `PurchaseService.list_purchase_bills(supplier_id, status)`.
   - In `backend/app/api/v1/purchase.py`: `@router.get("/bills")` returning `List[PurchaseBillResponse]`.
2. **Vendor Advance Knock-off Modal (`VendorAdvanceKnockoffModal.tsx`):**
   - Controlled dialog with step-by-step advance and bill selection.
   - Auto-computed default amount: `min(advance.unallocated_amount, bill.unpaid_amount)`.
   - Visual GL Accounting Impact Card:
     - `DR 2010 Accounts Payable / Creditors: ₹X,XXX.XX`
     - `CR 2050 Supplier Advance Liability: ₹X,XXX.XX`
     - `Net Cash Movement: ₹0.00`
   - Submits `POST /api/v1/supplier-payments/advance/knockoff`.
3. **Vendor Payables Tab Overhaul (`VendorPayablesTab.tsx`):**
   - Unified async fetch: `GET /purchase/bills/?supplier_id=...` and `GET /supplier-payments/?supplier_id=...`.
   - Compute `totalOutstandingAP = sum(b.total_amount - b.paid_amount)`.
   - Compute `totalUnallocatedAdvance = sum(p.unallocated_amount)`.
   - Show net payable and advance credit chip.

---

## 8. Files Created
1. `docs/implementation/procurement/Procurement_Phase2_6_Vendor360_Advance_Knockoff_UI_Plan_v1.0.md`
2. `src/components/vendor/tabs/VendorAdvanceKnockoffModal.tsx`
3. `backend/app/tests/test_purchase_bill_listing.py`
4. `scripts/capture_vendor_360_advance_knockoff_headless.py`
5. `docs/walkthrough/procurement/Procurement_Phase2_6_Vendor360_Advance_Knockoff_UI_v1.0.md`

---

## 9. Files Modified
1. `backend/app/schemas/purchase.py` (Add `due_date` and `paid_amount` to `PurchaseBillResponse`)
2. `backend/app/services/purchase.py` (Add `list_purchase_bills` method)
3. `backend/app/api/v1/purchase.py` (Add `GET /bills` and `GET /bills/` endpoints)
4. `backend/app/main.py` (Mount `supplier_payment` at `"/purchase"` alias)
5. `src/components/vendor/tabs/VendorPayablesTab.tsx` (Complete integration of bills, advances, and knock-off modal)
6. `src/App.tsx` (Add test route query for headless capture)
7. `package.json`, `backend/app/core/config.py`, `src/config/version.ts`, `CHANGELOG.md` (SSOT bump to 6.49.8)
8. `docs/implementation/README.md`, `docs/walkthrough/README.md` (Index updates)

---

## 10. Dependencies
- FastAPI + PostgreSQL backend.
- React 18 + Tailwind CSS + Lucide icons.
- Playwright Chromium for headless browser visual verification.

---

## 11. Risks
- **Over-allocation Risk:** Prevented by backend validation in `SupplierPaymentService.knockoff_advance` verifying both `amount <= unallocated_advance` and `amount <= unpaid_bill`.
- **Currency & Precision Drift:** Enforced 2 decimal place rounding (`quantize(Decimal("0.01"))`) on all calculations.
- **Race Condition in Multi-user Knock-off:** Handled by Postgres transaction isolation and row state validation.

---

## 12. Rollback Strategy
All changes are additive. If needed, reverting commit returns `VendorPayablesTab.tsx` to order-based view and removes `GET /bills` endpoint without affecting database integrity or existing GL vouchers.

---

## 13. Verification Plan
1. Backend Unit Tests: Run `pytest backend/app/tests/test_purchase_bill_listing.py` and regression test suite.
2. Frontend Build: Run `npx tsc --noEmit` to verify type safety.
3. Headless Visual Verification: Run `scripts/capture_vendor_360_advance_knockoff_headless.py` to capture screenshots of:
   - Vendor 360 Payables Overview with Available Advance Credit Chip.
   - Advance Knock-off Modal with Double-Entry Accounting Preview.
   - Successfully Knocked-Off Bill and Decremented Advance Balance.

---

## 14. Test Plan
- Test bill listing by supplier ID.
- Test bill listing by status (`POSTED`, `PAID`).
- Test advance knock-off execution via API and UI.
- Verify voucher balancing `sum(DR) == sum(CR)`.

---

## 15. Documentation Impact
- Update `docs/implementation/README.md` with `IP-PROC-006`.
- Create `docs/walkthrough/procurement/Procurement_Phase2_6_Vendor360_Advance_Knockoff_UI_v1.0.md` (`WT-PROC-006`).
- Update `docs/walkthrough/README.md`.
- Update `CHANGELOG.md` with v6.49.8 notes.

---

## 16. Deployment Plan
1. Commit backend and frontend files to branch `smritiNX`.
2. Run database migrations / tests.
3. Deploy frontend bundle.

---

## 17. Status
**Completed**

---

## 18. Related ADRs
- `ADR-PROC-001`: General Ledger Universal Posting Engine.
- `ADR-VEND-001`: Vendor 360 Universal Party System of Record.
- `ADR-PROC-005`: Supplier Advance Prepayments (Account 2050).

---

## 19. Related Walkthroughs
- `docs/walkthrough/procurement/Procurement_Phase2_5_Supplier_Advance_Payment_PO_Knockoff_v1.0.md`
- `docs/walkthrough/procurement/Procurement_Phase2_6_Vendor360_Advance_Knockoff_UI_v1.0.md`
