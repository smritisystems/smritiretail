# SMRITI Platform — Accounting Kernel Constitution v1.0.0

**Status:** FROZEN — Level 1 Accounting Kernel Constitution v1.0.0  
**Effective Date:** 2026-08-03  
**Organization:** SmritiSys / SMRITI Books  
**Chief Systems Architect:** Jawahar Ramkripal Mallah  

---

## Preamble

The **Accounting Kernel** is the foundational financial ledger platform engine of SMRITI Retail OS. It serves as the immutable financial source of truth for all business domains across the enterprise platform.

No business domain module (Sales, Purchase, POS, WMS, Marketplace, Consignment, Inventory) may bypass double-entry balance validation, post unbalanced journal entries, or directly mutate general ledger tables (`journal_entries`, `gl_vouchers`, `ledger_accounts`).

---

## 1. The Eight Immutable Accounting Constitutional Principles

### Principle 1: Ledger First (Financial Source of Truth)
The General Ledger is the single, authoritative financial source of truth for all monetary transactions in SMRITI Retail OS. Operational transactions (sales invoices, purchase receipts, payment collections) derive their financial validity exclusively from posted journal entries.

### Principle 2: Double Entry Always (Mandatory Balance Integrity)
Every financial voucher MUST satisfy the double-entry equation:
$$\sum \text{Debits} = \sum \text{Credits}$$
Unbalanced journal vouchers or asymmetrical entries are strictly rejected at the database transaction boundary and cannot be persisted under any circumstances.

### Principle 3: No Direct Journal Mutations
Database tables representing financial ledger state (`journal_entries`, `gl_vouchers`, `ledger_accounts`, `account_balances`) MUST NOT be directly mutated via SQL `UPDATE` or `DELETE` statements or direct ORM entity assignments. All ledger entries execute through published facade commands.

### Principle 4: Business Modules Never Post Journals Directly
Consumer business domains (Sales, Purchase, POS, WMS, Marketplace, Consignment) MUST NOT construct procedural SQL journal entries. All financial postings MUST execute exclusively through `AccountingCommandFacade.post_voucher()`.

### Principle 5: Deterministic Ledger Replay
Financial account balances, Trial Balance reports, and General Ledger states MUST be 100% deterministically reproducible by replaying the sequence of committed journal vouchers from opening balance to the target timestamp.

### Principle 6: Immutable Posted Journal Vouchers
Committed/posted journal vouchers are strictly immutable. They MUST NOT be edited, overwritten, or deleted. Corrections, cancellations, and adjustments execute exclusively by issuing reversing vouchers (`REVERSAL_VOUCHER`).

### Principle 7: Public Accounting Facade Isolation
Consumer modules interact with the Accounting Kernel exclusively through published Query and Command Facades (`AccountingQueryFacade`, `AccountingCommandFacade`, `VoucherPostingService`, `FinancialPeriodService`). Internal ledger schema details are completely decoupled from consumers.

### Principle 8: Extension Through Financial Registries
Custom Chart of Accounts structures, tax posting profiles, financial dimensions (cost centers, departments, branches), and currency conversion rules extend exclusively by registering metadata into platform accounting registries, never by altering core kernel posting logic.

---

## 2. Public Accounting Facades

```text
                               BUSINESS CONSUMER DOMAINS
                      (Sales, Purchase, POS, WMS, Marketplace)
                                          │
                  ┌───────────────────────┴───────────────────────┐
                  │                                               │
                  ▼                                               ▼
       AccountingQueryFacade                           AccountingCommandFacade
  • get_account_balance()                         • post_sales_invoice_voucher()
  • get_trial_balance()                           • post_purchase_grn_voucher()
  • get_general_ledger()                          • post_pos_settlement_voucher()
  • get_financial_statements()                    • post_journal_voucher()
                  │                                               │
                  └───────────────────────┬───────────────────────┘
                                          │
                                          ▼
                               ACCOUNTING KERNEL v1.0
                         (Double-Entry Engine & GL Ledger)
```

---

## 3. Accounting Kernel Certification Gates (AC001..AC008)

1. **AC001 Double Entry Gate**: Rejects any voucher where $\sum \text{Debits} \neq \sum \text{Credits}$.
2. **AC002 Facade Posting Gate**: Verifies 100% of consumer postings execute via `AccountingCommandFacade`.
3. **AC003 Zero Direct Mutation Guard**: Blocks direct SQL updates or ORM mutations to GL ledger tables.
4. **AC004 Reversal Immutability Gate**: Enforces immutability of posted vouchers and validates reversal workflows.
5. **AC005 Trial Balance Determinism Gate**: Replays journal stream and verifies Trial Balance equilibrium ($\text{Total Debits} = \text{Total Credits}$).
6. **AC006 Fiscal Period Gate**: Prevents posting vouchers into closed or locked financial periods.
7. **AC007 Multi-Currency Gate**: Validates exchange rate gain/loss postings for multi-currency transactions.
8. **AC008 Audit Trail Gate**: Verifies immutable audit metadata (`created_by`, `timestamp`, `source_doc_id`) on all journal entries.
