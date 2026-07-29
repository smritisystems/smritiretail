<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.45.0
  Created      : 2026-07-20
  Modified     : 2026-07-20
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Implementation Plan — Product Identity Engine (PIE) Phase 2: Rule Simulation, Variant Mapping & Duplicate Resolution (v3.45.0)

## 1. Objective
To implement Phase 2 of the Product Identity Engine (PIE) in SMRITI Retail OS, providing rule simulation analysis, matrix variant SKU/barcode generation, and duplicate resolution confidence scoring algorithms.

## 2. Business Motivation
Fashion, apparel, and multi-attribute retail items require matrix variant child SKU generation (`Color`, `Size`, `Style`). Furthermore, enterprise catalogue imports require pre-import identity rule simulation and duplicate detection scoring to prevent catalogue pollution and barcode collisions across store networks.

## 3. Scope
- **Services**: `simulate_identity_rules()`, `generate_variant_skus()`, and `calculate_duplicate_confidence()` inside `backend/app/services/identity_service.py`.
- **REST Endpoints**: `/api/v1/identity/simulate`, `/api/v1/identity/variants/resolve`, and `/api/v1/identity/duplicates/score` in `backend/app/api/v1/identity.py`.
- **Automated Tests**: Unit and integration test suite `backend/app/tests/test_pie_phase2_simulation.py`.

## 4. Current State
PIE Phase 1 (v3.43.0) delivers basic EAN-13 Mod-10 barcode assignment and SKU key formatting. Variant matrix generation and duplicate confidence scoring are unhandled.

## 5. Gap Analysis
Without variant matrix SKU mapping, retailers manually assign child barcodes for 50+ color/size combinations, slowing down PO receiving.

## 6. Architecture Impact
Adheres strictly to the SMRITI Platform Abstraction Layer (PAL) and System of Record principles inside FastAPI core.

## 7. Proposed Design
```text
Parent Item + Matrix Attributes (Size, Color) -> generate_variant_skus() -> Child SKUs + Mod-10 EAN-13 Barcodes
Import Batch -> calculate_duplicate_confidence() -> Confidence Score (DUPLICATE_EXACT | HIGH_PROBABILITY | UNIQUE)
```

## 8. Files Created
- [NEW] [test_pie_phase2_simulation.py](file:///f:/SMRITRretailNXmgrt/backend/app/tests/test_pie_phase2_simulation.py)
- [NEW] [Product_Identity_Engine_Phase2_Plan_v3.45.0.md](file:///f:/SMRITRretailNXmgrt/docs/implementation/foundation/Product_Identity_Engine_Phase2_Plan_v3.45.0.md)

## 9. Files Modified
- [MODIFY] [identity_service.py](file:///f:/SMRITRretailNXmgrt/backend/app/services/identity_service.py)
- [MODIFY] [identity.py](file:///f:/SMRITRretailNXmgrt/backend/app/api/v1/identity.py)
- [MODIFY] [README.md](file:///f:/SMRITRretailNXmgrt/docs/implementation/README.md)

## 10. Dependencies
FastAPI, AsyncSession, Pytest, difflib, Decimal.

## 11. Risks
Variant SKU collisions on large matrix datasets. Mitigation: Suffix uniqueness hashing on child attributes.

## 12. Rollback Strategy
Remove Phase 2 service methods and unmount API endpoints.

## 13. Verification Plan
Run automated pytest suite covering matrix variant resolution, simulation conflict reporting, and duplicate scoring thresholds.

## 14. Test Plan
Run `python -m pytest app/tests/test_pie_phase2_simulation.py -v`.

## 15. Documentation Impact
Update implementation index, walkthrough index, and produce Phase 3.45.0 Walkthrough.

## 16. Deployment Plan
Commit and push to `target` (`smritiNX` branch).

## 17. Status
Draft / Approved

## 18. Related ADRs
- ADR-002: SMRITI Metadata Architecture
- ADR-003: Platform Abstraction Layer

## 19. Related Walkthroughs
- `Product_Identity_Engine_Phase1_Walkthrough_v3.43.0.md`
