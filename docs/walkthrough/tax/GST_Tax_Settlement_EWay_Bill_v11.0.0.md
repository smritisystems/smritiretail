<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
  Version      : 11.0.0
  Created      : 2026-07-21
  Modified     : 2026-07-21
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal Architecture Standard
-->

# Tax & Statutory Compliance — GST Tax Settlement, Outward/Inward Return Filing DTO & E-Way Bill Integration Engine
**Walkthrough Version:** v11.0.0  
**Date:** 2026-07-21  
**Author:** Jawahar Ramkripal Mallah  
**Status:** Completed & Verified (100/100 PASSED)

---

## 1. Purpose

Establishes the enterprise **GST Tax Settlement, Outward/Inward Return Filing DTO & E-Way Bill Integration Engine** (`GstTaxEngine`) in SMRITI Retail OS. Manages monthly GST Output Tax Liability vs Inward Input Tax Credit (ITC) reconciliation with statutory set-off rules, compiles GSTN portal-compliant GSTR-1 return filing DTO payloads, and enforces statutory E-Way Bill generation (`EWayBill`) for goods transport exceeding regulatory thresholds (₹50,000) with distance validity calculation.

---

## 2. Scope

- New Alembic DDL migration: `v1100_gst_tax_settlement_eway.py` — creates `gst_tax_settlements`, `gst_return_filings`, and `eway_bills` tables with full `BaseEntity` audit columns.
- Unified ORM models in `app/models/tax.py`: `GstTaxSettlement`, `GstReturnFiling`, `EWayBill`.
- New `GstTaxEngine` domain service (`app/services/gst_tax_engine.py`):
  - `calculate_monthly_settlement()`: computes total outward CGST/SGST/IGST liability from Sales Invoices and total inward CGST/SGST/IGST Input Tax Credit (ITC) from Purchase Receipts, applies statutory set-off hierarchy, and calculates net tax payable or carry-forward ITC.
  - `generate_gstr1_payload()`: compiles sales invoice transactions into structured GSTR-1 return filing JSON payload conforming to GSTN portal B2B, B2C, and Credit Note specifications.
  - `generate_eway_bill()`: validates statutory consignment threshold (> ₹50,000), assigns unique EWB number, and computes distance-based validity period (1 day per 200 km).
- New REST API router: `/api/v1/tax` (`GET /gst/settlement`, `GET /gst/gstr1`, `POST /eway-bills`, `GET /eway-bills/{id}`).
- Pydantic DTO schemas: `GstSettlementResponse`, `Gstr1PayloadResponse`, `EWayBillCreateReq`, `EWayBillResponse`.
- 6 integration test assertions verifying monthly GST set-off calculation, GSTR-1 JSON structure compilation, E-Way bill threshold validation (> ₹50k pass, < ₹50k HTTP 400 rejection), distance validity calculation (450 km = 3 days), and multi-tenant isolation.

---

## 3. Files Created

| File | Role |
|------|------|
| `backend/alembic/versions/v1100_gst_tax_settlement_eway.py` | Alembic DDL migration — creates `gst_tax_settlements`, `gst_return_filings`, `eway_bills` tables |
| `backend/app/models/tax.py` | Unified Tax ORM models — GstTaxSettlement, GstReturnFiling, EWayBill |
| `backend/app/services/gst_tax_engine.py` | GstTaxEngine domain service — monthly GST set-off, GSTR-1 payload serialization, E-Way Bill generation |
| `backend/app/schemas/tax.py` | Pydantic DTO schemas for settlements, GSTR-1 payloads, and E-Way Bills |
| `backend/app/api/v1/tax.py` | REST API gateway: `/tax/gst/settlement`, `/tax/gst/gstr1`, `/tax/eway-bills` |
| `backend/app/tests/test_gst_tax.py` | 6 integration test assertions for GST settlement, GSTR-1 payload compilation, and E-Way bills |

---

## 4. Files Modified

| File | Change |
|------|--------|
| `backend/app/models/__init__.py` | Exported `GstTaxSettlement`, `GstReturnFiling`, `EWayBill` |
| `backend/alembic/env.py` | Updated POS model imports |
| `backend/app/main.py` | Imported and mounted `tax.router` under `/api/v1` |
| `docs/walkthrough/README.md` | Appended v11.0.0 entry to master walkthrough index |

---

## 5. Architecture Decisions

### AD-01: Statutory Input Tax Credit (ITC) Set-Off Hierarchy
- Calculates `net_cgst = max(0, outward_cgst - inward_itc_cgst)`.
- Calculates `net_sgst = max(0, outward_sgst - inward_itc_sgst)`.
- Computes `carry_forward_itc = max(0, total_inward_itc - total_outward_tax)`.

### AD-02: E-Way Bill Distance-Based Validity Calculation
- Evaluates `validity_days = max(1, math.ceil(distance_km / 200.0))`.
- Rejects consignments below statutory threshold (₹50,000) with HTTP 400.

---

## 6. Implementation Summary

### Database Schema

```text
gst_tax_settlements
    id, uuid, tenant_id, company_id, branch_id, settlement_no, tax_period,
    outward_cgst, outward_sgst, outward_igst, total_outward_tax,
    inward_itc_cgst, inward_itc_sgst, inward_itc_igst, total_inward_itc,
    net_cgst_payable, net_sgst_payable, net_igst_payable, total_net_tax_payable, carry_forward_itc,
    status (CALCULATED/SETTLED/FILED), notes

gst_return_filings
    id, uuid, tenant_id, company_id, branch_id, filing_no, return_type (GSTR1/GSTR3B/GSTR2B), tax_period,
    gstr1_payload_json, b2b_invoices_count, b2c_invoices_count, credit_notes_count,
    total_taxable_value, total_tax_amount, status (GENERATED/FILED/ACKNOWLEDGED), arn_number, filed_at

eway_bills
    id, uuid, tenant_id, company_id, branch_id, eway_bill_no, invoice_id, consignment_value,
    transporter_id, transporter_name, transport_mode (ROAD/RAIL/AIR/SHIP), vehicle_no, distance_km,
    valid_from, valid_until, status (GENERATED/IN_TRANSIT/CANCELLED/EXPIRED)
```

### API Endpoints

| Method | Path | Operation |
|--------|------|-----------|
| `GET` | `/api/v1/tax/gst/settlement` | Calculate monthly GST tax settlement |
| `GET` | `/api/v1/tax/gst/gstr1` | Generate GSTR-1 return filing JSON payload |
| `POST` | `/api/v1/tax/eway-bills` | Generate statutory E-Way Bill |
| `GET` | `/api/v1/tax/eway-bills/{id}` | Get E-Way Bill details |

---

## 7. Tests Executed & Results

**Command:**
```powershell
$env:PYTHONPATH="."; python -m pytest app/tests/test_product_vendor.py app/tests/test_vendor_contract.py app/tests/test_three_way_matching.py app/tests/test_rfq_quotation.py app/tests/test_blanket_agreement.py app/tests/test_purchase_requisition.py app/tests/test_quality_inspection.py app/tests/test_supplier_scorecard.py app/tests/test_sales_fulfillment.py app/tests/test_sales_invoicing.py app/tests/test_sales_return.py app/tests/test_stock_audit.py app/tests/test_stock_transfer.py app/tests/test_replenishment.py app/tests/test_pos.py app/tests/test_gst_tax.py -v
```

**Verification Results:**

| # | Test | Status |
|---|------|--------|
| 1 | `test_calculate_monthly_gst_settlement_setoff` | **PASSED** |
| 2 | `test_generate_gstr1_payload_structure` | **PASSED** |
| 3 | `test_generate_eway_bill_validates_threshold` | **PASSED** |
| 4 | `test_eway_bill_rejected_below_threshold` | **PASSED** |
| 5 | `test_eway_bill_distance_validity_calculation` | **PASSED** |
| 6 | `test_multi_tenant_isolation_for_tax_settlement` | **PASSED** |

**Overall Result: 100/100 PASSED across complete procurement, receiving, sales fulfillment, invoicing, returns, stock audit, stock transfer, replenishment, POS, and GST tax & statutory compliance stack**

**Verification Status: Done**
