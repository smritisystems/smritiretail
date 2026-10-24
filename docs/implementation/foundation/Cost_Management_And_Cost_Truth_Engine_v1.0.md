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
  Classification: Implementation Plan / Cost Truth Engine
-->

# Cost Management & Cost Truth Engine Implementation Plan v1.0

## 1. Objective
Design and implement a production-grade Cost Management & Cost Truth Engine across the existing FastAPI + PostgreSQL + React/TypeScript stack to provide retail business owners and finance leaders with a fully verifiable, double-entry compliant view of:
- Net purchase and buying costs
- Apportioned landed costs (freight, cartage, handling, customs duties)
- GST Input Tax Credit (ITC) treatment and Section 17(5)(h) blocked credits
- Continuous rolling Weighted Average Cost (WAC) and FIFO stock valuation
- Historical Cost of Goods Sold (COGS) snapshots
- Gross profit and transactional net contribution waterfall ledgers
- Real-time Inventory-to-General-Ledger reconciliation (verifying Account 1040 balance matches physical stock valuation).

## 2. Business Motivation
Accurate cost visibility is fundamental to retail survival and financial compliance. Prior to this implementation:
- Inventory valuation was calculated using fragmented, unpersisted formulas or naive static catalog cost prices.
- Sales COGS recognition ignored landed freight and duties, inflating reported gross margins.
- General Ledger postings for goods receipts and supplier bills duplicated inventory assets and trade payables due to the absence of a GR/IR clearing account.
- GST on damaged stock was not systematically tracked or reversed per Section 17(5)(h) of the CGST Act 2017.

## 3. Scope
- **Backend Service**: Create `backend/app/services/cost_engine.py` as the canonical Cost Truth and Valuation authority.
- **GL Posting Remediation**: Update `DEFAULT_CHART_OF_ACCOUNTS` in `unified_ledger.py` with Account `1045 (Unbilled GRN / GR-IR Clearing)`, Account `2040 (Freight Payable)`, and Account `5045 (Blocked ITC)`. Refactor `post_purchase_receipt_to_gl` and `post_purchase_bill_to_gl` to eliminate double-booking.
- **COGS & Landed Cost Integration**: Update `post_sales_invoice_to_gl` to incorporate `pcv.landed_cost` in the lookup hierarchy, persist `TransactionCostSnapshot`, and populate `InvoiceProfitabilityLedger`.
- **System Parameter Wiring**: Wire `SMRITI.COST.VALUATION_METHOD`, `SMRITI.COST.INCLUDE_LANDED_IN_COGS`, and `SMRITI.COST.VARIANCE_ALERT_PERCENT` into `SystemParameterService`.
- **API Endpoints**: Create `backend/app/api/v1/cost.py` exposing the 10 core Cost Truth reports, reconciliation endpoints, and dashboard metrics.
- **Frontend Cost Truth Workspace**: Create `src/components/finance/CostTruthDashboardTab.tsx` providing visual KPIs, report grids, drill-downs, and Inventory-to-GL reconciliation.
- **Test Suite**: Comprehensive automated test coverage in `backend/tests/test_cost_management_engine.py`.

## 4. Current State
- `product_cost_valuations` exists with 71 rows, but `weighted_average_cost` and `fifo_cost` are 100% unpopulated (0.00).
- `gl_entries` contains 0 records for Account `5010 (COGS)`.
- `transaction_cost_snapshots` and `invoice_profitability_ledgers` have 0 rows.
- Cost price is fragmented across 7 tables without central synchronization.
- Landed cost allocation exists for receipts via `LandedCostAllocationEngine`, but is detached from sales COGS and accounting ledgers.

## 5. Gap Analysis
1. **Valuation Engine Gap**: No service recalculates rolling WAC or FIFO layers when goods receipts are finalized.
2. **COGS Accounting Gap**: `UnifiedAccountingLedgerService` fails to include landed cost in its lookup hierarchy.
3. **Double-Booking Gap**: Receipts and bills both debit 1040 and credit 2010 directly, duplicating GL balances.
4. **Tax Compliance Gap**: Damaged goods are recorded on GRN without Section 17(5)(h) blocked ITC tracking.
5. **Observability Gap**: Finance teams have no unified Cost Truth dashboard to reconcile stock value with general ledger balance.

## 6. Architecture Impact
- Reuses existing PostgreSQL models without breaking schema changes: `ProductCostValuation`, `TransactionCostSnapshot`, `InvoiceProfitabilityLedger`, `InwardCostAllocation`, `StockMovement`.
- Maintains strict tenant isolation (`company_id` enforced on all operations).
- Guarantees backward compatibility: Selling prices and MRP are unmodified; bulk price revision remains strictly decoupled from cost price.

## 7. Proposed Design
1. **Lifecycle Hook in Purchase**: Upon finalizing a `PurchaseReceipt`, call `CostManagementEngine.process_inward_valuation(session, company_id, receipt_id)` to atomically update `ProductCostValuation` (WAC, Landed Cost, Replacement Cost) and `product_batch_stocks.purchase_rate`.
2. **Lifecycle Hook in Sales**: Upon finalizing a `SalesInvoice`, call `CostManagementEngine.process_sales_cogs_and_profitability(session, company_id, invoice_id)` to snapshot line-level COGS and generate `InvoiceProfitabilityLedger`.
3. **GR/IR Accounting Workflow**:
   - Receipt: DR 1040 (Inventory) / CR 1045 (Unbilled GRN) / CR 2040 (Freight Clearing).
   - Bill: DR 1045 (Unbilled GRN) / DR 1051-1053 (Input GST) / CR 2010 (Accounts Payable).
4. **Reconciliation Service**: Compares $\sum (\text{Product.stock} \times \text{pcv.weighted_average_cost})$ against the GL balance of Account `1040`.

## 8. Files Created
1. `docs/architecture/SMRITI_COST_MANAGEMENT_ENGINE_ARCHITECTURE.md`
2. `docs/implementation/foundation/Cost_Management_And_Cost_Truth_Engine_v1.0.md`
3. `backend/app/services/cost_engine.py`
4. `backend/app/api/v1/cost.py`
5. `src/components/finance/CostTruthDashboardTab.tsx`
6. `backend/tests/test_cost_management_engine.py`

## 9. Files Modified
1. `docs/implementation/README.md` (Master index table update per IPGP)
2. `backend/app/services/unified_ledger.py` (COA update, GR/IR posting, landed cost COGS fix)
3. `backend/app/services/purchase.py` (Hook into `CostManagementEngine` on receipt creation)
4. `backend/app/main.py` (Register `cost` router)
5. `src/components/shell/TabRenderer.tsx` (Register Cost Truth Dashboard in navigation)

## 10. Dependencies
- Python 3.11+, SQLAlchemy Async, Pydantic, FastAPI.
- React 18, Lucide React, existing SMRITI design tokens.

## 11. Risks
- **Risk**: Backdated stock movements altering historical WAC.
  - **Mitigation**: Standard retail convention calculates rolling WAC forward; historical transaction snapshots remain immutable.
- **Risk**: Concurrent goods receipts causing race conditions on WAC.
  - **Mitigation**: Database row-level locking (`SELECT ... FOR UPDATE`) on `product_cost_valuations` records.

## 12. Rollback Strategy
All changes are additive and backward-compatible. If necessary, system parameter `SMRITI.COST.VALUATION_METHOD` can be toggled to legacy mode, or the new API router decoupled without affecting existing billing or inventory workflows.

## 13. Verification Plan
- Unit tests for rolling WAC mathematical calculation under edge cases (initial stock, positive stock, zero stock, negative stock).
- Double-entry balance invariant tests (Debit == Credit) on GRN and Bill postings.
- Section 17(5)(h) ITC blocked credit calculations.
- COGS snapshot preservation during selling price changes.
- Multi-tenant boundary verification.

## 14. Test Plan
Execute `backend/tests/test_cost_management_engine.py` via pytest on an isolated test database. Verify:
- 100% green test execution.
- Literal terminal output captured.
- Database state assertions confirmed.

## 15. Documentation Impact
- Architecture specification in `docs/architecture/SMRITI_COST_MANAGEMENT_ENGINE_ARCHITECTURE.md`.
- Implementation plan in `docs/implementation/foundation/Cost_Management_And_Cost_Truth_Engine_v1.0.md`.
- Master index in `docs/implementation/README.md`.
- Walkthrough in `docs/walkthrough/foundation/Cost_Management_And_Cost_Truth_Engine_v1.0.md`.

## 16. Deployment Plan
Controlled deployment on branch `smritiNX`. Zero production downtime. Multi-tenant seed runs automatically on company database connection.

## 17. Status
Completed

## 18. Related ADRs
- `docs/architecture/COST.md`
- `docs/architecture/GRN_Damage_Qty_And_Indian_Landed_Cost_Addons_Architecture.md`

## 19. Related Walkthroughs
- `docs/walkthrough/foundation/Cost_Management_And_Cost_Truth_Engine_v1.0.md`
