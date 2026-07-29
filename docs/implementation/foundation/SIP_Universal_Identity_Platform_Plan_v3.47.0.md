<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.47.0
  Created      : 2026-07-20
  Modified     : 2026-07-20
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Implementation Plan — SMRITI Identity Platform (SIP) Universal Enterprise Identity Core (v3.47.0)

## 1. Objective
To implement the **SMRITI Identity Platform (SIP)** as a reusable enterprise platform service providing universal identity registration, extensible domain providers, strategy-pattern identifier standards, 8-stage governance FSM lifecycle, transactional outbox domain event publishing, and non-blocking advisory AI.

## 2. Business Motivation
Enterprise platforms require global identity uniqueness, cross-domain master data linking, standards compliance (GS1, GTIN, EAN, UPC, ISBN, UDI, Digital Link, SGTIN-96 RFID), and collision-free identity resolution across Product, Customer, Supplier, Warehouse, Asset, Employee, Voucher, Batch, and Serial Number domains.

## 3. Scope
- **ORM Models**: `UniversalIdentityRegistry`, `SIPIdentityRule`, `SIPIdentityRuleVersion`, `SIPIdentityOutbox` in `backend/app/models/sip.py`.
- **Domain Providers & Strategies**: Abstract `BaseIdentityProvider` with concrete domain plugins (`Product`, `Customer`, `Supplier`, `Warehouse`, `Asset`, `Employee`, `Voucher`, `Batch`, `Serial`) and strategy classes (`GS1Strategy`, `GTINStrategy`, `EANStrategy`, `UPCStrategy`, `ISBNStrategy`, `UDIStrategy`, `DigitalLinkStrategy`, `SGTIN96Strategy`).
- **Core Platform Engines**:
  - `SIPIdentityResolutionEngine` in `backend/app/services/sip/resolution_engine.py`.
  - `SIPRuleGovernanceFSM` in `backend/app/services/sip/governance_fsm.py`.
  - `SIPMetricsAndHealthEngine` in `backend/app/services/sip/metrics_engine.py`.
  - `SIPAIAdvisoryService` in `backend/app/services/sip/ai_advisory.py`.
- **REST Router**: Mounted `/api/v1/sip/*` endpoints in `backend/app/api/v1/sip.py`.
- **Automated Integration & Concurrency Tests**: Unit and integration test suite `backend/app/tests/test_sip_v3_47_platform.py`.

## 4. Current State
Product Identity Engine (PIE Phase 1 & 2 v3.45.0) provides basic SKU key formatting and EAN-13 barcode math. Universal multi-domain identity registration, central registry, FSM rule governance, and identifier strategy abstraction are required.

## 5. Gap Analysis
Without a universal identity registry, domains generate disjointed identifiers without cross-domain linking or standardized GS1 Digital Link / SGTIN-96 RFID tag encoding.

## 6. Architecture Impact
Establishes **SIP (SMRITI Identity Platform)** alongside SAP (Approval), SSP (Security), SNP (Numbering), SCP (Compliance), SIPX (Integration), SEP (Event), and SWP (Workflow).

## 7. Proposed Design
```text
Client Application -> REST API /api/v1/sip/*
                            ↓
               SIP Resolution Engine & Domain Providers
                            ↓
               Identifier Strategy (GS1, GTIN, EAN, SGTIN-96)
                            ↓
               Universal Identity Registry (smriti_universal_identities)
                            ↓
               Transactional Outbox (smriti_identity_outbox)
                            ↓
            (Non-blocking Asynchronous) SIP AI Advisory Service
```

## 8. Files Created
- [NEW] [sip.py](file:///f:/SMRITRretailNXmgrt/backend/app/models/sip.py)
- [NEW] [providers.py](file:///f:/SMRITRretailNXmgrt/backend/app/services/sip/providers.py)
- [NEW] [strategies.py](file:///f:/SMRITRretailNXmgrt/backend/app/services/sip/strategies.py)
- [NEW] [resolution_engine.py](file:///f:/SMRITRretailNXmgrt/backend/app/services/sip/resolution_engine.py)
- [NEW] [governance_fsm.py](file:///f:/SMRITRretailNXmgrt/backend/app/services/sip/governance_fsm.py)
- [NEW] [metrics_engine.py](file:///f:/SMRITRretailNXmgrt/backend/app/services/sip/metrics_engine.py)
- [NEW] [ai_advisory.py](file:///f:/SMRITRretailNXmgrt/backend/app/services/sip/ai_advisory.py)
- [NEW] [sip.py](file:///f:/SMRITRretailNXmgrt/backend/app/api/v1/sip.py)
- [NEW] [test_sip_v3_47_platform.py](file:///f:/SMRITRretailNXmgrt/backend/app/tests/test_sip_v3_47_platform.py)
- [NEW] [SIP_Universal_Identity_Platform_Plan_v3.47.0.md](file:///f:/SMRITRretailNXmgrt/docs/implementation/foundation/SIP_Universal_Identity_Platform_Plan_v3.47.0.md)

## 9. Files Modified
- [MODIFY] [models/__init__.py](file:///f:/SMRITRretailNXmgrt/backend/app/models/__init__.py)
- [MODIFY] [api/v1/__init__.py](file:///f:/SMRITRretailNXmgrt/backend/app/api/v1/__init__.py)
- [MODIFY] [main.py](file:///f:/SMRITRretailNXmgrt/backend/app/main.py)
- [MODIFY] [conftest.py](file:///f:/SMRITRretailNXmgrt/backend/app/tests/conftest.py)
- [MODIFY] [README.md](file:///f:/SMRITRretailNXmgrt/docs/implementation/README.md)

## 10. Dependencies
SQLAlchemy 2.0 Async, FastAPI, Pytest, hashlib, difflib, Decimal.

## 11. Risks
High-concurrency identity key collisions. Mitigation: Unique database constraints on `business_key` + transactional outbox isolation.

## 12. Rollback Strategy
Unmount router `/api/v1/sip` and drop `smriti_universal_identities` table via Alembic downgrade.

## 13. Verification Plan
Run automated pytest suite covering 9 domain providers, 8 identifier strategies, FSM state transitions, collision simulation, and REST endpoints.

## 14. Test Plan
Run `python -m pytest app/tests/test_sip_v3_47_platform.py -v`.

## 15. Documentation Impact
Update implementation index, walkthrough index, and produce Phase 3.47.0 Walkthrough.

## 16. Deployment Plan
Commit and push to `target` (`smritiNX` branch).

## 17. Status
Approved / In Progress

## 18. Related ADRs
- ADR-001: Platform Architecture Overview
- ADR-002: SMRITI Metadata Architecture
- ADR-003: Platform Abstraction Layer

## 19. Related Walkthroughs
- `Product_Identity_Engine_Phase2_Walkthrough_v3.45.0.md`
