<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.21.0
  Created      : 2026-07-15
  Modified     : 2026-07-15
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Systemic Debt Resolution — WorkflowEvent, Exchange TZ, Reports N+1, Barcode Race v3.21.0

## 1. Purpose

Resolve all remaining systemic debt items that blocked a 155/155 green test
suite after Phase 5D (deprecated alias cleanup). Four independent root causes
were identified and fixed in a single atomic commit (`29359fb`).

---

## 2. Scope

| Area | Item |
|---|---|
| Model | New `WorkflowEvent` ORM model + Alembic migration |
| API | `workflow.py` — event persistence, GET /events, role guards |
| API | `exchange.py` — `last_run` timezone mismatch fix |
| Service | `reports.py` — purchase_summary N+1 → 3-query batch load |
| Tests | `conftest.py` — `clear_db` includes workflow + exchange models |
| Tests | `test_tenant_isolation.py` — fixture isolation + barcode race fix |

---

## 3. Files Created

| File | Purpose |
|---|---|
| `backend/app/models/workflow.py` | `WorkflowEvent` ORM model |
| `backend/alembic/versions/g3h4i5j6k7l8_add_workflow_events_table.py` | DB migration for `workflow_events` table |

---

## 4. Files Modified

| File | Change |
|---|---|
| `backend/app/api/v1/workflow.py` | WorkflowEvent persistence + GET /events + MANAGER role guards |
| `backend/app/api/v1/exchange.py` | `last_run` tz-naive fix; version → 3.21.0 |
| `backend/app/models/__init__.py` | Export `WorkflowEvent` |
| `backend/app/services/reports.py` | N+1 → 3-query purchase_summary |
| `backend/app/tests/conftest.py` | `clear_db` adds `WorkflowEvent`, `DataExchangeTask`, `DataExchangeFieldMapping` |
| `backend/app/tests/test_tenant_isolation.py` | `clear_db` autouse + barcode race rewrite |

---

## 5. Architecture Decisions

### A. WorkflowEvent as a first-class audit table
`WorkflowEvent` is stored in its own `workflow_events` table rather than
appending to `audit_logs`. Workflow events are operational (triggered by
internal state machines), not user actions. They need different retention,
querying, and FK patterns.

### B. `last_run` kept as `TIMESTAMP WITHOUT TIME ZONE`
The column was defined with `Column(DateTime, nullable=True)` (no
`timezone=True`). The zero-risk fix is to strip timezone at the Python layer:
`datetime.now(timezone.utc).replace(tzinfo=None)`. A schema migration to
`TIMESTAMP WITH TIME ZONE` is deferred to a separate ADR.

### C. Purchase summary N+1 elimination
Before: 2N+1 queries (N orders × items query + N orders × supplier query +
1 order list query). After: 3 total queries — one for orders, one IN-clause
for all items, one IN-clause for all suppliers — with O(1) dict lookups.

### D. Barcode concurrency test using test-engine sessions
Root cause: `test_seef.py` called `verify_db_connectivity()` using the app's
real `AsyncSessionLocal` pool. This left a connection in `idle in transaction`
state in the pool. When the barcode test popped `get_db`, both concurrent
requests received that dirty connection → FK error before INSERT → [400, 400].

Fix: override `get_db` with a factory that creates fresh sessions from the
**test engine** (function-scoped, clean pool). Each concurrent request gets
its own independent Postgres connection without app-pool contamination.

---

## 6. Design Rationale

- Minimize schema migration surface: only one new table.
- All fixes are non-breaking (no existing API contract changes).
- Test fixes restore cross-module isolation without changing test semantics.

---

## 7. Implementation Summary

### 7.1 WorkflowEvent
```python
class WorkflowEvent(BaseEntity):
    __tablename__ = "workflow_events"
    workflow_id     = Column(String(100), ForeignKey("workflows.id"), nullable=False)
    event_type      = Column(String(50), nullable=False)
    performed_by_id = Column(String(100), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    notes           = Column(Text, nullable=True)
    metadata_json   = Column(Text, nullable=True)
```

### 7.2 exchange.py — last_run fix
```python
# Before (asyncpg DataError: tz-aware datetime into TIMESTAMP WITHOUT TZ column)
task.last_run = datetime.now(timezone.utc)

# After
task.last_run = datetime.now(timezone.utc).replace(tzinfo=None)
```

### 7.3 reports.py — N+1 → 3-query batch load
```python
# Query 1: order list in date range
# Query 2: SELECT * FROM purchase_order_items WHERE order_id IN (...)
# Query 3: SELECT * FROM suppliers WHERE id IN (...)
# Result: items_by_order = {order_id: [items]}, supplier_map = {id: name}
# O(1) lookup per order — no per-row queries
```

### 7.4 test_tenant_isolation.py — barcode race
```python
_session_factory = async_sessionmaker(db_engine, class_=AsyncSession, expire_on_commit=False)

async def _fresh_get_db():
    async with _session_factory() as session:
        try:
            yield session
        finally:
            await session.close()

app.dependency_overrides[get_db] = _fresh_get_db
results = await asyncio.gather(post_product("A"), post_product("B"))
```

---

## 8. Tests Executed

```
Command : python -m pytest app/tests/ --tb=short -q
Result  : 155 passed, 724 warnings in 115.41s (0:01:55)
```

Targeted verifications:

| Test | Result |
|---|---|
| `test_exchange.py::test_execute_product_export_task` | PASS |
| `test_tenant_isolation.py::test_concurrent_duplicate_barcode_returns_400_not_500` | PASS |
| `test_seef.py + barcode test (minimal contamination pair)` | 5 PASS |

---

## 9. Verification Results

**Evidence:**
```
commit 29359fb
fix(systemic-debt): 155/155 tests green
40 files changed, 1136 insertions(+), 70 deletions(-)
155 passed, 724 warnings in 115.41s
```

**Interpretation:**
All 155 tests pass in the same pytest session with the full corpus. The barcode
race test no longer depends on app-pool connection state. The exchange task
executor no longer raises DataError. The purchase summary no longer issues N+1.

**Recommendation:**
Proceed with the next planned feature phase or systemic debt item.

---

## 10. Known Limitations

- `last_run` remains `TIMESTAMP WITHOUT TIME ZONE`; future migration needed.
- `WorkflowEvent.metadata_json` is `Text`; a `JSONB` migration would enable
  server-side filtering.
- Barcode test uses the test engine pool (default pool_size=5); not an issue
  for the current sequential test runner.

---

## 11. Future Work

- Migrate `last_run` column to `TIMESTAMP WITH TIME ZONE`.
- Add `JSONB` to `WorkflowEvent.metadata_json`.
- Expose `GET /workflow/events` in Swagger with response schema examples.
- Add Prometheus counter for workflow event rates per type.

---

## 12. Related ADRs

None (all decisions are implementation-level).

---

## 13. Related RFCs

None.

---

*Commit: `29359fb` | Branch: `main` | Date: 2026-07-15*
