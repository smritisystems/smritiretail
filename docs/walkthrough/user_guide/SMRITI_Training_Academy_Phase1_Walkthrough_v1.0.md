<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.16.0
  Created      : 2026-08-14
  Modified     : 2026-08-14
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# SMRITI Training Academy Phase 1 Foundation Walkthrough — v1.0

## 1. Purpose
This walkthrough documents the successful implementation of **Phase 1 Foundation** for the **SMRITI Training Academy** (`src/components/training/TrainingAcademyTab.tsx`), providing an operational, interactive onboarding and certification system embedded inside SMRITI Retail OS with **100% strict isolation from production business data**.

## 2. Scope
- Session-based sandbox store implementation (`src/services/trainingSandboxStore.ts`).
- Academy UI tab component (`src/components/training/TrainingAcademyTab.tsx`) with 7-day curriculum grid, 7-step methodology runner, and Live Training State View.
- FastAPI backend routes (`backend/app/api/v1/training.py`) and `SmritiTraining` schema models (`backend/app/models/training.py`).
- Public certificate verification endpoint (`GET /api/v1/training/certificates/{certificate_id}/verify`).
- Production isolation test suite (`backend/tests/test_production_isolation.py`).

## 3. Files Created
- [`src/services/trainingSandboxStore.ts`](file:///F:/SMRITRretailNX/src/services/trainingSandboxStore.ts): Session-based isolated training store (`TRAIN-YYYY-XXX`).
- [`src/components/training/TrainingAcademyTab.tsx`](file:///F:/SMRITRretailNX/src/components/training/TrainingAcademyTab.tsx): Interactive Academy UI container with 7-day roadmap, methodology runner, and Live Training State View.
- [`backend/app/models/training.py`](file:///F:/SMRITRretailNX/backend/app/models/training.py): SQLAlchemy models for `SmritiTraining` database schema.
- [`backend/app/api/v1/training.py`](file:///F:/SMRITRretailNX/backend/app/api/v1/training.py): FastAPI training routes, session management, and public certificate verification endpoint.
- [`backend/tests/test_production_isolation.py`](file:///F:/SMRITRretailNX/backend/tests/test_production_isolation.py): Automated production isolation test suite.
- [`docs/walkthrough/user_guide/SMRITI_Training_Academy_Phase1_Walkthrough_v1.0.md`](file:///F:/SMRITRretailNX/docs/walkthrough/user_guide/SMRITI_Training_Academy_Phase1_Walkthrough_v1.0.md): This walkthrough document.

## 4. Files Modified
- [`src/App.tsx`](file:///F:/SMRITRretailNX/src/App.tsx): Mounted `TrainingAcademyTab` in main workspace tab router.
- [`backend/app/main.py`](file:///F:/SMRITRretailNX/backend/app/main.py): Included and mounted `training.router` under `/api/v1/training`.
- [`docs/implementation/README.md`](file:///F:/SMRITRretailNX/docs/implementation/README.md): Registered implementation plan.
- [`docs/walkthrough/README.md`](file:///F:/SMRITRretailNX/docs/walkthrough/README.md): Registered this walkthrough document.

## 5. Architecture Decisions
- **Golden Isolation Rule**: No training operation may mutate production data in `Smritibus_<CompanyCode>`.
- **Dedicated Training Schema (`SmritiTraining`)**: Training progress and certificate records are stored in a dedicated training schema.
- **Header Isolation Policy**: Training routes reject requests containing `X-Company-Code` header pointing to production databases.
- **Deterministic Day 5 Verification**: Validates expected business state (`PO=50, GRN=48, Short=2, Stock=+48, Sales=-5, Stock=43`).

## 6. Design Rationale
Teaching software through interactive simulation rather than static videos improves knowledge retention. Running simulations inside an isolated session sandbox (`TRAIN-YYYY-XXX`) guarantees zero risk of live business ledger contamination.

## 7. Implementation Summary
- Integrated `TrainingAcademyTab.tsx` into SMRITI Retail OS tab layout.
- Added session store supporting isolated simulated Items, POs, GRNs, Stock, and POS Sales.
- Implemented backend FastAPI training endpoints and public QR verification endpoint.
- Developed production isolation test suite verifying 4/4 assertions.

## 8. Tests Executed
```bash
python -m pytest tests/test_production_isolation.py -v
npx vite build
```

## 9. Verification Results
```text
tests/test_production_isolation.py::test_training_session_creation_isolation PASSED
tests/test_production_isolation.py::test_production_header_rejection PASSED
tests/test_production_isolation.py::test_certificate_issuance_and_public_verification PASSED
tests/test_production_isolation.py::test_zero_production_data_mutation_isolation PASSED
✓ 4/4 passed in 4.10s
✓ Vite build completed cleanly in 33.06s
```

## 10. Known Limitations
- Day 1 through Day 4 guided step tooltips will be expanded in Phase 2.

## 11. Future Work
- **Phase 2**: Day 1–4 guided step interactive sandboxes.
- **Phase 3**: Day 5 lifecycle engine integration.
- **Phase 4**: Day 6–7 assessment & PDF certification renderer.
- **Phase 5**: Store manager analytics console.

## 12. Related ADRs
- `ADR-001`: Platform Architecture & Modular Isolation Policy.

## 13. Related RFCs
- `RFC-2026-08`: User Training & Store Onboarding Blueprint Standard.
