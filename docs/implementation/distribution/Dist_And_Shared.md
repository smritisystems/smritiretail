<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.22.0
  Created      : 2026-08-23
  Modified     : 2026-08-23
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Implementation Plan: Shared Business Engines (Section 7) & Distribution Core (Section 8)

## 1. Objective
Deliver and verify unified pricing resolution (volume breaks, customer tiers, price lists) and full-scale distribution management (territories, dealer allocations, primary/secondary orders, and stock movements).

## 2. Business Motivation
Provide enterprise clients with B2B distribution capabilities alongside retail operations, allowing seamless management of multi-tier sales channels and automated pricing tiers.

## 3. Scope
- Unified Pricing Engine (`PricingEngine`).
- Distribution Territory and Dealer Assignment management.
- Primary and Secondary Distribution Orders with GST calculation.
- Dispatch workflow with Delivery Challan generation and Outward Stock Movement recording.
- REST API layer and automated regression test suite.

## 4. Current State
- Universal Party and Item Master models converged (Section 6).
- Governed logic and reproducibility version snapshotting active (P1.4 / P1.5).
- Shared pricing and distribution orders were previously unbacked by database schemas.

## 5. Gap Analysis
- Missing dedicated database tables for territories, dealer assignments, and distribution orders.
- Missing unified pricing service resolving volume breaks and customer price tiers.
- Missing dispatch workflow writing authoritative stock ledger entries.

## 6. Architecture Impact
- Added 4 new tables: `distribution_territories`, `dealer_assignments`, `distribution_orders`, `distribution_order_items`.
- Integrated `StockMovement` as the authoritative inventory boundary for distribution orders.

## 7. Proposed Design
- Schema defined in `backend/app/models/distribution.py`.
- Forward-only migration in `backend/alembic/versions/v1365_distribution_core.py`.
- Service layer in `backend/app/services/distribution_svc.py` and `backend/app/services/pricing_engine.py`.
- API router in `backend/app/api/v1/distribution.py`.

## 8. Files Created
- `backend/app/models/distribution.py`
- `backend/alembic/versions/v1365_distribution_core.py`
- `backend/app/services/pricing_engine.py`
- `backend/app/services/distribution_svc.py`
- `backend/app/api/v1/distribution.py`
- `backend/tests/t_dist_pricing.py`

## 9. Files Modified
- `backend/app/models/__init__.py`
- `backend/app/main.py`
- `backend/alembic/versions/v1364_party_item_snapshots.py`
- `backend/tests/t_tenant_migr.py`

## 10. Dependencies
- Universal Party & Item Master (Section 6).
- Governed Rule Engine (P1.4 & P1.5).
- SQLAlchemy 2.0 Async Session + PostgreSQL 16+.

## 11. Risks
- Concurrent dispatch operations on stock movements mitigated via atomic transaction boundaries.

## 12. Rollback Strategy
- Forward-only migrations per SMRITI Data Governance Policy. Fixes applied through forward revisions.

## 13. Verification Plan
- Unit testing of PricingEngine volume break math and customer tiers.
- Database persistence verification of Distribution Orders with embedded governance snapshots.
- StockMovement verification upon order dispatch.

## 14. Test Plan
- Automated pytest regression execution across 11 core domain test suites (73 tests).

## 15. Documentation Impact
- Added Walkthrough: `docs/walkthrough/distribution/Dist_And_Shared.md`
- Master Index: `docs/walkthrough/README.md`
- Implementation Plan Index: `docs/implementation/README.md`

## 16. Deployment Plan
- Upgrade tenant databases (`smriti001`, `smriti002`, `smritisys`) to revision `v1365_distribution_core`.

## 17. Status
Completed

## 18. Related ADRs
- `ADR-DIST-001`: Distribution Order Architecture
- `ADR-DIST-002`: Authoritative Stock Dispatch Boundary

## 19. Related Walkthroughs
- `docs/walkthrough/distribution/Dist_And_Shared.md`
