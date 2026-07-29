<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
  Version      : 22.0.0
  Created      : 2026-07-21
  Modified     : 2026-07-21
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal Architecture Standard
-->

# Phase 28: Omnichannel Customer Loyalty & Promotional Rewards Engine (v22.0.0)

## 1. Objective
Execute **Phase 28** of SMRITI Retail OS Roadmap as a **Domain Release (`v22.0.0`)** building on top of the **SMRITI Platform Foundation Series (PAR-001 v1.0 Baseline, CMP-001 Governance Policy)**. Deliver **Loyalty Subsystem (`backend/app/core/loyalty/`)** providing tiered customer loyalty profiles, promotional coupon validation, BOGO discounts, digital gift card ledgers, REST API Gateway (`/api/v1/loyalty`), and pytest integration suite.

## 2. Business Motivation
- **Customer Retention & Repeat Sales:** Enables retail chains to offer omnichannel rewards, tier-based points (Bronze/Silver/Gold/Platinum), coupon code promotions, and digital gift cards usable across both POS stores and online e-commerce channels.

## 3. Scope
- Governance Baseline: `PAR-001 v1.0`, `CMP-001`, `GCR-001`.
- Loyalty Core Services: `loyalty_manager.py`, `promotion_engine.py`, `giftcard_ledger.py`.
- DB Models & Schemas: `backend/app/models/loyalty.py`, `backend/app/schemas/loyalty.py`.
- REST API: `backend/app/api/v1/loyalty.py`.
- Pytest suite & walkthrough documentation.

## 4. Current State
- Layers 1 through 7 Platform Foundation, WMS, E-Commerce, Analytics, and Franchise operational. Phase 28 adds Loyalty & Promotions Engine.

## 5. Gap Analysis
- Need tier-based point accrual, coupon discount rule evaluations, and store credit gift card ledgers.

## 6. Architecture Impact
- Zero modifications to SPK Kernel or Platform Foundation. Loyalty operates as a Layer 3/Domain business module consuming sales transaction events.

## 7. Proposed Design
- Rule-based Promotion Evaluator and Double-Entry Gift Card Ledger.

## 8. Files Created
- `/backend/app/core/loyalty/loyalty_manager.py`
- `/backend/app/core/loyalty/promotion_engine.py`
- `/backend/app/core/loyalty/giftcard_ledger.py`
- `/backend/app/models/loyalty.py`
- `/backend/app/schemas/loyalty.py`
- `/backend/app/api/v1/loyalty.py`
- `/backend/app/tests/test_loyalty_engine.py`
- `/docs/implementation/loyalty/Loyalty_Promotions_Engine_Plan_v22.0.0.md`

## 9. Files Modified
- `/backend/app/api/v1/__init__.py`
- `/backend/app/main.py`
- `/docs/implementation/README.md`
- `/docs/walkthrough/README.md`

## 10. Dependencies
- FastAPI, Pydantic V2, Python `datetime`.

## 11. Risks
- Gift card fraudulent redemption: Mitigated by PIN hash verification and atomic transaction locks.

## 12. Rollback Strategy
- Remove `/api/v1/loyalty` route mount; core sales billing remains unaffected.

## 13. Verification Plan
- Automated pytest suite `test_loyalty_engine.py` and `npx tsc --noEmit`.

## 14. Test Plan
- Unit & integration tests for points accrual/redemption, coupon code validation, BOGO calculation, and gift card redemption.

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
- `docs/walkthrough/loyalty/Loyalty_Promotions_Engine_v22.0.0.md`
