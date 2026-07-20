<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.40.0
  Created      : 2026-07-20
  Modified     : 2026-07-20
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Implementation Plan — Multi-Store Automated Stock Rebalancing & Transfer Order Engine (v3.40.0)

## 1. Objective
To implement an enterprise multi-store stock rebalancing algorithm and inter-branch Stock Transfer Order (STO) management engine inside the SMRITI FastAPI system of record.

## 2. Business Motivation
Large retail chains (e.g., D-Mart, Reliance Retail, Vishal Mega Mart) manage stock across central warehouses, hub stores, and spoke outlets. Automated rebalancing analyzes store sales velocity, min/max inventory thresholds, and stock-outs to recommend and execute inter-store stock transfers, minimizing stock-outs while reducing holding costs.

## 3. Scope
- **Domain Models**: `StockTransferOrder`, `StockTransferOrderItem`, `StockRebalancingRecommendation` in `backend/app/models/transfer.py`.
- **Rebalancing Algorithm & Service**: `StockRebalancingService` in `backend/app/services/rebalancing_service.py` to calculate store stock surpluses/deficits and generate transfer orders.
- **FastAPI Endpoints**: `/api/v1/transfers` for STO lifecycle management (request, approve, dispatch, receive) and rebalancing execution.
- **Automated Tests**: Unit and integration test suite `backend/app/tests/test_multi_store_rebalancing.py`.

## 4. Current State
Base `StockMovement` and `StockDispatch` entities exist, but inter-store transfer orders with status state transitions (`REQUESTED` -> `APPROVED` -> `DISPATCHED` -> `RECEIVED`) and automated rebalancing recommendations do not exist.

## 5. Gap Analysis
Retailers currently lack automated inventory redistribution logic between stores with excess inventory and stores experiencing stock-outs.

## 6. Architecture Impact
Adheres to the Platform Abstraction Layer (PAL) and System of Record principles. Stock movement entries (`StockMovement`) are automatically generated upon dispatch and receipt.

## 7. Proposed Design
```text
Store Stock Velocity & Threshold Check -> Rebalancing Algorithm
                                                ↓
                                  StockRebalancingRecommendation
                                                ↓
                                  StockTransferOrder (DRAFT)
                                                ↓
                                      APPROVAL (Phase 6 FSM)
                                                ↓
                                       DISPATCHED (Stock IN_TRANSIT)
                                                ↓
                                       RECEIVED (Target Stock Updated)
```

## 8. Files Created
- [NEW] [transfer.py](file:///f:/SMRITRretailNXmgrt/backend/app/models/transfer.py)
- [NEW] [rebalancing_service.py](file:///f:/SMRITRretailNXmgrt/backend/app/services/rebalancing_service.py)
- [NEW] [transfers.py](file:///f:/SMRITRretailNXmgrt/backend/app/api/v1/transfers.py)
- [NEW] [test_multi_store_rebalancing.py](file:///f:/SMRITRretailNXmgrt/backend/app/tests/test_multi_store_rebalancing.py)
- [NEW] [MultiStore_Stock_Rebalancing_And_Transfer_Order_Plan_v3.40.0.md](file:///f:/SMRITRretailNXmgrt/docs/implementation/foundation/MultiStore_Stock_Rebalancing_And_Transfer_Order_Plan_v3.40.0.md)

## 9. Files Modified
- [MODIFY] [main.py](file:///f:/SMRITRretailNXmgrt/backend/app/main.py)
- [MODIFY] [README.md](file:///f:/SMRITRretailNXmgrt/docs/implementation/README.md)

## 10. Dependencies
SQLAlchemy 2.0 Async, FastAPI, Decimal, Pytest.

## 11. Risks
Simultaneous transfer requests on low stock items. Mitigation: Row-level locking on inventory check during approval.

## 12. Rollback Strategy
Unmount router `/api/v1/transfers` and drop transfer tables via Alembic downgrade.

## 13. Verification Plan
Execute automated test suite covering rebalancing algorithm calculations, STO status FSM transitions, and stock movement posting.

## 14. Test Plan
Run `python -m pytest app/tests/test_multi_store_rebalancing.py -v`.

## 15. Documentation Impact
Update implementation index and generate Phase 3.40.0 Walkthrough.

## 16. Deployment Plan
Commit and push to `target` (`smritiNX` branch).

## 17. Status
Draft

## 18. Related ADRs
- ADR-003: Platform Abstraction Layer
- ADR-007: Authorization Architecture

## 19. Related Walkthroughs
- `Foundation_Stock_Dispatch_Engine_Walkthrough_v3.28.0.md`
