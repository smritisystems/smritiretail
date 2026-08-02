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

## 1. The Three-Layer Accounting Kernel Architecture

```text
================================================================================
LAYER 3: FINANCIAL DECISIONS & CONTROL (PLATFORM ENGINE)
  • Fiscal Period Open/Locked Check         • Credit Limit Evaluation Gate
  • Payment Allocation & Settlement Engine  • Posting Validation Rules
================================================================================
                                       │
                                       ▼
================================================================================
LAYER 2: ACCOUNTING STATE (DERIVED FINANCIAL FACTS)
  • General Ledger Account Balances         • Customer AR Outstanding Balances
  • Supplier AP Outstanding Balances        • GST Tax Liability & Cost Centers
================================================================================
                                       │
                                       ▼
================================================================================
LAYER 1: FINANCIAL LEDGER (IMMUTABLE JOURNAL STREAM)
  • Journal Entries & Vouchers              • Reversal & Canceling Vouchers
================================================================================
```

---

## 2. The Eight Immutable Accounting Constitutional Principles

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
Consumer modules interact with the Accounting Kernel exclusively through 4 published platform interfaces:
`AccountingQueryFacade`, `AccountingCommandFacade`, `AccountingPostingService`, `AccountingValidationService`. Internal ledger schema details are completely decoupled from consumers.

### Principle 8: Extension Through Financial Registries
Custom Chart of Accounts structures, tax posting profiles, financial dimensions (cost centers, departments, branches), and currency conversion rules extend exclusively by registering metadata into platform accounting registries, never by altering core kernel posting logic.

---

## 3. Four Public Accounting Facades

```text
                               BUSINESS CONSUMER DOMAINS
                      (Sales, Purchase, POS, WMS, Marketplace)
                                          │
        ┌───────────────────┬─────────────┴─────────────┬───────────────────┐
        │                   │                           │                   │
        ▼                   ▼                           ▼                   ▼
AccountingQueryFacade AccountingCommandFacade AccountingPostingService AccountingValidationService
• get_account_balance • post_sales_invoice    • execute_posting_profile • validate_double_entry
• get_trial_balance   • post_purchase_grn     • resolve_tax_accounts   • validate_fiscal_period
• get_general_ledger  • post_pos_settlement   • apply_rounding         • validate_credit_limit
        │                   │                           │                   │
        └───────────────────┴─────────────┬─────────────┴───────────────────┘
                                          │
                                          ▼
                               ACCOUNTING KERNEL v1.0
                         (Double-Entry Engine & GL Ledger)
```

---

## 4. Accounting Kernel Certification Gates (AC001..AC008)

1. **AC001 Double Entry Validation**: Rejects any voucher where $\sum \text{Debits} \neq \sum \text{Credits}$.
2. **AC002 Journal Posting Facade**: Verifies 100% of consumer postings execute via `AccountingCommandFacade`.
3. **AC003 No Direct Journal Writes**: AST/Linter boundary guards blocking raw GL table edits.
4. **AC004 Replay Determinism**: Replays journal stream and verifies Trial Balance equilibrium ($\text{Total Debits} = \text{Total Credits}$).
5. **AC005 Financial Period Control**: Prevents posting vouchers into closed or locked financial periods.
6. **AC006 Reversal Instead of Edit**: Enforces immutability of posted vouchers and validates reversal workflows.
7. **AC007 Financial Dimension Support**: Validates cost centers, departments, and branch dimensions.
8. **AC008 Security & Audit Trail**: Verifies immutable audit metadata (`created_by`, `timestamp`, `source_doc_id`) on all journal entries.
