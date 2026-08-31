<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.90.0
  Created      : 2026-08-28
  Modified     : 2026-08-28
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: Supplier Scorecard & Vendor SLA Compliance Audit (v1.0.0-GA)

## 1. Purpose
Documents the implementation of the Supplier Scorecard Engine — automated vendor SLA compliance scoring using weighted composite metrics: On-Time Delivery (50%), Fill Rate (35%), and Quality Rejection (15%). Includes penalty accrual for late deliveries, per-supplier SLA status classification (GREEN/AMBER/RED/CRITICAL), and a multi-supplier ranked audit report.

## 2. Scope
- `SupplierScorecardEngine` covering lead-time calculation, composite score, scorecard entry build, and multi-supplier report generation.
- `SupplierScorecardModal` with ranked supplier list, composite score bar, KPI grid, and PO audit table.
- 4 SLA status bands: GREEN (≥85), AMBER (≥70), RED (≥50), CRITICAL (<50).

## 3. Files Created
- `src/utils/supplierScorecardEngine.ts`
- `src/components/purchase/SupplierScorecardModal.tsx`
- `src/tests/supplierScorecardEngine.test.ts`
- `docs/implementation/purchase/Supplier_Scorecard_Vendor_SLA_Audit_v1.0.0.md`
- `docs/walkthrough/purchase/Supplier_Scorecard_Vendor_SLA_Audit_v1.0.0.md`

## 4. Files Modified
- `docs/implementation/README.md`
- `docs/walkthrough/README.md`
- `CHANGELOG.md`

## 5. Architecture Decisions
1. **Weighted composite score** (OTD 50% / Fill 35% / Quality 15%) matches standard retail procurement SLA frameworks (ISO 20400, retail buyer scorecard conventions).
2. **Quality score formula**: `max(0, 100 - rejectionPct × 10)` penalizes each 1% rejection rate with 10 score points — ensuring even moderate quality issues significantly depress the composite score.
3. **Penalty per-day tracking**: Accrued from actual vs expected delivery dates, enabling financial reconciliation against supplier contracts.

## 6. Design Rationale
Supplier SLA visibility is a procurement prerequisite. The 4-band classification provides clear escalation tiers: GREEN = maintain, AMBER = performance discussion, RED = improvement plan, CRITICAL = termination review.

## 7. Implementation Summary
- `SupplierScorecardEngine.leadTimeDays()`: ISO date difference in days.
- `SupplierScorecardEngine.computeScore()`: Weighted composite with quality penalty formula.
- `SupplierScorecardEngine.resolveSLAStatus()`: 4-band classification.
- `SupplierScorecardEngine.buildScorecard()`: Per-supplier aggregation from PO records with penalty accrual.
- `SupplierScorecardEngine.generateReport()`: Multi-supplier report sorted descending by scorecard.

## 8. Tests Executed
```bash
npm test
```

## 9. Verification Results
- **`src/tests/supplierScorecardEngine.test.ts`**: 4/4 tests passed.
- **Total Frontend Suite**: 63/63 test files, 424/424 tests green in 9.13s.

## 10. Known Limitations
- Quality score formula penalizes linearly — production may use a non-linear penalty curve for extreme outliers.
- PO records are in-memory; production queries `purchase_orders` and `goods_receipt_notes` Postgres tables.

## 11. Future Work
- FastAPI `GET /api/v1/suppliers/{id}/scorecard` endpoint backed by Postgres query.
- Automated supplier escalation alerts via email/WhatsApp on SLA status degradation.
- Historical trend chart per supplier over rolling 12-month windows.

## 12. Related ADRs
- `ADR-001`: FastAPI Sole System of Record.
- `ADR-024`: Supplier SLA Scoring Methodology and Penalty Framework.

## 13. Related RFCs
- `RFC-093`: Supplier Scorecard Composite Weighting Standard.
