<!--
Author & Creator:
Jawahar Ramkripal Mallah

Founder:
SmritiSys
AITDL Networks

Role:
Chief Systems Architect

Web:
smritisys.com | smritibooks.com | aitdl.com

Email:
jawahar.mallah@gmail.com

Copyright © 2026 SmritiSys.
All Rights Reserved.
-->

# ADR-012: Database Blueprint Governance

**Status:** ACCEPTED — 2026-07-28  
**Deciders:** Chief Systems Architect — Jawahar Ramkripal Mallah  
**Constitutional Level:** Level 1 (Permanent)  
**Supersedes:** None  
**Referenced by:** ADR-004 (Database Governance), AOP-004 (Additive DDL)

---

## Context

SMRITI Retail OS has grown to 203 SQLAlchemy tables across 47 model files with 72 Alembic migrations. Without a formal database governance document, schema changes risk:

- Introducing tables without declared business ownership
- Duplicating canonical entities across modules (GR-001 violation)
- Adding columns or tables without business justification (GR-009 violation)
- Schema drift between documentation and the actual database

A formal Database Blueprint serves as the single authoritative reference for all schema decisions.

---

## Decision

### DBP-001 — Database Blueprint is Authoritative

> The `SMRITI_DATABASE_BLUEPRINT_v1.0.md` is the single authoritative reference for all database schema decisions.
>
> **No new Alembic migration shall be committed unless:**
> 1. The corresponding table or column is documented in the Database Blueprint.
> 2. The change is reviewed against the Canonical Data Model.
> 3. The migration file header references the Blueprint section and ADR.

### DBP-002 — Canonical Ownership

> Every database table shall have exactly ONE owning module. Other modules may consume a table only through:
> - Published Service interfaces
> - Repository pattern (ADR-006)
> - Published API contracts
>
> Direct cross-module table access or parallel duplicate schemas are prohibited (GR-001 / GR-011).

### DBP-003 — Migration Traceability

> Every Alembic migration file MUST include a header comment referencing:
> - The Database Blueprint section it implements
> - The Canonical Data Model entity (if applicable)
> - The ADR number (when introducing structural schema change)
>
> Example:
> ```python
> """Add journal_entries table
>
> DBP Reference : SMRITI_DATABASE_BLUEPRINT_v1.0.md §3 — Accounting
> CDM Reference : SMRITI_CANONICAL_DATA_MODEL_v1.0.md — LedgerEntry
> ADR Reference : ADR-012 (Database Blueprint Governance)
> Revision ID   : a1b2c3d4e5f6
> """
> ```

### Supplier Ownership Decision

`suppliers` table remains owned by the **Purchase module** (`backend/app/models/purchase.py`).
CRM may consume supplier data exclusively through `SupplierService` or the `/api/internal/v1/suppliers` endpoint.
No `Supplier` model shall be defined in `crm.py` or any other module.

### ERD Format

Both formats are maintained in parallel:
- `docs/database/ERD_*.mmd` — Mermaid (version-controlled, GitHub-renderable)
- `docs/database/ERD_*.png` — PNG (generated in Docker, for documentation)

Module-level sub-ERDs are maintained in addition to the full ERD.

### Accounting Gap — Phase 1 Only

Immediate additions (Phase 1):
- `financial_year` table — period locking for GST filing and ledger close
- `journal_entries` table — double-entry bookkeeping backbone

Deferred to Phase 2+ after business requirement validation:
- `bank_accounts`, `payment_terms`, `tax_ledger_accounts`

---

## Consequences

### Positive
- Every schema change is traceable to a business decision
- GR-001 (SSOT) enforced at the database layer
- New developers and AI agents have a single reference for the database
- Migration history becomes auditable

### Negative / Trade-offs
- Adds a documentation step before every migration (cost: ~15 min per migration)
- Blueprint document requires maintenance discipline

### Risks
- Blueprint can drift from reality if not enforced in CI
- **Mitigation:** `scripts/validate_ssot_architecture.py` will be extended to validate migration header comments

---

## Related Documents
- `docs/database/SMRITI_DATABASE_BLUEPRINT_v1.0.md`
- `docs/database/SMRITI_CANONICAL_DATA_MODEL_v1.0.md`
- `docs/database/TABLE_OWNERSHIP_REGISTRY.md`
- `docs/governance/DB_Standards.md`
- `backend/app/db/base.py` — BaseEntity mixin (all audit/tenant/soft-delete fields)
