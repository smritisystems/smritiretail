<!--
  SMRITI Retail OS — Masterbook
  Document  : 00_MASTER_INDEX.md
  Purpose   : Canonical index and navigation for the SMRITI architectural reference library
  Author    : Jawahar Ramkripal Mallah
  Status    : LIVING DOCUMENT — update on every architectural decision
  Version   : 1.0.0  |  Created: 2026-08-10
  Copyright : © SMRITIBooks.com. All Rights Reserved.
-->

# SMRITI Masterbook — Master Index

> **MASTERBOOK is the architectural memory of SMRITI.**
> **Source code is the implementation.**
> **If they differ, the AI agent must NOT silently choose one — it must report the difference and obtain an architectural decision.**

---

## What Is the Masterbook?

The Masterbook is the **single source of architectural truth** for SMRITI Retail OS. Every architectural decision, data model, governance rule, and platform contract is recorded here. When source code and Masterbook conflict, the conflict must be surfaced — never silently resolved.

---

## AI Agent Mandatory Protocol

Before any architectural change, every AI agent MUST:

```
1. Read  masterbook/00_MASTER_INDEX.md
2. Read  the relevant section document
3. Audit the actual current source code
4. Compare CURRENT CODE vs MASTERBOOK specification
5. Do NOT assume implementation matches the blueprint
6. STOP if there is an architectural conflict — report it
7. Implement only after evidence-based decision
8. Update masterbook if architecture is intentionally changed
```

See [`99_AI_AGENT/MASTER_EXECUTION_DIRECTIVE.md`](./99_AI_AGENT/MASTER_EXECUTION_DIRECTIVE.md) for the complete protocol.

---

## Document Map

| # | Section | Document | Status |
|---|---|---|---|
| 01 | Constitution | [SMRITI_CONSTITUTION.md](./01_CONSTITUTION/SMRITI_CONSTITUTION.md) | FROZEN |
| 02 | Architecture | [SMRITI_HYBRID_MULTI_COMPANY_MASTER_ARCHITECTURE.md](./02_ARCHITECTURE/SMRITI_HYBRID_MULTI_COMPANY_MASTER_ARCHITECTURE.md) | FROZEN |
| 02 | Architecture | [DATABASE_ARCHITECTURE.md](./02_ARCHITECTURE/DATABASE_ARCHITECTURE.md) | FROZEN |
| 02 | Architecture | [SCHEMA_GOVERNANCE.md](./02_ARCHITECTURE/SCHEMA_GOVERNANCE.md) | FROZEN |
| 02 | Architecture | [MASTER_OWNERSHIP_POLICY.md](./02_ARCHITECTURE/MASTER_OWNERSHIP_POLICY.md) | FROZEN |
| 03 | Security | [USER_COMPANY_ASSIGNMENT.md](./03_SECURITY/USER_COMPANY_ASSIGNMENT.md) | FROZEN |
| 03 | Security | [RBAC.md](./03_SECURITY/RBAC.md) | FROZEN |
| 03 | Security | [COMPANY_ISOLATION.md](./03_SECURITY/COMPANY_ISOLATION.md) | FROZEN |
| 04 | Master Data | [CUSTOMER.md](./04_MASTER_DATA/CUSTOMER.md) | FROZEN |
| 04 | Master Data | [PRODUCT.md](./04_MASTER_DATA/PRODUCT.md) | FROZEN |
| 04 | Master Data | [SUPPLIER.md](./04_MASTER_DATA/SUPPLIER.md) | FROZEN |
| 04 | Master Data | [APPLICABILITY.md](./04_MASTER_DATA/APPLICABILITY.md) | FROZEN |
| 05 | Transaction | [SALES.md](./05_TRANSACTION/SALES.md) | FROZEN |
| 05 | Transaction | [PURCHASE.md](./05_TRANSACTION/PURCHASE.md) | FROZEN |
| 05 | Transaction | [INVENTORY.md](./05_TRANSACTION/INVENTORY.md) | FROZEN |
| 05 | Transaction | [ACCOUNTING.md](./05_TRANSACTION/ACCOUNTING.md) | FROZEN |
| 06 | Database | [COMPANY_DATABASES.md](./06_DATABASE/COMPANY_DATABASES.md) | FROZEN |
| 06 | Database | [DATABASE_REGISTRY.md](./06_DATABASE/DATABASE_REGISTRY.md) | FROZEN |
| 06 | Database | [MIGRATION_GOVERNANCE.md](./06_DATABASE/MIGRATION_GOVERNANCE.md) | FROZEN |
| 07 | Consolidation | [CONSOLIDATED_REPORTING.md](./07_CONSOLIDATION/CONSOLIDATED_REPORTING.md) | FROZEN |
| 08 | Recovery | [DISASTER_RECOVERY.md](./08_RECOVERY/DISASTER_RECOVERY.md) | FROZEN |
| 08 | Recovery | [TROUBLESHOOTING_REFERENCE.md](./08_RECOVERY/TROUBLESHOOTING_REFERENCE.md) | LIVING |
| 99 | AI Agent | [MASTER_EXECUTION_DIRECTIVE.md](./99_AI_AGENT/MASTER_EXECUTION_DIRECTIVE.md) | FROZEN |

---

## Key Architectural Decisions (Quick Reference)

| Decision | Rule | Document |
|---|---|---|
| One login → multi-company switch | AUTH-001, SCS-WSC-002 | 03_SECURITY/USER_COMPANY_ASSIGNMENT.md |
| Single Workspace Principle | PROD-002 / SWP-001 | 01_CONSTITUTION |
| `customer_id` required FK in every invoice | SCS-INV-001 | 04_MASTER_DATA/CUSTOMER.md |
| Cross-company master isolation | PROD-004 | 03_SECURITY/COMPANY_ISOLATION.md |
| `UserCompanyAssignment` governs access | USR-005 | 03_SECURITY/USER_COMPANY_ASSIGNMENT.md |
| No duplicate screens / workspaces | PROD-002 | 01_CONSTITUTION |
| Orchestrator enforces customer-tenant match | SCS-INV-001 | 05_TRANSACTION/SALES.md |
| Walk-in invoicing requires ADR | T-E (open) | 05_TRANSACTION/SALES.md |
| Clean production install — zero business data | PROD-003 | 06_DATABASE/COMPANY_DATABASES.md |
| SPK.ule never depends on React/DOM | KND-001 | 02_ARCHITECTURE/SMRITI_HYBRID_MULTI_COMPANY_MASTER_ARCHITECTURE.md |

---

## Frozen Baseline

**SMRITI Enterprise SaaS Architecture v1.4** is the frozen architectural baseline (AFR-002).

No new architectural capabilities may be introduced until Runtime Certification (Phases A–G) is complete.

All future architectural ideas → **Future Architecture Backlog (v2.x+)**.

---

*Last updated: 2026-08-10 | Maintainer: Jawahar Ramkripal Mallah*
