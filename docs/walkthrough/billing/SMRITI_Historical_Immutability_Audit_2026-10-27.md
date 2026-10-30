# SMRITI Historical Transaction Immutability & Price Revision Integrity
# Audit Report — 2026-10-27

## WHAT WAS INSPECTED (Literal commands run)

1. backend/app/models/sales.py      - SalesInvoice, SalesInvoiceItem columns
2. backend/app/models/purchase.py   - PurchaseOrderLine, PurchaseReceiptItem columns
3. backend/app/models/inventory.py  - StockMovement columns
4. backend/app/models/pricing.py    - ItemPriceRevision, PriceBook, CustomerPriceTier columns
5. backend/app/models/profitability.py - TransactionCostSnapshot, InvoiceProfitabilityLedger columns
6. backend/app/services/cost_engine.py - resolve_cogs_unit_cost(), get_cogs_profitability_report()
7. backend/app/services/unified_ledger.py - GL posting, TransactionCostSnapshot write
8. backend/app/services/price_revision_service.py - _activate_revision_internal(), item_prices sync
9. backend/app/api/v1/cost.py, analytics.py - report endpoints
10. Grep: JOIN item_prices in services/ - product_resolution_service.py (4 hits), canonical_sales_writer.py (1 hit)
11. Grep: sales_invoices JOIN item_prices - 0 hits (CLEAN)

## FINDINGS BY RULE

### Rule 1 & 3 — Historical invoice/purchase prices

FINDING (SalesInvoiceItem):
  price          = Column(Numeric(15, 2))  -- billed unit price STORED
  mrp            = Column(Numeric(15, 2))  -- MRP at billing time STORED
  disc_pct       = Column(Numeric(7, 4))   -- discount percentage STORED
  tax_amount     = Column(Numeric(15, 2))  -- tax STORED
  total_amount   = Column(Numeric(15, 2))  -- line total STORED
  igst/cgst/sgst = all STORED
  STATUS: COMPLIANT — billed values are frozen at posting time in the row.

FINDING (PurchaseOrderLine):
  cost_price = Column(Numeric(15, 2))  -- agreed cost per unit STORED
  gst_rate   = Column(Numeric(5, 2))   STORED
  line_total = Column(Numeric(15, 2))  STORED
  STATUS: COMPLIANT

FINDING (PurchaseReceiptItem):
  cost_price       = Column(Numeric(15, 2)) STORED
  quantity_received = STORED
  line_total        = STORED
  STATUS: COMPLIANT

FINDING (StockMovement):
  unit_cost = Column(Numeric(15, 2)) NULLABLE  <- GAP
  STATUS: PARTIALLY COMPLIANT — unit_cost is nullable. Items posted via
  stock movement may have NULL unit_cost if cost was not resolved at movement time.

### Rule 2 — Snapshot at transaction posting

FINDING (TransactionCostSnapshot — unified_ledger.py:658-675):
  Written at GL posting time. Contains:
  - cost_per_unit (from ProductCostValuation WAC/Landed/Purchase, NOT from current item_prices)
  - selling_price_per_unit (from sales_invoice_items.price — the billed price)
  - valuation_method_used
  STATUS: COMPLIANT for invoice GL posting path.
  GAP: InvoiceProfitabilityLedger does NOT store cost_per_unit or valuation_method_used —
  only aggregated total_cogs and gross_profit. Sufficient for immutability since
  TransactionCostSnapshot stores the detail.

FINDING (price_level_source):
  Stamped in rule_snapshots._resolved_price_level_effective (added in Sprint v1.1.0).
  STATUS: Done (this sprint).

### Rule 4 — Reports must not use current prices for historical queries

FINDING (cost_engine.py get_cogs_profitability_report — line 1217):
  Reads from InvoiceProfitabilityLedger.total_cogs which was written at posting time
  via TransactionCostSnapshot (WAC, not current item_prices).
  STATUS: COMPLIANT — reports read the snapshot ledger, not current item_prices.

FINDING (cost_engine.py get_stock_valuation_report — line 1151):
  This is a LIVE stock valuation report (current stock * current cost).
  This is CORRECT — stock valuation is always a point-in-time snapshot of
  current stock at current cost. Not a historical report.
  STATUS: COMPLIANT — design is intentional.

FINDING (analytics.py get_category_margins):
  Reads from AnalyticalIntelligenceService.get_category_profitability_rollups().
  Needs inspection of that service.
  STATUS: UNVERIFIED — requires further audit of AnalyticalIntelligenceService.

FINDING (api/v1/cost.py — live item_prices joins in report endpoints):
  Grep found 0 joins of sales_invoices to item_prices in report queries.
  STATUS: COMPLIANT

### Rule 5 — Price revisions must be auditable

FINDING (ItemPriceRevision — pricing.py:132):
  COLUMNS:
  - previous_mrp, revised_mrp
  - previous_selling_price, revised_selling_price
  - previous_cost_price, revised_cost_price
  - effective_from, effective_to
  - status (PENDING_APPROVAL, ACTIVE, SUPERSEDED, SCHEDULED)
  - reason_code, justification
  - approved_by, approved_at
  - source (MANUAL, etc.)
  - company_id, branch_id
  - created_by (via BaseEntity)
  STATUS: COMPLIANT — full audit trail exists.
  GAP: wholesale_price NOT tracked in ItemPriceRevision.
  previous_wholesale_price / revised_wholesale_price columns missing.
  When ip_obj.wholesale_price is updated (line 435), the revision record
  does not capture old_wholesale_price.

### Rule 5b — _activate_revision_internal sync side-effect

FINDING (price_revision_service.py:385-450):
  On activation, the service:
  A. Sets ItemPriceRevision.status = SUPERSEDED on old revisions (CORRECT)
  B. Updates ItemVariant.selling_price, mrp, cost_price in-place (MUTABLE LIVE CACHE)
  C. Updates PriceBookEntry.selling_price, mrp in-place (MUTABLE LIVE CACHE)
  D. Updates ItemPrice.selling_price, mrp, cost_price, wholesale_price in-place

  Steps B, C, D mutate live price tables — this is CORRECT because posted
  invoices use the snapshot values stored in SalesInvoiceItem.price, not
  the live item_prices. The risk is only if a report reads item_prices
  and joins it to historical invoice lines — which grep confirmed does NOT happen.
  STATUS: COMPLIANT for immutability (live table updates do not retroactively
  alter posted invoice rows). PARTIAL GAP: wholesale_price not revision-tracked.

### Rule 6 — Correction workflows

FINDING: CreditNote / SalesReturn path exists via SalesReturnService.
FINDING: GL cancellation path exists via post_sales_cancellation_to_gl().
STATUS: COMPLIANT — no silent overwrite of posted invoices found.

### Rule 7 — Already done (this is the audit).

### Rule 8 — Regression tests

GAP: No test exists proving that:
  (a) Creating an ItemPriceRevision does NOT alter SalesInvoiceItem.price of historical invoices.
  (b) COGS report after price revision still returns old COGS values.
STATUS: MISSING — test needs to be written.

### Rule 9 — Preserve data, audit first.
STATUS: This document IS the audit. No production data changes made.

## SUMMARY OF GAPS

| # | Gap | Severity | Rule |
|---|-----|----------|------|
| G1 | ItemPriceRevision missing previous_wholesale_price / revised_wholesale_price | Medium | 5 |
| G2 | StockMovement.unit_cost is nullable — zero-cost movements have no cost basis | Medium | 2 |
| G3 | AnalyticalIntelligenceService.get_category_profitability_rollups() not yet audited | Low | 4 |
| G4 | No regression test proving price revision immutability for historical invoices | High | 8 |
| G5 | InvoiceProfitabilityLedger has no valuation_method_used column (detail is in TransactionCostSnapshot) | Low | 2 |

## WHAT IS ALREADY CORRECT

- Posted sales invoice prices frozen in SalesInvoiceItem.price at write time
- Posted purchase prices frozen in PurchaseOrderLine.cost_price and PurchaseReceiptItem.cost_price
- TransactionCostSnapshot written per invoice line at GL posting (WAC-based, not current item_prices)
- COGS profitability report reads InvoiceProfitabilityLedger (snapshot), not current item_prices
- 0 report queries join sales_invoices/purchase directly to item_prices
- ItemPriceRevision tracks old/new MRP, selling_price, cost_price with actor + effective range
- Price revision activation does NOT touch SalesInvoiceItem or PurchaseOrderLine
