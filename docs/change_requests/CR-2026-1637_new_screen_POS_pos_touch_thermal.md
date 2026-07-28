<!--
  Project      : SMRITI Retail OS
  Organization : SmritiSys
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
-->

# Change Request: CR-2026-1637 — NEW SCREEN `pos_touch_thermal`


- **CR ID:** CR-2026-1637
- **Date:** 2026-07-28
- **Change Type:** `new_screen`
- **Risk Level:** `MEDIUM`
- **Module:** POS
- **Target Entity / Component:** POSTouchLayout
- **Change Name:** `pos_touch_thermal`
- **Business Reason:** Touch-Screen Quick Billing layout, ESC/POS thermal receipt renderer, offline IndexedDB queue

---

## Capability Review (GR-014)
- Existing components reviewed: Yes
- Reusable components identified: `backend/app/models/pos.py`

---

## Impact Analysis Matrix

| Layer | Impact Status |
|:---|:---:|
| 1. SEDS UI Pattern (A/B/C) | `[IMPACT]` |
| 2. Layout Manager | `[IMPACT]` |
| 3. Navigation Manifest | `[IMPACT]` |
| 4. RBAC Scope | `[IMPACT]` |
| 5. Test Suite | `[IMPACT]` |

---

## Rollback Plan
- **Database:** Execute `alembic downgrade -1`
- **API/UI:** Revert schema DTO and hide component binding
- **Tests:** Revert test assertions in `backend/app/tests/`

---

## Auto-Generated Task Graph

- [ ] Task 1: Scaffolding and update for SEDS UI Pattern (A/B/C)
- [ ] Task 2: Scaffolding and update for Layout Manager
- [ ] Task 3: Scaffolding and update for Navigation Manifest
- [ ] Task 4: Scaffolding and update for RBAC Scope
- [ ] Task 5: Scaffolding and update for Test Suite
