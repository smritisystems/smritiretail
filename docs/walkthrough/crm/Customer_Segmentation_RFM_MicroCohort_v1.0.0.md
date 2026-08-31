<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.98.0
  Created      : 2026-08-28
  Modified     : 2026-08-28
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: Customer Segmentation & AI Micro-Cohort Engine (v1.0.0-GA)

## 1. Purpose
Documents the implementation of the Customer Segmentation Engine — RFM (Recency-Frequency-Monetary) quintile scoring, 10-micro-cohort classification (Champions, Loyal, Potential Loyalists, New, Promising, Need Attention, At Risk, Can't Lose Them, Hibernating, Lost), and per-cohort targeted promotion eligibility mapping.

## 2. Scope
- `CustomerSegmentationEngine` covering RFM scoring per customer, full report generation, cohort filtering, and promotion eligibility filtering.
- `CustomerSegmentationModal` with 3-tab view: RFM-scored customer cards with score bars and promo chips, cohort reference grid, and promotion eligibility filter panel.
- 5 RFM dimensions: R (days since last purchase), F (transaction count), M (lifetime value), each scored 1–5.
- 6 promotion types: winbackOffer, loyaltyDoublePts, earlyAccess, birthdayCoupon, flashSaleInvite, reEngagementEmail.

## 3. Files Created
- `src/utils/customerSegmentationEngine.ts`
- `src/components/crm/CustomerSegmentationModal.tsx`
- `src/tests/customerSegmentationEngine.test.ts`
- `docs/walkthrough/crm/Customer_Segmentation_RFM_MicroCohort_v1.0.0.md`

## 4. Files Modified
- `docs/implementation/README.md`
- `docs/walkthrough/README.md`
- `CHANGELOG.md`

## 5. Architecture Decisions
1. **Quintile-based RFM scoring**: Fixed threshold arrays (`RECENCY_THRESHOLDS`, `FREQUENCY_THRESHOLDS`, `MONETARY_THRESHOLDS`) assign scores 1–5, avoiding the need for dataset-relative percentile computation — suitable for real-time single-customer scoring.
2. **Rule-chain cohort resolution**: `COHORT_RULES` is an ordered array of `{ fn, cohort }` entries — the first matching rule wins. This allows precise, explainable cohort assignment without a black-box ML model.
3. **Weighted composite score**: `compositeScore = (R×0.30 + F×0.35 + M×0.35) × 20` — gives frequency and monetary slightly more weight than recency, reflecting retail's preference for high-LTV customers.
4. **Promotion eligibility as derived flags**: `resolvePromotion()` derives boolean flags from cohort and monetary score — no separate promotion mapping table needed, and eligibility updates automatically when RFM score changes.

## 6. Design Rationale
Undifferentiated marketing wastes budget and erodes customer trust. Micro-cohort segmentation lets SMRITI stores run 6 distinct targeted campaigns simultaneously — win-back for At Risk, double-points for Champions, re-engagement for Lost — without manual list building.

## 7. Implementation Summary
- `scoreCustomer()`: Computes R/F/M scores from transaction history, resolves cohort via COHORT_RULES, derives promotion eligibility.
- `buildReport()`: Maps all customers through `scoreCustomer()`, aggregates cohort counts, computes avgLTV, avgAOV, identifies top cohort.
- `filterByCohort()`: Returns segments matching a specific `MicroCohort` enum value.
- `filterByPromotion()`: Returns segments where a given `PromotionEligibility` key is `true`.

## 8. Tests Executed
```bash
npm test
```

## 9. Verification Results
- **`src/tests/customerSegmentationEngine.test.ts`**: 4/4 tests passed.
- **Total Frontend Suite**: 69/69 test files, 448/448 tests green in 12.70s.

## 10. Known Limitations
- Thresholds are fixed constants, not percentile-adaptive to the current customer dataset — suitable for initial deployment, should be calibrated after 3–6 months of transaction data.
- `asOf` date is hardcoded in the UI fixture; production uses `new Date()` from the server clock.
- RFM scoring does not account for seasonal purchase patterns (e.g., festive-only buyers may score low on recency despite high LTV).

## 11. Future Work
- FastAPI `GET /api/v1/customers/{id}/rfm` and `GET /api/v1/segments/report` backed by Postgres aggregate queries.
- Automatic campaign trigger: on cohort transition to AT_RISK, queue a WhatsApp win-back message via Communicator Studio.
- Percentile-adaptive thresholds computed nightly from the live transaction distribution in Postgres.

## 12. Related ADRs
- `ADR-001`: FastAPI Sole System of Record.
- `ADR-032`: RFM Scoring Model Architecture, Micro-Cohort Classification Rules, and Promotion Eligibility Matrix.

## 13. Related RFCs
- `RFC-101`: Customer Segmentation RFM Threshold Calibration Policy and Campaign Trigger Workflow.
