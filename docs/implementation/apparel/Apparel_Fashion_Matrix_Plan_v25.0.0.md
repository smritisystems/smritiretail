<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
  Version      : 25.0.0
  Created      : 2026-07-21
  Modified     : 2026-07-21
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal Architecture Standard
-->

# Phase 31: Apparel & Fashion 3D Matrix Engine (v25.0.0)

## 1. Objective
Execute **Phase 31** of SMRITI Retail OS Roadmap as a **Domain Release (`v25.0.0`)** building on top of the **SMRITI Platform Foundation Baseline (`v23.0.0`, PAR-001 v1.0 Baseline, CMP-001 Policy)**. Deliver **Apparel Subsystem (`backend/app/core/apparel/`)** providing Color-Size-Style 3D matrix variant grid pricing, seasonal markdown schedules, custom hang-tag thermal barcode generation, REST API Gateway (`/api/v1/apparel`), and pytest integration suite.

## 2. Business Motivation
- **Garment & Fashion Retail Management:** Enables garment and lifestyle retailers to efficiently manage multi-variant product grids (Color x Size x Style), run automated seasonal clearance markdowns, and print custom hang-tag barcodes.

## 3. Scope
- Governance Baseline: `PAR-001 v1.0`, `CMP-001`, `GCR-001`.
- Core Apparel Services: `matrix_grid.py`, `markdown_engine.py`, `hangtag_generator.py`.
- DB Models & Schemas: `backend/app/models/apparel.py`, `backend/app/schemas/apparel.py`.
- REST API: `backend/app/api/v1/apparel.py`.
- Pytest suite & walkthrough documentation.

## 4. Current State
- Phases 24 through 30 operational. Phase 31 launches Apparel Vertical Release.

## 5. Gap Analysis
- Need Color x Size matrix generation, inventory age markdown rules, and hang-tag rendering.

## 6. Architecture Impact
- Zero modifications to SPK Kernel or Platform Foundation.

## 7. Proposed Design
- Multi-dimensional Matrix Grid Allocator and Automated Markdown Calculator.

## 8. Files Created
- `/backend/app/core/apparel/matrix_grid.py`
- `/backend/app/core/apparel/markdown_engine.py`
- `/backend/app/core/apparel/hangtag_generator.py`
- `/backend/app/models/apparel.py`
- `/backend/app/schemas/apparel.py`
- `/backend/app/api/v1/apparel.py`
- `/backend/app/tests/test_apparel_engine.py`
- `/docs/implementation/apparel/Apparel_Fashion_Matrix_Plan_v25.0.0.md`

## 9. Files Modified
- `/backend/app/api/v1/__init__.py`
- `/backend/app/main.py`
- `/docs/implementation/README.md`
- `/docs/walkthrough/README.md`

## 10. Dependencies
- FastAPI, Pydantic V2, Python `datetime`.

## 11. Risks
- Matrix grid explosion: Mitigated by limiting max grid dimensions (10 colors x 10 sizes).

## 12. Rollback Strategy
- Remove `/api/v1/apparel` route mount.

## 13. Verification Plan
- Automated pytest suite `test_apparel_engine.py` and `npx tsc --noEmit`.

## 14. Test Plan
- Unit & integration tests for matrix grid generation, seasonal markdowns, and hang-tag rendering.

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
- `docs/walkthrough/apparel/Apparel_Fashion_Matrix_v25.0.0.md`
