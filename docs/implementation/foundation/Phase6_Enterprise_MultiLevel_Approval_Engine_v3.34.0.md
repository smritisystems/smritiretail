<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Email        : support@smritibooks.com
  Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.34.0
  Created      : 2026-07-20
  Modified     : 2026-07-20
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Implementation Plan: Phase 6 Enterprise Multi-Level Approval Engine — v3.34.0 (10/10)

## 1. Objective
Transform `ApprovalService` from a basic stub into an Enterprise-Grade Multi-Level Approval Engine supporting multi-condition matrix policies, SLA escalation, date-bound delegation, parallel/sequential step execution, document payload hashing, rule versioning, and event-driven decoupling.

---

## 2. Business Motivation
Large retail chains (D-Mart, Reliance Retail, Metro, multi-store franchises) require fine-grained document approval workflows that separate functional access permission (`Can the user create this document?`) from financial/business authorization (`Should this transaction become effective?`). This policy engine handles multi-tier thresholds, category/margin-based triggers, and emergency overrides with immutable audit trails.

---

## 3. Scope
- 11 normalized database entities under `smriti_approval_*`.
- Multi-condition policy engine evaluating Amount, Margin %, Discount %, Supplier Category, Store Zone, and Payment Type.
- Workflow execution strategies (`Sequential`, `Parallel`, `Hybrid`).
- Date-bound delegation and temporary acting manager support.
- SLA timeout tracking and auto-escalation.
- Cryptographic SHA-256 payload hashing for document tamper-proofing.
- Rule snapshot versioning per request.
- Event bus integration publishing `approval.*` lifecycle events.
- Approver Dashboard & timeline APIs.

---

## 4. Current State
- `ApprovalService` in `backend/app/services/approval.py` is a stub that logs intent and auto-approves all requests.
- No database tables exist to persist approval policies, matrices, requests, or delegation rules.

---

## 5. Gap Analysis
| Capability | Current State | Required Enterprise Target |
| :--- | :--- | :--- |
| Approval Engine | Single stub function returning `approved: True` | Multi-condition matrix policy engine |
| Strategy | Single amount threshold | Sequential, Parallel, Hybrid approval steps |
| Auditability | Unpersisted log | Versioned rule snapshots & SHA-256 payload hashing |
| SLA & Escalation | None | Configurable SLA timeouts & auto-escalation |
| Delegation | None | Date-bound delegation & acting manager support |
| Decoupling | Direct calls | Event-driven event bus architecture |

---

## 6. Architecture Impact
- **Architecture Principle:** Permission (`require_permission`) $\neq$ Approval (`ApprovalService`).
- **Dependencies:** Points inward from API routes $\rightarrow$ Approval Engine $\rightarrow$ Event Bus $\rightarrow$ Postgres.
- **Event Bus:** Emits decoupled events (`approval.requested`, `approval.completed`, `approval.rejected`).

---

## 7. Proposed Design

### Database Entities
1. `SMRITIApprovalPolicy` (id, version, document_type, priority, is_active)
2. `SMRITIApprovalMatrix` (id, policy_id, matrix_name, min_amount, max_amount)
3. `SMRITIApprovalStep` (id, matrix_id, step_number, strategy, sla_hours)
4. `SMRITIApprovalCondition` (id, step_id, field_name, operator, target_value)
5. `SMRITIApprovalAssignment` (id, step_id, role_id, user_id)
6. `SMRITIApprovalRequest` (id, document_type, document_id, document_hash, policy_version, current_step, status)
7. `SMRITIApprovalAction` (id, request_id, step_id, action, action_by, remarks, timestamp)
8. `SMRITIApprovalHistory` (id, request_id, state_from, state_to, transition_at)
9. `SMRITIApprovalDelegation` (id, delegator_id, delegate_id, start_date, end_date, is_active)
10. `SMRITIApprovalEscalation` (id, request_id, step_id, escalated_from_role, escalated_to_role, trigger_at)
11. `SMRITIApprovalComment` (id, request_id, user_id, comment, attachments_json)

---

## 8. Files Created
- `backend/app/models/approval.py`
- `backend/app/services/approval_engine.py`
- `backend/app/services/approval_events.py`
- `backend/app/api/v1/approvals.py`
- `backend/alembic/versions/add_enterprise_approval_engine_v3_34.py`
- `backend/app/tests/test_enterprise_approval_engine.py`

---

## 9. Files Modified
- `backend/app/models/__init__.py`
- `backend/app/services/approval.py`
- `backend/app/main.py`
- `docs/walkthrough/README.md`
- `docs/implementation/README.md`

---

## 10. Dependencies
- FastAPI, SQLAlchemy 2.0 (Async), Alembic, Pydantic V2.

---

## 11. Risks
- Performance overhead during query execution. *Mitigation:* Cache compiled active policy trees in memory; refresh on policy update.

---

## 12. Rollback Strategy
- Alembic downgrade script `downgrade()` drops the 11 `smriti_approval_*` tables.
- Revert `ApprovalService` to stub mode.

---

## 13. Verification Plan
- `python -m pytest app/tests/test_enterprise_approval_engine.py`

---

## 14. Test Plan
- Unit tests for condition evaluation algorithms.
- Integration tests for Parallel vs Sequential step resolution.
- End-to-end API contract tests via `/api/v1/approvals/*`.

---

## 15. Documentation Impact
- Update Walkthrough `Foundation_Security_Enterprise_Access_Architecture_Upgrade_v3.33.0.md`.
- Update Master Walkthrough Index and Implementation Index.

---

## 16. Deployment Plan
1. Run Alembic migration `add_enterprise_approval_engine_v3_34`.
2. Seed default system approval policies.
3. Restart FastAPI container.

---

## 17. Status
Approved

---

## 18. Related ADRs
- **ADR-004:** Scoped Security Configuration.
- **ADR-015:** Enterprise Approval Engine Decoupling.

---

## 19. Related Walkthroughs
- `Foundation_Security_Enterprise_Access_Architecture_Upgrade_v3.33.0.md`
