<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
  Version      : 1.0.0
  Created      : 2026-07-22
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Architecture & Governance Walkthrough
-->

# Walkthrough - SMRITI Three-Tier Governance Hierarchy & Frozen Architecture Constitution

## 1. Purpose
Establish the **SMRITI Three-Tier Governance Hierarchy & Frozen Level 1 Architecture Constitution (AOP-001 through AOP-006)**, defining permanent product boundaries, contract stability, additive migration safety, authorization isolation, and distributed observability across **SMRITI Website (Marketing)**, **SMRITI Portal (Customer Self-Service)**, **SMRITI Workspace (Retail Operations App)**, and **SMRITI Platform API (Core Engine)**.

## 2. Scope
- Three-Tier Governance Structure in `.agents/AGENTS.md`:
  - **Level 1 — SMRITI Architecture Constitution (FROZEN — v1.0)**
  - **Level 2 — Engineering Standards (Versioned Standards)**
  - **Level 3 — Operational Procedures (Evolving Daily Workflows)**
- Automated Architecture Guardian static analysis tool (`scripts/architecture_guardian.py`).

## 3. Files Created
- `scripts/architecture_guardian.py`
- `docs/walkthrough/foundation/SMRITI_Enterprise_Architecture_Guardian_v1.0.0.md`

## 4. Files Modified
- `.agents/AGENTS.md`
- `docs/walkthrough/README.md`

## 5. Architecture Decisions
- **Level 1 SMRITI Architecture Constitution (FROZEN — v1.0)**:
  - **AOP-001**: AI Optionality Principle.
  - **AOP-002**: Four-Tier Enterprise Architecture & Independence.
    - Rule 1: No direct inter-app dependencies (`Workspace ──► Platform API ◄── Portal`).
    - Rule 2: Independent deployment, installation, and removal of all 4 tiers.
    - Rule 3: Platform owns business logic; presentation apps own user experience.
    - Rule 4: Authoritative single-domain ownership.
    - Rule 5: Applications are replaceable. Platform services are reusable. Business data is permanent.
  - **AOP-003**: Backward Compatibility & Contract Binding Principle.
  - **AOP-004**: Additive Schema Evolution & Data Safety Principle.
  - **AOP-005**: Security & API Authorization Isolation (`/api/public/v1/*` vs `/api/internal/v1/*`).
  - **AOP-006**: Distributed Observability (`Trace-ID`, `Correlation-ID`, `Span-ID`, `Audit-ID`).

## 6. Design Rationale
Organizing governance into 3 tiers prevents policy clutter, giving developers a clear mental model while freezing permanent core architectural principles.

## 7. Implementation Summary
- Locked Policy Level 1 Constitution (`AOP-001` to `AOP-006`) in `.agents/AGENTS.md`.
- Updated static analysis script `scripts/architecture_guardian.py` for 4-tier module inventory scanning.

## 8. Tests Executed
- Module inventory scan via `scripts/architecture_guardian.py`.
- Docker test environment verification in `F:\SMRITI9TEST`.

## 9. Verification Results
- 1. SMRITI Website Modules: Public Marketing & Docs Components
- 2. SMRITI Portal Modules: Customer Self-Service & License Panels
- 3. SMRITI Workspace Modules: Retail Operations Components
- 4. SMRITI Platform API Modules: 17 Core Backend Service Directories
- Boundary Violations: 0 Violations Detected

## 10. Known Limitations
- Static analysis checks raw `fetch()` and DB engine creation; future iterations will include AST-based import graph parsing.

## 11. Future Work
- Maintain Level 1 Constitution as permanently frozen; evolve Level 2 Standards and Level 3 Operations independently.

## 12. Related ADRs
- ADR-001: Strangler-Fig Migration Strategy
- AOP-001: AI Optionality Principle

## 13. Related RFCs
- RFC-022: Multi-Tenant Architecture & Domain Separation
