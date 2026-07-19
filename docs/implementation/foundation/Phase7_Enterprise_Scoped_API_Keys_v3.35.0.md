<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Email        : support@smritibooks.com
  Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.35.0
  Created      : 2026-07-20
  Modified     : 2026-07-20
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Implementation Plan: Phase 7 — Enterprise Scoped Service Account API Keys — v3.35.0

This document defines the technical architecture, database schemas, cryptographic security model, and API endpoints for Phase 7 (Scoped Service Account API Keys) under the SMRITI Enterprise Access & Governance Framework.

---

## 1. Objective
Implement programmatic, non-human service accounts (`SMRITIServiceAccount`) and scoped API key credentials (`SMRITIAPIKey`) with rate limiting, IP whitelisting, permission set scoping, expiration lifecycles, and cryptographic HMAC-SHA256 secret hashing for third-party B2B integrations, POS sync agents, e-commerce gateways, and background automation engines.

---

## 2. Business Motivation
Large enterprise retail clients (e.g., supermarket chains, footwear networks, pharmacy systems) require automated headless data exchange for ERP synchronization, warehouse management systems (WMS), statutory compliance uploaders (GSTN/E-Way Bill), and external e-commerce channels. Interactive JWT user tokens tied to human user accounts are unsuitable for non-interactive background services due to session timeouts and lack of granular IP restrictions.

---

## 3. Scope
- **Models & Database DDL (`smriti_service_accounts`, `smriti_api_keys`, `smriti_api_key_logs`):**
  - High-performance, normalized ORM models with SHA-256 key hashing (`key_prefix` + `hashed_secret`).
  - Scoped tenant association (`company_id`, `branch_id`).
  - Expiration dates (`expires_at`), rate limit rules (`rate_limit_per_minute`), and strict IP CIDR whitelisting (`allowed_ip_cidrs`).
- **Security Context Integration (`api_key` & `X-API-Key` header authentication):**
  - Dependency injection middleware in FastAPI (`get_api_key_context`) to authenticate incoming `X-API-Key` requests.
  - Seamless synthesis of request-scoped `SecurityContext` with bounded permission sets and company/branch containment.
- **REST Management Endpoints (`/api/v1/api-keys`):**
  - Endpoints to create service accounts, generate API keys (displaying raw secret only once), revoke keys, rotate keys, view key audit logs, and toggle key status.
- **Automated Test Suite (`backend/app/tests/test_enterprise_api_keys.py`):**
  - Unit and integration tests asserting header authentication, permission containment, IP whitelisting enforcement, rate limiting, and key revocation.

---

## 4. Current State
- Authentication supports JWT Bearer tokens for human users (`User`).
- API keys are handled via a legacy single-string configuration parameter (`API_KEY_SECRET`) without per-client scoping, audit logging, rate limiting, or IP whitelisting.

---

## 5. Gap Analysis
- No granular service account model for external integrations.
- No ability to assign specific Permission Sets to programmatic API keys.
- No rate limiting or CIDR IP restriction per integration partner.
- Secret keys are stored in plaintext or static global configs rather than cryptographically hashed in Postgres with audit trails.

---

## 6. Architecture Impact
- Extends FastAPI authentication dependencies (`deps.py`) to support Dual-Auth Mode: JWT Bearer Tokens AND `X-API-Key` Header Authentication.
- Integrates seamlessly with Phase 5 RLS interceptor and Phase 3 `require_permission` authorization checks.

---

## 7. Proposed Design

### A. API Key Format & Storage Strategy
```text
Raw API Key Format: smriti_live_<key_prefix>_<secret_entropy>
Database Storage  : key_prefix (Plaintext, 12 chars), hashed_secret (SHA-256 Digest)
```
- During generation, the client receives the raw key `smriti_live_abc123xyz_987654321`.
- The database stores only `key_prefix = "abc123xyz"` and `hashed_secret = sha256("987654321")`.
- Authentication performs instant `key_prefix` indexed lookup, followed by constant-time secret comparison `hmac.compare_digest`.

### B. Request Execution Pipeline for API Keys
```text
Request (X-API-Key Header)
   │
Key Prefix Extraction & DB Lookup
   │
Is Key Active & Not Expired? ➔ NO ➔ 401 Unauthorized
   │
Client IP in allowed_ip_cidrs? ➔ NO ➔ 403 Forbidden
   │
Rate Limit Under Limit? ➔ NO ➔ 429 Too Many Requests
   │
Synthesize SecurityContext (Service Account + Permission Sets + Tenant Scopes)
   │
Proceed to Route Handler
```

---

## 8. Files Created
- `docs/implementation/foundation/Phase7_Enterprise_Scoped_API_Keys_v3.35.0.md`
- `backend/app/models/api_key.py`
- `backend/app/services/api_key_service.py`
- `backend/app/api/v1/api_keys.py`
- `backend/app/tests/test_enterprise_api_keys.py`
- `backend/alembic/versions/<hash>_add_enterprise_api_key_tables.py`

---

## 9. Files Modified
- [backend/app/models/__init__.py](file:///f:/SMRITRretailNXmgrt/backend/app/models/__init__.py)
- [backend/app/api/deps.py](file:///f:/SMRITRretailNXmgrt/backend/app/api/deps.py)
- [backend/app/main.py](file:///f:/SMRITRretailNXmgrt/backend/app/main.py)
- [backend/app/tests/conftest.py](file:///f:/SMRITRretailNXmgrt/backend/app/tests/conftest.py)

---

## 10. Dependencies
- SQLAlchemy 2.0 Async ORM.
- Alembic database migration runner.
- FastAPI dependency injection pipeline.

---

## 11. Risks
- Secret keys exposed in plaintext if logged in HTTP request logs.
- Mitigation: Scrub `X-API-Key` headers in security audit logging middleware.

---

## 12. Rollback Strategy
Revert code to commit `fb9c471` and execute Alembic migration downgrade.

---

## 13. Verification Plan
Run pytest test suite `test_enterprise_api_keys.py` asserting key generation, authentication, IP whitelisting, rate limiting, and permission set containment.

---

## 14. Test Plan
Execute unit tests for `APIKeyService` and integration tests via `AsyncClient` sending `X-API-Key` headers.

---

## 15. Documentation Impact
Update Developer API Guide and OpenAPI schema docs.

---

## 16. Deployment Plan
Apply Alembic DDL migration, copy updated Python files into `smriti-python-core` container, and verify with automated pytest.

---

## 17. Status
Approved / In Progress.

---

## 18. Related ADRs
- **AD-13:** Separation of Identity Concerns.
- **AD-14:** Composition over Inheritance.

---

## 19. Related Walkthroughs
- **Walkthrough-v3.34.0:** Multi-Level Approval Engine.
