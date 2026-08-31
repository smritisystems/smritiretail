<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 1.0.0
  Created      : 2026-08-24
  Modified     : 2026-08-24
  Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Sprint 11 — Loyalty, Returns & Stock Adjustments Parity Gap Registry
## Shoper9 MnuNo 200/410/430/650 → SMRITI Gap Analysis

**Date:** 2026-08-24  
**Source:** Live DB probe (confirmed table columns)  
**Total entries targeted:** 12 P2/P3 gaps from Sprint 10 backlog

---

## DB Confirmation

| Table | Status | Key Columns |
|---|---|---|
| `sales_returns` | ✅ EXISTS | `return_no`, `original_invoice_id`, `grand_total`, `reason`, `date`, `status` |
| `loyalty_members` | ✅ EXISTS | `current_points_balance`, `total_lifetime_spend`, `card_number`, `loyalty_tier_id` |
| `loyalty_tiers` | ✅ EXISTS | `name`, `min_spend`, `earn_multiplier`, `redemption_ratio` |
| `stock_adjustments` | ✅ EXISTS | `adjustment_no`, `adjustment_date`, `total_adjustment_qty`, `total_adjustment_value`, `status` |
| `loyalty_transactions` / `loyalty_ledger` | ❌ NOT EXIST | Deferred |
| `product_attributes` | ❌ NOT EXIST | Deferred to Sprint 12 |
| `stock_takes` | ❌ NOT EXIST | Deferred to Sprint 12 (needs migration) |

---

## Entries Implemented

| MnuNo/Opt | Caption | EXE | Endpoint | Status |
|---|---|---|---|---|
| 410/421 | Returned Bills (item-wise) | SR210200 | `GET /inventory-reports/returns` | ✅ IMPLEMENTED |
| 430/444 | Void/Returned Transactions | SR239800 | `GET /inventory-reports/returns` (with reason) | ✅ IMPLEMENTED |
| 430/436 | Stock Discrepancy / Adjustments | SR211600 | `GET /inventory-reports/adjustments` | ✅ IMPLEMENTED |
| 650/658 | Customer Loyalty Report | — | `GET /crm-reports/loyalty` | ✅ IMPLEMENTED |
| — | Loyalty Tier Summary | — | `GET /crm-reports/loyalty-tiers` | ✅ IMPLEMENTED |

---

## Deferred to Sprint 12

| Gap | Reason |
|---|---|
| Physical Stock Take (SR323400) | `stock_takes` table — requires Alembic migration |
| Physical vs Computed (SR211000) | Same |
| Attribute/Size-wise Balance (SR210300) | `product_attributes` table not in DB |
| Size-wise Sales (SR236300) | `sales_invoice_lines` table not in DB |
| Loyalty Transactions Ledger | `loyalty_transactions` table not in DB |
