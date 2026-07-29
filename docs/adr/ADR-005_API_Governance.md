# ADR-005: API Governance, OpenAPI Contracts, & Headless DTOs

**Status:** APPROVED — v1.0 (2026-07-28)  
**Deciders:** Jawahar Ramkripal Mallah (Chief Systems Architect & Creator)  

---

## Context
APIs serve as binding contracts between SMRITI Platform API and frontend applications (Workspace, Portal, Mobile). Silently changing response payloads breaks production clients.

---

## Decision
1. **API Versioning**: Gateways enforce `/api/public/v1/*` (External) and `/api/internal/v1/*` (Workspace).
2. **Headless DTOs**: Backend business modules MUST return type-safe Pydantic v2 DTOs (JSON), never HTML responses.
3. **Deprecation Lifecycle**: Published APIs adhere to the 4-stage deprecation cycle (`Experimental` → `Supported` → `Deprecated` → `Removed`).

---

## Consequences
- **Positive**: Complete client-server decoupling, backward compatibility, automatic SDK generation via OpenAPI specs.
- **Negative**: Requires maintaining versioned API gateways during major upgrades.
