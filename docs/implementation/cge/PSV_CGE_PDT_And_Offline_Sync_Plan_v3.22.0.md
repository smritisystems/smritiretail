<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.22.0
  Created      : 2026-08-23
  Modified     : 2026-08-23
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Implementation Plan: Section 9 (PSV, CGE, PDT) & Section 10 (Offline-First Sync Engine)

## 1. Objective
Deliver the authoritative business logic and backend engines for Section 9 (Public Stock Verification, Commercial Growth Engine, Predictive Distribution Twin) and Section 10 (Offline-First Sync Engine), ensuring full integration with PostgreSQL transactional models and passing all regression verification suites.

## 2. Business Motivation
- Enable omnichannel growth mechanics: customer loyalty programs with tier-based rewards, automated coupon application, and multi-tier commission structures.
- Support accurate inventory forecasting through predictive stock velocity and replenishment recommendations.
- Enable high-resilience retail operations with offline-capable POS terminals that synchronize sales batches reliably upon reconnecting.

## 3. Scope
- Commercial Growth Engine (CGE): Loyalty tiers, points ledger, promotion campaigns, coupon validation, commission attribution.
- Predictive Distribution Twin (PDT): Database-driven velocity calculation and safety stock reorder recommendations.
- Public Stock Verification (PSV): Idempotent event projection and balance tracking.
- Offline-First Synchronization: Batch transaction push, deduplication, and atomic posting.

## 4. Current State
- Transactional database models created and seeded in migration `v1364_party_item_snapshots` and `v1365_distribution_core`.
- POS and sales ledger engines functioning under single-source-of-record architecture.

## 5. Gap Analysis
- Missing unified service layer to orchestrate tier advancement, coupon evaluation, and commission ledger writes.
- Missing deterministic inventory velocity analytics endpoint for PDT.
- Missing offline batch push endpoint and deduplication service.

## 6. Architecture Impact
- New service layer modules (`CommercialGrowthEngine`, `PdtAnalyticsService`, `OfflineSyncService`).
- New REST API routers registered under `/api/v1/cge` and `/api/v1/sync`.

## 7. Proposed Design
- Implement domain services with strict transactional boundaries in PostgreSQL.
- Enforce idempotency on batch syncing via `SalesInvoice.invoice_no` lookup.
- Calculate PDT velocity by querying outward sales movements directly.

## 8. Files Created
- `backend/app/services/commercial_growth_service.py`
- `backend/app/services/pdt_analytics_service.py`
- `backend/app/services/offline_sync_service.py`
- `backend/app/api/v1/cge.py`
- `backend/app/api/v1/sync.py`
- `backend/tests/test_psv_cge_and_offline_sync.py`

## 9. Files Modified
- `backend/app/main.py`
- `backend/app/services/psv_projection_service.py`

## 10. Dependencies
- FastAPI Core, SQLAlchemy Async, PostgreSQL.

## 11. Risks
- Risk of duplicate transactions in poor connectivity environments; mitigated via strict idempotency checks on `invoice_no` and `source_event_id`.

## 12. Rollback Strategy
- Forward-only architecture; services are backward compatible and degrade gracefully if offline payloads are empty.

## 13. Verification Plan
- Automated unit and integration testing via pytest.
- Full 12-suite regression execution across all modules.

## 14. Test Plan
- Test loyalty lifecycle: enrollment, tier multiplier calculation, points earn, points redeem, automatic tier advancement.
- Test promotions: campaign rules, minimum order constraints, maximum discount caps, usage limits.
- Test PDT: sales velocity, days-of-cover, and reorder point calculations.
- Test offline sync: batch processing, idempotent deduplication (`ALREADY_PROCESSED`).
- Test PSV: stock event projection idempotency.

## 15. Documentation Impact
- Update Walkthrough master index (`docs/walkthrough/README.md`).
- Update Implementation master index (`docs/implementation/README.md`).
- Generate walkthrough document (`docs/walkthrough/cge/PSV_CGE_PDT_And_Offline_Sync_v3.22.0.md`).

## 16. Deployment Plan
- Deploy code to development branch, execute test suite, and merge to main.

## 17. Status
- `Completed`

## 18. Related ADRs
- ADR-041: Idempotent Offline Batch Synchronization
- ADR-042: Deterministic PDT Velocity Analytics

## 19. Related Walkthroughs
- [`docs/walkthrough/cge/PSV_CGE_PDT_And_Offline_Sync_v3.22.0.md`](file:///F:/SMRITRretailNX/docs/walkthrough/cge/PSV_CGE_PDT_And_Offline_Sync_v3.22.0.md)
