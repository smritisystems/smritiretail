<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.35.0
  Created      : 2026-08-28
  Modified     : 2026-08-28
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Implementation Plan: SMRITI Government Integration Platform (SGIP) — E-Invoice & E-Way Bill Gateway v1.0.0

## 1. Objective
Implement the statutory compliance gateway inside the FastAPI + PostgreSQL backend (`backend/app/compliance/`) for automated GSTN / NIC E-Invoice (IRN) and E-Way Bill (EWB) generation, cancellation, signed QR code generation, and transactional retry queue handling.

## 2. Business Motivation
Automate statutory compliance for enterprise retail and B2B wholesale distribution, eliminating manual portal data entry and ensuring real-time invoice regularization with the National Informatics Centre (NIC).

## 3. Scope
- NIC E-Invoice Connector (`einvoice` manifest and connector implementation).
- NIC E-Way Bill Connector (`ewaybill` manifest and connector implementation).
- GSTN Schema v1.03 payload serialization.
- Deterministic 64-character SHA-256 IRN hash generator.
- Signed QR Code decoder and payload builder.
- Transactional Outbox retry queue and circuit breaker failover.
- FastAPI REST endpoints under `/api/v1/compliance/`.

## 4. Current State
- `backend/app/compliance/` architecture scaffolding and Vault crypto (AES-256-GCM) exists.
- Base connector interface `ConnectorV1` defined.
- Registry discovery and audit models active.

## 5. Gap Analysis
- Connectors for `einvoice` and `ewaybill` need implementation.
- GSTN JSON schema v1.03 validation engine needed.
- E-Invoice / EWB orchestration services and REST endpoints needed.

## 6. Architecture Impact
- Enforces Rule 5 (FastAPI + PostgreSQL sole backend for compliance).
- Connectors remain strictly stateless and insulated from direct DB access.
- Plaintext credentials protected via AES-256-GCM in `ComplianceCredentials`.

## 7. Proposed Design
1. **E-Invoice Connector (`backend/app/compliance/connectors/einvoice/`)**:
   - `manifest.yaml` and `connector.py` implementing `ConnectorV1`.
   - `generate_irn`, `cancel_irn`, `get_irn_details`, `generate_qr_code`.
2. **E-Way Bill Connector (`backend/app/compliance/connectors/ewaybill/`)**:
   - `manifest.yaml` and `connector.py` implementing `ConnectorV1`.
   - `generate_ewb`, `cancel_ewb`, `update_vehicle`, `extend_validity`.
3. **Orchestration Services (`backend/app/compliance/services/`)**:
   - `einvoice_service.py`: Converts sales invoice to E-Invoice schema, executes gateway, records audit log.
   - `ewaybill_service.py`: Assesses ₹50,000 threshold, generates EWB payload, records audit log.
   - `retry_worker.py`: Resilient outbox background worker with exponential backoff.
4. **REST API (`backend/app/compliance/api/router.py`)**:
   - Endpoints for E-Invoice and E-Way Bill operations.

## 8. Files Created
- `backend/app/compliance/connectors/einvoice/manifest.yaml`
- `backend/app/compliance/connectors/einvoice/connector.py`
- `backend/app/compliance/connectors/ewaybill/manifest.yaml`
- `backend/app/compliance/connectors/ewaybill/connector.py`
- `backend/app/compliance/services/einvoice_service.py`
- `backend/app/compliance/services/ewaybill_service.py`
- `backend/app/compliance/services/retry_worker.py`
- `backend/tests/test_sgip_einvoice_ewaybill.py`
- `docs/implementation/foundation/SGIP_EInvoice_EWayBill_Gateway_v1.0.0.md`

## 9. Files Modified
- `backend/app/compliance/schemas/compliance.py`: Added E-Invoice and E-Way Bill request/response models.
- `backend/app/compliance/api/router.py`: Mounted E-Invoice and E-Way Bill routes.
- `docs/implementation/README.md`: Updated master implementation index.

## 10. Dependencies
- FastAPI, Pydantic v2, cryptography, SQLAlchemy, httpx, qrcode / pyzbar (or mock).

## 11. Risks
- NIC sandbox downtime: Mitigated by mock gateway fallback in sandbox test mode.
- Duplicate submission: Prevented by unique deterministic idempotency keys.

## 12. Rollback Strategy
- Stateless connectors can be deactivated via `status: disabled` in `manifest.yaml` without database migration rollbacks.

## 13. Verification Plan
- Unit tests for SHA-256 IRN generation and schema validation.
- Integration tests for sandbox authentication and payload generation.
- Outbox retry queue and circuit breaker verification.

## 14. Test Plan
- Run `python -m pytest tests/test_sgip_einvoice_ewaybill.py -v`.
- Assert 100% green across all SGIP tests.

## 15. Documentation Impact
- Update `docs/implementation/README.md` and generate walkthrough document.

## 16. Deployment Plan
- Mount in FastAPI `/api/v1/compliance/` router and deploy via Docker container.

## 17. Status
Approved

## 18. Related ADRs
- ADR-001: FastAPI + PostgreSQL Sole Backend Architecture
- ADR-005: Compliance Gateway & Vault Architecture

## 19. Related Walkthroughs
- `docs/walkthrough/foundation/SGIP_EInvoice_EWayBill_Gateway_v1.0.0.md` (to be generated).
