<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.16.0
  Created      : 2026-08-23
  Modified     : 2026-08-23
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: Authoritative Double-Entry General Ledger Engine (Slice 8)

## 1. Purpose
Establish the canonical **Authoritative Double-Entry General Ledger Engine** for SMRITI Retail OS, providing strict balance invariants ($\sum \text{Debits} = \sum \text{Credits}$), hierarchical Chart of Accounts (COA), automated document accounting integration (Sales Invoices, Purchases, Payment Settlements), Trial Balance & Financial Statement aggregations, and canonical Outbox event streaming (`GL_VOUCHER_POSTED`).

---

## 2. Scope
- Hierarchical Chart of Accounts schema (`accounts`) supporting 5 root accounting heads (Assets, Liabilities, Equity, Revenue, Expense) and standard Indian retail ledgers (CGST, SGST, IGST, Debtors, Creditors, Cash, Bank, Inventory, COGS, Roundoff).
- Immutable Journal Voucher headers (`journal_vouchers`) and general ledger entries (`general_ledger_entries`).
- Periodic account balance snapshotting table (`account_balance_snapshots`).
- Domain service `UnifiedAccountingLedgerService` with automated voucher balancing, validation errors (`SMRITI-GL-001`), Trial Balance reporting, and Net Profit calculations.
- Alembic database migration `v1343_accounting_gl` applied across tenant databases (`smriti001`, `smriti002`).
- 8 comprehensive automated unit and integration tests.

---

## 3. Files Created
- `backend/app/models/accounting.py`: Canonical SQLAlchemy models for `Account`, `JournalVoucher`, `GeneralLedgerEntry`, and `AccountBalanceSnapshot`.
- `backend/alembic/versions/v1343_accounting_gl.py`: Forward-only database migration creating accounting tables and indexes.
- `backend/app/services/unified_accounting_ledger_service.py`: Core double-entry domain logic, COA seeding, automated document posting, and financial statements.
- `backend/tests/test_unified_accounting_ledger.py`: Comprehensive test suite verifying all 8 balance invariants, document postings, and tenant isolation.

---

## 4. Files Modified
- `backend/app/models/__init__.py`: Exported canonical accounting models.
- `backend/app/models/purchase.py`: Added `items` relationship to `PurchaseReceipt`.
- `backend/alembic/env.py`: Added automatic `sys.path` insertion for standalone CLI runner.

---

## 5. Architecture Decisions
- **Strict Invariant Enforcement**: No journal voucher can be committed unless total debits equal total credits within a tolerance of ₹0.001. Unbalanced entries are rejected synchronously with HTTP 400 (`SMRITI-GL-001`).
- **Idempotent COA Seeding**: Company tenant databases automatically initialize a standard Indian Retail Chart of Accounts on first transaction without manual administrative overhead.
- **Tenant Isolation**: All GL entries and vouchers are scoped to `company_id` and stored exclusively in the tenant PostgreSQL database.
- **Outbox Integration**: Every posted journal voucher atomically emits a `GL_VOUCHER_POSTED` event to the `ACCOUNTING_STREAM` target channel.

---

## 6. Design Rationale
- Embedding double-entry logic directly at the transactional persistence layer prevents reconciliation drift between operational inventory/sales events and financial reporting.
- Splitting the General Ledger into immutable header and entry lines guarantees auditability and compliance with statutory Indian accounting standards (GST / MCA).

---

## 7. Implementation Summary
- `seed_default_chart_of_accounts`: Creates 18 standard root and leaf ledgers across 5 classifications.
- `post_journal_voucher`: Validates non-negative amounts, ensures debit == credit, creates GL entries, and stages outbox events.
- `post_sales_invoice_to_gl`: Automatically debits Debtors and credits Sales Revenue, Output CGST, SGST, IGST, and Roundoff.
- `post_purchase_receipt_to_gl`: Automatically debits Inventory Asset & Input GST and credits Accounts Payable.
- `get_trial_balance`: Real-time aggregated trial balance verifying `is_balanced == True`.
- `get_profit_and_loss`: Real-time operating statement computing `Revenue - Expenses = Net Profit`.

---

## 8. Tests Executed
```powershell
python -m pytest tests/test_unified_accounting_ledger.py -v
```

---

## 9. Verification Results
- 8/8 tests passed in `test_unified_accounting_ledger.py` in 5.20s.
- Verified idempotent chart of accounts seeding.
- Verified manual journal voucher posting and balance invariant.
- Verified rejection of unbalanced vouchers (`SMRITI-GL-001`).
- Verified multi-line sales invoice automated double-entry GL posting with GST and roundoff.
- Verified purchase receipt automated GL posting.
- Verified trial balance debit/credit balance equality.
- Verified real-time profit & loss statement calculation.
- Verified multi-tenant database isolation between `smriti001` and `smriti002`.

---

## 10. Known Limitations
- Multi-currency transactions currently default to `INR` and will require exchange rate conversion tables in international multi-currency milestones.

---

## 11. Future Work
- Bank reconciliation statement (BRS) auto-matching against MT940 / CSV statements.
- Cost-center and departmental sub-ledger allocation tags.

---

## 12. Related ADRs
- `ADR-0016`: PostgreSQL Multi-Tenant Database Isolation and Sole Backend Architecture.
- `ADR-0021`: Canonical Double-Entry General Ledger and Transactional Event Outbox.

---

## 13. Related RFCs
- `RFC-2026-08-GL`: Architecture for Double-Entry Financial Engine in Retail ERP.
