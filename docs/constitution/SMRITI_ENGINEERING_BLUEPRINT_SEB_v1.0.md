# SMRITI Engineering Blueprint (SEB) v1.0

**Status:** FROZEN — Level 1 SMRITI Architecture Constitution v2.0 (2026-07-28)  
**Author:** Jawahar Ramkripal Mallah (Chief Systems Architect & Creator)  
**Classification:** Universal Engineering Constitution & AI Agent Directive

---

## 1. Foundation Principles (GR-000 — GR-010)

1. **GR-000 — Business Capability Before Technology**: System architecture is organized around permanent retail business domains (`Inventory`, `Sales`, `Purchase`, `Accounting`, `CRM`, `POS`). Technology stacks (`FastAPI`, `React`, `Postgres`) are execution details.
2. **GR-001 — Single Source of Truth (SSOT)**: Every business rule, calculation, UI component, data definition, and configuration shall have **EXACTLY ONE** authoritative implementation.
3. **GR-002 — DRY (Don't Repeat Yourself)**: Zero logic duplication across modules or layers.
4. **GR-003 — High Cohesion, Low Coupling**: Cross-module communication happens strictly via Published Service Interfaces or Domain Events (`DomainEvents`).
5. **GR-004 — Separation of Concerns**: Clear boundaries between Presentation (React), API Controllers (FastAPI), Business Logic (Services), and Persistence (Repositories).
6. **GR-005 — Composition Over Inheritance**: Prefer modular composable contracts over rigid inheritance trees.
7. **GR-006 — Open-Closed Principle**: Modules open for capability extension, closed for breaking modifications.
8. **GR-007 — Convention Over Configuration**: Standardized naming and folder structure (`backend/app/modules/`).
9. **GR-008 — KISS (Keep It Simple)**: Prioritize clear, maintainable code over complex abstractions.
10. **GR-009 — YAGNI (You Aren't Gonna Need It)**: Implement only verified, explicit business requirements.
11. **GR-010 — Production-First**: Zero mock data or static fallback bypasses in production environments.
12. **GR-011 — Canonical Ownership**: One authoritative owner service per capability (Tax, Barcode, Pricing).
13. **GR-012 — No Silent Duplication**: Upgrade existing; never create `ServiceV2` parallel implementations.
14. **GR-013 — Backward Compatibility**: API and DB schema contracts follow 4-stage deprecation lifecycle.
15. **GR-014 — Code-First Review**: No new code without completing a reuse analysis and Gap Analysis Report.

---

## 2. Project Structure Blueprint

```text
backend/
 └── app/
      ├── modules/
      │     ├── inventory/
      │     ├── sales/
      │     ├── purchase/
      │     ├── accounting/
      │     ├── crm/
      │     └── pos/
      ├── core/
      ├── shared/
      ├── plugins/
      └── tests/
```

Every module encapsulates: `api/`, `services/`, `repositories/`, `models/`, `schemas/`, `events/`, `validators/`, `tests/`.

---

## 3. Layer Blueprint

```text
React UI (Workspace / Application)
      │
      ▼ (HTTP JSON over OpenAPI 3.1)
FastAPI Controller (`backend/app/api/v1/`)
      │
      ▼ (Pure DTOs & Domain Commands)
Domain Service (`backend/app/services/`)
      │
      ▼ (Repository Abstraction Methods)
Repository Layer (`backend/app/repositories/`)
      │
      ▼ (SQLAlchemy 2.0 Async Engine)
SQLAlchemy Models (`backend/app/models/`)
      │
      ▼ (ANSI SQL)
PostgreSQL Database (`smriti_retail_db`)
```

---

## 4. Naming Blueprint
Entity symbols follow standard suffixes:
- `ProductService`
- `ProductRepository`
- `ProductSchema`
- `ProductModel`
- `ProductValidator`
- `ProductEvent`

---

## 5. API Blueprint
Gateway URIs enforce `/api/public/v1/*` (External) and `/api/internal/v1/*` (Workspace) with standard REST verbs (`GET`, `POST`, `PUT`, `PATCH`, `DELETE`).

---

## 6. UI Blueprint
Workspace UI complies with `SLGP-001 v2.0`:
- **Pattern A**: Continuous Scrollable Page
- **Pattern B**: Viewport-Constrained Studio
- **Pattern C**: Master–Detail Split-Pane Workspace

---

## 7. Component Blueprint
Single Component Authority: `<CustomerSelector />`, `<ProductSelector />`, `<SmritiDialog />`, `<SmritiTabContainer />`, `<WorkspaceLayout />`.

---

## 8. Database Blueprint
`Model` ──► `Repository` ──► `Alembic Migration` ──► `Service/API` ──► `UI`. Direct DDL or controller SQL is strictly prohibited.

---

## 9. Event Blueprint
Modules publish strongly-typed events (`SaleCompleted`, `StockAdjusted`, `InvoiceCancelled`) via `backend/app/core/events/domain_events.py`.

---

## 10. Testing Blueprint
Mandatory test coverage per module: Unit Tests, Integration Tests, API Tests, Playwright UI Tests, and Performance Benchmarks.

---

## 11. Documentation Blueprint
Standard module documentation: README, Architecture, ADR, API Spec, Database Model, Walkthrough, Tests, Release Notes.

---

## 12. AI Coding Blueprint (12-Step Execution Checklist)

Before writing **ANY code**, AI agents MUST execute:
1. Understand the exact requirement.
2. Search the entire project.
3. Check for an existing implementation.
4. Reuse if available.
5. If extending, follow existing patterns.
6. If creating new code, justify why reuse isn't possible.
7. Ensure zero code duplication.
8. Verify architecture compliance (`validate_ssot_architecture.py`).
9. Add unit & integration tests.
10. Update documentation.
11. Run linting (`validate_layout_tokens.py`) and tests (`npx tsc --noEmit`).
12. Commit only if all checks pass.

---

## 13. Module Lifecycle Blueprint
`Planning` ──► `Architecture Review` ──► `Implementation` ──► `Unit Testing` ──► `Integration Testing` ──► `UI Testing` ──► `Docs` ──► `Release`.

---

## 14. Blueprint Enforcement
Automated enforcement tooling:
- **SSOT Architecture Linter**: `scripts/validate_ssot_architecture.py`
- **Layout Governance Linter**: `scripts/validate_layout_tokens.py`
- **TypeScript Compiler**: `npx tsc --noEmit`
- **Playwright Suite**: `node tests/e2e/playwright_e2e_runner.cjs`

---

## 15. GR-014: Mandatory AI Code-First Review Order

Every engineering task MUST follow this review sequence before writing code:

```text
1. Existing Code        (scan modules, services, repos)
        ↓
2. Existing Architecture (SEB, ADRs, GR rules)
        ↓
3. Existing APIs        (OpenAPI contracts, /api/v1/ routes)
        ↓
4. Existing Components  (React, SEEF primitives)
        ↓
5. Existing Database    (models, migrations, canonical schema)
        ↓
6. Existing Tests       (test coverage, patterns)
        ↓
7. Existing Docs        (walkthroughs, ADRs, governance)
        ↓
8. Write New Code       (only genuinely new capabilities)
```

### Gap Analysis Report Template (Required Before Implementation)
```text
CODE REVIEW REPORT
Files Reviewed:    [every file scanned]
Already Exists:    [✓ reusable items]
Needs Extension:   [✓ items to extend]
New Code Required: [✗ genuinely new items + justification]
Duplicate Risk:    LOW / MEDIUM / HIGH
```
