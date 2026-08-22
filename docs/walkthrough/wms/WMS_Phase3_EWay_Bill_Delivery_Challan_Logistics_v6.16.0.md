<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.16.0
  Created      : 2026-08-22
  Modified     : 2026-08-22
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough — WMS Phase 3: Statutory E-Way Bill JSON & Rule 55 Delivery Challan Logistics Engine

**Version:** `v6.16.0`  
**Area:** `wms` / `logistics`  
**Status:** Completed & Verified  

---

## 1. Purpose
Provide Indian distributors with complete statutory logistics compliance for goods movement across warehouses and retail customer dispatches. This includes automated Generation of standard NIC GST E-Way Bill JSON payloads (`ewaybillgst.gov.in` bulk upload schema v1.0.0) and Rule 55 Statutory Delivery Challans for non-supply inter-godown transfers and B2B sales dispatches.

---

## 2. Scope
1. **NIC GST E-Way Bill Generation Engine (`EWayBillService`)**:
   - Stock Transfer Orders (STO): `docType="CHL"`, `subSupplyType="8"` (Other / Inter-godown Transfer without consideration).
   - B2B Outward Sales Invoices: `docType="INV"`, `subSupplyType="1"` (Supply) with automatic State Code derivation, CGST/SGST/IGST breakdown, and transporter docket metadata.
2. **Rule 55 Statutory Delivery Challan**:
   - Comprehensive multi-godown transit document with Consignor / Consignee addresses, GSTIN numbers, vehicle & LR docket details, itemized batch breakdown with HSN codes, unit rates, total consignment value, and mandatory non-supply statutory declaration under Rule 55 of CGST Rules 2017.
3. **REST API Endpoints**:
   - `GET /api/v1/wms/transfers/{id}/eway-bill-payload`
   - `GET /api/v1/wms/transfers/{id}/delivery-challan`
   - `POST /api/v1/wms/transfers/{id}/transporter`
   - `GET /api/v1/sales/invoices/{id}/eway-bill-payload`
4. **WMS Studio React Workspace Integration**:
   - Interactive Delivery Challan view modal with browser print action (`window.print()`).
   - E-Way Bill JSON viewer with one-click direct JSON file download for portal upload.

---

## 3. Files Created
- `backend/app/services/eway_bill_service.py`: Core domain service generating statutory NIC E-Way Bill JSON payloads and Rule 55 Delivery Challans.
- `backend/tests/test_wms_phase3_eway_bill.py`: Automated pytest suite covering transfer challans, transfer E-Way Bill JSON, and sales invoice E-Way Bill generation.
- `docs/walkthrough/wms/WMS_Phase3_EWay_Bill_Delivery_Challan_Logistics_v6.16.0.md`: This walkthrough document.

---

## 4. Files Modified
- `backend/app/api/v1/wms.py`: Registered `/transfers/{id}/eway-bill-payload`, `/transfers/{id}/delivery-challan`, and `/transfers/{id}/transporter` routes.
- `backend/app/api/v1/sales.py`: Registered `/invoices/{id}/eway-bill-payload` route.
- `src/components/wms/WmsStudioTab.tsx`: Added Challan & E-Way JSON buttons on transfer cards, plus high-fidelity modal dialogs with print and export capabilities.
- `scripts/smoke_test_wms_api.py`: Extended test suite to 13 live authenticated HTTP test steps verifying Phase 1, Phase 2, and Phase 3.
- `docs/walkthrough/README.md`: Updated master index table.

---

## 5. Architecture Decisions
1. **NIC GST JSON Schema Strict Adherence**:
   - Implemented standard schema version `1.0.0` format accepted by the GST National Informatics Centre (NIC) bulk upload portal (`billLists` array, `userGstin`, `supplyType="O"`, `transType="1"`, `vehicleType="R"`).
2. **Statutory Rule 55 Delivery Challan Specification**:
   - Inter-godown transfers are legally non-taxable movements without consideration. The challan explicitly formats the mandatory subtitle `"Issued under Rule 55 of CGST Rules, 2017"` and declaration `"Supply of goods on inter-branch/godown transfer without consideration."`
3. **N+1 Query Elimination & High-Concurrency Batching**:
   - Refactored `EWayBillService` to load all transfer and invoice line item products via a single `Product.id.in_(product_ids)` batch query, reducing database round-trips from `O(N)` to `O(1)`.
4. **Statutory Data Validation & Guarding**:
   - Built statutory validation for 15-character GSTIN formats (`GSTIN_REGEX`), road vehicle number enforcement, and explicit compliance reporting (`status="VALID"` / `status="WITH_WARNINGS"`).
5. **Action-Level RBAC Permissions**:
   - Guarded logistics endpoints with granular dependencies: `require_permission("stock_ledger", "VIEW")`, `require_permission("stock_ledger", "EDIT")`, and `require_permission("sales_billing", "VIEW")`.
6. **Non-Destructive Test Isolation**:
   - Hardened all test suites (`test_wms_phase1.py`, `test_wms_phase2_grn_sales.py`, `test_wms_phase3_eway_bill.py`) and the live smoke test script (`smoke_test_wms_api.py`) with dedicated test entities and guaranteed `try...finally:` teardown, ensuring 0 residual test rows across all databases.

---

## 6. Design Rationale
Indian FMCG and consumer appliance distributors move goods between central distribution centers, town godowns, and retail floors daily. Without statutory Rule 55 Delivery Challans and valid E-Way Bills (mandatory for consignments exceeding ₹50,000), vehicles are subject to seizure by state tax enforcement. Integrating instant challan printing and NIC-ready JSON export directly on transfer and billing actions eliminates third-party ERP lag.

---

## 7. Implementation Summary
- Built `EWayBillService` with `generate_transfer_eway_bill_payload`, `generate_delivery_challan`, and `generate_invoice_eway_bill_payload`.
- Optimized queries with single-pass product batch loading.
- Added strict statutory GSTIN and transport parameter validation.
- Exposed RESTful endpoints with tenant isolation, action-level permission guards, and JWT authorization.
- Added interactive Delivery Challan viewer modal with print styling and official NIC JSON download to `WmsStudioTab.tsx`.
- Guaranteed non-destructive test isolation with automated database teardown.

---

## 8. Tests Executed
1. **Pytest Integration Suite (12/12 Clean Pass)**:
   ```powershell
   $env:PYTHONPATH='backend'; python -m pytest backend/tests/test_menu_governance.py backend/tests/test_security_menu_access.py backend/tests/test_wms_phase1.py backend/tests/test_wms_phase2_grn_sales.py backend/tests/test_wms_phase3_eway_bill.py
   ```
   **Output**: `12 passed, 1 warning in 6.39s` (100% green).
2. **13-Step Non-Destructive Live HTTP Smoke Test**:
   ```powershell
   python scripts/smoke_test_wms_api.py
   ```
   **Output**: All 13 authenticated API operations passed cleanly, followed by guaranteed teardown with 0 residual test rows.
3. **Database Residual Test Row Verification**:
   ```powershell
   # Residual test batches: 0, test transfers: 0, test GRNs: 0, test invoices: 0, test products: 0
   ```
4. **Frontend Production Build**:
   ```powershell
   npm run build
   ```
   **Output**: `3479 modules transformed. built in 22.47s` with 0 errors.

---

## 9. Verification Results
- [x] NIC E-Way Bill JSON adheres to standard `v1.0.0` specification.
- [x] Rule 55 Delivery Challan displays statutory non-supply declaration and complete godown & transport metadata.
- [x] N+1 queries eliminated via batch product query in `EWayBillService`.
- [x] Action-level RBAC permission guards verified on all WMS and Sales E-Way routes.
- [x] Multi-file combined regression passes 12/12 with zero FEFO test contamination.
- [x] Live API smoke test executes 13 real HTTP endpoints non-destructively and cleans up all database rows.
- [x] Vite React frontend compiles with 0 errors.

---

## 10. Known Limitations
- Direct GSP API push requires commercial credentials and ASP client certificates; JSON bulk upload format is standard and supported for all distributors.
- Pincode-to-pincode automated distance matrix is computed via default transit KM unless custom overridden in API query parameters.

---

## 11. Future Work
- Direct automated E-Way Bill generation via Sandbox/Production GST Suvidha Provider (GSP) REST APIs.
- QR code embedding directly on the printed Delivery Challan.

---

## 12. Related ADRs
- `ADR-0016`: PostgreSQL Single Backend System of Record.
- `ADR-0028`: Multi-Tenant Godown & FEFO Logistics Architecture.

---

## 13. Related RFCs
- `RFC-0089`: Statutory Delivery Challan & NIC E-Way Bill Logistics Engine.
