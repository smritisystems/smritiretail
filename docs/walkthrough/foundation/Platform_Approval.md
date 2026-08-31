<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.16.0
  Created      : 2026-08-23
  Modified     : 2026-08-23
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: Vertical Slice 5 — Approval, Workflow, and Communicator Engines

## 1. Purpose
Unify multi-tier document approval governance (Draft -> Pending Approval -> Approved / Rejected -> Cancelled), configurable threshold matrices, and multi-channel communicator dispatch audit ledgers (Email, SMS, WhatsApp) inside the SMRITI tenant data plane (`smritiXXX`). This guarantees that high-value transactions undergo verified role-based sign-offs and customer notifications maintain immutable dispatch audit trails.

---

## 2. Scope
- **Tenant Data Plane (`smritiXXX`) Only**: All approval policies, approval requests, approval actions, communicator templates, and dispatch logs reside strictly in tenant databases.
- **Configurable Approval Matrix**: Threshold-driven approval evaluation (`ApprovalPolicy`) routing requests to assigned operational roles (`STORE_MANAGER`, `FINANCE_CONTROLLER`, `DIRECTOR`).
- **Immutable Approval Action Audit**: Permanent recording of approver identity, timestamp, decision, and comments in `approval_actions`.
- **Multi-Channel Communicator Engine**: Template placeholder variable substitution (`{{key}}`) and dispatch audit logging in `communicator_logs`.

---

## 3. Files Created
1. `backend/app/models/approval.py`: Canonical `ApprovalPolicy`, `ApprovalRequest`, and `ApprovalAction` models.
2. `backend/app/models/communicator.py`: Canonical `CommunicatorTemplate` and `CommunicatorLog` models.
3. `backend/app/services/unified_approval.py`: Domain service orchestrating policy evaluation, state transitions, and communicator template dispatch.
4. `backend/tests/t_approval_comm.py`: Automated verification suite certifying approval thresholds, decision audits, message rendering, and tenant isolation.
5. `docs/implementation/foundation/Platform_Refactor.md`: Master 19-section implementation plan for Slice 5.

---

## 4. Files Modified
1. `backend/app/models/__init__.py`: Exported Approval and Communicator models.
2. `docs/implementation/README.md`: Appended Slice 5 implementation plan to master index.
3. `docs/architecture/PLATFORM.md`: Updated platform tracker with verified Slice 5 status.
4. `docs/walkthrough/README.md`: Appended Slice 5 walkthrough to chronological master index.

---

## 5. Architecture Decisions
- **ADR-010: Governed Document Approvals**: High-value transactions (such as Purchase Orders or Invoices exceeding threshold limits) cannot transition to finalized ledger states without an `ApprovalRequest` in `APPROVED` status.
- **ADR-011: Multi-Channel Communicator Audit**: Message dispatch operations write immutable log records with status tracking (`QUEUED`, `SENT`, `DELIVERED`, `FAILED`) to preserve customer communication audit trails.

---

## 6. Design Rationale
Decoupled approval policies allow organizations to adapt financial governance rules without altering core ledger posting logic. Standardized communicator logging provides audit defense for regulatory, billing, and order status communications.

---

## 7. Implementation Summary
- **Approval Policy Evaluation**:
  - Compares document type and financial value against active `ApprovalPolicy` rules.
  - Automatically instantiates `ApprovalRequest` (status="PENDING") assigned to the required role.
- **Approval Action Execution**:
  - Enforces valid state transitions (`APPROVE` -> `APPROVED`, `REJECT` -> `REJECTED`, `REQUEST_CHANGES` -> `CHANGES_REQUESTED`).
  - Appends an immutable `ApprovalAction` record detailing approver credentials and rationale.
- **Communicator Dispatch**:
  - Resolves `CommunicatorTemplate` by code.
  - Performs regex placeholder substitution for dynamic transaction variables.
  - Records delivery payload in `communicator_logs`.

---

## 8. Tests Executed
1. `backend/tests/t_approval_comm.py`:
   - `test_approval_policy_threshold_trigger_and_request_creation` (Passed)
   - `test_approval_action_decision_lifecycle` (Passed)
   - `test_communicator_template_rendering_and_dispatch_log` (Passed)
   - `test_approval_and_communicator_tenant_isolation` (Passed)
2. Full Multi-Module Regression Suite:
   - 81/81 automated tests passed in 32.28s across Routing Boundary, Tenant DB Provisioning, Menu Governance, Security Access, WMS Phases 1–4, Slice 2 Universal Party/Item Masters, Slice 3 Sales/POS & Stock Ledger, Slice 4 Pricing/Payments, and Slice 5 Approvals/Communicator.

---

## 9. Verification Results

```text
============================= test session starts =============================
platform win32 -- Python 3.13.11, pytest-9.1.1, pluggy-1.6.0
rootdir: F:\SMRITRretailNX\backend
configfile: pyproject.toml
plugins: anyio-4.14.2, asyncio-1.4.0
asyncio: mode=Mode.AUTO, debug=False, asyncio_default_fixture_loop_scope=None, asyncio_default_test_loop_scope=function
collected 81 items

backend\tests\t_approval_comm.py ....                 [  4%]
backend\tests\t_pricing_eng.py ....                [  9%]
backend\tests\t_sales_ledger.py ....                          [ 14%]
backend\tests\t_univ_party.py ...                         [ 18%]
backend\tests\t_univ_item.py ...                          [ 22%]
backend\tests\t_route_boundary.py .............           [ 38%]
backend\tests\t_comp_db_route.py .......                 [ 46%]
backend\tests\t_comp_db_name.py ......                [ 54%]
backend\tests\t_comp_db_wire.py .....                        [ 60%]
backend\tests\t_multi_comp_db.py ......         [ 67%]
backend\tests\t_comp_db_prov.py .....                      [ 74%]
backend\tests\t_menu_gov.py .                                  [ 75%]
backend\tests\t_sec_menu.py ..                            [ 77%]
backend\tests\test_wms_phase1.py ....                                    [ 82%]
backend\tests\t_wms_phase2.py ...                           [ 86%]
backend\tests\t_wms_phase3.py .....                         [ 92%]
backend\tests\t_wms_phase4.py ......             [100%]

======================= 81 passed, 1 warning in 32.28s ========================
```

---

## 10. Known Limitations
- Live third-party SMS Gateway (Twilio/Gupshup) and WhatsApp Cloud API HTTP calls are dispatched through external worker queues.

---

## 11. Future Work
- **Slice 6**: Capability, Template, and Workspace Resolution.
- **Slice 7**: Outbox and Analytics Plane.

---

## 12. Related ADRs
- `ADR-001`: Multi-Company Database Architecture.
- `ADR-010`: Governed Document Approvals & Communicator Dispatch Ledgers.

---

## 13. Related RFCs
- `RFC-012`: Multi-Tier Document Approval Workflows and Universal Communicator Engine.
