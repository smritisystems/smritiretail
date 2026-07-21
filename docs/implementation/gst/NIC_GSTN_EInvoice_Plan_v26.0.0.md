<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
  Version      : 26.0.0
  Created      : 2026-07-21
  Modified     : 2026-07-21
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal Architecture Standard
-->

# Phase 32: NIC GSTN E-Way Bill & E-Invoice Auto-Filing Gateway (v26.0.0)

## 1. Objective
Execute **Phase 32** of SMRITI Retail OS Roadmap as a **Domain Release (`v26.0.0`)** building on top of the **SMRITI Platform Foundation Baseline (`v23.0.0`, PAR-001 v1.0 Baseline, CMP-001 Policy)**. Deliver **NIC GSTN Subsystem (`backend/app/core/nic_gst/`)** providing native E-Invoice IRN & B2B QR Code generation, automated E-Way Bill dispatch for consignments > ₹50,000, GSTR-1 & GSTR-3B tax reconciliation JSON builder, REST API Gateway (`/api/v1/nic-gst`), and pytest integration suite.

## 2. Business Motivation
- **Automated Tax Compliance:** Replaces expensive third-party tax portals with direct NIC E-Invoicing, automatic E-Way Bill generation on high-value consignments, and automated GSTR-1 return filing preparation.

## 3. Scope
- Governance Baseline: `PAR-001 v1.0`, `CMP-001`, `GCR-001`.
- Core NIC GST Services: `nic_einvoice.py`, `nic_ewaybill.py`, `nic_gstr_reconciler.py`.
- DB Models & Schemas: `backend/app/models/nic_gst.py`, `backend/app/schemas/nic_gst.py`.
- REST API: `backend/app/api/v1/nic_gst.py`.
- Pytest suite & walkthrough documentation.

## 4. Current State
- Phases 24 through 31 operational. Phase 32 launches NIC GST Compliance Gateway.

## 5. Gap Analysis
- Need direct SHA-256 IRN calculation, B2B QR code generation, ₹50k EWB threshold evaluator, and GSTR-1 JSON serializer.

## 6. Architecture Impact
- Zero modifications to SPK Kernel or Platform Foundation.

## 7. Proposed Design
- Direct IRN Hash Engine & NIC REST Gateway Payload Serializer.

## 8. Files Created
- `/backend/app/core/nic_gst/nic_einvoice.py`
- `/backend/app/core/nic_gst/nic_ewaybill.py`
- `/backend/app/core/nic_gst/nic_gstr_reconciler.py`
- `/backend/app/models/nic_gst.py`
- `/backend/app/schemas/nic_gst.py`
- `/backend/app/api/v1/nic_gst.py`
- `/backend/app/tests/test_nic_gst_engine.py`
- `/docs/implementation/gst/NIC_GSTN_EInvoice_Plan_v26.0.0.md`

## 9. Files Modified
- `/backend/app/api/v1/__init__.py`
- `/backend/app/main.py`
- `/docs/implementation/README.md`
- `/docs/walkthrough/README.md`

## 10. Dependencies
- FastAPI, Pydantic V2, Python `hashlib`.

## 11. Risks
- Invalid GSTIN structure: Mitigated by mandatory 15-character GSTIN regex validator.

## 12. Rollback Strategy
- Remove `/api/v1/nic-gst` route mount.

## 13. Verification Plan
- Automated pytest suite `test_nic_gst_engine.py` and `npx tsc --noEmit`.

## 14. Test Plan
- Unit & integration tests for IRN generation, EWB threshold evaluation, and GSTR-1 payload serialization.

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
- `docs/walkthrough/gst/NIC_GSTN_EInvoice_v26.0.0.md`
