<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
  Version      : 4.1.0
  Created      : 2026-07-20
  Modified     : 2026-07-20
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Implementation Plan — SMRITI Adaptive Experience Framework (SAEF v4.1.0)

## 1. Objective
To implement the **SMRITI Adaptive Experience Framework (SAEF v4.1.0)**, unifying the **Adaptive Workspace Engine (AWE)**, **SMRITI Experience Policy (SEP)**, **Industry Packs** (Footwear, Apparel, Medical, Electronics, Restaurant), **Screen Studio Metadata Engine**, and **Communicator Connector Pipeline** (`ConnectorManager` ➔ `Protocol` ➔ `Transport` ➔ `Transformation` ➔ `Queue` ➔ `Audit`) under a single enterprise framework umbrella.

## 2. Business Motivation
Configurable experience policies allow enterprises to override default recommendations (e.g. increasing max action buttons from 7 to 9 for Footwear/Wholesale screens) while preserving zero-training simplicity and 100% database backward compatibility.

## 3. Scope
- **SAEF Core Store**: `src/layout_engine/saef_experience_store.ts` managing:
  - Experience Policy (`default_recommended` vs `company_configured` overrides).
  - Industry Packs (`FOOTWEAR`, `APPAREL`, `MEDICAL`, `ELECTRONICS`, `RESTAURANT`, `GENERAL_RETAIL`).
  - Screen Studio Metadata (conditional field visibility, column ordering, role visibility).
  - Personalization Hierarchy: `System Standard` ➔ `Industry Pack` ➔ `Company Policy` ➔ `Role Override` ➔ `User Personalization`.
- **Communicator Connector Pipeline**:
  - `backend/app/services/communicator_service.py` refactored to implement `ConnectorManager` with explicit `Protocol`, `Transport`, `Transformation`, `Queue`, and `Audit` layers.
- **Automated Test Suite**:
  - `backend/app/tests/test_saef_v4_1_experience_framework.py` verifying workspace mode switching without logout, Experience Policy overrides, Industry Pack metadata rendering, and Communicator pipeline execution.

## 4. Current State
v4.0.0 established the basic Adaptive Workspace Engine and Communicator router. SAEF v4.1.0 elevates this into a metadata-driven enterprise experience framework.

## 5. Gap Analysis
Default rules were hardcoded. SAEF provides configurable Experience Policies and visual metadata customization.

## 6. Architecture Impact
Establishes **SAEF** as the top-level UX framework layer above the Platform Abstraction Layer (PAL).

```text
SMRITI Adaptive Experience Framework (SAEF v4.1.0)
                        │
 ┌──────────────────────┼──────────────────────┬──────────────────────┐
 ▼                      ▼                      ▼                      ▼
Adaptive Workspace    Experience Policy     Industry Packs       Screen Studio
   Engine (AWE)             (SEP)          (Footwear, Medical)  Metadata Engine
 (Simple/Hybrid/      (Configurable         (Industry Specific     (Field & Button
  Advanced Modes)      Primary Buttons)       Layout Presets)       Customization)
```

## 7. Proposed Design
1. **SAEF Store**: React/TypeScript metadata store controlling experience policies and industry presets.
2. **Communicator Pipeline**: 6-stage connector pipeline (`Connector` ➔ `Protocol` ➔ `Transport` ➔ `Transformation` ➔ `Queue` ➔ `Audit`).

## 8. Files Created
- [NEW] [saef_experience_store.ts](file:///f:/SMRITRretailNXmgrt/src/layout_engine/saef_experience_store.ts)
- [NEW] [test_saef_v4_1_experience_framework.py](file:///f:/SMRITRretailNXmgrt/backend/app/tests/test_saef_v4_1_experience_framework.py)
- [NEW] [SAEF_Adaptive_Experience_Framework_Plan_v4.1.0.md](file:///f:/SMRITRretailNXmgrt/docs/implementation/foundation/SAEF_Adaptive_Experience_Framework_Plan_v4.1.0.md)

## 9. Files Modified
- [MODIFY] [backend/app/services/communicator_service.py](file:///f:/SMRITRretailNXmgrt/backend/app/services/communicator_service.py)
- [MODIFY] [backend/app/api/v1/communicator.py](file:///f:/SMRITRretailNXmgrt/backend/app/api/v1/communicator.py)
- [MODIFY] [docs/implementation/README.md](file:///f:/SMRITRretailNXmgrt/docs/implementation/README.md)
- [MODIFY] [docs/walkthrough/README.md](file:///f:/SMRITRretailNXmgrt/docs/walkthrough/README.md)

## 10. Dependencies
React 18, TypeScript, FastAPI, AsyncSession, Pytest.

## 11. Risks
Over-configuration introducing UI rendering latency. Mitigation: In-memory memoization of active SAEF metadata layout presets.

## 12. Rollback Strategy
Fallback active experience policy to `GENERAL_RETAIL` standard defaults.

## 13. Verification Plan
Run automated pytest suite verifying SAEF Experience Policy overrides, Industry Pack metadata rendering, and Communicator pipeline execution.

## 14. Test Plan
Run `python -m pytest app/tests/test_saef_v4_1_experience_framework.py -v`.

## 15. Documentation Impact
Update master implementation index, walkthrough index, and produce SAEF v4.1.0 Walkthrough.

## 16. Deployment Plan
Commit and push to `target` (`smritiNX` branch).

## 17. Status
Approved / In Progress

## 18. Related ADRs
- ADR-001: Platform Architecture Overview
- ADR-003: Platform Abstraction Layer

## 19. Related Walkthroughs
- `v4_0_Master_Architecture_Assessment_And_Evolution_Walkthrough.md`
