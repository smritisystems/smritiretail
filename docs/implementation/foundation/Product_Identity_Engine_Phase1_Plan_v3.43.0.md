<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.43.0
  Created      : 2026-07-20
  Modified     : 2026-07-20
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Implementation Plan — Product Identity Engine (PIE) Phase 1: Core Business Key & Barcode Assignment Engine (v3.43.0)

## 1. Objective
To implement Phase 1 of the SMRITI Product Identity Engine (PIE), providing canonical SKU business key generation, GS1 EAN-13 barcode assignment with Mod-10 check digit calculation, and identity rule evaluation inside the FastAPI system of record.

## 2. Business Motivation
Enterprise retail and multi-channel commerce platforms require unique, collision-free product identity resolution across POS terminals, physical warehouses, e-commerce storefronts, and compliance gateways (GSTN / SGIP). PIE eliminates SKU collisions, automates EAN-13 barcode generation, and enforces master data identity governance.

## 3. Scope
- **Models**: `ProductIdentity`, `BarcodeProviderPool`, `IdentityRule` in `backend/app/models/identity.py`.
- **Identity Service**: `ProductIdentityService` in `backend/app/services/identity_service.py` for business key calculation, Mod-10 EAN-13 barcode assignment, and fingerprint resolution.
- **REST Endpoints**: `/api/v1/identity/evaluate` and `/api/v1/identity/barcode/assign` in `backend/app/api/v1/identity.py`.
- **Automated Tests**: Unit and integration test suite `backend/app/tests/test_product_identity_engine.py`.

## 4. Current State
Product master contains basic string SKU and barcode columns. Automated GS1 EAN-13 check digit generation, identity fingerprinting, and priority rule evaluation are unhandled.

## 5. Gap Analysis
Without automated GS1 EAN-13 check digit calculation and SKU fingerprinting, manually typed barcodes cause scanner read failures at POS checkout counters.

## 6. Architecture Impact
Adheres to the Platform Abstraction Layer (PAL) and System of Record principles. Extends product master capabilities via FastAPI persistence.

## 7. Proposed Design
```text
Product Attributes (Name, Brand, Category) -> Business Key Builder (SHA-256 Fingerprint)
                                                    ↓
                                      Identity Rule Priority Evaluation
                                                    ↓
                                 GS1 Provider Pool (EAN-13 Mod-10 Check Digit)
                                                    ↓
                                            ProductIdentity Record
```

## 8. Files Created
- [NEW] [identity.py](file:///f:/SMRITRretailNXmgrt/backend/app/models/identity.py)
- [NEW] [identity_service.py](file:///f:/SMRITRretailNXmgrt/backend/app/services/identity_service.py)
- [NEW] [identity.py](file:///f:/SMRITRretailNXmgrt/backend/app/api/v1/identity.py)
- [NEW] [test_product_identity_engine.py](file:///f:/SMRITRretailNXmgrt/backend/app/tests/test_product_identity_engine.py)
- [NEW] [Product_Identity_Engine_Phase1_Plan_v3.43.0.md](file:///f:/SMRITRretailNXmgrt/docs/implementation/foundation/Product_Identity_Engine_Phase1_Plan_v3.43.0.md)

## 9. Files Modified
- [MODIFY] [main.py](file:///f:/SMRITRretailNXmgrt/backend/app/main.py)
- [MODIFY] [README.md](file:///f:/SMRITRretailNXmgrt/docs/implementation/README.md)

## 10. Dependencies
FastAPI, AsyncSession, Pytest, hashlib, Decimal.

## 11. Risks
EAN-13 check digit miscalculation. Mitigation: Standard GS1 Mod-10 weighting algorithm unit-tested against official GS1 test vectors.

## 12. Rollback Strategy
Unmount router `/api/v1/identity` and drop identity tables via Alembic downgrade.

## 13. Verification Plan
Run automated pytest suite covering EAN-13 Mod-10 check digit math, business key collision checks, and REST API payload evaluation.

## 14. Test Plan
Run `python -m pytest app/tests/test_product_identity_engine.py -v`.

## 15. Documentation Impact
Update implementation index, walkthrough index, and produce Phase 3.43.0 Walkthrough.

## 16. Deployment Plan
Commit and push to `target` (`smritiNX` branch).

## 17. Status
Draft / Approved

## 18. Related ADRs
- ADR-002: SMRITI Metadata Architecture
- ADR-003: Platform Abstraction Layer

## 19. Related Walkthroughs
- `Foundation_Dynamic_Item_Master_v3.16.0.md`
