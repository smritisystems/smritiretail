<!--
  Project      : SMRITI Retail OS
  Organization : SmritiSys
  Author       : Jawahar Ramkripal Mallah
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
-->

# Database Blueprint v1.0, Domain Events & Milestone 1 Foundation Walkthrough


**Version:** v1.0.0  
**Date:** 2026-07-28  
**Author:** Jawahar Ramkripal Mallah — Chief Systems Architect  
**Classification:** Internal  
**Area:** Foundation / Database / Events / Architecture

---

## 1. Purpose

Document the database governance freeze (DBB v1.0), domain event bus wiring, and Milestone 1 Foundation Integrity work executed in this session.

---

## 2. Scope

| Layer | What Changed |
|:---|:---|
| Governance | ADR-012 (DBB), ADR-013 (Event Bus), DBP-001..004, AGENTS.md updated |
| Database | `financial_year` table added (migration v1211), 5 Mermaid ERDs created |
| Documentation | Blueprint, Canonical Data Model, Table Ownership Registry, Health Matrix |
| Repository Layer | `inventory.py`, `purchase.py`, `crm.py` repositories created |
| Domain Events | 3 publishers added, `domain_events.py` deprecated per ADR-013 |
| Services | `purchase.py` + `crm.py` wired with post-commit domain events |

---

## 3. Files Created

| File | Purpose |
|:---|:---|
| `docs/adr/ADR-012-Database-Blueprint-Governance.md` | Freezes DBB as authoritative schema reference |
| `docs/adr/ADR-013-Canonical-Event-Bus.md` | Selects SmritiEventBus as canonical; deprecates domain_events.py |
| `docs/database/SMRITI_DATABASE_BLUEPRINT_v1.0.md` | 204 tables, tier-classified |
| `docs/database/SMRITI_CANONICAL_DATA_MODEL_v1.0.md` | 10 canonical entity shapes |
| `docs/database/TABLE_OWNERSHIP_REGISTRY.md` | Module-to-table ownership map |
| `docs/database/ERD_core.mmd` | Tier 1 core entity Mermaid ERD |
| `docs/database/ERD_accounting.mmd` | Accounting module ERD |
| `docs/database/ERD_inventory.mmd` | Inventory module ERD |
| `docs/database/ERD_sales.mmd` | Sales module ERD |
| `docs/database/ERD_purchase.mmd` | Purchase module ERD |
| `docs/database/SMRITI_TABLE_HEALTH_MATRIX_v1.0.md` | Tier 1 health scoring (20 tables, avg 78%) |
| `backend/alembic/versions/v1211_financial_year.py` | Migration: `financial_year` table |
| `backend/app/repositories/inventory.py` | ProductRepository, StockMovementRepository, WarehouseRepository |
| `backend/app/repositories/purchase.py` | SupplierRepository, PurchaseOrderRepository, PurchaseReceiptRepository |
| `backend/app/repositories/crm.py` | CustomerRepository, CustomerGroupRepository, PricingGroupRepository |

---

## 4. Files Modified

| File | Change |
|:---|:---|
| `backend/app/models/accounting.py` | `FinancialYear` model class added |
| `backend/app/core/events/domain_events.py` | Deprecated per ADR-013 |
| `backend/app/services/purchase.py` | Wired `PurchaseOrderCreated` + `GRNCompleted` events, added logger |
| `backend/app/services/crm.py` | Wired `CustomerCreated` event |
| `docs/governance/DB_Standards.md` | DBP-001/002/003 rules appended |
| `.agents/AGENTS.md` | DBP-001..004 added as Level 2 Engineering Standard |

---

## 5. Architecture Decisions

| ADR | Decision |
|:---|:---|
| ADR-012 | Database Blueprint Governance — no migration without Blueprint reference |
| ADR-013 | SmritiEventBus (`event_bus.py`) is canonical. `domain_events.py` deprecated. |

---

## 6. Design Rationale

### FinancialYear table (accounting gap, Phase 1)
Scanner initially misreported only 1 accounting table due to encoding issue with quote characters in regex. Actual state: 4 tables already existed (`chart_of_accounts`, `journal_vouchers`, `journal_ledger_entries`, `fiscal_periods`). Only `financial_year` was genuinely missing for GST period locking and ledger close.

### Repository Layer
`InventoryRepository`, `PurchaseRepository`, `CrmRepository` created to close the ADR-006 breach identified in the Implementation Roadmap. All three extend `BaseRepository[T]` from `repositories/base.py`. Services must migrate direct `session.execute(select(...))` calls to use these repositories.

### Dual Event Bus
`domain_events.py` (fire-and-forget, no session) was identified as incompatible with SMRITI's transactional requirements. `event_bus.py` (`SmritiEventBus`) provides DB session coupling, typed constants, and a Celery/Redis upgrade path. ADR-013 formalizes this choice.

---

## 7. Implementation Summary

Two git commits produced:

**Commit 1 — `9069cf6`:**
- ADR-012, DBP rules, Database Blueprint v1.0, Canonical Data Model, ERDs (core + accounting), Ownership Registry, FinancialYear model + migration v1211
- 9 files, 1,233 insertions

**Commit 2 — `818ccb8`:**
- DBP-001..004 in AGENTS.md, 3 new domain event publishers, purchase/crm event wiring, 3 module ERDs (inventory/sales/purchase), Table Health Matrix
- 8 files, 832 insertions

---

## 8. Tests Executed

| Test | Result |
|:---|:---|
| SSOT Linter (`validate_ssot_architecture.py`) | ✅ 546 files, 0 violations |
| Syntax check: `accounting.py`, `v1211`, `purchase.py`, `crm.py`, `domain_events.py` | ✅ ALL SYNTAX OK |
| Governance validator | ⚠️ WGP FAIL (this walkthrough resolves it) |

---

## 9. Verification Results

**Evidence — Rule 1:**

```
Commit 9069cf6: 9 files, 1233 insertions
Commit 818ccb8: 8 files, 832 insertions
git push → 1aadc61..818ccb8 smritiNX
F:\SMRITI9TEST pull → Fast-forward confirmed
```

---

## 10. Known Limitations

- `companies` and `branches` inherit from raw `Base`, not `BaseEntity`. They manually replicate some audit fields but miss `created_by`, `updated_by`, `deleted_at`, `version`. This is intentional — these are FK root tables. Changing their inheritance requires a careful migration. Deferred.

- Repository layer created but existing service methods still use direct `session.execute`. Full service migration is Phase M1-C (next sprint).

- `domain_events.py` is deprecated but not deleted. Deletion happens after all 6 call sites migrate to `SmritiEventBus`.

---

## 11. Future Work

- M1-C: Migrate all 6 `domain_events.py` call sites to `SmritiEventBus.publish()`
- M2: Accounting completeness (bank accounts, period lock, AP/AR ageing, auto-journal)
- M3: CRM full capability (Leads, Opportunities, Campaigns, Tickets)

---

## 12. Related ADRs

- ADR-006 — Repository Pattern
- ADR-007 — Domain Events
- ADR-012 — Database Blueprint Governance
- ADR-013 — Canonical Event Bus

---

## 13. Related RFCs

None.
