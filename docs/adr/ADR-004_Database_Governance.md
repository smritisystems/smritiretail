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

# ADR-004: Database Governance, Additive DDL, & Alembic Migrations

**Status:** APPROVED — v1.0 (2026-07-28)  
**Deciders:** Jawahar Ramkripal Mallah (Chief Systems Architect & Creator)  

---

## Context
Database schema evolution must occur safely across thousands of live retail store deployments without data loss, downtime, or breaking API contracts.

---

## Decision
1. **Primary Database**: PostgreSQL 15+ with ACID compliance and JSONB document support.
2. **Schema Evolution**: Schema modifications MUST be additive (`ADD COLUMN IF NOT EXISTS`). Destructive DDL (column drop or table rename) is strictly forbidden in minor releases.
3. **Migration Engine**: All DDL changes MUST be versioned using `Alembic` scripts (`backend/alembic/versions/`).

---

## Consequences
- **Positive**: Zero-downtime database upgrades, deterministic migration history, rollback safety.
- **Negative**: Requires multi-phase deprecation cycles to remove unused columns.
