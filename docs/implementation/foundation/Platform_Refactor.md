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

# Implementation Plan: Vertical Slice 5 — Approval, Workflow, and Communicator Engines

## 1. Objective
Unify multi-tier document approval governance (Draft -> Pending Approval -> Approved / Rejected -> Cancelled), configurable threshold matrices, and multi-channel communicator dispatch ledgers (Email, SMS, WhatsApp) inside the tenant data plane (`smritiXXX`).

---

## 2. Business Motivation
In large retail networks and distribution operations, high-value purchase orders, credit memo refunds, and discount overrides must require strict hierarchical management sign-off before committing to transactional ledgers. Furthermore, transactional communications must be delivered reliably with complete dispatch audit trails.

---

## 3. Scope

### In-Scope
1. **Multi-Tier Approval State Machine (`approval_policies`, `approval_requests`, `approval_actions`)**:
   - Threshold-driven triggers (e.g. Sales Invoices or Purchase Orders exceeding financial thresholds).
   - Approval routing by role (`STORE_MANAGER`, `FINANCE_CONTROLLER`, `DIRECTOR`).
   - Immutable audit logging of approval/rejection decisions with timestamps and notes.
2. **Unified Communicator Engine (`communicator_templates`, `communicator_logs`)**:
   - Channels: `EMAIL`, `SMS`, `WHATSAPP`, `PUSH_NOTIFICATION`.
   - Variable substitution engine (`{{customer_name}}`, `{{invoice_no}}`, `{{amount}}`).
   - Delivery status tracking (`QUEUED`, `SENT`, `DELIVERED`, `FAILED`).
3. **Tenant Isolation**:
   - All approval records and communication logs reside strictly inside `smritiXXX`.

### Out-of-Scope (Deferred)
- External SMS/WhatsApp third-party aggregator live HTTP webhooks (handled in external compliance gateways).
- Background polling daemon queues (scheduled for Slice 7 Outbox Plane).

---

## 4. Current State
- Document approval workflows were handled ad-hoc in isolated modules without a unified state machine.
- Communicator templates were not standardized across tenant databases.

---

## 5. Gap Analysis
| Dimension | Current State | Target Architecture (Slice 5) |
| :--- | :--- | :--- |
| **Approval Lifecycle** | Ad-hoc flags | Governed state machine with threshold policies and multi-tier sign-off |
| **Approval Audit** | Basic modified_by | Immutable `approval_actions` ledger recording every decision |
| **Communication** | Decentralized | Centralized `communicator_templates` and `communicator_logs` dispatch tracking |
| **Data Plane Boundary** | Tenant DB | Strictly tenant data plane (`smritiXXX`) |

---

## 6. Architecture Impact
- **Fraud & Overdraft Prevention**: High-value transactions cannot transition to confirmed states without verified digital signatures/approvals.
- **Auditable Customer Messaging**: Every SMS, WhatsApp, and Email notification has a traceable dispatch log.

---

## 7. Proposed Design

### A. Approval Models (`backend/app/models/approval.py`)
- `ApprovalPolicy`: Defines document type, threshold amount, required approver role, and escalation timeout.
- `ApprovalRequest`: State tracker (`DRAFT`, `PENDING_APPROVAL`, `APPROVED`, `REJECTED`, `CANCELLED`) linked to `reference_doc_type` and `reference_doc_id`.
- `ApprovalAction`: Individual decision recorded by an approver (`APPROVE`, `REJECT`, `REQUEST_CHANGES`).

### B. Communicator Models (`backend/app/models/communicator.py`)
- `CommunicatorTemplate`: `name`, `code`, `channel` (EMAIL/SMS/WHATSAPP), `subject_template`, `body_template`.
- `CommunicatorLog`: `recipient`, `channel`, `rendered_body`, `status` (QUEUED/SENT/FAILED), `gateway_response`.

---

## 8. Files Created
- `backend/app/models/approval.py`: Canonical ApprovalPolicy, ApprovalRequest, ApprovalAction models.
- `backend/app/models/communicator.py`: Canonical CommunicatorTemplate, CommunicatorLog models.
- `backend/app/services/unified_approval.py`: Domain service orchestrating approval workflows, evaluation against policies, and template rendering/dispatch.
- `backend/tests/t_approval_comm.py`: Automated verification suite certifying approval state transitions, threshold triggers, communicator rendering, and tenant isolation.
- `docs/implementation/foundation/Platform_Refactor.md`: This implementation plan.

---

## 9. Files Modified
- `backend/app/models/__init__.py`: Export Approval and Communicator models.
- `docs/implementation/README.md`: Append Slice 5 plan to master index.
- `docs/architecture/PLATFORM.md`: Track Slice 5 verification.

---

## 10. Dependencies
- Vertical Slice 3: Sales, POS, and Operational Stock Ledger.
- Vertical Slice 4: Pricing, Payments, and Document Sequences.

---

## 11. Risks
| Risk | Severity | Mitigation |
| :--- | :--- | :--- |
| Unapproved document execution bypass | High | Verify `ApprovalRequest.status == 'APPROVED'` in transactional services before ledger posting |
| Template variable syntax injection | Low | Sanitize placeholders and use safe Jinja-style regex replacements |

---

## 12. Rollback Strategy
Additive DDL tables. If rollback is required, existing invoice workflows execute with bypass default policies.

---

## 13. Verification Plan
1. Test approval request submission for high-value transactions.
2. Test approver authorization and decision execution (`APPROVE` / `REJECT`).
3. Test communicator template variable rendering for WhatsApp and SMS.
4. Verify tenant isolation between `smriti001` and `smriti002`.

---

## 14. Test Plan
- Run `backend/tests/t_approval_comm.py`.
- Run full 81+ test multi-module regression suite.

---

## 15. Documentation Impact
- Update `docs/architecture/PLATFORM.md`.
- Generate Walkthrough `docs/walkthrough/foundation/Platform_Approval.md`.
- Update `docs/walkthrough/README.md`.

---

## 16. Deployment Plan
1. Apply DDL to tenant databases (`smriti001`, `smriti002`).
2. Deploy backend service models.
3. Validate automated test execution.

---

## 17. Status
**Draft — Ready for Review & Execution**

---

## 18. Related ADRs
- `ADR-001`: Multi-Company Database Architecture.
- `ADR-010`: Governed Document Approvals & Communicator Dispatch Ledgers.

---

## 19. Related Walkthroughs
- `docs/walkthrough/foundation/Platform_Pricing.md`.
