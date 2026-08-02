# Inventory Hardening Checklist

## Status
RC2 Active

## Scope Freeze
This is the only inventory work allowed during RC2:

- Multi-warehouse validation
- Consignment validation
- Negative stock validation
- Concurrent reservation validation
- Performance benchmark
- SI_001 integration validation

No new inventory features are allowed during this phase.

---

## Canonical Ownership Rule

```
Workspace
    ↓
Business Service
    ↓
Canonical Engine
    ↓
Repository
    ↓
Database
```

All inventory quantity logic must originate from the canonical state engine. No duplicate stock math is allowed across screens or services.

---

## Required Validation Gates

### 1. Multi-warehouse validation
- [ ] Stock state is calculated correctly per warehouse
- [ ] Transfer logic does not double-count stock
- [ ] Available quantity is computed from canonical state only
- [ ] Cross-warehouse reservations are isolated
- [ ] Inventory API responses remain consistent across warehouses

### 2. Consignment validation
- [ ] Consignment in and out flows are separated from normal on-hand stock
- [ ] Consignment reservations do not affect standard available stock incorrectly
- [ ] Ledger metadata remains traceable
- [ ] All movement types show correct source and reference data

### 3. Negative stock validation
- [ ] Negative stock paths are explicitly understood and validated
- [ ] No unguarded decrement can bypass engine checks
- [ ] Business rules for overdraw and blocked stock are enforced by the canonical engine
- [ ] Error conditions surface clear reasons and safe remediation

### 4. Concurrent reservation validation
- [ ] Two simultaneous reservations cannot oversubscribe stock
- [ ] Reservation checks respect canonical available stock at the moment of request
- [ ] Race conditions are prevented or safely rejected
- [ ] Reservation result remains deterministic under parallel requests

### 5. Performance benchmark
Target thresholds:

- [ ] State engine < 20 ms
- [ ] Availability check < 10 ms
- [ ] Reservation check < 20 ms
- [ ] No expensive repeated queries across the engine path
- [ ] Timeline and trace calls remain efficient under realistic dataset load

### 6. SI_001 integration validation
- [ ] SI_001 does not calculate inventory independently
- [ ] All inventory reads use canonical state engine
- [ ] Invoice and journal workflows do not duplicate stock logic
- [ ] Reconciliation remains consistent with ledger and engine output

---

## Exit Criteria

- [ ] All inventory tests green
- [ ] Performance target achieved
- [ ] No duplicate inventory calculations anywhere
- [ ] All consumers use the canonical State Engine
- [ ] Inventory kernel is stable and ready for RC2 freeze

---

## Hard Blockers
Stop immediately if any of the following appear:

- Duplicate stock logic in a new service
- Inventory quantity computed outside the engine
- UI calculating a stock value independently
- Reservation path bypassing available state
- New feature work under the inventory name without approval

---

## Sign-off
Inventory hardening may proceed to RC2 freeze only after all boxes above are checked and verified by tests and performance evidence.
