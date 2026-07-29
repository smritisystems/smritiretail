<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
  Version      : 4.2.0
  Created      : 2026-07-20
  Modified     : 2026-07-20
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Implementation Plan — Screen Studio Metadata Visual Editor & Dynamic Layout Customizer (v4.2.0)

## 1. Objective
To implement **v4.2.0 — Screen Studio Metadata Visual Editor**, providing administrators with an interactive studio tab to visually inspect and customize screen layouts, reorder fields, toggle conditional field visibility, configure industry-specific presets, and customize Experience Policy overrides without altering source code.

## 2. Business Motivation
Visual metadata configuration empowers enterprise admins and franchisees to customize screen layouts for different retail verticals (Footwear, Apparel, Medical, Electronics, Restaurant) without requiring software rebuilds or code changes.

## 3. Scope
- **Backend ORM & Services**:
  - `ScreenLayoutTemplate` ORM model in `backend/app/models/screen_studio.py`.
  - `ScreenStudioService` in `backend/app/services/screen_studio_service.py`.
  - FastAPI router `/api/v1/screen-studio/*` in `backend/app/api/v1/screen_studio.py`.
- **Frontend Studio & Store**:
  - `src/layout_engine/screen_studio_store.ts` (Metadata state management).
  - `src/components/ScreenStudioTab.tsx` (Visual Screen Studio Customizer UI).
- **Automated Test Suite**:
  - `backend/app/tests/test_v4_2_screen_studio.py`.

## 4. Current State
SAEF v4.1.0 established Industry Packs and Experience Policies in JSON/TypeScript definitions. Screen Studio v4.2.0 exposes a visual administrator UI and backend persistence API for dynamic metadata edits.

## 5. Gap Analysis
Without Screen Studio, customizing field visibility or action button limits requires editing code configuration. Screen Studio enables point-and-click customization.

## 6. Architecture Impact
Extends the **SMRITI Adaptive Experience Framework (SAEF)** with visual metadata design capabilities.

## 7. Proposed Design
```text
ScreenStudioTab (React Visual Editor) <---> screen_studio_store.ts
                                                     │
                                                     ▼
                                     FastAPI /api/v1/screen-studio/*
                                                     │
                                                     ▼
                                    ScreenLayoutTemplate (PostgreSQL)
```

## 8. Files Created
- [NEW] [screen_studio.py](file:///f:/SMRITRretailNXmgrt/backend/app/models/screen_studio.py)
- [NEW] [screen_studio_service.py](file:///f:/SMRITRretailNXmgrt/backend/app/services/screen_studio_service.py)
- [NEW] [screen_studio.py](file:///f:/SMRITRretailNXmgrt/backend/app/api/v1/screen_studio.py)
- [NEW] [screen_studio_store.ts](file:///f:/SMRITRretailNXmgrt/src/layout_engine/screen_studio_store.ts)
- [NEW] [ScreenStudioTab.tsx](file:///f:/SMRITRretailNXmgrt/src/components/ScreenStudioTab.tsx)
- [NEW] [test_v4_2_screen_studio.py](file:///f:/SMRITRretailNXmgrt/backend/app/tests/test_v4_2_screen_studio.py)
- [NEW] [v4_2_Screen_Studio_Metadata_Editor_Plan.md](file:///f:/SMRITRretailNXmgrt/docs/implementation/foundation/v4_2_Screen_Studio_Metadata_Editor_Plan.md)

## 9. Files Modified
- [MODIFY] [backend/app/models/__init__.py](file:///f:/SMRITRretailNXmgrt/backend/app/models/__init__.py)
- [MODIFY] [backend/app/api/v1/__init__.py](file:///f:/SMRITRretailNXmgrt/backend/app/api/v1/__init__.py)
- [MODIFY] [backend/app/main.py](file:///f:/SMRITRretailNXmgrt/backend/app/main.py)
- [MODIFY] [backend/app/tests/conftest.py](file:///f:/SMRITRretailNXmgrt/backend/app/tests/conftest.py)
- [MODIFY] [docs/implementation/README.md](file:///f:/SMRITRretailNXmgrt/docs/implementation/README.md)
- [MODIFY] [docs/walkthrough/README.md](file:///f:/SMRITRretailNXmgrt/docs/walkthrough/README.md)

## 10. Dependencies
React 18, Motion, FastAPI, AsyncSession, Pytest.

## 11. Risks
Invalid JSON layout payloads breaking UI rendering. Mitigation: Strict schema validation and default fallback templates.

## 12. Rollback Strategy
Restore default industry pack metadata preset (`GENERAL_RETAIL`).

## 13. Verification Plan
Run automated pytest suite verifying Screen Studio template saving, loading, and API CRUD operations.

## 14. Test Plan
Run `python -m pytest app/tests/test_v4_2_screen_studio.py -v`.

## 15. Documentation Impact
Update master implementation index, walkthrough index, and create v4.2.0 Walkthrough.

## 16. Deployment Plan
Commit and push to `target` (`smritiNX` branch).

## 17. Status
In Progress

## 18. Related ADRs
- ADR-001: Platform Architecture Overview
- ADR-003: Platform Abstraction Layer

## 19. Related Walkthroughs
- `v4_1_SAEF_Adaptive_Experience_Framework_Walkthrough.md`
