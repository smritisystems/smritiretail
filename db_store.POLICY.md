<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.21.0
  Created      : 2026-07-16
  Modified     : 2026-07-16
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
-->

# db_store.json — Seed & Reference Data Policy

## Purpose

`db_store.json` is the **Express-level in-memory store** used exclusively for:

1. **Transient UI caching** — data loaded by the frontend that has no durable Postgres home yet
2. **Reference/seed data** — field mappings, transformation rules, lookup tables
3. **Migration fallback** — data bridging modules still on Express during Strangler-Fig transition

> [!IMPORTANT]
> Per **AGENTS.md — SMRITI Platform Abstraction Layer (PAL) Rule 3**:
> "Express-level in-memory stores are for transient UI caching/migration fallback only and must
> not be used as transactional systems of record."

---

## Classification of Current Keys

| Key | Type | Policy |
|---|---|---|
| `tallyExportQueue` | Reference/Queue | OK — integration queue, not a business record |
| `partnersList` | Reference | OK — integration partner config |
| `transformationMappings` | Reference | OK — field mapping rules for Data Exchange |
| `exchangeLogs` | Transient Cache | ⚠ Move to Postgres when Exchange module migrates |
| `ledgerEntries` | Transient Cache | ⚠ Move to Postgres when Inventory migrates |
| `auditLogs` | Transient Cache | ⚠ Move to Postgres when System module migrates |
| `profiles` | Reference | OK — UI session/view preferences |
| `bills` | Transient Cache | ⚠ Move to Postgres when POS migrates |
| `holdBills` | Transient Cache | ⚠ Move to Postgres when POS migrates |
| `quotations` | Transient Cache | ⚠ Move to Postgres when Sales migrates |
| `salesOrders` | Transient Cache | ⚠ Move to Postgres when Sales migrates |
| `salesInvoices` | Transient Cache | ⚠ Move to Postgres when Sales migrates |
| `salesReturns` | Transient Cache | ⚠ Move to Postgres when Sales migrates |
| `fields` | Reference | OK — attribute/field definitions |
| `formulas` | Reference | OK — pricing formula definitions |
| `psvParties` | Reference | OK — Party Stock Visibility config |
| `companyState` | Reference | OK — company setup state |
| `goodsReceipts` | Transient Cache | ⚠ Move to Postgres when Purchase migrates |
| `attributeDefinitions` | Reference | OK — attribute master catalog |
| `attributeGroups` | Reference | OK — attribute grouping |
| `variantTemplates` | Reference | OK — variant configuration |
| `categoryAttributeGroupMappings` | Reference | OK — category→attribute mapping |
| `roles` | Reference | OK — role permission definitions |

---

## What Must NEVER Live in db_store.json

The following data types are **permanently prohibited** in `db_store.json`:

| Data Type | Reason | System of Record |
|---|---|---|
| Stock ledger / inventory balances | Transactional | Postgres `stock_movements` |
| Barcode print history | Transactional | Postgres `print_history` |
| Barcode layouts / templates | Transactional | Postgres `barcode_layouts` |
| Sales invoices (finalized) | Transactional | Postgres `sales_invoices` |
| Purchase orders / GRNs (finalized) | Transactional | Postgres `purchase_orders` |
| User credentials / sessions | Security-critical | Postgres `users` + Redis |
| Shift / cash register data | Transactional | Postgres `shifts` |

---

## Migration Exit Criteria for db_store.json

A key may be **removed from db_store.json** when:

- ✅ The corresponding module's Strangler-Fig migration is complete
- ✅ FastAPI endpoint serves the data from Postgres
- ✅ Frontend calls `apiFetchV1` for that data
- ✅ Full regression suite passes without the key
- ✅ Walkthrough documents the removal

---

*Policy effective: 2026-07-16 | Governance: AGENTS.md PAL Rule 3*
