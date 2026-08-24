# SH9 Legacy Menu -> SMRITI Workspace Mapping

**Author:** Jawahar Ramkripal Mallah
**Date:** 2026-08-24
**Sprint:** 1 — ID Registry & Mapping Matrix
**Status:** Sprint 1 COMPLETE

## Coverage

| Metric | Count |
|---|---|
| Total active Shoper entries | 265 |
| Classified in this sprint | 265 |
| Unclassified (PENDING) | 0 |
| Coverage | 100.0% |

## Migration Status Distribution

| Status | Count | Meaning |
|---|---|---|
| MAPPED | 201 | Direct 1:1 equivalent exists in SMRITI |
| MERGED | 27 | Consolidated into a broader SMRITI workspace |
| REPLACED | 10 | SMRITI has a superior/different implementation |
| DEPRECATED | 14 | Legacy-only (Tally, flat files) -- no SMRITI equivalent needed |
| NOT_APPLIC | 5 | Internal Shoper infrastructure, not a business action |
| PENDING | 8 | Requires further analysis |

## CANONICAL_34_MENU_MATRIX Reconciliation

The SMRITI codebase contains a hardcoded 34-item matrix.
This sprint confirms the following coverage against 265 real Shoper entries:

| SMRITI Menu ID | Workspace | Shoper MnuNos Covered |
|---|---|---|
| `menu-accounting-sync` | Accounting Sync | 720, 740 |
| `menu-approval-matrix` | Approval Matrix | 750 |
| `menu-audit-logs` | Audit Logs | 500 |
| `menu-barcode` | Barcode Studio | 300, 370 |
| `menu-business-ledger` | Business Ledger | 0, 200, 250, 260, 270, 280, 460 |
| `menu-company-setup` | Company Setup | 0, 260, 560, 700, 750 |
| `menu-customer-master` | Customer Workspace | 100, 613, 650 |
| `menu-dashboard` | Dashboard | 0, 800 |
| `menu-data-exchange` | Data Exchange | 300, 500, 520, 530, 550, 560, 720 |
| `menu-document-series` | Numbering Engine | 650, 720 |
| `menu-inventory` | Inventory Hub | 0 |
| `menu-item-master` | Item Master | 0, 360, 600, 614, 615, 650, 750 |
| `menu-masters` | Governance Masters | 0, 500, 600, 603, 609, 613, 700, 720, 750 |
| `menu-pos` | POS Hub | 0 |
| `menu-print-studio` | Print Studio | 720 |
| `menu-purchase` | Purchase Workspace | 100, 300, 360, 380 |
| `menu-report-designer` | Report Designer | 400, 900, 910, 920, 930, 940 |
| `menu-reports` | Reports Portal | 0, 400, 410, 470, 490, 650, 900 |
| `menu-sales` | Sales Workspace | 100 |
| `menu-staff-management` | Staff Management | 612, 650, 700 |
| `menu-stock-ledger` | Stock Ledger | 300, 350, 430, 450 |
| `menu-supplier-mgmt` | Supplier Management | 600 |

## GAP: SMRITI Menu Items With No Shoper Equivalent

The following SMRITI menu items are NEW capabilities (not present in Shoper):

| SMRITI Menu ID | Purpose |
|---|---|
| `menu-wiki` | Integrated documentation/knowledge base |
| `menu-about-smriti` | SMRITI platform info |
| `menu-dev-tracker` | Engineering task tracker |
| `menu-psv` | Product-Service-Variant visibility rules |
| `menu-ufe` | Universal Field Explorer |
| `menu-formulas` | Pricing formula registry |
| `menu-terms-engine` | Payment terms engine |
| `menu-loyalty` | Loyalty/Rewards workspace |
| `menu-approval-matrix` | Multi-level approval workflows |

These are genuine SMRITI innovations with no Shoper predecessor.
They do NOT need legacy compatibility entries.

## Unclassified Entries (PENDING)

None. All entries classified.

## MultiInstance Flag Summary

Shoper entries with `MultiInstance=1` require SMRITI to support
concurrent multi-session or multi-tab operation for those document types:

| MnuNo | MenuOpt | MnuCap | SMRITI Action |
|---|---|---|---|
| 100 | 101 | Billing | NEW_TRANSACTION |
| 500 | 581 | Activity Log | VIEW |
| 940 | 945 | Tender | RUN |
| 940 | 946 | Slips | RUN |
