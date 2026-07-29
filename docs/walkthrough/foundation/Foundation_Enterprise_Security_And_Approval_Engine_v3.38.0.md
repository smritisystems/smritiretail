<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.38.0
  Created      : 2026-07-20
  Modified     : 2026-07-20
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough — SMRITI Retail OS v3.38.0 Enterprise Security, Multi-Level Approval Engine & API Key Platform Release

## 1. Purpose
This walkthrough documents the full implementation, validation, and delivery of the Enterprise Security System upgrade for SMRITI Retail OS (v3.34.0 — v3.38.0), incorporating a Multi-Level Document Approval Engine, Scoped Service Account API Keys, Security-Aware UI Studio, and High-Concurrency Stress Testing.

## 2. Scope
- **Phase 6 (v3.34.0)**: Multi-Level Approval Engine (12 ORM entities, AST DSL condition evaluator, FSM state machine, outbox events).
- **Phase 7 (v3.35.0)**: Scoped Service Account API Keys (HMAC-SHA256 secret hashing, IP CIDR validation, sliding window rate limiting).
- **Phase 8 (v3.36.0)**: Security-Aware Menu UI Studio & API Key Management React interface (`ApiKeyManagementSection.tsx`, `ApprovalMatrixTab.tsx`).
- **Phase 9 (v3.37.0)**: High-Concurrency Stress Testing & Optimistic Concurrency Locking verification (`test_enterprise_stress_and_concurrency.py`).
- **Phase 10 (v3.38.0)**: Repository Governance Release & Synchronization.

## 3. Files Created
- `backend/app/models/approval.py`
- `backend/app/models/api_key.py`
- `backend/app/services/approval_resolver.py`
- `backend/app/services/approval_fsm.py`
- `backend/app/services/api_key_service.py`
- `backend/app/api/v1/approvals.py`
- `backend/app/api/v1/api_keys.py`
- `backend/app/tests/test_enterprise_approval_engine.py`
- `backend/app/tests/test_enterprise_api_keys.py`
- `backend/app/tests/test_enterprise_stress_and_concurrency.py`
- `src/components/ApiKeyManagementSection.tsx`
- `docs/implementation/foundation/Phase6_MultiLevel_Approval_Engine_v3.34.0.md`
- `docs/implementation/foundation/Phase7_Enterprise_Scoped_API_Keys_v3.35.0.md`
- `docs/implementation/foundation/Phase8_UI_Security_Approval_And_APIKey_Studio_v3.36.0.md`
- `docs/implementation/foundation/Phase9_Stress_Testing_And_Concurrency_v3.37.0.md`
- `docs/implementation/foundation/Phase10_Governance_Release_And_Documentation_v3.38.0.md`
- `docs/walkthrough/foundation/Foundation_Enterprise_Security_And_Approval_Engine_v3.38.0.md`

## 4. Files Modified
- `backend/app/main.py`
- `backend/app/tests/conftest.py`
- `src/components/ApprovalMatrixTab.tsx`
- `docs/implementation/README.md`
- `docs/walkthrough/README.md`
- `CHANGELOG.md`

## 5. Architecture Decisions
- **Optimistic Concurrency Control**: Document approval transitions increment an integer `version` field. Action requests check `expected_version` against current database version, raising a `ValueError("Concurrency conflict...")` on mismatch.
- **AST-Based DSL Evaluation**: Evaluates rule expressions without dangerous `eval()` calls. Supports threshold comparisons, logical `AND`/`OR`, and attribute lookups safely.
- **HMAC-SHA256 API Key Verification**: Raw keys are never stored. The system retains only a 12-character prefix and HMAC-SHA256 secret hash.

## 6. Design Rationale
Combines granular RBAC authorization with flexible, multi-tiered document approvals to satisfy enterprise retail governance standards (e.g. D-Mart, Reliance Retail, Metro Cash & Carry).

## 7. Implementation Summary
1. Built SQLAlchemy ORM models for approval policies, matrices, steps, conditions, assignments, requests, actions, histories, delegations, escalations, comments, and outbox logs.
2. Built service account models, API keys, key-permission-set mappings, and key audit logs.
3. Created FastAPI `/api/v1/approvals` and `/api/v1/api-keys` endpoints.
4. Created React API Key Management Studio (`ApiKeyManagementSection.tsx`) with secret creation modal, revocation actions, and audit trail drawer.
5. Added automated stress test suite for 50 concurrent authentications, optimistic locking race conditions, and AST evaluation performance.

## 8. Tests Executed
```bash
python -m pytest app/tests/test_enterprise_approval_engine.py app/tests/test_enterprise_api_keys.py app/tests/test_enterprise_stress_and_concurrency.py -v
npm run build
```

## 9. Verification Results
- **Backend Test Suite**: 13/13 passed (100%).
- **Frontend Vite Build**: 3,379 modules transformed cleanly with 0 errors.

## 10. Known Limitations
- Redis-backed rate limiting slider fallback currently defaults to sliding in-memory window per node.

## 11. Future Work
- Integration of WebSocket push notifications for instant approval request alerts.

## 12. Related ADRs
- ADR-003: Platform Abstraction Layer
- ADR-007: Enterprise Authorization Architecture

## 13. Related RFCs
- RFC-022: Multi-Level Document Approval Engine
- RFC-023: Scoped Service Account API Keys
