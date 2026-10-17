<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.50.0
  Created      : 2026-10-03
  Modified     : 2026-10-03
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Implementation Plan: Procurement Phase 2.8 — Vendor Statement of Account & Ledger Audit PDF/Excel Export

**Plan ID:** `IP-PROC-008`  
**Area:** `procurement`  
**Status:** `Completed`  
**Version:** `1.0.0`  
**Target Release:** `v6.50.0`  
**Related ADRs:** `ADR-VEND-01`, `ADR-PROC-001`, `ADR-FIN-003`  
**Related Walkthroughs:** `WT-PROC-008`, `WT-PROC-007`, `WT-PROC-006`, `WT-PROC-005`  

---

## 1. Objective
Establish an authoritative, audit-ready **Vendor Statement of Account (SOA)** and **Ledger Audit Export Engine** within SMRITI Retail OS. Enable finance controllers, accounts payable accountants, and procurement executives to generate, inspect, print (A4 PDF), and export (Excel/CSV) comprehensive chronological subledger statements for any supplier across arbitrary or statutory date ranges (Financial Year, Month, Custom) with exact running balance tracking and unallocated advance reconciliation.

---

## 2. Business Motivation
In enterprise wholesale, retail distribution, and footwear/apparel supply chains:
1. **Periodic Supplier Balance Confirmations:** Suppliers and auditors require periodic balance confirmations and ledgers matching invoices, returns, advance deposits, and disbursements.
2. **Reconciliation of Non-Cash Knock-Offs:** Prepayment advance knock-offs (Phase 2.5–2.7) adjust Accounts Payable without cash outflow. A standard bill list alone fails to show how advances offset liability; a double-entry statement of account provides full transparent visibility into running balances.
3. **Dispute Resolution & Audit Readiness:** Indian Companies Act and statutory GST audits require immutable chronological ledger transcripts showing document references, debit/credit entries, and closing net positions.

---

## 3. Scope
- **In Scope:**
  - Backend `UnifiedAccountingLedgerService.get_vendor_statement_of_account()` querying `GeneralLedgerEntry`, `JournalVoucher`, `PurchaseBill`, and `SupplierPayment`.
  - Computation of Opening Balance prior to `from_date` for Account 2010 (Accounts Payable) and Account 2050 (Supplier Advance Liability).
  - Chronological transaction sequence with running balance calculation:
    - Credit increases liability (Purchase Bills).
    - Debit decreases liability (Payments, Advance Knock-Offs, Debit Notes).
  - Summary KPI cards: Opening Balance, Total Invoiced, Total Settled, Closing AP Balance, Unallocated Advance Prepayments, Net Payable Position.
  - REST API endpoint: `GET /api/v1/purchase/vendors/{vendor_id}/statement`.
  - React 18 UI: `VendorStatementOfAccountModal.tsx` mounted in `VendorPayablesTab.tsx`.
  - Date Range Filtering: Current Financial Year, This Month, Last 30 Days, Last 90 Days, All Time, Custom Date Range.
  - Export capabilities:
    - A4 Printable Audit Statement (`window.print()` with clean print media stylesheet, letterhead, vendor details, and signatory blocks).
    - CSV / Excel Export with complete transaction columns.
  - Standalone preview support in `StandaloneVendorPayablesPreview.tsx`.
  - Automated Pytest battery verifying ledger balance logic, date filtering, and multi-tenant isolation.
  - Headless Playwright visual evidence capture.
  - SSOT Version bump to `v6.50.0`.
- **Out of Scope:**
  - Direct email dispatch of PDF statements via SMTP (reserved for Phase 3 automated dunning).
  - Multi-currency cross-border foreign currency gain/loss statement revaluation (reserved for international trade module).

---

## 4. Current State
- Phase 2.2 integrated Purchase Bills to GL (DR 1040, CR 2010).
- Phase 2.3 integrated Supplier Payments to GL (DR 2010, CR 1010/1020).
- Phase 2.4 integrated Debit Notes to GL (DR 2010, CR 1040 / GST).
- Phase 2.5 integrated Supplier Advance Disbursements (DR 2050, CR 1010/1020) and 1-to-1 knock-offs.
- Phase 2.6 integrated advance monitoring and bill knock-off modals into `VendorPayablesTab.tsx`.
- Phase 2.7 added Multi-Bill Batch Advance Knock-Off and FIFO allocation.
- **Gap:** There is no dedicated Statement of Account or printable ledger transcript view compiling all these transactions chronologically with running balances.

---

## 5. Gap Analysis
| Capability | Current State | Target State (Phase 2.8) |
|---|---|---|
| Vendor Statement Endpoint | None | `GET /api/v1/purchase/vendors/{vendor_id}/statement` |
| Subledger Running Balance | Calculated on ad-hoc tables | Authoritative mathematical running balance from GL |
| Opening Balance Engine | Not available | Calculated for arbitrary date ranges from prior GL entries |
| A4 Printable SOA | None | Pixel-faithful statutory A4 printable modal |
| Excel / CSV Export | None | 1-click formatted CSV export with header metadata |

---

## 6. Architecture Impact
```text
React 18 VendorPayablesTab.tsx
  │
  ├── [📄 Statement of Account] Action Button
  │     ▼
  └── VendorStatementOfAccountModal.tsx
        ├── Period Filter (FY / Month / Custom)
        ├── Summary Ribbon Cards (Opening, Invoiced, Paid, Closing, Advance, Net)
        ├── Chronological Ledger Table (Date, Ref, Particulars, Type, Dr, Cr, Balance)
        ├── 🖨️ A4 Print Layout (Statutory Header, Tables, Signatures)
        └── 📥 CSV / Excel Export Engine
              │
              ▼ GET /api/v1/purchase/vendors/{id}/statement?from_date=...&to_date=...
FastAPI Backend (purchase.py)
  │
  ▼
UnifiedAccountingLedgerService.get_vendor_statement_of_account()
  │
  ├── Query prior GeneralLedgerEntry (Account 2010 / 2050) -> Opening Balance
  ├── Query in-period GeneralLedgerEntry + JournalVoucher
  ├── Fallback union with PurchaseBill & SupplierPayment for unposted legacy
  └── Compute Running Balance & Net Position
        │
        ▼
PostgreSQL Database (general_ledger_entries, journal_vouchers, purchase_bills, supplier_payments)
```

---

## 7. Proposed Design
1. **Mathematical Invariant for Subledger AP Balance:**
   $$\text{Running Balance}_t = \text{Running Balance}_{t-1} + \text{Credit}_t - \text{Debit}_t$$
   Where:
   - $\text{Credit}_t$: Invoices / Purchase Bills (increases amount owed).
   - $\text{Debit}_t$: Payments, Advance Knock-Offs, Debit Notes (reduces amount owed).
2. **Net Payable Position:**
   $$\text{Net Due} = \max(0, \text{Closing AP Balance} - \text{Available Advance Credit})$$

---

## 8. Files Created
1. `backend/app/schemas/vendor_statement.py`
2. `src/components/vendor/tabs/VendorStatementOfAccountModal.tsx`
3. `backend/app/tests/test_vendor_statement_of_account.py`
4. `scripts/capture_vendor_360_statement_of_account_headless.py`
5. `docs/implementation/procurement/Procurement_Phase2_8_Vendor_Statement_Of_Account_Plan_v1.0.md`
6. `docs/walkthrough/procurement/Procurement_Phase2_8_Vendor_Statement_Of_Account_v1.0.md`

---

## 9. Files Modified
1. `backend/app/services/unified_ledger.py`
2. `backend/app/api/v1/purchase.py`
3. `src/components/vendor/tabs/VendorPayablesTab.tsx`
4. `src/components/vendor/StandaloneVendorPayablesPreview.tsx`
5. `package.json`
6. `src/config/version.ts`
7. `CHANGELOG.md`
8. `docs/implementation/README.md`
9. `docs/walkthrough/README.md`

---

## 10. Dependencies
- FastAPI 0.110+
- SQLAlchemy 2.0 AsyncSession
- Pydantic v2
- React 18 / Lucide React
- Playwright Chromium for headless visual telemetry

---

## 11. Risks
- **Risk:** Vendors with zero historical transactions return 500.
  - *Mitigation:* Explicit null-guarding returning zero opening balance and empty rows.
- **Risk:** Print media styles clipping long ledger tables across pages.
  - *Mitigation:* CSS `page-break-inside: avoid` on table rows and `@media print` layout normalization.

---

## 12. Rollback Strategy
- Non-destructive addition; zero schema migrations. Reverting git commit restores previous v6.49.9 state cleanly.

---

## 13. Verification Plan
- Unit & integration tests via pytest covering:
  - Statement generation with bills, payments, advances, and knock-offs.
  - Date filtering and opening balance computation.
  - Multi-tenant data segregation.
- TypeScript compiler zero-error assertion (`npx tsc --noEmit`).
- Programmatic headless Playwright visual telemetry.

---

## 14. Test Plan
- `test_vendor_statement_full_lifecycle`
- `test_vendor_statement_date_range_and_opening_balance`
- `test_vendor_statement_empty_vendor`
- `test_vendor_statement_tenant_isolation`

---

## 15. Documentation Impact
- Update `docs/implementation/README.md` (add `IP-PROC-008`).
- Update `docs/walkthrough/README.md` (add `WT-PROC-008`).
- Update `CHANGELOG.md` under `v6.50.0`.

---

## 16. Deployment Plan
- Atomic git commit to `smritiNX` branch and push to `origin/smritiNX`.
- Vite asset rebuild verification.

---

## 17. Status
`Completed`

---

## 18. Related ADRs
- `ADR-VEND-01`: Universal Party Master & Vendor 360 Architecture
- `ADR-PROC-001`: Universal Document Lifecycle & Procurement Integration
- `ADR-FIN-003`: Double-Entry General Ledger Subledger Integration

---

## 19. Related Walkthroughs
- `WT-PROC-008`: Procurement Phase 2.8 — Vendor Statement of Account & Ledger Audit PDF/Excel Export
- `WT-PROC-007`: Procurement Phase 2.7 — Multi-Bill Batch Advance Knock-Off & FIFO Allocation Engine
- `WT-PROC-006`: Procurement Phase 2.6 — Vendor 360 Supplier Advance Prepayment & Bill Knock-off UI Integration
