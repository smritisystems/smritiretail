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

# Walkthrough: Procurement Phase 2.6 — Vendor 360 Supplier Advance Prepayment & Bill Knock-off UI Integration

**Document Reference:** `WT-PROC-006`  
**Related Implementation Plan:** `docs/implementation/procurement/Procurement_Phase2_6_Vendor360_Advance_Knockoff_UI_Plan_v1.0.md` (`IP-PROC-006`)  
**Target Version:** `6.49.8`  
**Area:** Procurement & Vendor 360 Financial Accounting  
**Status:** Done  

---

## 1. Purpose
This walkthrough documents the design, implementation, and verification of the **Vendor 360 Supplier Advance Prepayment & Bill Knock-off UI Integration** (Procurement Phase 2.6). It provides accounts payable managers, finance controllers, and procurement operators with a seamless workspace to monitor unallocated supplier advance balances (`Account 2050 Supplier Advance Liability`) and execute 1-click non-cash journal knock-offs (`DR 2010 Accounts Payable / CR 2050 Supplier Advance Liability`) directly against confirmed purchase bills.

---

## 2. Scope
- **Backend API & Service Layer:**
  - Added `GET /api/v1/bills` and `GET /api/v1/purchase/bills` with `supplier_id` and `status` query filtering.
  - Exposed `due_date` and `paid_amount` on `PurchaseBillResponse` schema.
  - Mounted `/purchase/supplier-payments` alias in `backend/app/main.py`.
  - Added unit test suite `backend/app/tests/test_purchase_bill_listing.py` (6/6 tests passing).
- **Frontend Vendor 360 Workspace:**
  - Upgraded `VendorPayablesTab.tsx` with live `PurchaseBill` tracking, real-time unallocated advance balance cards, and payables aging schedule.
  - Created `VendorAdvanceKnockoffModal.tsx` providing automated eligible knock-off limit computation, source advance and target bill selection, and authoritative double-entry general ledger voucher preview.
  - Added `StandaloneVendorPayablesPreview.tsx` mounted under `?standalone_vendor_advance_knockoff=1`.
- **Verification & Governance:**
  - Captured 3 high-resolution visual evidence screenshots headlessly without browser windows.
  - Compliant with WGP 13 sections, IPGP 19 sections, UADHP header policy, and SSOT version bump to `6.49.8`.

---

## 3. Files Created
1. `docs/implementation/procurement/Procurement_Phase2_6_Vendor360_Advance_Knockoff_UI_Plan_v1.0.md` (`IP-PROC-006`)
2. `src/components/vendor/tabs/VendorAdvanceKnockoffModal.tsx`
3. `src/components/vendor/StandaloneVendorPayablesPreview.tsx`
4. `backend/app/tests/test_purchase_bill_listing.py`
5. `scripts/capture_vendor_360_advance_knockoff_headless.py`
6. `docs/walkthrough/procurement/Procurement_Phase2_6_Vendor360_Advance_Knockoff_UI_v1.0.md` (`WT-PROC-006`)
7. `docs/walkthrough/procurement/evidence/vendor_360_payables_and_advances_overview.png`
8. `docs/walkthrough/procurement/evidence/vendor_360_advance_knockoff_modal_active.png`
9. `docs/walkthrough/procurement/evidence/vendor_360_advance_knockoff_settled.png`

---

## 4. Files Modified
1. `backend/app/schemas/purchase.py` (Added `due_date` and `paid_amount` to `PurchaseBillResponse`)
2. `backend/app/services/purchase.py` (Added `list_purchase_bills` and `get_purchase_bill` methods)
3. `backend/app/api/v1/purchase.py` (Added `GET /bills` and `GET /bills/` endpoints)
4. `backend/app/main.py` (Mounted `supplier_payment` at `"/purchase"` alias)
5. `src/components/vendor/tabs/VendorPayablesTab.tsx` (Integrated bills, advances, and knock-off modal)
6. `src/App.tsx` (Mounted `?standalone_vendor_advance_knockoff=1` preview route)
7. `package.json`, `backend/app/core/config.py`, `src/config/version.ts`, `CHANGELOG.md` (SSOT bump to 6.49.8)
8. `docs/implementation/README.md`, `docs/walkthrough/README.md` (Registry updates)

---

## 5. Architecture Decisions
- **AD-PROC-206-1: Direct Subledger & General Ledger Parity:**
  - Accounts payable liabilities are sourced directly from canonical `PurchaseBill` entities (`status IN ('POSTED', 'PARTIALLY_PAID')`).
  - Prepayment credit is sourced from `SupplierPayment` records where `payment_type == 'ADVANCE'` and `unallocated_amount > 0`.
- **AD-PROC-206-2: Non-Cash Symmetrical Double-Entry Knock-off:**
  - Knock-off transactions post a Journal Voucher (`JOURNAL`):
    - `DR 2010 Accounts Payable / Creditors`: Reduces trade liability owed to vendor.
    - `CR 2050 Supplier Advance Liability`: Consumes pre-disbursed advance deposit.
  - Net cash movement is strictly `₹0.00` across all cash and bank accounts.
- **AD-PROC-206-3: Clamped Allocation Boundary:**
  - The maximum allowable knock-off amount is strictly bounded by:
    $$\text{Max Amount} = \min(\text{Advance.unallocated\_amount}, \text{Bill.unpaid\_amount})$$
  - Prevents over-application of advances and negative bill balances.

---

## 6. Design Rationale
- **Single-Screen Payables Intelligence:** Rather than forcing operators to navigate between procurement purchase orders, payments registers, and general ledger reports, Vendor 360 presents gross AP, available advance credits, and net exposure on a single dashboard.
- **Visual Ledger Transparency:** Before posting, the modal renders the exact debit and credit legs of the journal voucher, giving operators confidence that no unauthorized cash movements or unbalanced journals occur.

---

## 7. Implementation Summary

### 7.1 Financial Metrics Strip
The Vendor 360 overview incorporates three primary financial cards:
1. **Gross Accounts Payable (Account 2010):** Total outstanding bill liabilities owed.
2. **Available Advance Prepayments (Account 2050):** Total unallocated advance credit with an active "Settle Now" quick action.
3. **Net Settlement Position:** Net cash liability after applying unallocated advance deposits.

### 7.2 Interactive Knock-Off Modal
```typescript
const maxAllowedKnockoff = Math.max(
  0,
  Math.min(
    Number(selectedAdvance.unallocated_amount || 0),
    Number(selectedBill.unpaid_amount || 0)
  )
);
```
Displays:
- Source Advance Prepayment (with unallocated credit available)
- Target Confirmed Purchase Bill (with unpaid bill balance)
- Knock-Off Amount Input with "Max Eligible" one-click filler
- Authoritative General Ledger Preview Box (`DR 2010 / CR 2050 / Net Cash: ₹0.00`)

---

## 8. Tests Executed

### 8.1 Backend Purchase Bill Listing Test Battery
Command executed:
```bash
& "f:\SMRITRretailNX\.venv\Scripts\python.exe" -m pytest backend/app/tests/test_purchase_bill_listing.py -v
```
Literal output:
```text
============================= test session starts =============================
platform win32 -- Python 3.11.9, pytest-8.2.1, pluggy-1.6.0 -- F:\SMRITRretailNX\.venv\Scripts\python.exe
cachedir: .pytest_cache
rootdir: F:\SMRITRretailNX\backend
configfile: pyproject.toml
plugins: anyio-4.15.1, asyncio-0.23.7, cov-5.0.0
asyncio: mode=Mode.AUTO
collecting ... collected 6 items

backend\app\tests\test_purchase_bill_listing.py::test_list_all_tenant_bills PASSED [ 16%]
backend\app\tests\test_purchase_bill_listing.py::test_list_bills_by_supplier PASSED [ 33%]
backend\app\tests\test_purchase_bill_listing.py::test_list_bills_by_status PASSED [ 50%]
backend\app\tests\test_purchase_bill_listing.py::test_purchase_bill_response_schema PASSED [ 66%]
backend\app\tests\test_purchase_bill_listing.py::test_get_purchase_bill_by_id PASSED [ 83%]
backend\app\tests\test_purchase_bill_listing.py::test_get_purchase_bill_not_found PASSED [100%]

======================= 6 passed, 18 warnings in 54.98s =======================
```

### 8.2 TypeScript Type-Safety Verification
Command executed:
```bash
npx tsc --noEmit
```
Literal output:
```text
Exit Code: 0 (Zero errors)
```

---

## 9. Verification Results & Headless Visual Evidence

### 9.1 Headless Visual Evidence Capture
Executed via `scripts/capture_vendor_360_advance_knockoff_headless.py`:
```text
================================================================================
SMRITI RETAIL OS — VENDOR 360 ADVANCE PREPAYMENT & KNOCK-OFF EVIDENCE CAPTURE
================================================================================
[STEP 1] Navigating to Vendor 360 Payables & Advance Knockoff Studio...
[CAPTURE OK] Overview screenshot: vendor_360_payables_and_advances_overview.png
[STEP 2] Opening 1-Click Advance Knock-off Modal...
[CAPTURE OK] Knock-off modal screenshot: vendor_360_advance_knockoff_modal_active.png
[STEP 3] Executing Knock-off Voucher...
[CAPTURE OK] Post-settlement screenshot: vendor_360_advance_knockoff_settled.png
--------------------------------------------------------------------------------
ALL HEADLESS CAPTURES COMPLETED SUCCESSFULLY.
================================================================================
```

### 9.2 Visual Evidence Gallery

#### Figure 1: Vendor 360 Payables Overview & Available Advance Credit (Account 2050)
![Vendor 360 Payables Overview](file:///C:/Users/netma/.gemini/antigravity-ide/brain/aaff00e6-0df9-4455-9368-34989e066b42/vendor_360_payables_and_advances_overview.png)

#### Figure 2: 1-Click Advance Knock-off Modal with Double-Entry GL Preview (ADR-PROC-005)
![1-Click Advance Knock-off Modal](file:///C:/Users/netma/.gemini/antigravity-ide/brain/aaff00e6-0df9-4455-9368-34989e066b42/vendor_360_advance_knockoff_modal_active.png)

#### Figure 3: Post-Settlement State with Settled Bill and Decremented Advance Balance
![Post-Settlement State](file:///C:/Users/netma/.gemini/antigravity-ide/brain/aaff00e6-0df9-4455-9368-34989e066b42/vendor_360_advance_knockoff_settled.png)

---

## 10. Known Limitations
- Partial knock-offs leave the remainder in `unallocated_amount` on the advance payment and `unpaid_amount` on the bill; multi-bill batch knock-off in a single click will be introduced in Procurement Phase 2.7.

---

## 11. Future Work
- **Procurement Phase 2.7:** Multi-bill batch knock-off allocating a single advance across multiple open bills simultaneously using FIFO rules.
- **Procurement Phase 2.8:** Supplier Statement of Accounts PDF export including chronological advance disbursements and non-cash knock-off journal vouchers.

---

## 12. Related ADRs
- `ADR-PROC-001`: General Ledger Universal Posting Engine.
- `ADR-VEND-001`: Vendor 360 Universal Party System of Record.
- `ADR-PROC-005`: Supplier Advance Prepayments (Account 2050).

---

## 13. Related RFCs
- `RFC-PROC-2026-005`: General Ledger Supplier Advance Liabilities.
- `RFC-PROC-2026-006`: Vendor 360 Operational Prepayment Settlement.
