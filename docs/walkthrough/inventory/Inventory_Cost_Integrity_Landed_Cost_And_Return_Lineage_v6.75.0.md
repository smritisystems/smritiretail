<!--
  Project      : SMRITI Retail OS
  Repository   : SMRITIRetailNX
  Organization : AITDL NETWORKS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.75.0
  Created      : 2026-10-14
  Modified     : 2026-10-14
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Walkthrough / Inventory / Cost Integrity, Landed Cost & Return Lineage
-->

# Walkthrough: SMRITI Retail OS — Inventory Cost Integrity, Landed Cost Vouchers & Historical Return Lineage v6.75.0

## 1. Purpose
Consolidate, certify, and remediate the Batch 2.4 engineering release of SMRITI Retail OS. Establish end-to-end data integrity across inventory costing, receipt allocation, and sales-return lineage without introducing secondary accounting subsystems. Guarantee that:
1. **Sales Return Lineage & Commercial Defense**: Sales returns unambiguously reference original invoice lines via persisted `sales_invoice_item_id`. Cross-product mismatches, line quantity over-returns, and ambiguous multi-line returns with conflicting commercial terms (unit price, GST rate, historical cost) are strictly rejected with HTTP 422.
2. **Perpetual Cost Accounting & Inward Valuation**: Inward receipts (GRN) automatically update rolling Weighted Average Cost (WAC) under Ind AS 2, apportion landed cost components, and log explicit audit warnings whenever FIFO fallback is invoked.
3. **Landed Cost Vouchers & Ledger Balance**: Landed cost adjustment vouchers posted to the General Ledger enforce exact mathematical balance ($\sum \text{Debits} = \sum \text{Credits}$) and idempotent duplicate-posting protection, preserving dock-stage unbilled GRN clearing entries (Account 1045).
4. **Provisional Cost Quarantine**: Invoices and returns with provisional or estimated costs are quarantined from finalized gross profit and contribution KPI reporting.
5. **Schema & Migration Convergence**: Alembic migration `v1532` converges safely across both fresh databases and pre-existing production schemas without destructive drops or silent rollbacks on non-empty tables.

---

## 2. Scope
- **Database Schema & Models**:
  - Registered cost management models (`ProductCostValuation`, `TransactionCostSnapshot`, `InvoiceProfitabilityLedger`, `InwardCostComponent`) in `backend/alembic/env.py`.
  - Added `sales_return_items.sales_invoice_item_id` (Integer, ForeignKey to `sales_invoice_items.id`, indexed) in `backend/app/models/sales.py`.
  - Authoritative Alembic migration `backend/alembic/versions/v1532_cost_management_engine_foundations.py` supporting idempotent column/table addition and safe rollback abortion on non-empty tables.
- **Sales Return API & Business Service**:
  - Schema extension in `backend/app/schemas/sales.py` with alias normalization (`invoice_item_id`, `original_invoice_item_id`).
  - Strict validation, cross-product checking, line-level and SKU-level cumulative return limit enforcement, and multi-line ambiguity defense in `backend/app/services/sales.py`.
- **Cost Engine & Inward Valuation**:
  - Perpetual Ind AS 2 rolling WAC calculation, landed cost component apportionment, and explicit FIFO fallback logging in `backend/app/services/cost_engine.py`.
  - Quarantine of provisional return valuations from finalized gross profit metrics in `backend/app/services/cost_engine.py`.
  - Inward valuation delegation from `backend/app/services/purchase.py`.
  - Elimination of selling price fallbacks during stock movement valuation in `backend/app/services/sales_stock_authority.py`.
- **Unified Ledger & Tally Integration**:
  - Landed cost adjustment voucher posting with debit/credit balance verification and idempotency check in `backend/app/services/unified_ledger.py`.
  - Legacy `TallyService` alias resolution in `backend/app/services/tally_service.py`.
- **Automated Regression Test Suite**:
  - 34 passing tests across migration v1532 lifecycle, Batch 2.4 valuation suite, and Batch 1 commercial ledger suite.

---

## 3. Files Created
1. `backend/alembic/versions/v1532_cost_management_engine_foundations.py` — Authoritative Alembic migration for cost management foundation tables and `sales_return_items.sales_invoice_item_id`.
2. `backend/app/tests/test_cost_accounting_batch1.py` — Dedicated commercial ledger, GR/IR clearing account, and voucher test suite (6 tests).
3. `backend/app/tests/test_cost_valuation_batch2.py` — Comprehensive Batch 2.4 valuation, sales return ambiguity, and landed cost suite (27 tests).
4. `backend/app/tests/test_migration_v1532_lifecycle.py` — Migration v1532 upgrade, partial-schema convergence, and downgrade safety test suite (1 test).
5. `docs/walkthrough/inventory/Inventory_Cost_Integrity_Landed_Cost_And_Return_Lineage_v6.75.0.md` — This formal walkthrough document.

---

## 4. Files Modified
1. `backend/alembic/env.py` — Registered `ProductCostValuation`, `TransactionCostSnapshot`, `InvoiceProfitabilityLedger`, and `InwardCostComponent` in metadata.
2. `backend/app/models/sales.py` — Added `sales_invoice_item_id` column to `SalesReturnItem`.
3. `backend/app/schemas/sales.py` — Added `sales_invoice_item_id` and aliases to `SalesReturnItemCreate`.
4. `backend/app/services/cost_engine.py` — Implemented rolling WAC, landed cost apportionment, FIFO fallback warning logs, and provisional cost quarantine.
5. `backend/app/services/purchase.py` — Delegated inward receipt valuation to `CostManagementEngine.process_inward_valuation`.
6. `backend/app/services/sales.py` — Added exact-line validation, multi-line ambiguity defense (422), and line/SKU return quantity caps.
7. `backend/app/services/sales_stock_authority.py` — Fixed stock movement valuation to eliminate selling price fallbacks.
8. `backend/app/services/tally_service.py` — Added `TallyService = TallyPrimeService` module alias.
9. `backend/app/services/unified_ledger.py` — Implemented `post_landed_cost_adjustment_voucher` with balance check, idempotency guard, and dock-stage clearing preservation.
10. `docs/walkthrough/README.md` — Appended walkthrough entry to master index.
11. `CHANGELOG.md` — Documented release v6.75.0 changes and architectural enhancements.
12. `RELEASE_NOTES.md` — Added release notes for v6.75.0.

---

## 5. Architecture Decisions
1. **Sales Return Lineage Defense (HTTP 422 Ambiguity Rejection)**:
   - When a sales return specifies `sales_invoice_item_id`, the engine strictly validates that the line belongs to the specified original invoice AND matches the returned `product_id`. Any mismatch raises an HTTP 422 error.
   - When a product appears on multiple original invoice lines with differing prices, tax rates, or historical costs, and the return request omits `sales_invoice_item_id`, the system rejects the return with HTTP 422 rather than guessing or silently picking an arbitrary line.
   - Line-level return quantities are bounded: $\sum \text{Return Qty} \le \text{Original Invoice Line Qty}$. Cumulative returns across lines for the same product cannot exceed the total invoiced quantity.
2. **Perpetual Rolling WAC with Explicit FIFO Fallback Logging**:
   - In accordance with Ind AS 2, inventory valuation defaults to rolling Weighted Average Cost (WAC).
   - If stock falls to zero or negative (oversold recovery), or if WAC pools require sequential resolution, FIFO fallback queueing is supported but MUST emit an explicit warning log (`Rolling WAC for product %s falling back to FIFO queue`).
3. **Landed Cost Voucher Balance & Idempotency**:
   - Landed cost adjustment vouchers posted to the General Ledger require strict mathematical equality: $\sum \text{Debits} == \sum \text{Credits}$. Unequal postings raise a `ValueError`.
   - Repeated calls with the same reference ID return the existing voucher without duplicate debit/credit generation.
   - The dock-stage clearing entry (Account 1045: Unbilled GRN / GR-IR Clearing) is preserved across all purchase workflows.
4. **Provisional Cost Quarantine**:
   - Profitability calculation (`get_cost_truth_dashboard_kpis` and ledger profitability) quarantines any transaction or return flagged as `is_provisional=True`. Provisional costs are excluded from finalized gross profit metrics until authoritative invoice reconciliation occurs.
5. **Non-Destructive Migration Convergence**:
   - Migration `v1532` uses PostgreSQL catalog inspection (`to_regclass`, `column_name` existence) before executing `CREATE TABLE`, `ADD COLUMN`, or `CREATE INDEX`.
   - Downgrade prevents catastrophic data loss: if tables contain live records, downgrade aborts with an informative exception instructing the administrator to archive data before dropping.

---

## 6. Design Rationale
- **Financial Integrity Over Heuristics**: Silently picking the cheapest or newest invoice line for a return introduces tax and margin distortion. Requiring explicit line linkage whenever ambiguity exists ensures zero financial drift.
- **TallyPrime Accounting Boundary**: SMRITI Retail OS acts strictly as an operational inventory management system. General ledger vouchers generated locally (including landed cost adjustments) are formatted for zero-friction synchronization to TallyPrime without introducing a secondary accounting ledger.
- **Safe Database Evolution**: In multi-tenant retail environments, tenant databases may have diverged slightly due to historical upgrades. Idempotent schema convergence prevents migration failures during rollout.

---

## 7. Implementation Summary
- **Schema & Migration**:
  - `v1532_cost_management_engine_foundations.py` created and tested.
  - Added `sales_return_items.sales_invoice_item_id` with foreign key constraint and B-tree index.
- **Sales Return Processing**:
  - In `backend/app/services/sales.py`, added `_validate_return_line_linkage`:
    - Checks `sales_invoice_item_id` foreign key association.
    - Compares line `product_id` against return `product_id`.
    - Detects multiple lines for the same SKU with divergent unit prices, tax rates, or historical costs.
    - Aggregates existing approved returns from the database to enforce line-level and product-level cumulative caps.
- **Cost Engine**:
  - In `backend/app/services/cost_engine.py`:
    - Implemented `process_inward_valuation` linking landed cost components directly to GRN lines.
    - Added logging when FIFO queue fallback is triggered.
    - Updated `get_cost_truth_dashboard_kpis` to filter out records where `is_provisional == True`.
- **General Ledger**:
  - In `backend/app/services/unified_ledger.py`:
    - Implemented `post_landed_cost_adjustment_voucher` enforcing balanced vouchers and idempotency.

---

## 8. Tests Executed
The test suite was executed against the isolated test environment on port 2781:
```bash
.venv\Scripts\python.exe -m pytest backend/app/tests/test_migration_v1532_lifecycle.py backend/app/tests/test_cost_valuation_batch2.py backend/app/tests/test_cost_accounting_batch1.py -v
```

Executed test cases:
1. `backend/app/tests/test_migration_v1532_lifecycle.py::test_v1532_migration_upgrade_and_partial_schema_idempotency` (PASSED)
2. `backend/app/tests/test_cost_valuation_batch2.py` (27 tests):
   - `test_return_line_validation_exact_match` (PASSED)
   - `test_return_line_validation_cross_product_mismatch_rejected` (PASSED)
   - `test_return_line_ambiguity_multi_line_different_prices_rejected` (PASSED)
   - `test_return_line_unambiguous_single_line_auto_resolved` (PASSED)
   - `test_return_quantity_exceeds_line_limit_rejected` (PASSED)
   - `test_return_cumulative_quantity_across_batches_enforced` (PASSED)
   - `test_landed_cost_voucher_balanced_posting` (PASSED)
   - `test_landed_cost_voucher_unbalanced_rejected` (PASSED)
   - `test_landed_cost_voucher_idempotent_duplicate_protection` (PASSED)
   - `test_rolling_wac_valuation_standard_receipt` (PASSED)
   - `test_rolling_wac_fifo_fallback_emits_warning_log` (PASSED)
   - `test_provisional_cost_quarantined_from_finalized_kpi` (PASSED)
   - *(plus 15 additional boundary and integration test cases)* (ALL PASSED)
3. `backend/app/tests/test_cost_accounting_batch1.py` (6 tests):
   - `test_grn_dock_clearing_account_1045_posted` (PASSED)
   - `test_purchase_bill_gr_ir_clearing_reconciliation` (PASSED)
   - `test_section_17_5_h_blocked_itc_voucher` (PASSED)
   - `test_landed_cost_freight_clearing_account_2040` (PASSED)
   - `test_invoice_profitability_waterfall_generation` (PASSED)
   - `test_tally_service_alias_export` (PASSED)

---

## 9. Verification Results
- **Test Battery Output**:
  - Total tests executed: 34
  - Total passed: 34 (100% green, 0 failures, 0 errors, 0 skipped)
  - Execution time: ~4.5 seconds
- **Code Linting / Static Checks**:
  - `git diff --check`: 0 whitespace errors.
  - Python compile check: clean.
- **Git Commit Citation**:
  - Commit Hash: `0ae30a371e839faf46a203087f0799fc3254ebd9`
  - Branch: `smritiNX`

---

## 10. Known Limitations
- Returns against legacy pre-v6.75.0 sales invoices that lack historical line cost snapshots default to standard product master cost with an explicit provisional audit flag.
- Landed cost vouchers currently support single-currency INR ledger accounts; multi-currency forex variance postings remain scheduled for Phase 3.

---

## 11. Future Work
- Automated supplier rebate and volume discount recalculation against historical inward receipts.
- Direct TallyPrime XML push queue integration for landed cost adjustment vouchers.
- Advanced automated barcode-scan return matching using receipt sequence tags.

---

## 12. Related ADRs
- `ADR-048`: Universal Financial System of Record & Double-Entry General Ledger Convergence.
- `ADR-049`: Cost Management Engine, Perpetual Rolling WAC, and GR/IR Clearing Account.
- `ADR-050`: Authoritative Sales Return Lineage & Historical Cost Immutability.

---

## 13. Related RFCs
- `RFC-2026-08`: Real-Time Perpetual Inventory Valuation and Landed Cost Allocation.
- `RFC-2026-10`: Sales Return Lineage Disambiguation and Anti-Arbitrage Controls.
