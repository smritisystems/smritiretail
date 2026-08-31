<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.92.0
  Created      : 2026-08-28
  Modified     : 2026-08-28
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: Smart Replenishment & Min-Max Inventory Reorder Automation (v1.0.0-GA)

## 1. Purpose
Documents the implementation of the Smart Replenishment Engine — automated min/max inventory reorder with 5-trigger classification, stockout date projection, suggested order quantity with PO value estimation, and one-click auto-PO generation.

## 2. Scope
- `ReplenishmentEngine` covering trigger classification, days-of-stock calculation, stockout projection, single-SKU suggestion, and full branch inventory scan.
- `SmartReplenishmentModal` with suggestion cards, trigger filters, stockout progress bars, and approve/auto-raise-PO actions.
- 5 trigger types ordered by priority: SAFETY_STOCK_BREACH > REORDER_POINT_HIT > MIN_STOCK_BREACH > SEASONAL_PUSH > MANUAL_OVERRIDE.

## 3. Files Created
- `src/utils/replenishmentEngine.ts`
- `src/components/inventory/SmartReplenishmentModal.tsx`
- `src/tests/replenishmentEngine.test.ts`
- `docs/implementation/inventory/Smart_Replenishment_MinMax_Reorder_v1.0.0.md`
- `docs/walkthrough/inventory/Smart_Replenishment_MinMax_Reorder_v1.0.0.md`

## 4. Files Modified
- `docs/implementation/README.md`
- `docs/walkthrough/README.md`
- `CHANGELOG.md`

## 5. Architecture Decisions
1. **5-trigger priority hierarchy**: SAFETY_STOCK_BREACH has highest urgency — any item below safety stock is escalated first regardless of other levels.
2. **Order-up-to-max model**: `suggestedOrderQty = maxStockLevel - currentStock` ensures replenishment brings inventory to the configured maximum, preventing over-ordering cycles.
3. **Stockout date projection**: `currentStock / avgDailySales` gives a simple but actionable horizon with zero external dependencies — production can refine with Holt-Winters forecasting backed by Postgres sales history.

## 6. Design Rationale
Automated replenishment reduces lost sales from stockouts and reduces manual PO creation effort. The visual stockout bar in the UI gives store managers immediate triage priority without reading raw numbers.

## 7. Implementation Summary
- `ReplenishmentEngine.getTrigger()`: Returns highest-priority applicable trigger or null if none.
- `ReplenishmentEngine.daysOfStockRemaining()`: `floor(currentStock / avgDailySales)`.
- `ReplenishmentEngine.estimatedStockoutDate()`: Adds days to `asOf` date.
- `ReplenishmentEngine.generateSuggestion()`: Returns null if no trigger, else builds full suggestion with PO value.
- `ReplenishmentEngine.scanInventory()`: Runs across all items, filters and sorts by trigger priority.
- `ReplenishmentEngine.raisePO() / approve() / cancel()`: Status state transitions on suggestion.

## 8. Tests Executed
```bash
npm test
```

## 9. Verification Results
- **`src/tests/replenishmentEngine.test.ts`**: 4/4 tests passed.
- **Total Frontend Suite**: 63/63 test files, 424/424 tests green in 9.13s.

## 10. Known Limitations
- `avgDailySales` is a static field on each item; production should compute dynamically from a Postgres `sales_history` 30-day rolling average.
- PO auto-raise creates a local state record; production calls `POST /api/v1/purchase-orders` on FastAPI.

## 11. Future Work
- FastAPI `GET /api/v1/inventory/replenishment-scan` endpoint with Postgres-backed suggestions.
- Holt-Winters seasonal forecasting for `avgDailySales` using actual sales history.
- Multi-supplier PO splitting when no preferred supplier is configured (round-robin by category).

## 12. Related ADRs
- `ADR-001`: FastAPI Sole System of Record.
- `ADR-026`: Replenishment Trigger Hierarchy and Min-Max Reorder Policy.

## 13. Related RFCs
- `RFC-095`: Smart Replenishment Engine — Stockout Projection and Auto-PO Generation Policy.
