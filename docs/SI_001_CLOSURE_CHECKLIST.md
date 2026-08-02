# SI_001 Closure Checklist

## Status
Next major closure gate before RC2 freeze

## Scope
This phase is limited to closing the Sales Foundation path:

- AR Aging
- Customer Statement
- Financial Reconciliation
- Print Validation
- Dashboard Validation
- UAT

No unrelated Sales feature work is allowed in this phase.

---

## Canonical Flow

```
Invoice
    ↓
Journal
    ↓
AR
    ↓
Ledger
    ↓
Reports
    ↓
UAT
```

---

## Required Completion Items

### 1. AR Aging
- [ ] Aging calculation matches invoice and payment chronology
- [ ] Outstanding balances are consistent with ledger state
- [ ] Aging buckets are validated against real transactions
- [ ] Broken or stale invoice balances are identified and fixed

### 2. Customer Statement
- [ ] Opening balance, invoices, receipts, and final balance are consistent
- [ ] Statement output reflects canonical accounting state
- [ ] Customer-facing view matches ledger truth
- [ ] Statement print/export is validated

### 3. Financial Reconciliation
- [ ] Invoice totals reconcile to journal entries
- [ ] Receivable balances reconcile to ledger and AR totals
- [ ] Mismatches are identified with reason traces
- [ ] Reconciliation pass is documented and repeatable

### 4. Print Validation
- [ ] Invoice print output matches generated financial state
- [ ] Customer statement print output matches ledger state
- [ ] Approved templates and final rendering are verified
- [ ] Print layout regressions are blocked before release

### 5. Dashboard Validation
- [ ] Dashboard KPIs reflect the same sources as the ledger and AR engine
- [ ] Sales finance metrics are not computed in a separate inconsistent path
- [ ] Required key measures are validated with real transaction data

### 6. UAT
- [ ] UAT test cases cover invoice creation, journal, AR, statement, and reconciliation
- [ ] Test evidence is captured and signed off
- [ ] No unresolved critical issues remain
- [ ] Sales Foundation is frozen after UAT sign-off

---

## Exit Criteria

- [ ] Invoice → Journal → AR → Ledger path is consistent
- [ ] Reports are generated from canonical state
- [ ] Customer-facing financial outputs are validated
- [ ] UAT is complete and no critical issues remain
- [ ] Sales Foundation is ready for RC2 freeze

---

## Hard Blockers
Stop the closure flow if any of the following happen:

- Invoice totals do not reconcile to journal totals
- AR aging uses different source data from ledger
- Prints do not match the canonical financial state
- Dashboard and ledger differ on a critical metric
- UAT findings are not resolved before sign-off

---

## Sign-off
SI_001 may be closed only when all validation gates are green, all UAT issues are resolved, and the Sales Foundation can be frozen without further feature expansion.
