<!--
  Project      : SMRITI Retail OS
  Repository   : SMRITIRetailNX
  Organization : AITDL NETWORKS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 1.0.0
  Created      : 2026-10-06
  Modified     : 2026-10-06
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal — Technical Architecture Walkthrough
-->

# SMRITI DataBridge Phase 1 — Core Foundation Walkthrough

## 1. Purpose
This walkthrough documents the successful implementation of **Phase 1 — SMRITI DataBridge Core Foundation** in SMRITI Retail OS. It establishes the authoritative, governed service boundary, platform capability registration, and strict tenant isolation guard chain without creating entity-specific import/export adapters or premature database migrations.

---

## 2. Scope
- Creation of the canonical service boundary under `backend/app/services/databridge/`.
- Technical registration of the `DATABRIDGE` platform capability (`cap_databridge`) in the control plane capability registry (`is_core=False`, `default_enabled=False`).
- Creation of the governed API namespace under `backend/app/api/v1/databridge.py` with endpoints `/status` and `/contract/ping`.
- Strict enforcement of the canonical 7-stage security guard chain:
  `AUTH` $\rightarrow$ `TenantContext` $\rightarrow$ `Capability Entitlement` $\rightarrow$ `RBAC` $\rightarrow$ `Company DB Resolution` $\rightarrow$ `Business Operation` $\rightarrow$ `Audit`.
- Enforcement of hard tenant boundary isolation (`smritisys` is Control Plane ONLY; business operations targeting `smritisys` are strictly rejected).
- Cryptographic WORM audit logging integration via `compliance_immutable_audit_logs`.
- Zero database migrations (reusing existing `tenant_capability_bindings` and `compliance_immutable_audit_logs`).
- Zero changes to legacy `backend/app/api/v1/exchange.py` (preserved intact for strangler-fig migration in later phases).

---

## 3. Files Created
1. `backend/app/services/databridge/__init__.py`: Module entry point exporting `DataBridgeService`, domain models, and exceptions with canonical capability annotations.
2. `backend/app/services/databridge/exceptions.py`: Standardized domain exceptions (`DataBridgeError`, `DataBridgeEntitlementError`, `DataBridgeTenantIsolationError`, `DataBridgePermissionError`, `DataBridgePayloadTooLargeError`, `DataBridgeBarcodeConflictError`).
3. `backend/app/services/databridge/models.py`: Authoritative Pydantic DTO contracts (`DataBridgeStatusResponse`, `DataBridgeContractPingRequest`, `DataBridgeContractPingResponse`, `DataBridgeSecurityContext`, `DataBridgeReconciliationSummary`).
4. `backend/app/services/databridge/service.py`: Canonical service boundary implementing `verify_tenant_boundary`, `verify_capability_entitlement`, `get_status`, `record_audit_entry`, and `execute_contract_ping`.
5. `backend/app/api/v1/databridge.py`: FastAPI v1 route controller enforcing the 7-stage security chain.
6. `backend/tests/test_databridge_phase1.py`: Comprehensive 9-scenario unit and integration test suite.
7. `scripts/register_databridge_phase1_architecture.py`: Governance registration script registering `ADR-DATABRIDGE-01`, entity `databridge`, and issuing preflight certificates.
8. `.architecture/certificates/PF-2026-1006-BD674A.json`: Preflight certificate for `backend/app/services/databridge/service.py`.
9. `.architecture/certificates/PF-2026-1006-D4BDC2.json`: Preflight certificate for `backend/app/services/databridge/__init__.py`.
10. `.architecture/certificates/PF-2026-1006-2BA0B8.json`: Preflight certificate for `backend/app/services/databridge/models.py`.
11. `.architecture/certificates/PF-2026-1006-AD9CCF.json`: Preflight certificate for `backend/app/services/databridge/exceptions.py`.
12. `.architecture/certificates/PF-2026-1006-4BD0C2.json`: Preflight certificate for `backend/app/api/v1/databridge.py`.

---

## 4. Files Modified
1. `backend/app/db/seed_cap_master.py`: Registered `cap_databridge` (`DATABRIDGE`, `PLATFORM`, `is_core=False`, `default_enabled=False`).
2. `backend/app/services/capability_service.py`: Added `"DATABRIDGE"` to canonical capability validation set.
3. `backend/app/main.py`: Imported `databridge` router and mounted at `(databridge, "/databridge", ["SMRITI DataBridge"])` under `# --- Integration & Data ---`.
4. `docs/implementation/README.md`: Updated master index table with Phase 1 status and walkthrough link.

---

## 5. Architecture Decisions
- **Zero-Migration Foundation:** Persistent DataBridge jobs and staging tables are deferred until Phase 7. In Phase 1, tenant capability entitlement is governed by the existing `tenant_capability_bindings` table, and audit trail is stored in `compliance_immutable_audit_logs`.
- **Fail-Closed Capability Model:** SMRITI DataBridge is registered as a non-core platform capability (`is_core=False`, `default_enabled=False`). If not explicitly activated for a tenant company in `tenant_capability_bindings`, access is rejected immediately with HTTP 403 and business error code `SMRITI-CAP-001`.
- **Strict Control Plane Protection:** The tenant database resolver checks `session.info["resolved_database_name"]`. If the session resolves to `smritisys` or has no resolved database name, `DataBridgeTenantIsolationError` (`SMRITI-TENANT-001`) is raised, completely preventing accidental writes to the control plane.
- **Strangler-Fig Coexistence:** Legacy `backend/app/api/v1/exchange.py` is left untouched. The new `/api/v1/databridge` namespace operates side-by-side with zero collisions.

---

## 6. Design Rationale
- **Canonical Dependency Reuse:** Rather than reinventing authentication, tenant isolation, RBAC, or audit engines, `databridge.py` directly reuses `get_current_user`, `get_tenant_context`, `get_company_db`, `require_permission`, and `ComplianceImmutableAuditLog`. This guarantees compliance with SMRITI architecture governance and prevents architectural duplication.
- **Cryptographic Hash-Chaining:** Even at the foundational handshake level (`/contract/ping`), every executed operation writes a WORM-locked audit record with SHA-256 payload digest and previous-hash chaining, establishing tamper-evident traceability from day one.

---

## 7. Implementation Summary
The implementation establishes a clean, extensible architectural boundary:
```text
Client Request
    │
    ▼
FastAPI Router: /api/v1/databridge
    │
    ├── 1. AUTH: get_current_user (JWT validation)
    ├── 2. TENANT: get_tenant_context (header tampering checks, company normalization)
    ├── 3. ENTITLEMENT: require_databridge_entitlement (checks tenant_capability_bindings)
    ├── 4. RBAC: require_permission("databridge", "READ" | "EXECUTE")
    ├── 5. COMPANY DB: get_company_db (routes session to tenant DB e.g. smriti001)
    │
    ▼
DataBridgeService (backend/app/services/databridge/)
    ├── verify_tenant_boundary() -> asserts db != "smritisys"
    ├── record_audit_entry()     -> writes WORM SHA-256 record to compliance_immutable_audit_logs
    └── execute_contract_ping()  -> produces DataBridgeContractPingResponse
```

---

## 8. Tests Executed
Targeted test suite in `backend/tests/test_databridge_phase1.py` covering 9 essential test vectors:
- `test_databridge_unauthorized_missing_token`: Rejects unauthenticated request with 401.
- `test_databridge_unauthorized_invalid_token`: Rejects forged token with 401.
- `test_databridge_capability_disabled_by_default`: Fails closed with 403 and `SMRITI-CAP-001`.
- `test_databridge_tenant_header_tampering_rejected`: Rejects unauthorized company header with 403.
- `test_databridge_tenant_isolation_boundary_check`: Asserts `smritisys` or unmapped sessions raise `SMRITI-TENANT-001`.
- `test_databridge_authorized_status_success`: Returns 200 OK with `DataBridgeStatusResponse` when entitled.
- `test_databridge_contract_ping_handshake`: Returns 200 OK with cryptographic SHA-256 proof.
- `test_databridge_architecture_guard_order_and_reuse`: Verifies canonical dependency reuse.
- `test_databridge_oversized_payload_rejection`: Rejects oversized token with 422.

---

## 9. Verification Results
- **Unit & Integration Tests:** 9/9 passed (`pytest backend/tests/test_databridge_phase1.py`).
- **Regression Suite:** 12/12 passed (`pytest backend/tests/test_postgres_outbox_worker.py`).
- **Architecture Duplication Gate:** 11/11 checks passed, 0 violations (`scripts/architecture_duplication_gate.py`).
- **Preflight Certificates:** All 5 new Phase 1 source files certified in smritisys DB and local `.architecture/certificates/`.

---

## 10. Known Limitations
- Entity-specific import/export (Item Master, Barcode, Customer, PriceBook) is not yet implemented (scheduled for Phase 2).
- SMRITI-X schema validators and file parsers are not yet implemented (scheduled for Phase 3 and Phase 4).
- Background asynchronous queue execution is not yet wired (scheduled for Phase 7).

---

## 11. Future Work
- **Phase 2:** Catalog Domain Adapters (`ItemMaster`, `ItemVariant`, `ItemBarcode`, `PriceBook`).
- **Phase 3:** Parties & Master Data Adapters (`Customer`, `Supplier`, `Branch`, `Account`).
- **Phase 4:** SMRITI-X Parser, Validator & Serializer (JSON/CSV/XLSX).
- **Phase 5:** Interactive Preview & Reconciliation Engine.
- **Phase 6:** Hardware & External Integrations.
- **Phase 7:** Asynchronous Large-File Processing Engine.
- **Phase 8:** Frontend DataBridge Workspace Studio.
- **Phase 9:** Strangler-Fig Migration & Legacy Decommissioning.

---

## 12. Related ADRs
- `ADR-DATABRIDGE-01`: SMRITI DataBridge Enterprise Import/Export & Transfer Architecture.

---

## 13. Related RFCs
- `RFC-DATABRIDGE-001`: Universal Ingress/Egress Contract & SMRITI-X File Specification.
