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

# Change Request: CR-2026-1632 — NEW TABLE `apparel_matrix_grid`


- **CR ID:** CR-2026-1632
- **Date:** 2026-07-28
- **Change Type:** `new_table`
- **Risk Level:** `MEDIUM`
- **Module:** Apparel
- **Target Entity / Component:** ApparelVariantGrid
- **Change Name:** `apparel_matrix_grid`
- **Business Reason:** Apparel Color/Size matrix grid variant SKU generator and inventory allocation

---

## Capability Review (GR-014)
- Existing components reviewed: Yes
- Reusable components identified: `backend/app/models/apparel.py`

---

## Impact Analysis Matrix

| Layer | Impact Status |
|:---|:---:|
| 1. Database Blueprint (ADR-012) | `[IMPACT]` |
| 2. Alembic Migration | `[IMPACT]` |
| 3. BaseEntity ORM Class | `[IMPACT]` |
| 4. Repository Layer (ADR-006) | `[IMPACT]` |
| 5. Domain Service | `[IMPACT]` |
| 6. REST Router | `[IMPACT]` |
| 7. RBAC Scopes | `[IMPACT]` |
| 8. Test Suite | `[IMPACT]` |

---

## Rollback Plan
- **Database:** Execute `alembic downgrade -1`
- **API/UI:** Revert schema DTO and hide component binding
- **Tests:** Revert test assertions in `backend/app/tests/`

---

## Auto-Generated Task Graph

- [ ] Task 1: Scaffolding and update for Database Blueprint (ADR-012)
- [ ] Task 2: Scaffolding and update for Alembic Migration
- [ ] Task 3: Scaffolding and update for BaseEntity ORM Class
- [ ] Task 4: Scaffolding and update for Repository Layer (ADR-006)
- [ ] Task 5: Scaffolding and update for Domain Service
- [ ] Task 6: Scaffolding and update for REST Router
- [ ] Task 7: Scaffolding and update for RBAC Scopes
- [ ] Task 8: Scaffolding and update for Test Suite
