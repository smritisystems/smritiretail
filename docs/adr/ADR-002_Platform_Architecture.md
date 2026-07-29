# ADR-002: Platform Architecture & Technology Stack

**Status:** APPROVED — v1.0 (2026-07-28)  
**Deciders:** Jawahar Ramkripal Mallah (Chief Systems Architect & Creator)  

---

## Context
To build a high-performance, type-safe, and asynchronous backend engine, we must select mature, industry-standard open technology components.

---

## Decision
We standardize on the following core backend stack:
- **Web Framework**: FastAPI (ASGI async HTTP router, OpenAPI auto-generation).
- **ORM Engine**: SQLAlchemy 2.0 (Async Session, Unit of Work pattern).
- **Validation & DTOs**: Pydantic v2 (Rust `pydantic-core`, type-safe request/response schemas).
- **Database Engine**: PostgreSQL 15+ (ACID compliant, JSONB indexing).
- **Container Runtime**: Docker / OCI (Immutable image deployment).

---

## Consequences
- **Positive**: High throughput (>10,000 req/sec), native async IO, auto-generated OpenAPI documentation.
- **Negative**: Requires strict async programming discipline (`async/await`) across all services.
