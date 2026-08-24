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

# Sprint 10 — P2 Sales, CRM & Staff Management Parity Gap Registry
## Shoper9 MnuNo 100/410/612/613 → SMRITI Gap Analysis

**Date:** 2026-08-24  
**Source:** Live DB probe + model inspection  
**Total entries targeted:** 15 (P2 carry-overs from Sprint 9)

---

## Critical DB Findings

| Finding | Impact |
|---|---|
| `sales_invoice_lines` — **table does not exist** | Bill-wise items must parse `rule_snapshots` JSONB on `sales_invoices` |
| `SalesInvoice` has no `salesperson_id`/`discount_amount`/`net_amount` | Sprint 9 `getattr` fallbacks are correct — fields not in schema |
| `CommissionParticipant` table exists (`person_name`, `user_id`, `participant_role`) | Personnel catalogue backed by `commission_participants` |
| `commission_programs`, `commission_rules` exist | Incentive definition backed by `commission_rules` |
| `loyalty_members`, `loyalty_tiers`, `loyalty_rules` exist | Loyalty/walk-in register backed by `loyalty_members` |
| `pos_sessions` exists (not `pos_shifts`) | Till activity uses `pos_sessions` not `pos_shifts` |
| `customers` table exists | Walk-in register from `customers` with `source_type=WALKIN` |

---

## MnuNo 410 P2 Sales Reports (5 entries)

| MnuNo/Opt | Caption | EXE | SMRITI Impl | Gap Status |
|---|---|---|---|---|
| 410/415 | Bill-wise Items | SR202000 | `GET /sales-reports/bill-items` via `rule_snapshots` JSONB | ✅ IMPLEMENTED |
| 410/422 | Attribute+Size wise | SR236300 | `GET /sales-reports/size-wise` via `rule_snapshots` | ✅ IMPLEMENTED |
| 410/425 | Item-wise Sales Returns | SR214100 | `GET /sales-reports/item-returns` via returned SalesInvoice | ✅ IMPLEMENTED |

---

## MnuNo 612/613 CRM & Staff (7 entries)

| MnuNo/Opt | Caption | EXE | SMRITI Impl | Gap Status |
|---|---|---|---|---|
| 100/108 | Walk-in Entry/Register | SR120100 | `GET /crm-reports/walk-in` from `customers` | ✅ IMPLEMENTED |
| 613/6133 | Customer Mailer | SR430900 | `GET /crm-reports/mailer-list` from `customers` | ✅ IMPLEMENTED |
| 612/6121 | Personnel Catalogue | SR442900 | `GET /staff/personnel` from `commission_participants` | ✅ IMPLEMENTED |
| 612/6124 | Incentive Definition | SR443900 | `GET/POST /staff/incentives` from `commission_rules` | ✅ IMPLEMENTED |

---

## P3 Deferred (Physical Stock — missing table)

| Gap | Reason |
|---|---|
| Physical Stock Management (SR323400) | `physical_stock_counts` / `stock_takes` table does not exist |
| Physical vs Computed (SR211000) | Same — deferred to Sprint 11 (requires DB migration) |
| Attribute/Size-wise Balance (SR210300) | `product_attributes` table — deferred |
