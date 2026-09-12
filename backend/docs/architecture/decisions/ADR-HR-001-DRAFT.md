<!--
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Classification: Architecture Decision Record — DRAFT (NOT COMMITTED TO DB)
Created      : 2026-09-03
-->

# ADR-HR-001-DRAFT: HR Domain Registration and Directory Consolidation

**Status:** DRAFT — not inserted into `smritisys.architecture_decisions` until approved  
**Domain:** `hr`  
**Date:** 2026-09-03  
**Author:** Jawahar Ramkripal Mallah  

---

## Context

HR capabilities exist in the frontend but were not registered in the architecture governance registry. Two components were spread across two directories (`hr/` and `hrm/`), and no `hr` domain existed.

### Current State (pre-v1395)

| Component | Directory | Purpose | Engine |
|---|---|---|---|
| `CommissionStudioModal.tsx` | `src/components/hr/` | Sales rep commission tracking | `commissionEngine.ts` |
| `EmployeeAttendanceModal.tsx` | `src/components/hr/` | Attendance management | None (standalone UI) |
| `ShiftCommissionStudioModal.tsx` | `src/components/hrm/` | Shift/hourly commission | `shiftEngine.ts` |

`CommissionStudioModal` is for commissioned sales representatives (revenue-based, period payout, leaderboard).  
`ShiftCommissionStudioModal` is for hourly/shift employees (clock-in/out, tier-based per-invoice attribution).  
These are **distinct commission programs** and must NOT be merged into a single component.

### Missing from Registry

- No `hr` domain in `architecture_domains`
- No `hr`-type entity in `architecture_entities`
- Zero HR capabilities in `architecture_capabilities`

## Decision

### 1. Register `hr` domain

```sql
INSERT INTO architecture_domains (id, name, description)
VALUES ('hr', 'Human Resources & Workforce Management',
        'Governs employee master, attendance, shift management, commission programs, and HR policies.')
```

### 2. Register `hr_domain` entity

The HR domain currently has no single canonical table (future `employees`, `shifts`, `commission_targets` tables are pending). A domain-aggregate entity with `canonical_table = NULL` is registered under the `hr` domain. This is explicitly allowed by v1395 constraint relaxation.

### 3. Register 3 HR capabilities

| capability_key | Component | Engine | integration_type |
|---|---|---|---|
| `hr.sales_rep_commission` | `CommissionStudioModal.tsx` | `commissionEngine.ts` | `LOCAL_ENGINE` |
| `hr.shift_commission` | `ShiftCommissionStudioModal.tsx` | `shiftEngine.ts` | `LOCAL_ENGINE` |
| `hr.attendance` | `EmployeeAttendanceModal.tsx` | None | `LOCAL_EXECUTION` |

### 4. Directory Consolidation Decision

`ShiftCommissionStudioModal.tsx` is currently in `src/components/hrm/`. The canonical HR directory is `src/components/hr/`.

**This ADR APPROVES consolidation of `hrm/` into `hr/`** — subject to:
- A production-safe move (update all importers, verify no broken imports)
- `ShiftCommissionStudioModal.tsx` retains its name (NOT merged with `CommissionStudioModal.tsx`)
- A separate Phase 2 cleanup task is created for the actual file move

**This ADR does NOT authorize the move to happen yet.** The move requires a Phase 2 cleanup task with a full import graph audit.

## Implementation Status

- `hr` domain, `hr_domain` entity, and all 3 capabilities have been inserted (v1395, 2026-09-03).
- `ShiftCommissionStudioModal.tsx` file move: **PENDING** — requires Phase 2 cleanup approval.

## Consequences

- HR capabilities are now visible in the governance registry.
- The `hr` domain is now actively owned.
- `hrm/` directory remains temporarily until the Phase 2 move is approved.

## Related ADRs

- ADR-WMS-001 (entity model pattern for domain-aggregate entities)
