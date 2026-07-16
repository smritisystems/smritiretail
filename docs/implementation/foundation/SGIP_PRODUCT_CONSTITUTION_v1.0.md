<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.16.0
  Created      : 2026-07-12
  Modified     : 2026-07-12
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

> **Status: Phase 0 — Constitution Only.**
> No code under `backend/app/compliance/` exists yet. This document defines
> the target architecture and governance rules for when implementation
> begins. Do not cite this document as evidence of a built capability.

# SMRITI Government Integration Platform (SGIP) — Product Constitution

This constitution serves as the authoritative architectural foundation and governance contract for all compliance integrations in SMRITI Retail OS. All AI agents, engineers, and modules must conform to these policies.

---

## 1. Architecture Principles

1. **FastAPI Compliance System of Record**: FastAPI + PostgreSQL is the sole transactional system of record for all compliance operations, secret storage, and queue management.
2. **Express is a Gateway Only**: Express acts as a lightweight layout routing host and proxy router. It must never decrypt credentials, schedule jobs, or call government compliance endpoints.
3. **Versioned Connectors**: Every government, banking, or tax integration must be implemented as a versioned Connector adhering to `ConnectorV1` or newer interfaces.
4. **Insulated Database Access**: Connectors are strictly stateless, pure functions. No connector may write to or read from the database directly; all operations are mediated by the `ComplianceService` layer.
5. **Encrypted at Rest**: Plaintext secrets (passwords, client secrets) must never be stored. All storage columns must contain encrypted values (`encrypted_password`, `encrypted_client_secret`) secured via AES-256-GCM.
6. **Full Auditability**: Every request and response payload passing through external gateways must be captured in the `ApiAuditLog` with durations, response codes, and timestamps.
7. **Strict Idempotency**: All submissions must use unique, deterministic idempotency keys to prevent duplicate transactions (e.g. double E-Way bill generation).
8. **Separation of Router Logic**: API controllers must only parse requests and validate inputs. All business policies, state changes, and queue triggers must be dispatched to the service layer.
9. **Circuits & DLQs**: Connectors must be wrapped in Circuit Breakers to fail fast when external networks are down, routing persistently failing tasks to a Dead Letter Queue (DLQ).
10. **HREP Mapping Compliance**: Raw HTTP stack traces, database exceptions, and external API error codes must be mapped to user-friendly business guidance before being returned to the UI.

---

## 2. Bounded Context Domain Purity

1. **Strict Encapsulation**: The `compliance` module is a closed bounded context. Nothing outside `backend/app/compliance/` is allowed to directly import or call repositories, credentials databases, vault keys, or manifest registries.
2. **Minimal Public API Contract**: Any communication between external application services and the compliance module must occur strictly via public functions exposed in the top-level package module init `compliance/__init__.py`.
3. **Internal Decoupling**: Repositories must perform persistence tasks only and are forbidden from calling services or cryptographic utility functions.

---

## 3. OpenAPI Governance

1. **Mandatory Documentation**: Every endpoint registered in the compliance router must specify a unique summary and detailed description explaining its intent.
2. **Strict Schema Mapping**: All input payloads and endpoint output results must use explicit Pydantic schemas.
3. **Normalized Tagging**: Group all swagger documentation endpoints under the `Compliance` tag header.

---

## 4. ADR Governance & History

1. **Decision Immutability**: Accepted Architectural Decision Records (ADRs) must never be modified or altered retroactively.
2. **Evolution Registry**: If architectural revisions occur, create new numbered entries (e.g., ADR-002, ADR-003) referencing the original decisions being superseded or complemented.

---

## 5. Connector Contract

Each connector must represent a self-contained package under `backend/app/compliance/connectors/` with its own `manifest.yaml`:

```yaml
id: ewaybill
name: NIC E-Way Bill
version: 1.0.0
provider: NIC
api_version: v1
status: active
display_name: E-Way Bill Integration
description: Standard dynamic GSTN/NIC E-Way Bill compliant transaction gateway
documentation_url: https://smritibooks.com/docs/ewaybill
minimum_platform_version: 3.16.0
authentication:
  type: token
environments:
  sandbox:
    enabled: true
  production:
    enabled: false
capabilities:
  - generate
  - cancel
  - update_vehicle
```

All versioned connectors must implement the abstract connector interface:
* `authenticate(credentials: dict) -> str`
* `submit(payload: dict, token: str) -> dict`
* `cancel(document_no: str, reason: str, token: str) -> dict`

---

## 6. State Machines

### 6.1 Compliance Outbox States
```text
[Draft] ──► [Validated] ──► [Queued] ──► [Authenticating] ──► [Submitting] ──► [Waiting Response] ──► [Success]
                                                                     │
                                                                     ▼
                                                                  [Failed] ◄──► [Retry]
                                                                     │
                                                                     ▼
                                                                [Dead Letter]
```

### 6.2 Connector Lifecycle States
```text
[Created] ──► [Registered] ──► [Configured] ──► [Validated] ──► [Enabled] ──► [Disabled] ──► [Deprecated] ──► [Removed]
```

---

## 7. Definition of Done (DoD)

No compliance task is complete until:
1. **DB Migration**: Alembic autogenerated migration file committed and verified.
2. **Clean compilation**: Linter checks (`tsc --noEmit` and python code style checks) pass with 0 errors.
3. **Tests Passed**: pytest suite passes with 100% success rate, covering repository, vault, manifest, services, and routers.
4. **Documentation**: Walkthrough updated, and CHANGELOG entry logged.
