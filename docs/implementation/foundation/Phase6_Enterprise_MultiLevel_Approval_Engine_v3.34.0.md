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

# Implementation Plan: Phase 6 Enterprise Multi-Level Approval Engine Specification v1.0 — v3.34.0 (10/10)

## 1. Objective
Transform `ApprovalService` from a basic stub into an Enterprise-Grade Multi-Level Approval Engine Specification v1.0 supporting an Approval Resolver Layer, Outbox-based Event Delivery, explicit Finite State Machine (FSM), Policy In-Memory Caching (>95% hit rate), AST Safe DSL Expression Evaluator, Effective Date Validity (`valid_from`/`valid_to`), Optimistic Request Locking, and Execution Context Auditing.

---

## 2. Business Motivation
Large retail chains (D-Mart, Reliance Retail, Metro, multi-store franchises) require fine-grained document approval workflows that separate functional access permission (`Can the user create this document?`) from financial/business authorization (`Should this transaction become effective?`). This policy engine handles multi-tier thresholds, category/margin-based triggers, and emergency overrides with immutable audit trails.

---

## 3. Scope
- 12 normalized database entities under `smriti_approval_*`.
- Approval Resolver Layer decoupling data resolution from FSM execution.
- AST Safe DSL Expression Evaluator (`Amount > 50000 AND Supplier.Category == 'IMPORTED' AND Margin < 0.08`).
- Effective Date Range (`valid_from`, `valid_to`) for policy scheduling.
- Workflow execution strategies (`Sequential`, `Parallel`, `Hybrid`).
- Date-bound delegation and temporary acting manager support.
- SLA timeout tracking and auto-escalation.
- Cryptographic SHA-256 payload hashing for document tamper-proofing.
- Rule snapshot versioning per request.
- Transactional Outbox Pattern publishing `approval.*` lifecycle events.
- Optimistic concurrency control (`version` column) preventing race conditions.
- Approver Dashboard & timeline APIs.

---

## 4. Current State
- `ApprovalService` in `backend/app/services/approval.py` is a stub that logs intent and auto-approves all requests.
- No database tables exist to persist approval policies, matrices, requests, outbox events, or delegation rules.

---

## 5. Gap Analysis
| Capability | Current State | Required Enterprise Target |
| :--- | :--- | :--- |
| Approval Engine | Single stub function returning `approved: True` | Multi-condition matrix policy engine |
| Strategy | Single amount threshold | Sequential, Parallel, Hybrid approval steps |
| Auditability | Unpersisted log | Versioned rule snapshots, execution context & SHA-256 payload hashing |
| Concurrency Control | None | Optimistic locking (`version` column) |
| Event Architecture | None | Transactional Outbox Pattern (`smriti_approval_outbox`) |
| SLA & Escalation | None | Configurable SLA timeouts & auto-escalation |
| Delegation | None | Date-bound delegation & acting manager support |
| Policy Caching | None | In-memory policy cache (>95% hit rate) |

---

## 6. Architecture Impact
- **Architecture Principle:** Permission (`require_permission`) $\neq$ Approval (`ApprovalService`).
- **Dependencies:** Points inward: API Routes $\rightarrow$ FSM Service $\rightarrow$ Approval Resolver $\rightarrow$ Event Outbox $\rightarrow$ Postgres.
- **Outbox Pattern:** Event records written to `smriti_approval_outbox` table within the active DB transaction.

---

## 7. Proposed Design

### Database Entities
1. `SMRITIApprovalPolicy` (id, version, document_type, scope_type, scope_id, valid_from, valid_to, priority, is_active)
2. `SMRITIApprovalMatrix` (id, policy_id, matrix_name, min_amount, max_amount)
3. `SMRITIApprovalStep` (id, matrix_id, step_number, strategy, sla_hours, auto_escalate_role_id)
4. `SMRITIApprovalCondition` (id, step_id, expression_dsl)
5. `SMRITIApprovalAssignment` (id, step_id, role_id, user_id)
6. `SMRITIApprovalRequest` (id, document_type, document_id, document_hash, policy_version, current_step, status, version)
7. `SMRITIApprovalAction` (id, request_id, step_id, action, action_by, remarks, ip_address, user_agent, correlation_id, timestamp)
8. `SMRITIApprovalHistory` (id, request_id, state_from, state_to, transition_at)
9. `SMRITIApprovalDelegation` (id, delegator_id, delegate_id, start_date, end_date, is_active)
10. `SMRITIApprovalEscalation` (id, request_id, step_id, escalated_from_role, escalated_to_role, trigger_at)
11. `SMRITIApprovalComment` (id, request_id, user_id, comment, attachments_json)
12. `SMRITIApprovalOutbox` (id, event_type, payload_json, status, created_at, processed_at)

---

## 8. Performance SLA Targets
| Metric | SLA Target |
| :--- | :--- |
| Policy evaluation time | $< 50\text{ ms}$ |
| Approval action execution | $< 100\text{ ms}$ |
| Pending dashboard query | $< 200\text{ ms}$ |
| Event outbox write | $< 20\text{ ms}$ |
| Policy cache hit rate | $> 95\%$ |

---

## 9. Files Created
- `backend/app/models/approval.py`
- `backend/app/services/approval_resolver.py`
- `backend/app/services/approval_fsm.py`
- `backend/app/services/approval_events.py`
- `backend/app/api/v1/approvals.py`
- `backend/alembic/versions/add_approval_engine_v3_34.py`
- `backend/app/tests/test_enterprise_approval_engine.py`

---

## 10. Files Modified
- `backend/app/models/__init__.py`
- `backend/app/services/approval.py`
- `backend/app/main.py`
- `docs/walkthrough/README.md`
- `docs/implementation/README.md`

---

## 11. Dependencies
- FastAPI, SQLAlchemy 2.0 (Async), Alembic, Pydantic V2.

---

## 12. Risks & Mitigations
- *Risk:* Performance overhead during query execution.
- *Mitigation:* Policy Cache Layer in memory with TTL and automatic invalidation on policy updates (>95% hit rate).

---

## 13. Rollback Strategy
- Alembic downgrade script `downgrade()` drops the 12 `smriti_approval_*` tables.
- Revert `ApprovalService` to stub mode.

---

## 14. Verification Plan
- `python -m pytest app/tests/test_enterprise_approval_engine.py`

---

## 15. Test Plan
- Unit tests for AST DSL expression evaluator.
- Integration tests for Parallel vs Sequential step resolution and FSM state transitions.
- Concurrency test for optimistic locking.
- End-to-end API contract tests via `/api/v1/approvals/*`.

---

## 16. Documentation Impact
- Update Walkthrough `Foundation_Security_Enterprise_Access_Architecture_Upgrade_v3.33.0.md`.
- Update Master Walkthrough Index and Implementation Index.

---

## 17. Deployment Plan
1. Run Alembic migration `add_approval_engine_v3_34`.
2. Seed default system approval policies.
3. Restart FastAPI container.

---

## 18. Status
Approved

---

## 19. Related ADRs & RFCs
- **ADR-004:** Scoped Security Configuration.
- **ADR-015:** Enterprise Approval Engine Decoupling & Outbox Pattern.
- **RFC-009:** Approval Engine Specification v1.0.
