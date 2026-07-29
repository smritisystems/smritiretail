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

# Walkthrough — SGIP Phase 2: NIC E-Way Bill & E-Invoice Automated Compliance Gateway (v3.39.0)

## 1. Purpose
This document records the design, implementation, and verification of SGIP Phase 2 (v3.39.0), establishing automated NIC E-Way Bill generation, IRP E-Invoice IRN calculation, signed QR code parsing, and transactional outbox background queue retries inside the SMRITI FastAPI system of record.

## 2. Scope
- **NIC Stateless Connectors**: `NICEWayBillConnectorV1` and `NICEInvoiceConnectorV1` in `backend/app/compliance/connectors/nic.py`.
- **Background Queue Engine**: `ComplianceQueueEngine` in `backend/app/compliance/services/queue_engine.py` for asynchronous outbox task retries.
- **API Request/Response Schemas**: Pydantic models in `backend/app/compliance/schemas/nic.py`.
- **FastAPI Endpoints**: `/api/v1/compliance/ewaybill/generate`, `/api/v1/compliance/einvoice/generate`, and `/api/v1/compliance/queue/process`.
- **Automated Test Suite**: 4 unit/integration test cases in `backend/app/compliance/tests/test_nic_compliance_gateway.py`.

## 3. Files Created
- `backend/app/compliance/schemas/nic.py`
- `backend/app/compliance/connectors/nic.py`
- `backend/app/compliance/services/queue_engine.py`
- `backend/app/compliance/tests/test_nic_compliance_gateway.py`
- `docs/implementation/foundation/SGIP_Phase2_EWayBill_EInvoice_Gateway_Plan_v3.39.0.md`
- `docs/walkthrough/foundation/Foundation_SGIP_Phase2_EWayBill_EInvoice_v3.39.0.md`

## 4. Files Modified
- `backend/app/compliance/api/router.py`
- `docs/implementation/README.md`
- `docs/walkthrough/README.md`
- `CHANGELOG.md`

## 5. Architecture Decisions
- **Stateless Connectors**: Connectors implement the `ConnectorV1` abstract class and perform token handshakes independently, storing zero session state.
- **Outbox Pattern Execution**: Outbox entries marked `QUEUED` or `RETRY` are picked up by `ComplianceQueueEngine` with exponential backoff delay calculation (`2 ** attempts * 5` seconds).
- **Standardized IRN Calculation**: Computes 64-character SHA-256 hash using the official formula: `SHA256(SellerGSTIN + FinYear + DocType + DocNum)`.

## 6. Design Rationale
Complies with Indian GST tax regulations while ensuring zero performance impact on point-of-sale checkout speeds through asynchronous outbox queuing.

## 7. Implementation Summary
1. Created Pydantic schema models for NIC E-Way Bill line items, requests, responses, IRNs, and cancellations.
2. Implemented `NICEWayBillConnectorV1` and `NICEInvoiceConnectorV1`.
3. Created `ComplianceQueueEngine` to process queued tasks and record audit entries in `ComplianceAuditLog`.
4. Mounted REST endpoints in `/api/v1/compliance/`.
5. Created comprehensive test suite verifying connectors, outbox processing, and REST APIs (4/4 passed).

## 8. Tests Executed
```bash
python -m pytest app/compliance/tests/test_nic_compliance_gateway.py -v
```

## 9. Verification Results
- 4/4 test cases passed (100% pass rate).

## 10. Known Limitations
- Real-world NIC production API integration requires live GSP credentials configured in the compliance vault.

## 11. Future Work
- Dynamic GSP provider failover (e.g. Cleartax / Taxmann GSP fallbacks).

## 12. Related ADRs
- ADR-003: Platform Abstraction Layer
- ADR-005: Government Integration Gateway

## 13. Related RFCs
- RFC-019: SMRITI Government Integration Platform (SGIP)
