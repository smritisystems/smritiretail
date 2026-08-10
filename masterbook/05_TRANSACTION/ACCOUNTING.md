<!--
  SMRITI Retail OS — Masterbook
  Document  : 05_TRANSACTION/ACCOUNTING.md
  Status    : FROZEN
  Version   : 1.0.0  |  Created: 2026-08-10
-->

# Accounting Architecture

---

## Double-Entry Ledger

SMRITI uses a standard double-entry accounting system:
- Every financial transaction generates at least 2 journal entry lines
- Debits = Credits (balanced entries)
- Journal entries are immutable once posted

---

## Chart of Accounts Structure

```
Assets
  ├── Current Assets
  │   ├── Cash
  │   ├── Bank Accounts
  │   ├── Accounts Receivable (Debtors)
  │   └── Inventory
  └── Fixed Assets

Liabilities
  ├── Current Liabilities
  │   ├── Accounts Payable (Creditors)
  │   ├── GST Payable (CGST / SGST / IGST)
  │   └── TDS Payable
  └── Long-Term Liabilities

Equity
  └── Owner's Capital / Retained Earnings

Income
  └── Sales Revenue / Other Income

Expenses
  └── Purchase / Operating Expenses
```

---

## GST Accounting

| Tax Component | Account |
|---|---|
| CGST Collected (on sales) | CGST Payable (Liability) |
| SGST Collected (on sales) | SGST Payable (Liability) |
| IGST Collected (inter-state) | IGST Payable (Liability) |
| CGST Input Credit (on purchases) | CGST Input Credit (Asset) |
| SGST Input Credit | SGST Input Credit (Asset) |
| IGST Input Credit | IGST Input Credit (Asset) |

---

## Journal Entry Pattern (Sales Invoice)

```
Sales Invoice Posted — ₹10,000 + 18% GST (CGST 9% + SGST 9%):

DR  Accounts Receivable     ₹11,800
    CR  Sales Revenue               ₹10,000
    CR  CGST Payable                   ₹900
    CR  SGST Payable                   ₹900
```

---

## Company Isolation in Accounting

Every journal entry row carries `company_id`. Financial reports, P&L, Balance Sheet are always company-scoped. Cross-company consolidation is handled via the Consolidated Reporting engine (see `07_CONSOLIDATION/`).

---

*Status: FROZEN | Version: 1.0.0 | 2026-08-10*
