<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.3.0
  Created      : 2026-07-21
  Modified     : 2026-07-21
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal Architecture Standard
-->

# Procurement — Automated Supplier Performance Rating & Scorecard Analytics Engine
**Walkthrough Version:** v6.3.0  
**Date:** 2026-07-21  
**Author:** Jawahar Ramkripal Mallah  
**Status:** Completed & Verified (52/52 PASSED)

---

## 1. Purpose

Establishes the empirical **Supplier Performance & Scorecard Analytics Engine** in SMRITI Retail OS. Aggregates transactional data across all previous procurement phases (OTIF delivery, Quality Control pass rates, 3-Way Matching invoice price compliance, and RFQ bidding responsiveness) into dynamic 0–100 performance scores and letter grades (A/B/C/F), automatically updating supplier tier classifications (`PREFERRED`, `APPROVED`, `CONDITIONAL`, `SUSPENDED`).

---

## 2. Scope

- New Alembic DDL migration: `supplier_scorecards` and `supplier_scorecard_metrics` tables; `performance_rating` and `tier_classification` columns added to `suppliers`.
- New ORM models: `SupplierScorecard` and `SupplierScorecardMetric`.
- New `SupplierPerformanceEngine` — calculates 4 weighted metric dimensions (OTIF 35%, Quality 35%, Price 15%, RFQ 15%), updates supplier model tiering, generates scorecard aggregate snapshots, and supports single/batch recalculations.
- New REST API router: `/api/v1/purchase/scorecards` (calculate single/batch, get supplier scorecard history, list ranked suppliers).
- Pydantic schemas: `SupplierScorecardResponse`, `SupplierScorecardMetricResponse`, `ScorecardRecalculateRequest`.
- 6 integration test assertions verifying perfect performance (Grade A / PREFERRED), QC rejection penalty, OTIF delivery tracking, low score automatic tier downgrade (`SUSPENDED`), batch recalculation, and multi-tenant isolation.

---

## 3. Files Created

| File | Role |
|------|------|
| `backend/alembic/versions/v630_supplier_scorecard_engine.py` | Alembic DDL migration — 2 new tables + 2 new columns on `suppliers` |
| `backend/app/procurement/engine/supplier_performance_engine.py` | SupplierPerformanceEngine — multi-metric evaluator, tier classifier, batch engine |
| `backend/app/api/v1/procurement_scorecard.py` | REST API gateway: calculate scorecards, get by supplier, list rankings |
| `backend/app/tests/test_supplier_scorecard.py` | 6 integration test assertions for complete scorecard analytics lifecycle |

---

## 4. Files Modified

| File | Change |
|------|--------|
| `backend/app/models/purchase.py` | +`SupplierScorecard`, +`SupplierScorecardMetric` models; +`performance_rating`, `tier_classification` columns on `Supplier` |
| `backend/app/schemas/purchase.py` | +`SupplierScorecardResponse`, `SupplierScorecardMetricResponse`, `ScorecardRecalculateRequest` DTOs |
| `backend/app/main.py` | +`procurement_scorecard` import; +`app.include_router(procurement_scorecard.router, ...)` |

---

## 5. Architecture Decisions

### AD-01: SupplierScorecard as Historical Aggregate Root
`SupplierScorecard` acts as the aggregate root managing line-level metric breakdowns (`SupplierScorecardMetric`). Historical scorecards provide an auditable timeline of vendor performance evolution over customizable day windows (default 90 days).

### AD-02: Multi-Metric Empirical Weighting Model
Performance scores ($0.00 \rightarrow 100.00$) are calculated using enterprise-standard weights:
- **OTIF (On-Time In-Full) Delivery (35%)**: Ratio of confirmed/received POs vs. scheduled lead time & quantity accuracy.
- **Quality Control Pass Rate (35%)**: Ratio of accepted vs. received items from Phase 7 `QualityInspection` records.
- **Price Compliance Index (15%)**: Invoice variance tracking against agreed contract unit prices.
- **RFQ Responsiveness (15%)**: Ratio of quotations submitted vs. RFQ bidding invitations extended.

### AD-03: Dynamic Grade & Tier Classification FSM
Based on the composite score, the engine automatically updates the `Supplier` master entity's `performance_rating` and `tier_classification`:
- $\ge 90.00 \rightarrow$ Grade `A` (`PREFERRED`)
- $75.00 – 89.99 \rightarrow$ Grade `B` (`APPROVED`)
- $60.00 – 74.99 \rightarrow$ Grade `C` (`CONDITIONAL`)
- $< 60.00 \rightarrow$ Grade `F` (`SUSPENDED`)

---

## 6. Implementation Summary

### Database Schema

```text
suppliers (modified)
    +performance_rating (Numeric 5,2)
    +tier_classification (PREFERRED/APPROVED/CONDITIONAL/SUSPENDED)

supplier_scorecards
    id, scorecard_no, supplier_id, evaluation_date, days_window,
    otif_score, quality_score, price_score, rfq_score, composite_score,
    grade (A/B/C/D/F), tier_classification

supplier_scorecard_metrics
    scorecard_id → supplier_scorecards.id (CASCADE)
    metric_type (OTIF/QUALITY/PRICE/RFQ), raw_value, weight, weighted_score, details_json
```

### API Endpoints

| Method | Path | Operation |
|--------|------|-----------|
| `POST` | `/api/v1/purchase/scorecards/calculate` | Recalculate scorecard for supplier(s) |
| `GET` | `/api/v1/purchase/scorecards/supplier/{supplier_id}` | Get latest scorecard for supplier |
| `GET` | `/api/v1/purchase/scorecards/rankings` | List suppliers ranked by composite score |

---

## 7. Tests Executed & Results

**Command:**
```powershell
$env:PYTHONPATH="."; python -m pytest app/tests/test_product_vendor.py app/tests/test_vendor_contract.py app/tests/test_three_way_matching.py app/tests/test_rfq_quotation.py app/tests/test_blanket_agreement.py app/tests/test_purchase_requisition.py app/tests/test_quality_inspection.py app/tests/test_supplier_scorecard.py -v
```

**Verification Results:**

| # | Test | Status |
|---|------|--------|
| 1 | `test_scorecard_perfect_performance` | **PASSED** |
| 2 | `test_scorecard_qc_rejection_reduces_quality_score` | **PASSED** |
| 3 | `test_scorecard_otif_delivery_tracking` | **PASSED** |
| 4 | `test_scorecard_automatic_tier_downgrade_to_suspended` | **PASSED** |
| 5 | `test_batch_scorecard_recalculation` | **PASSED** |
| 6 | `test_multi_tenant_isolation_for_scorecards` | **PASSED** |

**Overall Result: 52/52 PASSED across complete procurement & warehouse stack**

**Verification Status: Done**
