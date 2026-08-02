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

# ADR-013 — Canonical Event Bus Selection


**Status:** ACCEPTED  
**Date:** 2026-07-28  
**Author:** Jawahar Ramkripal Mallah — Chief Systems Architect  
**Supersedes:** None  
**Related:** ADR-007 (Domain Events), ADR-003 (Engineering Constitution)

---

## Context

SMRITI Retail OS has two co-existing event bus implementations:

### Implementation A — `DomainEventBus` (`backend/app/core/events/domain_events.py`)

- Fire-and-forget async bus
- No DB session coupling
- No typed event name constants
- 6 named publisher functions: `publish_sale_completed`, `publish_stock_adjusted`, `publish_invoice_cancelled`, `publish_purchase_order_created`, `publish_grn_completed`, `publish_customer_created`
- No registered subscribers
- Version: 5.4.0 (created earlier)

### Implementation B — `SmritiEventBus` (`backend/app/services/event_bus.py`)

- Synchronous, transactional in-process bus
- Requires `AsyncSession` — handlers run inside the caller's DB transaction
- Typed event constants in `Events` class (GR-001 SSOT)
- Decorator and programmatic registration (`@event_bus.on`, `event_bus.subscribe`)
- Designed for future Celery/Redis upgrade path
- Version: 3.27.0 (designed as long-term foundation)

---

## Decision

**`SmritiEventBus` (`event_bus.py`) is the canonical SMRITI event bus.**

All new event publishers and subscribers MUST use `SmritiEventBus`.

`domain_events.py` is deprecated. Its six publisher functions will be replaced by direct `event_bus.publish()` calls in the corresponding services.

---

## Rationale

| Criterion | `DomainEventBus` | `SmritiEventBus` |
|:---|:---:|:---:|
| DB transaction safety | ❌ (no session) | ✅ (session-coupled) |
| Typed event constants | ❌ | ✅ (`Events` class) |
| Subscriber registration | ❌ (none registered) | ✅ (decorator + programmatic) |
| Rollback on handler error | ❌ | ✅ |
| GR-001 SSOT compliance | ❌ | ✅ |
| Future async upgrade path | ❌ | ✅ (documented) |

**Session-coupling is the deciding factor.** Without the `session` parameter, a handler cannot safely write to the database within the same transaction as the publisher. This makes fire-and-forget handlers unsafe for any business-critical side effects (e.g., auto-posting a journal entry when an invoice is created).

---

## Migration Plan

### Phase 1 — Freeze (Immediate)
- Mark `domain_events.py` deprecated in file header.
- No new publisher functions in `domain_events.py`.

### Phase 2 — Wire existing events to SmritiEventBus (M1-C tasks E-1 through E-6)
Replace each `domain_events.py` publisher call in service files with:

```python
from ..services.event_bus import event_bus, Events

# In service method, after db.commit():
await event_bus.publish(Events.PURCHASE_ORDER_CREATED, {
    "order_id": order.id,
    "order_no": order.order_no,
    ...
}, session=self.db)
```

### Phase 3 — Delete `domain_events.py` (after all publishers migrated)
- `domain_events.py` to be deleted once all 6 publisher call sites are migrated.

---

## Consequences

### Positive
- Single event bus — GR-001 compliance restored.
- Handlers can safely read/write DB within the same transaction.
- `Events` class provides typed constants — prevents string typos.
- Clear upgrade path to Celery/Redis workers in v4.x.

### Negative
- Migration effort: 3 service files must be updated (`purchase.py`, `crm.py`, `sales.py`).
- Any subscriber written against `DomainEventBus` must be rewritten (none exist — zero migration cost).

---

## Event Naming Convention

All event names use dot-notation domain prefixes:

```
<domain>.<entity>.<action>

Examples:
  sales.invoice.created
  purchase.order.created
  purchase.grn.created
  crm.customer.created
  inventory.stock.adjusted
  auth.user.login
```

New events must be added to the `Events` class in `event_bus.py` before use.
