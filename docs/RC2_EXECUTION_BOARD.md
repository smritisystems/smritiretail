<!--
Author & Creator:
Jawahar Ramkripal Mallah

Founder:
SmritiSys
AITDL Networks

Role:
Chief Systems Architect

Web:
smritisys.com | smritibooks.com | aitdl.com

Email:
jawahar.mallah@gmail.com

Copyright © 2026 SmritiSys.
All Rights Reserved.
-->

# RC2 Execution Board

## Goal
Finish the platform core before expanding the product surface.

This board is intentionally narrow. No new feature streams are allowed during RC2 unless they are required to close a blocking issue in Inventory or SI_001.

---

## No-New-Feature Guardrail

The following are not allowed during RC2:

- New inventory feature work beyond hardening the frozen kernel
- New Sales features outside SI_001 closure work
- Inventory 360 workspace work
- Decision Engine work
- Mobile/Desktop UX builds
- Advanced analytics or dashboard expansion beyond release validation

Allowed during RC2:

- Bug fixes
- Hardening and validation
- Performance tuning
- Documentation
- Release validation

---

## Phase A — Inventory Kernel Hardening (Current)
Status: Active

### Scope
Complete only the following items:

- [ ] Multi-warehouse validation
- [ ] Consignment validation
- [ ] Negative stock validation
- [ ] Concurrent reservation validation
- [ ] Performance benchmark
- [ ] SI_001 integration validation

### Exit Criteria

- [ ] All inventory tests green
- [ ] Performance targets achieved
- [ ] No duplicate inventory calculations anywhere
- [ ] All consumers use the canonical State Engine
- [ ] Inventory APIs are stable and aligned to engine ownership

### Canonical Rule

```
Inventory Domain
    ↓
services/inventory
    ↓
Canonical Engine
    ↓
Repository
    ↓
Database
```

Not:

```
Workspace
    ↓
Random Service
    ↓
Database
```

---

## Phase B — SI_001 Close
Status: Next

### Scope

- [ ] AR Aging
- [ ] Customer Statement
- [ ] Financial Reconciliation
- [ ] Print Validation
- [ ] Dashboard Validation
- [ ] UAT

### Exit Criteria

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

After this, Sales Foundation is frozen.

---

## Phase C — SDK Stabilization
Status: After Inventory + Sales are frozen

### Target Domain Structure

```
backend/app/services/
    inventory/
    sales/
    purchase/
    accounting/
```

Each domain should expose a clean public surface through its package, for example:

```python
from app.services.inventory import (
    StateEngine,
    AvailabilityEngine,
    ReservationEngine,
    TraceEngine,
    TimelineEngine,
)
```

### Rule
The SDK should not expose legacy compatibility modules as the preferred API.

---

## Phase D — RC2 Freeze
Status: Final gate before RC3

### Allowed during RC2

- Bug fixes
- Performance improvements
- Documentation
- Release validation

### Disallowed during RC2

- New feature streams
- New business modules outside the frozen scope
- Expansion into UI/UX workstreams not required for release readiness

---

## Architecture Rule (Freeze)
This should be the standard for every domain, not just Inventory.

```
Workspace
    │
    ▼
Business Service
    │
    ▼
Canonical Engine
    │
    ▼
Repository
    │
    ▼
Database
```

This pattern should later apply to:

- Inventory
- Sales
- Purchase
- CRM
- Accounting
- POS

---

## Legacy Compatibility Migration Rule

### RC2
Legacy modules may remain only as re-export wrappers, for example:

```
inventory_state.py
    ↓
re-export only
```

### RC3
Remove legacy modules once all imports are migrated to:

```
app.services.inventory
```

This avoids carrying technical debt forward while keeping RC2 stable.

---

## Platform Snapshot

- Inventory Kernel: 🟢 ~95%
- Sales Foundation (SI_001): 🟡 ~94%
- Purchase Foundation: 🟡 Ready for namespace cleanup after SI_001
- SDK Structure: 🟡 ~85%
- Mobile/Desktop UX: 🔵 Planned for RC3
- Inventory 360 Workspace: 🔒 Deferred until after RC2

---

## Recommended Execution Order

1. Finish Inventory Kernel hardening
2. Complete SI_001
3. Stabilize SDK namespaces
4. Freeze RC2
5. Start RC3 with:
   - Mobile/Desktop UX (SAP Fiori-inspired)
   - Inventory 360 Workspace
   - Decision Engine
   - Advanced analytics

---

## Final Decision
The product should follow the "Finish Before Expand" principle until RC2 closes.

The current objective is not to add more capability; it is to stabilize the platform core so the next wave of product work is built on a trusted, enterprise-grade foundation.
