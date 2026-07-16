<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.21.0
  Created      : 2026-07-16
  Modified     : 2026-07-16
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Reports Module — Strangler-Fig Migration to FastAPI+Postgres v3.21.0

## 1. Purpose

Complete the Strangler-Fig migration of the Reports module (first in migration order per AGENTS.md Rule 2).
Restore report studio catalog and schedule management, which were broken (404) since v3.20.0 when
Express `reports.ts` was unmounted. Now fully served by FastAPI + Postgres.

---

## 2. Scope

| Area | Item |
|---|---|
| Model | New `ReportSchedule(BaseEntity)` ORM model + Alembic migration |
| API | 4 new FastAPI endpoints (studios, schedule CRUD) |
| Schema | `ReportScheduleCreate` + `ReportScheduleResponse` Pydantic schemas |
| Service | `list_schedules`, `create_schedule`, `delete_schedule`, `_derive_cron` |
| Tests | 6 new tests for schedule endpoints (conftest cleanup included) |
| Frontend | `ReportDesignerTab.tsx` migrated from raw fetch to `apiFetchV1` |
| Frontend | `apiFetchV1.ts` patched to handle 204 No Content |
| Cleanup | `reports.ts` deleted, `reportSchedules` removed from `db_store.json`, server.ts guard removed |

---

## 3. Files Created

| File | Purpose |
|---|---|
| `backend/app/models/report_schedule.py` | `ReportSchedule(BaseEntity)` ORM model |
| `backend/alembic/versions/h4i5j6k7l8m9_add_report_schedules_table.py` | DB migration |
| `backend/app/schemas/report_schedule.py` | Pydantic create/response schemas |
| `backend/app/tests/test_reports_schedule.py` | 6 endpoint tests |

---

## 4. Files Modified

| File | Change |
|---|---|
| `backend/app/api/v1/reports.py` | + studios catalog dict + 4 schedule endpoints |
| `backend/app/services/reports.py` | + list_schedules, create_schedule, delete_schedule, _derive_cron |
| `backend/app/models/__init__.py` | + ReportSchedule export |
| `backend/app/tests/conftest.py` | + ReportSchedule in clear_db |
| `src/components/ReportDesignerTab.tsx` | 4 fetch calls migrated, TS type updated, UI bindings updated |
| `src/lib/apiFetchV1.ts` | + 204 no-content guard |
| `server.ts` | - Report User /api/reports/schedule guard (dead code) |
| `db_store.json` | - reportSchedules key |

---

## 5. Architecture Decisions

### A. ReportSchedule inherits BaseEntity
Avoids redeclaring id, uuid, company_id, branch_id, is_active, timestamps, soft-delete,
versioning. Consistent with all other SMRITI business entities.

### B. Studios catalog as Python dict
SMRITI_STUDIOS is system metadata (report definitions don't change day-to-day).
No DB table needed until custom studio support is introduced.
Stored in `backend/app/api/v1/reports.py` and served by GET /api/v1/reports/studios.

### C. delivery_channel + delivery_target pattern
`recipient_email` (Express) replaced with `delivery_channel` (EMAIL/WHATSAPP/SMS)
+ `delivery_target` (email address or phone number). Schema supports multi-channel
delivery without future migrations.

### D. frequency + execution_time + cron_expression
UI shows human-readable `frequency` (DAILY/WEEKLY/MONTHLY) + `execution_time` (HH:MM).
`_derive_cron()` derives the cron expression internally. Future execution engine
reads `cron_expression` directly. No cron literacy required from business users.

### E. Report User role preserved
FastAPI schedule create endpoint returns 403 for `Report User` role,
identical to the Express behavior it replaces. Migration preserves behavior.

### F. apiFetchV1 204 guard
DELETE /api/v1/reports/schedules/{id} returns 204. `apiFetchV1` previously called
`response.json()` unconditionally — would throw SyntaxError on empty body.
Fixed by returning null when `response.status === 204`.

---

## 6. Design Rationale

- One module at a time (Strangler-Fig, not big-bang)
- No DB schema changes to existing tables
- Soft-delete on schedules (is_deleted=True) preserves audit trail
- Frontend migration uses `apiFetchV1` with JWT Bearer token — removes dependency on `x-user-role` header

---

## 7. Implementation Summary

### Model
`python
class ReportSchedule(BaseEntity):
    __tablename__ = "report_schedules"
    report_id, report_name, frequency, execution_time, cron_expression
    delivery_channel, delivery_target, delivery_format
    created_by_id (FK -> users, nullable)
`

### New Endpoints
`
GET    /api/v1/reports/studios          # Returns SMRITI_STUDIOS dict
GET    /api/v1/reports/schedules        # Tenant-scoped list (MANAGER+)
POST   /api/v1/reports/schedules        # Create (MANAGER only; Report User blocked)
DELETE /api/v1/reports/schedules/{id}   # Soft-delete (MANAGER only)
`

### URL Migration Map (frontend)
| Old (Express, broken) | New (FastAPI) |
|---|---|
| GET /api/reports/list | GET /api/v1/reports/studios |
| GET /api/reports/schedules | GET /api/v1/reports/schedules |
| POST /api/reports/schedule | POST /api/v1/reports/schedules |
| DELETE /api/reports/schedule/:id | DELETE /api/v1/reports/schedules/:id |

---

## 8. Tests Executed

`
Command: python -m pytest app/tests/ --tb=short -q
Result : 161 passed, 748 warnings in 121.53s

Command: python -m pytest app/tests/test_reports_schedule.py -v --tb=short
Result : 6 passed in 4.80s
`

### Test Coverage (test_reports_schedule.py)
| Test | Assertion |
|---|---|
| test_studios_catalog_returns_all_studios | 3 studios, ≥4 sales reports |
| test_create_schedule_returns_201 | 201, correct fields, cron derived correctly |
| test_list_schedules_returns_tenant_scoped | 2 schedules, correct channel |
| test_delete_schedule_soft_deletes | 204, row in DB with is_deleted=True |
| test_delete_schedule_returns_404_for_unknown | 404 |
| test_report_user_blocked_from_creating_schedule | 403, "Read-Only" in detail |

---

## 9. Verification Results

**Evidence:**
`
commit d33bdab
feat(MC3-Reports): Strangler-Fig migration complete
29 files changed, 2792 insertions(+), 2466 deletions(-)
161 passed, 748 warnings in 121.53s
`

**Interpretation:**
- Migration criterion met (AGENTS.md Rule 2): frontend calls FastAPI via apiFetchV1; Express path deleted.
- All 161 tests pass including 6 new schedule tests.
- No regression in existing 155 tests.

**Recommendation:**
Proceed to next Strangler-Fig module: Inventory/Products.

---

## 10. Known Limitations

- Schedule execution engine not implemented (metadata only, per AI policy).
- Studios catalog is not editable from the admin UI (no DB table yet).
- `execution_time` → cron derivation in frontend uses regex on cron field; edge cases possible.

---

## 11. Future Work

- Schedule execution engine (background task runner + delivery adapters).
- Admin-editable studio catalog (report_catalog DB table, ADR required).
- WhatsApp / SMS delivery adapters for delivery_channel != EMAIL.

---

## 12. Related ADRs

None (all decisions are implementation-level).

---

## 13. Related RFCs

None.

---

*Commit: `d33bdab` | Branch: `main` | Date: 2026-07-16*
