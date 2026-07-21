<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
  Version      : 27.0.0
  Created      : 2026-07-21
  Modified     : 2026-07-21
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal Architecture Standard
-->

# Phase 33: SMRITI Digital Platform (v27.0.0) — Ecosystem Hub

## 1. Objective
Execute **Phase 33** of SMRITI Retail OS Roadmap as a **Platform Ecosystem Release (`v27.0.0`)** implementing the **SMRITI Digital Platform & Ecosystem Hub**. Following architectural refinement, separate the ecosystem into 3 distinct logical tiers (**Public Website**, **Portal Platform**, and **Retail OS Core**) connected via **Shared Platform Services**, a dynamic **Portal Metadata Registry (`portal_registry.py`)**, **Customer Workspace Engine (`customer_portal.py`)**, **Learning Management System (`academy_engine.py`)**, and unified domain API routes.

## 2. Business Motivation
- **Unified Digital Operating Environment:** Eliminates fragmented external websites by integrating all customer, developer, partner, community, and support services into a single digital platform under one unified identity while keeping Retail OS business runtime focused on transactional retail operations.

## 3. Scope
- Governance Baseline: `PAR-001 v1.0`, `CMP-001`, `GCR-001`.
- Core Ecosystem Services: `portal_registry.py`, `customer_portal.py`, `academy_engine.py`.
- DB Models & Schemas: `backend/app/models/ecosystem.py`, `backend/app/schemas/ecosystem.py`.
- REST API: `backend/app/api/v1/ecosystem.py`.
- Frontend Hub UI Component: `src/components/SmritiEcosystemHub.tsx`.
- Pytest suite & walkthrough documentation.

## 4. Current State
- Phases 24 through 32 operational. Phase 33 launches Digital Platform & Ecosystem Hub.

## 5. Gap Analysis
- Need dynamic portal metadata registry, customer workspace dashboard aggregator, and LMS course engine.

## 6. Architecture Impact
- Zero modifications to SPK Kernel or Platform Foundation. Operates as Shared Platform Services consuming Layer 4 Marketplace & Layer 7 UDMS.

## 7. Proposed Design
- 3-Tier Ecosystem Architecture (Public Site, Authenticated Portal Platform, Retail OS Core).

## 8. Files Created
- `/backend/app/core/ecosystem/portal_registry.py`
- `/backend/app/core/ecosystem/customer_portal.py`
- `/backend/app/core/ecosystem/academy_engine.py`
- `/backend/app/models/ecosystem.py`
- `/backend/app/schemas/ecosystem.py`
- `/backend/app/api/v1/ecosystem.py`
- `/src/components/SmritiEcosystemHub.tsx`
- `/backend/app/tests/test_ecosystem_engine.py`
- `/docs/implementation/ecosystem/Smriti_Ecosystem_Platform_Plan_v27.0.0.md`

## 9. Files Modified
- `/backend/app/api/v1/__init__.py`
- `/backend/app/main.py`
- `/docs/implementation/README.md`
- `/docs/walkthrough/README.md`

## 10. Dependencies
- FastAPI, Pydantic V2, React TSX, Lucide Icons.

## 11. Risks
- None. Read-only portal registry and customer workspace services.

## 12. Rollback Strategy
- Remove `/api/v1/ecosystem` route mount.

## 13. Verification Plan
- Automated pytest suite `test_ecosystem_engine.py` and `npx tsc --noEmit`.

## 14. Test Plan
- Unit & integration tests for portal registry metadata filtering, customer workspace dashboard compilation, and LMS courses.

## 15. Documentation Impact
- Implementation plan and walkthrough documentation.

## 16. Deployment Plan
- Git commit and build verification.

## 17. Status
Approved / In Progress.

## 18. Related ADRs
- ADR-002 SMRITI Metadata Architecture
- CMP-001 SMRITI Compatibility Policy
- GCR-001 SMRITI Golden Code Rule

## 19. Related Walkthroughs
- `docs/walkthrough/ecosystem/Smriti_Ecosystem_Platform_v27.0.0.md`
