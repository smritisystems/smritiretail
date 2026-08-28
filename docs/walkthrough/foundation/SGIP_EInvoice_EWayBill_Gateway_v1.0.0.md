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

# Walkthrough: SMRITI Government Integration Platform (SGIP) — E-Invoice & E-Way Bill Gateway v1.0.0

## 1. Purpose
This walkthrough documents the complete implementation and certification of the statutory **E-Invoice (IRN & Signed QR Code)** and **E-Way Bill (EWB Part A & Part B)** gateways residing inside the sole FastAPI + PostgreSQL backend (`backend/app/compliance/`).

## 2. Scope
- NIC GSTN E-Invoice Connector (`backend/app/compliance/connectors/einvoice/`).
- NIC E-Way Bill Connector (`backend/app/compliance/connectors/ewaybill/`).
- GSTN Schema v1.03 payload transformer & deterministic 64-char SHA-256 IRN hash generator.
- Signed QR Code decoder/builder.
- Statutory threshold evaluation (> ₹50,000 / Interstate).
- Distance-based validity calculation (1 day per 200 km).
- Transactional Outbox retry worker with exponential backoff.
- FastAPI REST endpoints mounted on `/api/v1/compliance/`.
- Integration and regression test certification.

## 3. Files Created
- `backend/app/compliance/connectors/einvoice/manifest.yaml`
- `backend/app/compliance/connectors/einvoice/connector.py`
- `backend/app/compliance/connectors/ewaybill/manifest.yaml`
- `backend/app/compliance/connectors/ewaybill/connector.py`
- `backend/app/compliance/services/einvoice_service.py`
- `backend/app/compliance/services/ewaybill_service.py`
- `backend/app/compliance/services/retry_worker.py`
- `backend/tests/test_sgip_einvoice_ewaybill.py`
- `docs/implementation/foundation/SGIP_EInvoice_EWayBill_Gateway_v1.0.0.md`
- `docs/walkthrough/foundation/SGIP_EInvoice_EWayBill_Gateway_v1.0.0.md`

## 4. Files Modified
- `backend/app/compliance/schemas/compliance.py`: Added `EInvoiceGenerationRequest`, `EInvoiceResponse`, `EWayBillGenerationRequest`, `EWayBillResponse`, `CancelComplianceDocRequest`.
- `backend/app/compliance/api/router.py`: Mounted `/einvoice/generate`, `/einvoice/cancel`, `/ewaybill/generate`, `/ewaybill/cancel`, `/connectors`.
- `backend/app/compliance/__init__.py`: Exposed public SGIP interfaces.
- `docs/implementation/README.md`: Updated master implementation index.
- `docs/walkthrough/README.md`: Updated master walkthrough index.
- `CHANGELOG.md`: Added release notes for `[3.71.0] - 2026-08-28`.

## 5. Architecture Decisions
- **Rule 5 Compliance**: All external government compliance engines reside in FastAPI + PostgreSQL backend (`backend/app/compliance/`).
- **Stateless Connectors**: Connectors implement `ConnectorV1` and never access the database directly.
- **Encrypted Secret Storage**: Plaintext secrets are encrypted using AES-256-GCM in `ComplianceCredentials`.

## 6. Design Rationale
- **Deterministic IRN Hash Calculation**: Avoids external network dependency during preliminary invoice validation.
- **Statutory Threshold Automation**: Enforces mandatory E-Way Bill generation on all invoices ≥ ₹50,000 or interstate transit.
- **Resilient Retry Queue**: Transactional outbox with exponential backoff prevents transient NIC gateway failures from disrupting retail POS checkouts.

## 7. Implementation Summary
1. **E-Invoice Gateway**:
   - Manifest defined with ID `einvoice` and provider `NIC`.
   - INV-01 JSON payload builder and 64-character SHA-256 IRN generator.
   - Base64 signed QR payload generator.
2. **E-Way Bill Gateway**:
   - Manifest defined with ID `ewaybill` and provider `NIC`.
   - 12-digit numeric EWB number generator and distance validity calculator.
3. **Services & Outbox Worker**:
   - `EInvoiceService` and `EWayBillService` with persistent audit logging in `compliance_audit_logs`.
   - `ComplianceRetryWorker` with exponential backoff (15s, 30s, 60s, 120s, 240s).
4. **FastAPI Endpoints**:
   - High-performance async REST routes under `/api/v1/compliance/`.

## 8. Tests Executed
```bash
python -m pytest tests/test_sgip_einvoice_ewaybill.py tests/test_reporting_certification_suite.py tests/test_reporting_api_endpoints.py tests/test_report_registry_governance.py tests/test_report_security_and_performance.py tests/test_inventory_snapshots_and_lineage.py -v
npm test
```

## 9. Verification Results
- **Backend Test Suites**: `45/45 passed (100% green)` in 15.09s.
- **Frontend Test Suite**: `347/347 passed (100% green)` across 44 test files in 6.29s.
- **Statutory IRN Formula Verification**: SHA-256 exact match.
- **E-Way Bill 12-digit format & validity**: 100% compliant.

## 10. Known Limitations
- Direct production NIC portal calls require valid production GSTN credentials in `ComplianceCredentials`.

## 11. Future Work
- Integration with GSP (GST Suvidha Provider) multi-vendor failover routing.
- Direct auto-generation trigger from POS terminal billing screen on invoice finalization.

## 12. Related ADRs
- ADR-001: FastAPI + PostgreSQL Sole Backend Architecture
- ADR-005: Compliance Gateway & Vault Architecture

## 13. Related RFCs
- RFC-SGIP-01: GSTN Schema v1.03 Integration Standard
