<!--
  Project      : SMRITI Retail OS
  Repository   : SMRITIRetailNX
  Organization : AITDL NETWORKS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.74.0
  Created      : 2026-10-14
  Modified     : 2026-10-14
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Walkthrough / Foundation / Cost Management & Cost Truth Engine
-->

# Walkthrough: SMRITI Retail OS — Cost Management & Cost Truth Engine v1.0

## 1. Purpose
Design, implement, and certify an authoritative, production-grade **Cost Management Engine & Cost Truth Reporting Architecture** for SMRITI Retail OS. Provide business owners with absolute, explainable transparency over purchase and buying costs, landed cost allocations, Indian GST and Section 17(5)(h) Input Tax Credit (ITC) treatments, perpetual inventory stock valuation under Ind AS 2 / AS 2 (Rolling Weighted Average Cost), historical Sales COGS snapshot immutability, gross margin and net contribution waterfalls, and real-time Inventory-to-General-Ledger reconciliation.

---

## 2. Scope
- **Backend Core**: Implementation of canonical `CostManagementEngine` service in `backend/app/services/cost_engine.py`.
- **Accounting & General Ledger Parity**: Elimination of inventory/payable double-booking across Goods Receipt Notes (GRN) and Purchase Bills via Account `1045 (Unbilled GRN / GR-IR Clearing)` in `backend/app/services/unified_ledger.py`.
- **Perpetual Rolling WAC Engine**: Integrated rolling WAC recalculation upon GRN receipt in `backend/app/services/purchase.py`.
- **REST API Endpoints**: Exposing dashboard KPIs, live GL reconciliation, 6 detailed report endpoints, and backfill tools under `/api/v1/cost/*` in `backend/app/api/v1/cost.py`.
- **Interactive UI**: Engineered high-velocity `CostTruthDashboardTab.tsx` in `src/components/finance/` integrated into `TabRenderer.tsx`.
- **Test Suite**: Dedicated integration test suite `backend/tests/test_cost_management_engine.py` executed against isolated test database `smriti_test_cost_engine`.

---

## 3. Files Created
1. `backend/app/services/cost_engine.py` — Canonical Cost Management Engine service.
2. `backend/app/api/v1/cost.py` — Cost Truth REST API router.
3. `src/components/finance/CostTruthDashboardTab.tsx` — React/TypeScript Cost Truth Dashboard and reporting interface.
4. `backend/tests/test_cost_management_engine.py` — Dedicated Phase 5 integration test suite.
5. `docs/architecture/SMRITI_COST_MANAGEMENT_ENGINE_ARCHITECTURE.md` — Formal Phase 1 & 2 architecture specification.
6. `docs/implementation/foundation/Cost_Management_And_Cost_Truth_Engine_v1.0.md` — Phase 3 Implementation Plan (19 sections).
7. `docs/walkthrough/foundation/Cost_Management_And_Cost_Truth_Engine_v1.0.md` — This formal walkthrough document.

---

## 4. Files Modified
1. `backend/app/services/unified_ledger.py` — Added accounts 1045, 2040, 5012, 5045 to default COA; added landed cost to COGS lookup; added `InvoiceProfitabilityLedger` generation; eliminated GRN/Bill double-booking.
2. `backend/app/services/purchase.py` — Linked GRN receipt to `CostManagementEngine.process_inward_valuation`.
3. `backend/app/api/v1/__init__.py` — Registered `cost` router.
4. `backend/app/main.py` — Mounted `cost` router.
5. `src/components/shell/TabRenderer.tsx` — Registered lazy import, module ID, and rendering case for `cost-truth`.
6. `docs/implementation/README.md` — Updated master implementation plan index.
7. `docs/walkthrough/README.md` — Appended walkthrough entry to master index.

---

## 5. Architecture Decisions
1. **Authoritative Cost Hierarchy**:
   - `Rolling WAC` (Ind AS 2 default for perpetual inventory valuation).
   - `Landed Unit Cost` = Base Purchase Cost + Allocated Eligible Charges (Freight, Handling, Customs, Insurance).
   - `Replacement Cost` = Most recent landed inward cost.
   - `Historical Sales COGS` = Permanently snapshotted into `TransactionCostSnapshot` at posting time; zero retrospective mutation.
2. **Double-Entry GR/IR Clearing Account (1045)**:
   - GRN posting: Debit `1040 (Inventory)` @ landed value, Credit `1045 (Unbilled GRN)`.
   - Bill posting: Debit `1045 (Unbilled GRN)`, Debit `1051/1052/1053 (ITC)`, Credit `2010 (Accounts Payable)`.
   - Eliminates duplicate inventory debits.
3. **Statutory GST Blocked ITC (Section 17(5)(h))**:
   - Stock destroyed, lost, written off, or disposed of by way of gift requires reversal of ITC.
   - Expensed to Account `5045 (Blocked/Reversed ITC - Section 17(5)(h))`, crediting ITC input accounts.

---

## 6. Design Rationale
- **Zero Historical Mutations**: Modifying company valuation policies or running backfills must never mutate previously filed invoices or posted general ledger vouchers.
- **Decimal Safety**: All arithmetic performed using Python `Decimal` with `ROUND_HALF_UP` to prevent IEEE 754 binary floating-point rounding errors.
- **Explainability**: Every dashboard metric provides drilldowns into source transactions, allocation bases, and underlying ledger accounts.

---

## 7. Implementation Summary
- Created `CostManagementEngine` containing:
  - `calculate_rolling_wac`: Pure decimal mathematical function handling zero stock, positive stock, and oversold negative stock recovery.
  - `process_inward_valuation`: Atomically apportions landed cost allocations to line items and updates `ProductCostValuation`.
  - `get_inventory_to_gl_reconciliation`: Compares physical stock valuation against general ledger Account `1040 (Inventory Asset)`.
  - `get_cost_truth_dashboard_kpis`: Delivers high-level business intelligence (Inventory Value, COGS, Gross Profit, Unallocated Landed Cost, Pending ITC, Material Cost Variances).
  - 6 report engines for purchase variance, landed cost breakdown, ITC reconciliation, stock valuation, COGS profitability, and exceptions.
- Built `CostTruthDashboardTab.tsx` with responsive KPI stat cards, real-time GL reconciliation gauge, search and filters, and 5 interactive data grids.

---

## 8. Tests Executed
Dedicated pytest suite executed against isolated database `smriti_test_cost_engine`:
```bash
.venv\Scripts\python.exe -m pytest backend/tests/test_cost_management_engine.py -v
```
Test cases executed:
1. `test_rolling_wac_math_edge_cases` (PASSED)
2. `test_inward_receipt_valuation_and_landed_costs` (PASSED)
3. `test_gl_posting_no_double_booking` (PASSED)
4. `test_sales_cogs_snapshot_and_landed_cost_inclusion` (PASSED)
5. `test_inventory_to_gl_reconciliation` (PASSED)
6. `test_cost_truth_api_endpoints` (PASSED)

TypeScript validation:
```bash
npm run lint (tsc --noEmit)
```

---

## 9. Verification Results
- **Pytest Output**: `6 passed, 24 warnings in 23.15s` (Exit Code: 0).
- **TypeScript Output**: Clean compilation with 0 errors (Exit Code: 0).
- **Test Isolation**: 100% of tests ran strictly against dedicated test database `smriti_test_cost_engine` on port 2781. Zero mutations to production or control plane databases (`smriti001`, `smritisys`).

---

## 10. Known Limitations
- AI predictive forecasting under `backend/app/ai/` remains uninstantiated until high-density live production transaction volume accumulates (per SMRITI Backend System-of-Record Policy Rule 3).
- Landed cost allocation currently operates on manual or GRN-linked cost components; direct multi-GRN freight apportionment from third-party transporter invoices will be added in Phase 2.

---

## 11. Future Work
- Automated supplier cost comparison matrix across multi-vendor catalogs.
- Multi-currency landed cost conversion with automated forex gain/loss posting.
- Automated GST E-Way Bill freight charge auto-population into landed cost components.

---

## 12. Related ADRs
- `ADR-048`: Universal Financial System of Record & Double-Entry General Ledger Convergence.
- `ADR-049`: Cost Management Engine, Perpetual Rolling WAC, and GR/IR Clearing Account.

---

## 13. Related RFCs
- `RFC-2026-08`: Real-Time Perpetual Inventory Valuation and Landed Cost Allocation.
- `RFC-2026-09`: Section 17(5)(h) Blocked Input Tax Credit Automation and Compliance.
