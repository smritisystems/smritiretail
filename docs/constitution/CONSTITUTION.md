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

# SMRITI Retail OS: 200-Year Engineering Constitution

**Status:** FROZEN — Level 1 SMRITI Architecture Constitution v2.0 (2026-07-28)  
**Author:** Jawahar Ramkripal Mallah (Chief Systems Architect & Creator)  
**Scope:** Universal Engineering Constitution for Platform, Services, Applications, and AI Agents

---

## 1. Vision & Core Philosophy

> **Software frameworks change. Business capabilities endure.**

SMRITI Retail OS is designed for a **15 to 200-year maintainability horizon**. No framework (`FastAPI`, `React`, `Postgres`) can be guaranteed to run unchanged for two centuries. What **can** endure is clean architecture, decoupled boundaries, open standards, and constitutional governance.

---

## 2. Level 1 Constitutional Rules

### Rule GR-000: Business Capability Before Technology Principle
Technology stacks are execution details. Architecture must be organized around permanent retail business domains (`Inventory`, `Sales`, `Purchase`, `Accounting`, `CRM`, `POS`, `Barcode`, `Reports`), never around third-party frameworks.

### Rule GR-001: Single Source of Truth (SSOT) Principle
Every business rule, logic, calculation, configuration, UI component, API contract, and data definition shall have **EXACTLY ONE** authoritative implementation. Duplication is strictly prohibited. Reuse is mandatory.

### Rule 23 — Repository Ownership Principle
Every artifact shall have exactly one authoritative repository. Other repositories may reference it, but they must not duplicate or redefine it. This applies to constitutional governance, compatibility matrices, contracts, SDK code, runtime services, roadmap planning, and product-specific compatibility declarations.

### AI Agent Mandatory Code Reuse Directive
Before writing ANY new code or creating files, all AI agents and engineers MUST execute the 5-step search chain:
`Search Project` ──► `Find Existing Implementation` ──► `Reuse` ──► `Else Extend` ──► `Else Create & Document Justification`

---

## 3. The 10 Core Engineering Principles (GR-001 — GR-010)

1. **GR-001 — Single Source of Truth (SSOT)**: One authoritative implementation per capability.
2. **GR-002 — Don't Repeat Yourself (DRY)**: Zero logic duplication across modules or layers.
3. **GR-003 — High Cohesion, Low Coupling**: Cross-module communication happens strictly via Published Service Interfaces or Domain Event Bus (`DomainEvents`).
4. **GR-004 — Separation of Concerns**: Headless separation between React UI, FastAPI controllers, Python business services, and SQLAlchemy repositories.
5. **GR-005 — Composition Over Inheritance**: Prefer modular composable contracts over rigid inheritance trees.
6. **GR-006 — Open-Closed Principle**: Systems open for capability extension, closed for breaking modifications.
7. **GR-007 — Convention Over Configuration**: Standardized directory structure (`backend/app/modules/`).
8. **GR-008 — Keep It Simple (KISS)**: Prioritize clear, maintainable code over complex abstractions.
9. **GR-009 — You Aren't Gonna Need It (YAGNI)**: Implement only verified, explicit business requirements.
10. **GR-010 — Production-First**: Zero mock data or fallback bypasses in production environments.
11. **GR-011 — Canonical Ownership**: Every business capability has exactly ONE authoritative owner service.
12. **GR-012 — No Silent Duplication**: Upgrade existing canonical services; never create parallel V2 implementations.
13. **GR-013 — Backward Compatibility**: APIs and DB contracts follow the 4-stage deprecation lifecycle before removal.
14. **GR-014 — Code-First Review**: No new code written until a complete reuse analysis has been completed and documented.

---

## 4. The 5-Phase Review Protocol

All engineering output must pass these phases:
1. **Reuse Audit**: Verify non-existence of equivalent logic.
2. **Architecture Compliance**: Verify adherence to SSOT and Boundary rules.
3. **Domain Integrity**: Verify no cross-domain leaking.
4. **Lifecycle Check**: Verify backward compatibility for existing contracts.
5. **Standardization Validation**: Ensure naming and structure conventions are met.
