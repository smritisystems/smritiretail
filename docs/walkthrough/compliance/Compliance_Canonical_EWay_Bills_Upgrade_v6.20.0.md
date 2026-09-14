<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.20.0
  Created      : 2026-09-14
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Canonical Statutory E-Way Bill 2026 Compliance Architecture
-->

# Compliance Walkthrough: Canonical E-Way Bill 2026 Upgrade & PostgreSQL Database Unification (v6.20.0)

**Walkthrough Version:** v6.20.0  
**Release Milestone:** Milestone 6.20.0 / SGIP Statutory Gateway  
**Date:** 2026-09-14  
**Author:** Jawahar Ramkripal Mallah (Chief Systems Architect & Creator)  
**Classification:** Canonical Government Integration Platform (SGIP)  

---

## 1. Purpose
This implementation eliminates schema drift and statutory obsolescence in SMRITI Retail OS's E-Way Bill architecture. It aligns both the control plane (`smritisys`) and tenant databases (`smriti001`) with latest 2026 Government of India statutory mandates (CBIC & NIC E-Way Bill System), enforces Rule 12 column-by-column parity (73 columns each), binds runtime E-Way Bill generation directly to the database via SQLAlchemy ORM, and populates canonical records for Reliance Retail West Bengal DC dispatches (`TT2026-2027/195`, `196`, `197`).

---

## 2. Scope
- Reconcile database schema drift between `smriti001` and `smritisys` on `eway_bills`.
- Implement new idempotent canonical Alembic migration `v1452_canonical_eway_bills_2026.py` upgrading both databases to 73 columns.
- Update SQLAlchemy ORM model `EWayBill` in `backend/app/models/distribution.py` to match all 73 columns.
- Upgrade `EWayBillGenerationRequest` in `backend/app/compliance/schemas/compliance.py` with 2026 canonical compliance parameters (`trans_type=4`, `dispatch_from_*`, `ship_to_*`, `total_taxable_amount`, `main_hsn_code`).
- Upgrade `EWayBillService` in `backend/app/compliance/services/ewaybill_service.py` to persist generated E-Way Bill records to PostgreSQL and handle 24-hour statutory cancellation transitions.
- Populate canonical E-Way Bills in `smriti001.eway_bills` for invoices `TT2026-2027/195`, `196`, `197` and synchronize `sales_invoices.eway_bill_no`.
- Implement and pass integration test suite `test_canonical_ewaybill_lifecycle.py` and verify all 10 compliance test suites.

---

## 3. Files Created
1. `backend/alembic/versions/v1452_canonical_eway_bills_2026.py` — Idempotent canonical Alembic migration adding missing 2026 statutory columns and alias bridges.
2. `backend/app/compliance/tests/test_canonical_ewaybill_lifecycle.py` — Comprehensive integration test suite verifying threshold logic, generation, ORM persistence, 200 km/day validity, and cancellation.
3. `docs/walkthrough/compliance/Compliance_Canonical_EWay_Bills_Upgrade_v6.20.0.md` — This formal walkthrough document.

---

## 4. Files Modified
1. `backend/app/models/distribution.py` — Updated `EWayBill` SQLAlchemy model with all 73 canonical columns.
2. `backend/app/compliance/schemas/compliance.py` — Added 2026 statutory compliance fields to `EWayBillGenerationRequest`.
3. `backend/app/compliance/services/ewaybill_service.py` — Wired ORM persistence in `generate_ewaybill()` and database status updating in `cancel_ewaybill()`.
4. `docs/walkthrough/README.md` — Updated master index with v6.20.0 entry.

---

## 5. Architecture Decisions
1. **Rule 12 Zero-Drift Guarantee:** `smriti001` and `smritisys` both reached revision `v1452` with exactly 73 columns, 0 missing columns, and matching data types.
2. **Statutory 4-Party Combination Movement (`transType: 4`):** In retail supply chain dispatches where goods originate from an offsite warehouse (e.g. Nagpur Depot `440029`) and deliver directly to a client's regional distribution center (e.g. Sankrail DC `711310`), statutory `transType = 4` must be used to legally isolate Billing addresses from physical transit points.
3. **2026 Validity Computation:** Enforced Rule 138(10) formula: 200 km per day or part thereof for normal cargo (minimum 24 hours). For 1020 km, validity is calculated as `ceil(1020 / 200) = 6` days (144 hours).
4. **Column Alias Preservation:** Maintained dual aliases (`document_id` and `invoice_id`, `document_value` and `consignment_value`, `vehicle_number` and `vehicle_no`) in DDL and ORM to ensure zero breaking changes across older distribution scripts and newer compliance microservices.

---

## 6. Design Rationale
Previously, E-Way Bill generation generated JSON files and logged into `compliance_audit_logs`, but bypassed the transactional `eway_bills` table. This created a split-brain state where UI and accounting queries could not find E-Way Bill numbers on invoices. By persisting `EWayBill` entities with complete NIC snapshots in PostgreSQL, the system provides single-source-of-truth governance, automated validity countdowns, and audit readiness for GST authorities.

---

## 7. Implementation Summary
- **Alembic Migration (`v1452`):**
  Added physical origin columns (`dispatch_from_gstin`, `dispatch_from_trade_name`, `dispatch_from_place`, `dispatch_from_pincode`, `dispatch_from_state_code`, `dispatch_from_addr1`, `dispatch_from_addr2`), physical delivery columns (`ship_to_gstin`, `ship_to_trade_name`, `ship_to_place`, `ship_to_pincode`, `ship_to_state_code`, `ship_to_addr1`, `ship_to_addr2`), statutory verification columns (`irn`, `ewb_date`, `valid_from`, `valid_until`, `signed_qr_code`, `part_b_status`, `nic_payload_snapshot`, `nic_response_snapshot`), and synchronized missing delivery/distribution columns across both databases.
- **Service Orchestrator (`EWayBillService`):**
  Integrated `self.db.add(ewb_record)` and statutory cancellation status synchronization.
- **Data Persistence:**
  Populated Reliance Retail invoices `TT2026-2027/195` (EWB `260951827195`), `196` (EWB `260951827196`), `197` (EWB `260951827197`) into `smriti001.eway_bills` with valid from `05-09-2026` to `11-09-2026` (6 days, 1020 km), and updated `smriti001.sales_invoices.eway_bill_no`.

---

## 8. Tests Executed
1. **Canonical E-Way Bill Lifecycle Test (`test_canonical_ewaybill_lifecycle.py`):**
   - `test_ewaybill_statutory_threshold`: Intra-state ₹50,000 threshold and interstate mandatory evaluation.
   - `test_canonical_ewaybill_generation_and_persistence`: Generation with `trans_type=4`, 1020 km 6-day validity check, ORM entity querying, and 24-hr statutory cancellation.
2. **Full Compliance Test Suite (`backend/app/compliance/tests/`):**
   - 10/10 tests passed across vault, registry, credentials, outbox, and lifecycle.

---

## 9. Verification Results
```text
============================= test session starts =============================
platform win32 -- Python 3.13.11, pytest-9.1.1, pluggy-1.6.0 -- C:\Users\netma\AppData\Local\Programs\Python\Python313\python.exe
rootdir: F:\SMRITRretailNX\backend
plugins: anyio-4.14.2, asyncio-1.4.0
asyncio: mode=Mode.AUTO, debug=False

collected 10 items

backend\app\compliance\tests\test_canonical_ewaybill_lifecycle.py::test_ewaybill_statutory_threshold PASSED [ 10%]
backend\app\compliance\tests\test_canonical_ewaybill_lifecycle.py::test_canonical_ewaybill_generation_and_persistence PASSED [ 20%]
backend\app\compliance\tests\test_compliance_fou.py::test_vault_key_sourcing_validation PASSED [ 30%]
backend\app\compliance\tests\test_compliance_fou.py::test_vault_deterministic_mode_gating PASSED [ 40%]
backend\app\compliance\tests\test_compliance_fou.py::test_connector_registry_discovery PASSED [ 50%]
backend\app\compliance\tests\test_compliance_fou.py::test_connector_registry_invalid_manifests PASSED [ 60%]
backend\app\compliance\tests\test_compliance_fou.py::test_compliance_repositories_crud PASSED [ 70%]
backend\app\compliance\tests\test_compliance_fou.py::test_services_coordination PASSED [ 80%]
backend\app\compliance\tests\test_compliance_fou.py::test_health_check_endpoint PASSED [ 90%]
backend\app\compliance\tests\test_compliance_fou.py::test_debug_outbox_gating PASSED [100%]

================= 10 passed, 27 warnings in 60.89s (0:01:00) ==================
```

---

## 10. Known Limitations
- Real-time direct HTTP POST calls to `ewaybillgst.gov.in` require GSP (GST Suvidha Provider) or NIC production client credentials; local execution operates against the compliant statutory sandbox simulation engine.

---

## 11. Future Work
- Integrate Part-B vehicle number batch updates from warehouse loading dock scanner events.
- Implement automatic SMS/WhatsApp dispatch alerts to consignees carrying the 12-digit E-Way Bill Number and tracking URL.

---

## 12. Related ADRs
- `ADR-0026`: Multi-Tenant Schema Parity & Zero-Drift Alembic Governance.
- `ADR-0042`: Government Integration Platform (SGIP) Statutory Connector Standard.

---

## 13. Related RFCs
- `RFC-GST-2026-01`: 2026 E-Way Bill TransType 4 Party Architecture and E-Invoice IRN Interlocking.
