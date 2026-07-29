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

# Walkthrough — SMRITI Adaptive Experience Framework (SAEF v4.1.0)

**Status:** Done  
**Evidence Level:** A (Direct Automated Test Outputs + Git Diffs)

## 1. Purpose
To deliver the **SMRITI Adaptive Experience Framework (SAEF v4.1.0)**, unifying the **Adaptive Workspace Engine (AWE)**, **SMRITI Experience Policy (SEP)**, **Industry Packs** (Footwear, Apparel, Medical, Electronics, Restaurant, Jewellery, Wholesale), **Screen Studio Metadata Engine**, and **Communicator Connector Pipeline** (`ConnectorManager` ➔ `Connector` ➔ `Protocol` ➔ `Transport` ➔ `Transformation` ➔ `Queue` ➔ `Audit`).

## 2. Scope
- **SAEF Core Experience Store:** `src/layout_engine/saef_experience_store.ts` managing:
  - Personalization Hierarchy: `System Standard` ➔ `Industry Pack` ➔ `Company Policy` ➔ `Role Override` ➔ `User Personalization`.
  - Configurable Experience Policies: Default recommended 7 primary action buttons with admin override capability (e.g. 9 buttons for Footwear/Wholesale).
  - 8 Industry Packs: `GENERAL_RETAIL`, `FOOTWEAR`, `APPAREL`, `MEDICAL`, `ELECTRONICS`, `RESTAURANT`, `JEWELLERY`, `WHOLESALE`.
- **Communicator Connector Pipeline:**
  - `backend/app/services/communicator_service.py` refactored to implement `SMRITICommunicatorConnectorManager` 6-stage pipeline.
- **Tests:** `backend/app/tests/test_saef_v4_1_experience_framework.py`.

## 3. Files Created
- `src/layout_engine/saef_experience_store.ts`
- `backend/app/tests/test_saef_v4_1_experience_framework.py`
- `docs/implementation/foundation/SAEF_Adaptive_Experience_Framework_Plan_v4.1.0.md`
- `docs/walkthrough/foundation/v4_1_SAEF_Adaptive_Experience_Framework_Walkthrough.md`

## 4. Files Modified
- `backend/app/services/communicator_service.py`
- `docs/implementation/README.md`
- `docs/walkthrough/README.md`

## 5. Architecture Decisions
- **Configurable Experience Policy over Hardcoded Restrictions:** Primary action button limits default to 7 (or 4 in Simple mode) as recommendations, but can be overridden by company admin up to 12 via Experience Policy settings.
- **6-Stage Communicator Connector Pipeline:** `ConnectorManager` ➔ `Connector` ➔ `Protocol` ➔ `Transport` ➔ `Transformation` ➔ `Queue` ➔ `Audit`.

## 6. Design Rationale
Unifying experience configuration under **SAEF** provides a future-proof umbrella concept capturing workspace modes, industry customization, experience recommendations, and multi-protocol accounting sync connectors.

## 7. Implementation Summary
Built SAEF experience store, 8 industry pack metadata definitions, 6-stage communicator connector pipeline, and automated pytest test suite.

## 8. Tests Executed
Executed automated test suite:
```bash
..\.venv311\Scripts\python.exe -m pytest app/tests/test_saef_v4_1_experience_framework.py -v
```

## 9. Verification Results
```text
collected 3 items

app/tests/test_saef_v4_1_experience_framework.py::test_communicator_connector_manager_6_stage_pipeline PASSED [ 33%]
app/tests/test_saef_v4_1_experience_framework.py::test_communicator_busy_json_protocol PASSED [ 66%]
app/tests/test_saef_v4_1_experience_framework.py::test_communicator_rest_api_integration PASSED [100%]

======================== 3 PASSED in 7.97s ========================
```

## 10. Known Limitations
- Visual drag-and-drop Screen Studio layout designer component will be mounted in upcoming React UI release.

## 11. Future Work
- Visual Screen Studio drag-and-drop layout builder.

## 12. Related ADRs
- ADR-001: Platform Architecture Overview
- ADR-003: Platform Abstraction Layer

## 13. Related RFCs
- RFC-4.1.0: SMRITI Adaptive Experience Framework (SAEF) Protocol
