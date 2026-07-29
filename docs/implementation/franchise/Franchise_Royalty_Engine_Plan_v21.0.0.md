<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
  Version      : 21.0.0
  Created      : 2026-07-21
  Modified     : 2026-07-21
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal Architecture Standard
-->

# Phase 27: Multi-Store Enterprise Franchise & Royalty Engine (v21.0.0)

## 1. Objective
Execute **Phase 27** of SMRITI Retail OS Roadmap as a **Domain Release (`v21.0.0`)** building on top of the **SMRITI Platform Foundation Series (PAR-001 v1.0 Baseline, CMP-001 Governance Policy)**. Deliver **Franchise Subsystem (`backend/app/core/franchise/`)** providing COCO/FOFO store profiles, automated percentage royalty and tech platform fee calculations, inter-store settlement ledgers, REST API Gateway (`/api/v1/franchise`), and pytest integration suite.

## 2. Business Motivation
- **Multi-Store Enterprise Scaling:** Enables retail chains to operate COCO (Company-Owned) and FOFO (Franchise-Owned) stores with automated royalty calculations, technology fee deductions, and inter-store balance clearing.

## 3. Scope
- Governance Baseline: `PAR-001 v1.0`, `CMP-001`, `GCR-001`.
- Franchise Core Services: `franchise_manager.py`, `royalty_calculator.py`, `settlement_engine.py`.
- DB Models & Schemas: `backend/app/models/franchise.py`, `backend/app/schemas/franchise.py`.
- REST API: `backend/app/api/v1/franchise.py`.
- Pytest suite & walkthrough documentation.

## 4. Current State
- Layers 1 through 7 Platform Foundation, WMS, E-Commerce, and Analytics operational. Phase 27 adds Franchise & Royalty Engine.

## 5. Gap Analysis
- Need store ownership profile management (COCO vs FOFO), automated royalty tier processing, and inter-company debit/credit note clearing.

## 6. Architecture Impact
- Zero modifications to SPK Kernel or Platform Foundation. Franchise operates as a Layer 3/Domain business module consuming sales and accounting data.

## 7. Proposed Design
- Decoupled Store Profile Manager and Rule-Based Royalty Calculator.

## 8. Files Created
- `/backend/app/core/franchise/franchise_manager.py`
- `/backend/app/core/franchise/royalty_calculator.py`
- `/backend/app/core/franchise/settlement_engine.py`
- `/backend/app/models/franchise.py`
- `/backend/app/schemas/franchise.py`
- `/backend/app/api/v1/franchise.py`
- `/backend/app/tests/test_franchise_engine.py`
- `/docs/implementation/franchise/Franchise_Royalty_Engine_Plan_v21.0.0.md`

## 9. Files Modified
- `/backend/app/api/v1/__init__.py`
- `/backend/app/main.py`
- `/docs/implementation/README.md`
- `/docs/walkthrough/README.md`

## 10. Dependencies
- FastAPI, Pydantic V2, Python `datetime`.

## 11. Risks
- Multi-currency/multi-jurisdiction tax variance: Mitigated by delegating tax computation to `tax.py` compliance router.

## 12. Rollback Strategy
- Remove `/api/v1/franchise` route mount; core store billing remains unaffected.

## 13. Verification Plan
- Automated pytest suite `test_franchise_engine.py` and `npx tsc --noEmit`.

## 14. Test Plan
- Unit & integration tests for franchise store registration, royalty fee calculation, and inter-store debit note generation.

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
- `docs/walkthrough/franchise/Franchise_Royalty_Engine_v21.0.0.md`
