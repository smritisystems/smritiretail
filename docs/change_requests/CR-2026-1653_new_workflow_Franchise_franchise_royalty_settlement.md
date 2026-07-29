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

# Change Request: CR-2026-1653 — NEW WORKFLOW `franchise_royalty_settlement`


- **CR ID:** CR-2026-1653
- **Date:** 2026-07-28
- **Change Type:** `new_workflow`
- **Risk Level:** `HIGH`
- **Module:** Franchise
- **Target Entity / Component:** RoyaltySettlementEngine
- **Change Name:** `franchise_royalty_settlement`
- **Business Reason:** Franchise multi-store sales royalty calculation, store settlement ledger, inter-company debit/credit notes

---

## Capability Review (GR-014)
- Existing components reviewed: Yes
- Reusable components identified: `backend/app/models/franchise.py`

---

## Impact Analysis Matrix

| Layer | Impact Status |
|:---|:---:|
| 1. FSM State Enum | `[IMPACT]` |
| 2. Approval Matrix | `[IMPACT]` |
| 3. Event Bus Trigger | `[IMPACT]` |
| 4. Escalation Rules | `[IMPACT]` |
| 5. REST API | `[IMPACT]` |
| 6. Test Suite | `[IMPACT]` |

---

## Rollback Plan
- **Database:** Execute `alembic downgrade -1`
- **API/UI:** Revert schema DTO and hide component binding
- **Tests:** Revert test assertions in `backend/app/tests/`

---

## Auto-Generated Task Graph

- [ ] Task 1: Scaffolding and update for FSM State Enum
- [ ] Task 2: Scaffolding and update for Approval Matrix
- [ ] Task 3: Scaffolding and update for Event Bus Trigger
- [ ] Task 4: Scaffolding and update for Escalation Rules
- [ ] Task 5: Scaffolding and update for REST API
- [ ] Task 6: Scaffolding and update for Test Suite
