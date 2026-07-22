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

# Walkthrough - SMRITI Enterprise Architecture Guardian & Separation Principles

## 1. Purpose
Establish the **SMRITI Architecture Guardian & Application Independence Policy (AOP-002)**, defining strict architectural boundaries between **SMRITI Core Platform**, **SMRITI Workspace Application**, and **SMRITI Portal / Marketing Website**.

## 2. Scope
- Governance policy update in `.agents/AGENTS.md`.
- Automated Architecture Guardian static analysis tool (`scripts/architecture_guardian.py`).
- Separation rules for Core (FastAPI/Postgres), Workspace (Retail Operations), and Portal (Customer Self-Service & Marketing).

## 3. Files Created
- `scripts/architecture_guardian.py`
- `docs/walkthrough/foundation/SMRITI_Enterprise_Architecture_Guardian_v1.0.0.md`

## 4. Files Modified
- `.agents/AGENTS.md`
- `docs/walkthrough/README.md`

## 5. Architecture Decisions
- **Independence Principle**: SMRITI Core Platform (FastAPI + Postgres) remains framework-independent and database-agnostic. Core API must never reference frontend UI or portal pages.
- **Zero Database Cross-Contamination**: Marketing/Portal app operates on its own store; it must never directly query the Retail Application's transactional database.
- **Optional Advisory Cloud Integration**: License activation, cloud backup, and update checks communicate via advisory HTTP endpoints without blocking offline store operations.

## 6. Design Rationale
Decoupling Portal and Workspace prevents distributed monolithic complexity, isolates security footprints, and ensures retail POS transactions run at maximum speed regardless of cloud or portal availability.

## 7. Implementation Summary
- Added Policy ID `AOP-002` to `.agents/AGENTS.md`.
- Created static analysis script `scripts/architecture_guardian.py` for module inventory scanning and boundary violation detection.

## 8. Tests Executed
- Module inventory scan via `scripts/architecture_guardian.py`.
- Docker test environment verification in `F:\SMRITI9TEST`.

## 9. Verification Results
- Core Platform Modules: 17 Directories / API Services
- Workspace Modules: Active Retail Application Components
- Portal Modules: Customer Self-Service & License Panels
- Boundary Violations: 0 Violations Detected

## 10. Known Limitations
- Static analysis checks raw `fetch()` and DB engine creation; future iterations will include AST-based import graph parsing.

## 11. Future Work
- Implement dedicated container stacks (`smriti-portal` vs `smriti-workspace`) for enterprise cloud deployments.

## 12. Related ADRs
- ADR-001: Strangler-Fig Migration Strategy
- AOP-001: AI Optionality Principle

## 13. Related RFCs
- RFC-022: Multi-Tenant Architecture & Domain Separation
