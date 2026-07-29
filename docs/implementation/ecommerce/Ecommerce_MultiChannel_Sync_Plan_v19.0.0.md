<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
  Version      : 19.0.0
  Created      : 2026-07-21
  Modified     : 2026-07-21
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal Architecture Standard
-->

# Phase 25: E-Commerce Multi-Channel Sync & Omnichannel Fulfillment Engine (v19.0.0)

## 1. Objective
Execute **Phase 25** of SMRITI Retail OS Roadmap as a **Domain Release (`v19.0.0`)** building on top of the **SMRITI Platform Foundation Series (PAR-001 v1.0 Baseline, CMP-001 Governance Policy)**. Deliver **E-Commerce Subsystem (`backend/app/core/ecommerce/`)** providing multi-channel store sync (Shopify, WooCommerce, Amazon, Quick Commerce), real-time omnichannel inventory reservation, ship-from-store routing, REST API Gateway (`/api/v1/ecommerce`), and pytest integration suite.

## 2. Business Motivation
- **Omnichannel Retail Sync:** Empowers retailers to integrate online marketplaces (Shopify, Amazon, WooCommerce) with physical POS stores, preventing overselling via real-time safety buffers and ship-from-store fulfillment.

## 3. Scope
- Governance Baseline: `PAR-001 v1.0`, `CMP-001`, `GCR-001`.
- E-Commerce Core Services: `channel_sync.py`, `fulfillment_engine.py`, `stock_allocator.py`.
- DB Models & Schemas: `backend/app/models/ecommerce.py`, `backend/app/schemas/ecommerce.py`.
- REST API: `backend/app/api/v1/ecommerce.py`.
- Pytest suite & walkthrough documentation.

## 4. Current State
- Layers 1 through 7 Platform Foundation and Phase 24 WMS operational. Phase 25 adds E-Commerce Multi-Channel Sync.

## 5. Gap Analysis
- Need unified channel connector status, omnichannel order fulfillment routing (Ship-from-Store vs Warehouse), and real-time inventory allocation buffers.

## 6. Architecture Impact
- Zero modifications to SPK Kernel or Platform Foundation. E-Commerce operates as a Layer 3/Domain business module consuming platform services.

## 7. Proposed Design
- Decoupled Channel Connector Manager and Intelligent Fulfillment Router.

## 8. Files Created
- `/backend/app/core/ecommerce/channel_sync.py`
- `/backend/app/core/ecommerce/fulfillment_engine.py`
- `/backend/app/core/ecommerce/stock_allocator.py`
- `/backend/app/models/ecommerce.py`
- `/backend/app/schemas/ecommerce.py`
- `/backend/app/api/v1/ecommerce.py`
- `/backend/app/tests/test_ecommerce_engine.py`
- `/docs/implementation/ecommerce/Ecommerce_MultiChannel_Sync_Plan_v19.0.0.md`

## 9. Files Modified
- `/backend/app/api/v1/__init__.py`
- `/backend/app/main.py`
- `/docs/implementation/README.md`
- `/docs/walkthrough/README.md`

## 10. Dependencies
- FastAPI, Pydantic V2, Python `datetime`.

## 11. Risks
- Marketplace API rate limits: Mitigated by asynchronous background queue worker synchronization.

## 12. Rollback Strategy
- Remove `/api/v1/ecommerce` route mount; core retail billing remains unaffected.

## 13. Verification Plan
- Automated pytest suite `test_ecommerce_engine.py` and `npx tsc --noEmit`.

## 14. Test Plan
- Unit & integration tests for channel registration, stock allocation buffers, fulfillment route selection, and order status sync.

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
- `docs/walkthrough/ecommerce/Ecommerce_MultiChannel_Sync_v19.0.0.md`
