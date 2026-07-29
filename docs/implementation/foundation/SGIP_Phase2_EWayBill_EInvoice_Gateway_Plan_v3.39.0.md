<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.39.0
  Created      : 2026-07-20
  Modified     : 2026-07-20
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Implementation Plan — SGIP Phase 2: NIC E-Way Bill & E-Invoice Automated Integration Gateway (v3.39.0)

## 1. Objective
To implement Phase 2 of the SMRITI Government Integration Platform (SGIP), delivering stateless NIC GSTN compliance connectors for automated E-Way Bill generation, E-Invoice (IRN) generation, QR code parsing, background queue scheduling (`ComplianceOutbox` processor), and encrypted credential management.

## 2. Business Motivation
Indian tax regulations require retail enterprises with turnover exceeding mandated thresholds to generate IRNs (Invoice Reference Numbers) via the IRP portal and E-Way Bills for goods transport above INR 50,000. Automating this directly inside the FastAPI system of record ensures zero manual entry, real-time compliance validation, and audit trail preservation.

## 3. Scope
- **NIC Connectors**: Implement `NICEWayBillConnectorV1` and `NICEInvoiceConnectorV1` inheriting from `ConnectorV1` in `backend/app/compliance/connectors/nic.py`.
- **Outbox Processor Service**: Build `ComplianceQueueEngine` in `backend/app/compliance/services/queue_engine.py` to process queued outbox payloads with exponential backoff retry scheduling.
- **IRN & E-Way Bill Schema Mapping**: Define Pydantic request/response schemas for E-Way Bill and E-Invoice payloads in `backend/app/compliance/schemas/nic.py`.
- **REST Endpoints**: Add endpoints to `/api/v1/compliance/ewaybill` and `/api/v1/compliance/einvoice` in `backend/app/compliance/api/router.py`.
- **Automated Tests**: Implement integration unit tests in `backend/app/compliance/tests/test_nic_compliance_gateway.py`.

## 4. Current State
SGIP Phase 1 (v3.16.0) established `GovernmentService`, `ComplianceCredentials`, `ComplianceAuditLog`, `ComplianceOutbox` ORM models, AES-256 GCM vault cryptography, and the abstract `ConnectorV1` interface.

## 5. Gap Analysis
Currently, connectors for NIC E-Way Bill and E-Invoice APIs are not implemented, outbox processing requires manual debug triggers, and REST endpoints for direct E-Way Bill/IRN generation do not exist.

## 6. Architecture Impact
- Operates strictly inside `backend/app/compliance/` adhering to the Backend System-of-Record Policy (Rule 5).
- Relies on AES-256 GCM vault (`backend/app/compliance/vault/crypto.py`) for credential decryption.
- Implements stateless connectors adhering to `ConnectorV1`.

## 7. Proposed Design
```text
Dispatch/Invoice Event -> ComplianceOutbox (QUEUED)
                             ↓
                    ComplianceQueueEngine
                             ↓
                   NICEWayBillConnectorV1 / NICEInvoiceConnectorV1
                             ↓
                     NIC / IRP Sandbox / Live Gateway
                             ↓
                ComplianceAuditLog & Database Record Update
```

## 8. Files Created
- [NEW] [nic.py](file:///f:/SMRITRretailNXmgrt/backend/app/compliance/connectors/nic.py)
- [NEW] [queue_engine.py](file:///f:/SMRITRretailNXmgrt/backend/app/compliance/services/queue_engine.py)
- [NEW] [nic.py](file:///f:/SMRITRretailNXmgrt/backend/app/compliance/schemas/nic.py)
- [NEW] [test_nic_compliance_gateway.py](file:///f:/SMRITRretailNXmgrt/backend/app/compliance/tests/test_nic_compliance_gateway.py)
- [NEW] [SGIP_Phase2_EWayBill_EInvoice_Gateway_Plan_v3.39.0.md](file:///f:/SMRITRretailNXmgrt/docs/implementation/foundation/SGIP_Phase2_EWayBill_EInvoice_Gateway_Plan_v3.39.0.md)

## 9. Files Modified
- [MODIFY] [router.py](file:///f:/SMRITRretailNXmgrt/backend/app/compliance/api/router.py)
- [MODIFY] [README.md](file:///f:/SMRITRretailNXmgrt/docs/implementation/README.md)

## 10. Dependencies
FastAPI, SQLAlchemy 2.0 Async, Pycryptodome / Cryptography, Pydantic v2.

## 11. Risks
External NIC API unavailability during peak trading hours. Mitigation: Outbox pattern with automated retries.

## 12. Rollback Strategy
Revert newly added connector endpoints and queue engine files via git revert.

## 13. Verification Plan
Run automated backend pytest suite covering NIC authentication mock, E-Way Bill submission, E-Invoice IRN generation, and Outbox queue processing.

## 14. Test Plan
Run `python -m pytest app/compliance/tests/test_nic_compliance_gateway.py -v`.

## 15. Documentation Impact
Update implementation index and generate Phase 2 SGIP Walkthrough.

## 16. Deployment Plan
Commit and push to `target` (`smritiNX` branch).

## 17. Status
Draft

## 18. Related ADRs
- ADR-003: Platform Abstraction Layer
- ADR-005: Government Integration Gateway

## 19. Related Walkthroughs
- `Foundation_SGIP_Milestone1_Compliance_Foundation_v3.16.0.md`
