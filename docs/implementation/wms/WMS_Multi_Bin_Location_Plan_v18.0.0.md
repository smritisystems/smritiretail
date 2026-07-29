<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
  Version      : 18.0.0
  Created      : 2026-07-21
  Modified     : 2026-07-21
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal Architecture Standard
-->

# Phase 24: Enterprise Warehouse Management & Multi-Bin Location Engine (v18.0.0)

## 1. Objective
Execute **Phase 24** of SMRITI Retail OS Roadmap as the first **Domain Release (`v18.0.0`)** building on top of the **SMRITI Platform Foundation Series (PAR-001 v1.0 Baseline, CMP-001 Governance Policy)**. Deliver **WMS Subsystem (`backend/app/core/wms/`)** providing multi-bin location tracking, in-transit stock transfer reconciliation, batch/serial expiry management, physical inventory count variance adjustments, REST API Gateway (`/api/v1/wms`), and pytest integration suite.

## 2. Business Motivation
- **Advanced Fulfillment:** Enables multi-warehouse enterprise retailers to track stock down to exact bin locations (Aisle-Rack-Shelf-Bin), automate FEFO lot picking, and reconcile in-transit shipments across warehouses.

## 3. Scope
- Governance Baseline: `PAR-001 v1.0`, `CMP-001`, `GCR-001`.
- WMS Core Services: `bin_location.py`, `stock_transfer.py`, `batch_serial.py`, `inventory_count.py`.
- DB Models & Schemas: `backend/app/models/wms.py`, `backend/app/schemas/wms.py`.
- REST API: `backend/app/api/v1/wms.py`.
- Pytest suite & walkthrough documentation.

## 4. Current State
- Layers 1 through 7 Platform Foundation operational. Phase 24 launches Domain Release Series.

## 5. Gap Analysis
- Need bin-level inventory allocation, FEFO batch picking algorithms, in-transit shipment reconciliation, and cycle count variance postings.

## 6. Architecture Impact
- Zero modifications to SPK Kernel or Platform Foundation. WMS operates as a Layer 3/Domain business module consuming platform services.

## 7. Proposed Design
- Hierarchical Bin Location Manager (`Aisle-Rack-Shelf-Bin`) and stateful In-Transit Transfer Engine.

## 8. Files Created
- `/backend/app/core/wms/bin_location.py`
- `/backend/app/core/wms/stock_transfer.py`
- `/backend/app/core/wms/batch_serial.py`
- `/backend/app/core/wms/inventory_count.py`
- `/backend/app/models/wms.py`
- `/backend/app/schemas/wms.py`
- `/backend/app/api/v1/wms.py`
- `/backend/app/tests/test_wms_engine.py`
- `/docs/implementation/wms/WMS_Multi_Bin_Location_Plan_v18.0.0.md`

## 9. Files Modified
- `/backend/app/api/v1/__init__.py`
- `/backend/app/main.py`
- `/docs/implementation/README.md`
- `/docs/walkthrough/README.md`

## 10. Dependencies
- FastAPI, Pydantic V2, Python `datetime`.

## 11. Risks
- Stock transfer variance during transit: Mitigated by double-entry transfer receipt reconciliation.

## 12. Rollback Strategy
- Remove `/api/v1/wms` route mount; existing inventory records remain intact.

## 13. Verification Plan
- Automated pytest suite `test_wms_engine.py` and `npx tsc --noEmit`.

## 14. Test Plan
- Unit & integration tests for bin capacity checks, FEFO lot allocation, in-transit shipment state transitions, and physical count variance postings.

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
- `docs/walkthrough/wms/WMS_Multi_Bin_Location_v18.0.0.md`
