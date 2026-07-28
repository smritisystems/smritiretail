# ADR-006: Repository Pattern & SQLAlchemy ORM Isolation

**Status:** APPROVED — v1.0 (2026-07-28)  
**Deciders:** Jawahar Ramkripal Mallah (Chief Systems Architect & Creator)  

---

## Context
Directly coupling business services to SQLAlchemy 2.0 ORM queries makes business logic difficult to test and ties domain rules to database-specific ORM quirks.

---

## Decision
We enforce the **Repository Pattern**:
- Business services (`backend/app/services/`) consume repository interface methods (`await repo.get_by_id(id)`).
- All SQLAlchemy 2.0 async queries, filters, and joins live strictly inside repository classes (`backend/app/repositories/`).
- Service layer contains zero SQL strings or ORM session mutations.

---

## Consequences
- **Positive**: Business logic can be unit-tested using memory repository mocks; ORM framework can be upgraded without breaking business rules.
- **Negative**: Adds a thin data access layer abstraction between services and ORM models.
