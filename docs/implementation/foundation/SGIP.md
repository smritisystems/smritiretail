<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 1.1.0
  Created      : 2026-07-12
  Modified     : 2026-07-12
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# SMRITI Government Integration Platform (SGIP) — Implementation Plan v1.1

> **Status: Phase 0 — Constitution Only, entering Milestone 1.**
> No code under `backend/app/compliance/` exists yet as of this plan's
> creation. This document defines the target architecture and governance
> rules for Milestone 1 implementation. Do not cite this document as
> evidence of a built capability until the Completion Report (§9) has been
> independently verified against actual repository contents.

> **Revision note (v1.1):** This revises v1.0 after review. Four gaps were
> found and closed — master key sourcing (§7.1), deterministic-encryption
> gating (§7.2), a missing test fixture for connector discovery (§10.1),
> and missing lint/type-check enforcement (§8). All four are now explicit
> Definition-of-Done items, not prose statements of intent.

## AI Agent Execution Rules
1. Implement **ONLY Milestone 1**.
2. Do **NOT** start Milestone 2.
3. Do **NOT** create placeholder implementations for future milestones.
4. Do **NOT** implement any HTTP integrations.
5. Do **NOT** implement any Government API connector.
6. Do **NOT** add speculative features.
7. If additional functionality is required, stop and produce a completion report instead of continuing into the next milestone.
8. Do **NOT** hardcode a default value for any secret, key, or credential. If a required secret is missing from the environment, the application must fail to start with a clear error — never fall back silently.
9. Every claim in the final Completion Report (§9) must be verifiable by a reviewer re-running the same commands in a clean environment. Do not report a status you have not personally executed and observed in this session.

---

## 1. Objective
Design and implement the SMRITI Government Integration Platform (SGIP) compliance framework inside the FastAPI + PostgreSQL backend using a 5-milestone phased plan, keeping compliance-specific artifacts contained under `backend/app/compliance/`.

## 2. Scope & Roadmap

### ✅ Milestone 0 — Architecture Freeze (COMPLETE — verified)
* **Goal**: Establish architecture principles, folder structures, and connector contracts.
* **Deliverables** (confirmed present in repository):
  * `docs/implementation/foundation/SGIP_PRODUCT_CONSTITUTION_v1.0.md`
  * `docs/architecture/decisions/SGIP_ADR_001_Compliance_Architecture.md`

### ⬜ Milestone 1 — Compliance Foundation (THIS PLAN)
* **Goal**: Build database layer, credentials vault, registry, abstract connector, schemas, and unit tests.
* **Excluded**: Real connector logic, HTTP Client SDK, Circuit Breaker, Queue Worker, and external government API requests.

### ⬜ Milestone 2 — Integration Infrastructure (DEFERRED)
* **Goal**: Build HTTP Client SDK, Retry Engine, Circuit Breaker, Compliance Event Bus, and Queue Worker.

### ⬜ Milestone 3 — Government Connectors (DEFERRED)
* **Goal**: Implement isolated connectors in packages under `connectors/ewaybill/` and `connectors/einvoice/`.

### ⬜ Milestone 4 — AI & Analytics (DEFERRED)
* **Goal**: Implement dashboards, GST forecasts, and analytics.

---

## 3. Dependency Rules

```text
Frontend
   │
   ▼
API Router
   │
   ▼
Service Layer
   │
   ▼
Repository
   │
   ▼
Models
```

* **Vault**: Decoupled cryptographic engine, imported by `CredentialService`.
* **Registry**: Package discovery module, imported by `RegistryService`.
* **Enforcements**:
  * Models must never import Services or Repositories.
  * Repositories SHALL NOT call Services, Vault, or Registry layers. Repositories SHALL only perform database persistence.
  * Services SHALL coordinate repositories, vault, registry, and policy engine modules.
  * Connectors must never import Database Models.
  * Services are the only layer allowed to coordinate database and vault state.

---

## 4. State Enums

```python
class ComplianceState(str, Enum):
    DRAFT = "DRAFT"
    VALIDATED = "VALIDATED"
    QUEUED = "QUEUED"
    AUTHENTICATING = "AUTHENTICATING"
    SUBMITTING = "SUBMITTING"
    WAITING_RESPONSE = "WAITING_RESPONSE"
    SUCCESS = "SUCCESS"
    RETRY = "RETRY"
    FAILED = "FAILED"
    DEAD_LETTER = "DEAD_LETTER"
    CANCELLED = "CANCELLED"

class GovernmentServiceStatus(str, Enum):
    ACTIVE = "ACTIVE"
    DISABLED = "DISABLED"
    DEPRECATED = "DEPRECATED"

class ConnectorStatus(str, Enum):
    REGISTERED = "REGISTERED"
    CONFIGURED = "CONFIGURED"
    ENABLED = "ENABLED"
    DISABLED = "DISABLED"
```

---

## 5. Manifest Schema (`manifest.yaml`)

```yaml
id: ewaybill
name: NIC E-Way Bill
version: 1.0.0
provider: NIC
api_version: v1
status: active
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

* **Schema Validation**: The Connector Registry must validate this structure during initialization. If a schema violation or duplicate connector ID is detected, it must throw a **`ConnectorLoadException`**.
* See §10.1 for the test fixture manifest required to actually exercise this logic in Milestone 1.

---

## 6. Non-Goals (Milestone 1)
The following are explicitly **OUT OF SCOPE** for this milestone:
* Government API integration
* HTTP requests
* Retry Engine
* Queue Workers
* Circuit Breaker
* Event Bus
* Celery/Arq
* Background Jobs
* Authentication Tokens
* Dashboard UI
* AI Analytics
* Forecasting
* Compliance Reports
* Scheduler

---

## 7. Acceptance Criteria

### 7.1 Credential Vault — key sourcing (NEW — closes prior gap)
* AES-256-GCM encryption.
* HKDF-SHA256 key derivation.
* Company-specific derived keys.
* Zero plaintext persistence.
* **Master/root key MUST be read from a dedicated environment variable
  (e.g. `SGIP_VAULT_MASTER_KEY`), with NO default value in code.** If the
  variable is missing at startup, the application must fail to start with
  an explicit error — mirror the existing `JWT_SECRET_KEY` pattern already
  established in `backend/app/core/config.py`.
* The master key MUST NOT be the same value as `JWT_SECRET_KEY` — separate
  secrets for separate concerns.
* Document the required env var in `.env.example` with a placeholder value
  and a comment stating it must be generated fresh per environment (never
  copied from example to production).

### 7.2 Deterministic encryption mode (NEW — closes prior gap)
* Encryption MAY be deterministic only when running under pytest.
* Enforcement: gate this behind detection of the test environment (e.g.
  `os.getenv("PYTEST_CURRENT_TEST")` or an equivalent explicit test-only
  signal), NOT a general-purpose settings boolean that could be left
  `True` in a production `.env` file by mistake.
* Add a unit test asserting that deterministic mode is OFF when the
  test-environment signal is absent, to prevent silent regression.

### Connector Registry
* Loads all `manifest.yaml` files.
* Detects duplicate connector IDs.
* Validates manifest schema (throws `ConnectorLoadException` on invalid/missing fields).
* Supports versioning.
* Supports enable/disable state.
* Registry logic is exercised against the fixture manifest defined in §10.1 — this is required for the corresponding Definition-of-Done item to be considered met.

### Repository Layer
* No business logic.
* Only persistence.
* Transaction-safe.
* Unit tested.

---

## 8. Definition of Done – Milestone 1
A milestone is considered complete only when ALL of the following are satisfied:
- [ ] All SQLAlchemy models implemented under `backend/app/compliance/models/`.
- [ ] Bounded context imports registered in `backend/app/compliance/models/__init__.py`. (Do **NOT** modify the root `backend/app/models/__init__.py`).
- [ ] Alembic migration generated and applied successfully.
- [ ] Pydantic schemas validated under `backend/app/compliance/schemas/`.
- [ ] Credential Vault encrypts/decrypts successfully, using a master key sourced per §7.1 (no hardcoded default).
- [ ] Deterministic-encryption mode gated per §7.2, with the regression test in place.
- [ ] ConnectorRegistry discovers manifests automatically, verified against the fixture manifest in §10.1.
- [ ] Repository tests pass.
- [ ] Service layer tests pass.
- [ ] API router tests pass.
- [ ] OpenAPI documentation generated.
- [ ] Code coverage >= 90% for compliance modules.
- [ ] Ruff, MyPy, and Bandit checks pass for `backend/app/compliance/` — run explicitly and paste output; do not assume passing based on existing CI (the CI pipeline does not currently run these tools — see repository-wide CI gap tracked separately).
- [ ] The Debug Outbox Endpoint (§11) has an explicit test asserting it is inaccessible when `ENVIRONMENT=production` — a prose statement of "disabled in production" is not sufficient.
- [ ] Conforms to SGIP Product Constitution.

---

## 9. Final AI Completion Report Format

Upon completing Milestone 1, the AI agent must output the completion report in this format:

```text
Completion Report

Architecture           ✓
Files Created          [List of paths]
Files Modified         [List of paths]
Alembic Revision       [Migration ID]
Models                 [Names of SQLAlchemy Models]
Schemas                [Names of Pydantic Schemas]
Repositories           [Names of Repository classes]
Services               [Names of Service classes]
Routes                 [Endpoint details]
Tests                  [Test runner outputs — literal, not summarized]
Coverage               [Percentage number, from actual coverage tool output]
Lint (Ruff)            [Pass / Fail status, literal output]
Type Checking (MyPy)   [Pass / Fail status, literal output]
Security (Bandit)      [Pass / Fail status, literal output]
Master Key Source      [Env var name used, confirm no default in code]
Deterministic Mode Gate [Test name confirming it is OFF outside pytest]
Known Limitations      [Text description]
Deferred Work          [Text description]
Milestone Status       PASS / FAIL
```

Do not self-assign an "Evidence Level." That determination is made by the
human reviewer after independently reproducing the test run.

---

## 10. Proposed Folder Structure

All compliance artifacts are located together within the self-contained `backend/app/compliance/` module.

```text
backend/app/
└── compliance/
    ├── __init__.py
    ├── api/
    │   ├── __init__.py
    │   └── router.py
    ├── connectors/
    │   ├── __init__.py
    │   └── base.py
    ├── services/
    │   ├── __init__.py
    │   ├── compliance_service.py
    │   ├── credential_service.py
    │   ├── audit_service.py
    │   ├── registry_service.py
    │   └── policy_service.py
    ├── repositories/
    │   ├── __init__.py
    │   └── compliance.py
    ├── models/
    │   ├── __init__.py
    │   └── compliance.py
    ├── schemas/
    │   ├── __init__.py
    │   └── compliance.py
    ├── vault/
    │   ├── __init__.py
    │   └── crypto.py
    ├── registry/
    │   ├── __init__.py
    │   └── registry.py
    ├── policies/
    │   ├── __init__.py
    │   └── engine.py
    └── tests/
        ├── __init__.py
        ├── fixtures/
        │   └── manifest.example.yaml     ← NEW, see §10.1
        └── test_compliance_foundation.py
```

### 10.1 Required test fixture (NEW — closes prior gap)
Milestone 1 must include a dummy connector manifest at
`backend/app/compliance/tests/fixtures/manifest.example.yaml`, matching the
schema in §5, used ONLY to exercise `ConnectorRegistry` discovery/validation
logic in tests. This fixture must NOT reference any real government
endpoint, must have `environments.production.enabled: false`, and must be
clearly named/commented as a test-only fixture so it is never mistaken for
a real connector in Milestone 3.

---

## 11. API Router Details

### Health Check Endpoint
* **GET `/api/v1/compliance/health`**
* Returns status of Database connection, Vault decryption keys, Registry modules, and loaded Connectors.
* JSON Output Schema:
  ```json
  {
    "status": "healthy",
    "database": "healthy",
    "vault": "healthy",
    "registry": "healthy",
    "connectors": 0,
    "version": "1.0.0",
    "milestone": "1"
  }
  ```

### Debug Outbox Endpoint (Admin-only, Disabled in Production)
* **POST `/api/v1/compliance/debug/outbox`**
* Allows manual insertion of outbox events during development and integration testing.
* Enforcement mechanism: gate behind `settings.ENVIRONMENT != "production"`,
  returning 404 (not 403 — do not reveal the route exists) when in
  production mode.
* Required test: assert 404 when `ENVIRONMENT=production` is set, and 200/expected
  behavior otherwise. See §8 Definition-of-Done — this is not satisfied by
  a comment or docstring alone.
