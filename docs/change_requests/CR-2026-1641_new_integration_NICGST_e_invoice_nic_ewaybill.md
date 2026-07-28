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

# Change Request: CR-2026-1641 — NEW INTEGRATION `e_invoice_nic_ewaybill`


- **CR ID:** CR-2026-1641
- **Date:** 2026-07-28
- **Change Type:** `new_integration`
- **Risk Level:** `HIGH`
- **Module:** NICGST
- **Target Entity / Component:** EInvoiceGateway
- **Change Name:** `e_invoice_nic_ewaybill`
- **Business Reason:** NIC GSTN e-Invoice IRN generation and E-Way bill auto-filing payload encoder

---

## Capability Review (GR-014)
- Existing components reviewed: Yes
- Reusable components identified: `backend/app/models/nicgst.py`

---

## Impact Analysis Matrix

| Layer | Impact Status |
|:---|:---:|
| 1. Public API Gateway | `[IMPACT]` |
| 2. Webhook Callback Handler | `[IMPACT]` |
| 3. Event Queue Worker | `[IMPACT]` |
| 4. DLQ Logger | `[IMPACT]` |
| 5. Test Suite | `[IMPACT]` |

---

## Rollback Plan
- **Database:** Execute `alembic downgrade -1`
- **API/UI:** Revert schema DTO and hide component binding
- **Tests:** Revert test assertions in `backend/app/tests/`

---

## Auto-Generated Task Graph

- [ ] Task 1: Scaffolding and update for Public API Gateway
- [ ] Task 2: Scaffolding and update for Webhook Callback Handler
- [ ] Task 3: Scaffolding and update for Event Queue Worker
- [ ] Task 4: Scaffolding and update for DLQ Logger
- [ ] Task 5: Scaffolding and update for Test Suite
