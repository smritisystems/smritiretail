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

# Change Request: CR-2026-1615 — NEW FIELD `sales_person_id`

- **CR ID:** CR-2026-1615
- **Date:** 2026-07-28
- **Change Type:** `new_field`
- **Risk Level:** `LOW`
- **Module:** Sales
- **Target Entity / Component:** SalesInvoice
- **Change Name:** `sales_person_id`
- **Business Reason:** Track sales commissions and executive performance

---

## Capability Review (GR-014)
- Existing components reviewed: Yes
- Reusable components identified: `backend/app/models/sales.py`

---

## Impact Analysis Matrix

| Layer | Impact Status |
|:---|:---:|
| 1. Database Column | `[IMPACT]` |
| 2. Alembic Migration | `[IMPACT]` |
| 3. ORM Model | `[IMPACT]` |
| 4. Repository | `[IMPACT]` |
| 5. Service | `[IMPACT]` |
| 6. REST API Schema | `[IMPACT]` |
| 7. UI Form | `[IMPACT]` |
| 8. Global Search | `[IMPACT]` |
| 9. Reports & BI | `[IMPACT]` |
| 10. Data Exchange (Excel) | `[IMPACT]` |
| 11. Print Framework | `[IMPACT]` |
| 12. Test Suite | `[IMPACT]` |

---

## Rollback Plan
- **Database:** Execute `alembic downgrade -1`
- **API/UI:** Revert schema DTO and hide component binding
- **Tests:** Revert test assertions in `backend/app/tests/`

---

## Auto-Generated Task Graph

- [x] Task 1: Scaffolding and update for Database Column
- [x] Task 2: Scaffolding and update for Alembic Migration
- [x] Task 3: Scaffolding and update for ORM Model
- [x] Task 4: Scaffolding and update for Repository
- [x] Task 5: Scaffolding and update for Service
- [x] Task 6: Scaffolding and update for REST API Schema
- [x] Task 7: Scaffolding and update for UI Form
- [x] Task 8: Scaffolding and update for Global Search
- [x] Task 9: Scaffolding and update for Reports & BI
- [x] Task 10: Scaffolding and update for Data Exchange (Excel)
- [x] Task 11: Scaffolding and update for Print Framework
- [x] Task 12: Scaffolding and update for Test Suite
