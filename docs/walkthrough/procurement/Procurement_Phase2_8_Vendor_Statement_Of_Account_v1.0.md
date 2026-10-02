<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.50.0
  Created      : 2026-10-02
  Modified     : 2026-10-02
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: SMRITI Procurement Phase 2.8 — Vendor Statement of Account (SOA) & Ledger Audit PDF/Excel Export

> **Document ID:** `WT-PROC-008`  
> **Version:** `1.0.0` (SSOT Release `v6.50.0`)  
> **Status:** `Completed & Verified`  
> **Area:** Procurement / Accounts Payable / Vendor Statement of Account (SOA)  
> **Related Implementation Plan:** [`Procurement_Phase2_8_Vendor_Statement_Of_Account_Plan_v1.0.md`](../../implementation/procurement/Procurement_Phase2_8_Vendor_Statement_Of_Account_Plan_v1.0.md)  

---

## 1. Purpose

The objective of **SMRITI Procurement Phase 2.8** is to deliver an authoritative, audit-compliant **Vendor Statement of Account (SOA)** and double-entry General Ledger reconciliation engine. Prior to Phase 2.8, accounts payable balances, purchase bills, supplier disbursements, and advance knock-offs were tracked across disparate sub-components without an aggregated, period-delimited chronological ledger trail. 

Phase 2.8 bridges this critical gap by computing prior opening balances, aggregating in-period debits and credits, computing real-time progressive running balances for Account 2010 (Accounts Payable), reconciling active prepayment liabilities from Account 2050 (Supplier Advance Liability), and rendering a printable A4 statement layout with 1-click CSV/Excel export.

---

## 2. Scope

1. **Backend General Ledger Audit Engine**:
   - `UnifiedAccountingLedgerService.get_vendor_statement_of_account()`: computes opening balance prior to `from_date`, in-period chronological journal transactions, and progressive running balance.
   - Computes active unallocated advance liability deposits (Account 2050) and net payable exposure (`max(0, closing_balance - unallocated_advance)`).
   - Multi-tenant isolated, resilient to legacy bills without posted GL vouchers by synthesizing journal lines from purchase bill records.
2. **Statement Schemas & DTOs**:
   - Pydantic models in `backend/app/schemas/vendor_statement.py`: `VendorStatementLine`, `VendorStatementSummary`, `VendorStatementSupplier`, `VendorStatementResponse`.
3. **REST API Surface**:
   - `GET /api/v1/purchase/vendors/{vendor_id}/statement` and `GET /api/v1/vendors/{vendor_id}/statement` supporting optional `from_date`, `to_date`, and `branch_id` query parameters.
4. **Vendor 360 Statement of Account Modal (React 18 + TypeScript)**:
   - `src/components/vendor/tabs/VendorStatementOfAccountModal.tsx` featuring period presets (Current FY, This Month, Last Month, Last 30 Days, Last 90 Days, All Time, Custom).
   - 7-Card Financial Health Summary Ribbon (Opening Balance, Billed (+), Paid (-), Knocked Off (-), Closing AP, Available Advances, Net Due).
   - Chronological general ledger audit trail table with document badges, monospace amounts, and period totals footer.
   - A4 Printable layout (`window.print()`) with `@media print` CSS classes and formal accounting certification signature block.
   - 1-Click Excel / CSV export.
5. **UI Integration**:
   - Mounted in `src/components/vendor/tabs/VendorPayablesTab.tsx` and `src/components/vendor/StandaloneVendorPayablesPreview.tsx`.
6. **Automated Testing & Visual Evidence**:
   - 4/4 pytest tests green in `backend/app/tests/test_vendor_statement_of_account.py`.
   - Programmatic headless Playwright visual evidence captures.

---

## 3. Files Created

| File Path | Description |
|---|---|
| `backend/app/schemas/vendor_statement.py` | Pydantic response models for vendor statement lines, summary, supplier info, and response. |
| `backend/app/tests/test_vendor_statement_of_account.py` | Comprehensive test suite verifying lifecycle SOA generation, date range opening balances, empty states, and tenant isolation. |
| `src/components/vendor/tabs/VendorStatementOfAccountModal.tsx` | Full-featured React 18 modal for interactive period filtering, A4 printing, and CSV export. |
| `scripts/capture_vendor_360_statement_of_account_headless.py` | Headless Playwright script for automated visual verification of the SOA modal and period switching. |
| `docs/implementation/procurement/Procurement_Phase2_8_Vendor_Statement_Of_Account_Plan_v1.0.md` | 19-section formal implementation plan for Phase 2.8. |
| `docs/walkthrough/procurement/Procurement_Phase2_8_Vendor_Statement_Of_Account_v1.0.md` | 13-section formal walkthrough for Phase 2.8. |

---

## 4. Files Modified

| File Path | Description of Changes |
|---|---|
| `backend/app/services/unified_ledger.py` | Implemented `get_vendor_statement_of_account()` computing opening balances, running AP balances, and unallocated advance balances. |
| `backend/app/api/v1/vendor.py` | Added `GET /{vendor_id}/statement` endpoint mapped to `VendorStatementResponse`. |
| `src/components/vendor/tabs/VendorPayablesTab.tsx` | Added "📄 Statement of Account" trigger button and mounted `VendorStatementOfAccountModal`. |
| `src/components/vendor/StandaloneVendorPayablesPreview.tsx` | Added "📄 Statement of Account" studio button and mounted `VendorStatementOfAccountModal`. |
| `src/config/version.ts` | Bumped SSOT version to `6.50.0`. |
| `package.json` | Bumped package version to `6.50.0`. |
| `CHANGELOG.md` | Added changelog section for `[6.50.0]`. |
| `docs/implementation/README.md` | Added Phase 2.8 implementation plan entry to master table. |
| `docs/walkthrough/README.md` | Added Phase 2.8 walkthrough entry to master table. |

---

## 5. Architecture Decisions

### AD-PROC-2.8.1: Dual Balance Calculation (AP vs. Advance Prepayment)
In double-entry retail accounting, Sundry Creditors (Account 2010) represents current purchase liabilities, whereas Supplier Advance Prepayments (Account 2050) represents prepayment deposits. Conflating these two ledgers into a single net balance obscures gross liability from statutory tax audit. Phase 2.8 maintains **Account 2010 AP Running Balance** in the transaction audit trail while displaying **Available Advance Prepayments (Account 2050)** as an offset to calculate **Net Due Position**.

### AD-PROC-2.8.2: Dynamic Opening Balance Derivation
Opening balances prior to `from_date` are dynamically computed as:
$$\text{Opening Balance} = \sum_{t < \text{from\_date}} \text{Credit}_{2010} - \sum_{t < \text{from\_date}} \text{Debit}_{2010}$$
This guarantees mathematical integrity across any arbitrary reporting window without requiring pre-aggregated period close tables.

### AD-PROC-2.8.3: Client & Print Separation
The modal is optimized for two distinct modes:
- **Interactive UI Mode**: Dark/light mode theme support, period presets, interactive date pickers, CSV export, and scrollable container.
- **A4 Statutory Print Mode**: Automatically triggers print styles (`@media print`), hides modal backdrops and toolbar buttons, expands tables to full printable page width, and renders prepared/acknowledged signature boxes.

---

## 6. Design Rationale

1. **Indian Financial Year Presets**: Retail businesses in India operate on the April 1 to March 31 financial year. The period selector defaults to "Current FY" with automatic leap-year and fiscal year calculation (`start = April 1`, `end = March 31`).
2. **Resilience to Legacy Bills**: For databases with historical bills created prior to automated GL postings, the engine synthesizes virtual credit lines from `PurchaseBill` records and virtual debit lines from `SupplierPayment` records, preventing blank statements for legacy tenants.
3. **Double-Entry Mathematical Invariant**:
   $$\text{Closing AP} = \text{Opening Bal} + \text{Total Billed} - (\text{Total Paid} + \text{Advances Knocked Off} + \text{Debit Notes})$$
   $$\text{Net Payable} = \max(0, \text{Closing AP} - \text{Unallocated Advances})$$

---

## 7. Implementation Summary

### Backend Service (`backend/app/services/unified_ledger.py`)
```python
@classmethod
async def get_vendor_statement_of_account(
    cls,
    session: AsyncSession,
    company_id: str,
    supplier_id: str,
    from_date: Optional[date] = None,
    to_date: Optional[date] = None,
    branch_id: Optional[str] = None,
) -> Dict[str, Any]:
    # 1. Fetch & validate supplier
    # 2. Compute opening balance before from_date
    # 3. Query in-period journal lines for Account 2010 (party_id = supplier_id)
    # 4. Synthesize from PurchaseBill and SupplierPayment if journal entries absent
    # 5. Compute progressive running balance
    # 6. Aggregate unallocated advance deposits from Account 2050
    # 7. Return complete statement response dictionary
```

### REST API (`backend/app/api/v1/vendor.py`)
```python
@router.get(
    "/{vendor_id}/statement",
    response_model=VendorStatementResponse,
    summary="Get Vendor Statement of Account (SOA) & Ledger Audit Trail",
)
async def get_vendor_statement(
    vendor_id: str,
    from_date: Optional[date] = Query(None),
    to_date: Optional[date] = Query(None),
    branch_id: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    tenant: TenantContext = Depends(get_current_tenant),
):
    ...
```

---

## 8. Tests Executed

### Backend Pytest Suite
Command executed:
```bash
.venv\Scripts\pytest.exe backend/app/tests/test_vendor_statement_of_account.py -v
```

Literal Terminal Output:
```
============================= test session starts =============================
platform win32 -- Python 3.11.9, pytest-8.2.1, pluggy-1.6.0 -- F:\SMRITRretailNX\.venv\Scripts\python.exe
cachedir: .pytest_cache
rootdir: F:\SMRITRretailNX\backend
configfile: pyproject.toml
plugins: anyio-4.15.1, asyncio-0.23.7, cov-5.0.0
asyncio: mode=Mode.AUTO
collecting ... collected 4 items

backend\app\tests\test_vendor_statement_of_account.py::test_vendor_statement_full_lifecycle PASSED [ 25%]
backend\app\tests\test_vendor_statement_of_account.py::test_vendor_statement_date_range_and_opening_balance PASSED [ 50%]
backend\app\tests\test_vendor_statement_of_account.py::test_vendor_statement_empty_vendor PASSED [ 75%]
backend\app\tests\test_vendor_statement_of_account.py::test_vendor_statement_tenant_isolation PASSED [100%]

======================= 4 passed, 18 warnings in 47.57s =======================
```

### TypeScript Compilation Check
Command executed:
```bash
npx tsc --noEmit
```

Literal Terminal Output:
```
Exit Code: 0 (Clean, 0 errors)
```

---

## 9. Verification Results

### Visual Verification Artifacts
Programmatic headless Playwright Chromium captures were executed and saved to the documentation evidence directory:

| Screenshot | Path | Description |
|---|---|---|
| Statement of Account Modal | `docs/walkthrough/procurement/evidence/vendor_360_statement_of_account_modal.png` | Complete A4 statement layout with financial ribbon, Current FY period, and GL audit trail table. |
| Filtered Statement View | `docs/walkthrough/procurement/evidence/vendor_360_statement_of_account_filtered.png` | Filtered statement view under "This Month" preset with dynamic opening balance computation. |
| Studio Overview | `docs/walkthrough/procurement/evidence/vendor_360_statement_of_account_overview.png` | Studio view after closing the modal. |

---

## 10. Known Limitations

- **Browser Print Dialog**: `window.print()` triggers the client browser's native print / PDF dialog. For headless server-side PDF generation, a dedicated headless rendering service or WeasyPrint integration can be added in a future enhancement.
- **Foreign Currency**: Currently, currency amounts are presented in INR (₹). Multi-currency transactions will be addressed in future internationalization phases.

---

## 11. Future Work

- **Scheduled Monthly Vendor SOA Dispatch**: Automated monthly email dispatch of PDF statements to vendor primary accounting contacts.
- **Vendor Portal Direct Confirmation**: Interactive vendor acceptance / discrepancy flagging directly via the SMRITI Vendor Self-Service Portal.

---

## 12. Related ADRs

- **ADR-VEND-01**: Canonical Vendor Master & Tab Architecture.
- **ADR-ACC-004**: Double-Entry Chart of Accounts & Subledger Mapping.
- **ADR-PROC-007**: Supplier Advance Liability & Knock-Off Compound Vouchers.

---

## 13. Related RFCs

- **RFC-PROC-2026-08**: Authoritative Vendor Statement of Account & Audit Trail Specification.
