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

# Sprint 8 — Workspace Functional Parity Matrix
## Shoper9 → SMRITI Workspace-Level Gap Analysis

**Date:** 2026-08-24  
**Source:** Live `smriti_legacy_menu_map` (265 rows, Postgres verified)  
**Scope:** 22 SMRITI workspaces carrying Shoper9 lineage  

> **Definition of Parity:** Every MAPPED/MERGED Shoper9 capability has a
> corresponding SMRITI screen, action, or report. DEPRECATED and NOT_APPLIC
> entries are explicitly excluded from parity scope.

---

## Priority Order (by MAPPED+MERGED count, descending)

| # | SMRITI Workspace | Module | Total | M+M | Pending | Multi | Route Key | SMRITI Component | Parity Status |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Reports Portal | REPORTS | 48 | 46 | 1 | 0 | `report-designer` | `ReportDesignerTab` | Partially Verified |
| 2 | Business Ledger | FINANCE | 32 | 29 | 3 | 0 | `business-ledger` | `BusinessLedgerTab` | Partially Verified |
| 3 | Governance Masters | CONFIG | 31 | 25 | 0 | 0 | `masters` | `MasterManagementTab` | Partially Verified |
| 4 | Stock Ledger | INVENTORY | 25 | 25 | 0 | 0 | `stock-ledger` | `StockLedgerTab` | Partially Verified |
| 5 | Data Exchange | CONFIG | 25 | 21 | 4 | 0 | `data-exchange` | `DataExchangeTab` | Partially Verified |
| 6 | Report Designer | REPORTS | 20 | 20 | 0 | 2 | `report-designer` | `ReportDesignerTab` | Partially Verified |
| 7 | Purchase Workspace | PURCHASE | 16 | 16 | 0 | 0 | `purchase` | `PurchaseStudioTab` | Partially Verified |
| 8 | Item Master | INVENTORY | 15 | 15 | 0 | 0 | `item-master` | `ItemMasterTab` | Partially Verified |
| 9 | Sales Workspace | SALES | 8 | 7 | 0 | 1 | `sales` | `SalesStudioTab` | Partially Verified |
| 10 | Company Setup | ADMIN | 7 | 5 | 0 | 0 | `company-setup` | `CompanyControlCent` | Partially Verified |
| 11 | Barcode Studio | INVENTORY | 5 | 5 | 0 | 0 | `barcode` | `BarcodeStudioTab` | Partially Verified |
| 12 | Customer Workspace | CRM | 5 | 5 | 0 | 0 | `customer-master` | `CustomerMasterTab` | Partially Verified |
| 13 | Staff Management | ADMIN | 4 | 4 | 0 | 0 | `staff-management` | `StaffManagementTab` | Partially Verified |
| 14 | Numbering Engine | CONFIG | 3 | 3 | 0 | 0 | `document-series` | `DocumentSeriesTab` | Partially Verified |
| 15 | Print Studio | CONFIG | 2 | 2 | 0 | 0 | `print-studio` | `PrintStudioTab` | Partially Verified |
| 16 | Approval Matrix | ADMIN | 1 | 1 | 0 | 0 | `approval-matrix` | `ApprovalMatrixTab` | Partially Verified |
| 17 | Audit Logs | ADMIN | 1 | 1 | 0 | 1 | `audit-logs` | `AuditLogsTab` | Partially Verified |
| 18 | Inventory Hub | INVENTORY | 1 | 1 | 0 | 0 | `pos` | `PosTerminalTab` | Partially Verified |
| 19 | POS Hub | SALES | 1 | 1 | 0 | 0 | `pos` | `PosTerminalTab` | Partially Verified |
| 20 | Supplier Management | PURCHASE | 1 | 1 | 0 | 0 | `supplier-mgmt` | `SupplierDashboardTab` | Partially Verified |
| — | Accounting Sync | FINANCE | 9 | 0 | 0 | 0 | `accounting-sync` | `AccountingSyncTab` | N/A (all DEPRECATED) |
| — | Dashboard | SYSTEM | 5 | 0 | 0 | 0 | `pos` | (home) | N/A (all NOT_APPLIC) |

**M+M = MAPPED + MERGED entries (parity scope)**  
**Multi = entries requiring multi-tab/multi-instance session**

---

## Tier 1 — Reports Portal (48 entries, 46 in scope)

SMRITI workspace: `report-designer` → `ReportDesignerTab`

### Shoper9 Report Groups → SMRITI Equivalents

| Shoper9 Group | Key Reports | SMRITI Equivalent | Gap |
|---|---|---|---|
| Sales Reports (MnuNo 410) | Daily Sales Book, Bill-wise, Item-wise, Tax Register | Report Designer — Sales Analytics | Verify axis/filter parity |
| Cash Reports (MnuNo 460) | Cash Transaction, Till Status, Reconciliation | Business Ledger / Till | Already in Business Ledger |
| MIS Reports (MnuNo 470) | Monthly Comparison, Gross Margin, Promotions, Walk-in | Report Designer — MIS | Gross Margin + Promotions verify |
| Customer Offtake (490) | Period-wise, Bill-wise, Product-wise | CRM Studio / Reports | Needs CRM cross-link |
| Stock Registers (430, 450) | Style Catalogue, Price Listing, Schedule Details | Stock Ledger / Report Designer | Price Listing confirm |
| MnuNo 900 Summary | Sales, Stock, Customer — multi-branch | Reports Portal top level | Multi-branch scope |

### Actions Required
- [ ] Verify Report Designer has: `Daily Sales Book`, `Bill-wise Sales`, `Item-wise Sales`, `Tax Register`
- [ ] Confirm `Gross Margin` report exists in Report Designer (SR229700.exe)
- [ ] Confirm `Cancelled Bills` and `Returned Bills` reports exist
- [ ] Map `Customer Offtake` (SR208400/500/600) → CRM Studio or Reports
- [ ] `Style Catalogue` (SR430800) → Item Master or Report Designer
- [ ] `Multi-branch Node-wise Details` (SR221600, MnuNo 427) → scope check

---

## Tier 2 — Business Ledger (32 entries, 29 in scope)

SMRITI workspace: `business-ledger` → `BusinessLedgerTab`

### Shoper9 Capability Groups → SMRITI Equivalents

| Shoper9 Group | Key Functions | SMRITI Equivalent | Gap |
|---|---|---|---|
| Cash (MnuNo 200) | Cash Payouts, Cash Receipts | Business Ledger — Cash section | Verify both directions |
| Credit Card Mgmt (250) | Submission, Realisation | Business Ledger — Card section | Submission/realisation workflow |
| Till Management (270) | Status, Balance, Cash Lift, Reconciliation, Drawer | POS Terminal — Till | Till reconciliation confirm |
| Credit Sale Mgmt (280) | Collect Payment, Opening Balance, Clear Credit Note | Sales Studio — Credit | Credit note clearing |
| Cash Reports (460) | 12 reports: Transactions, Summaries, Reconciliation | Business Ledger Reports | MnuNo 460 report coverage |
| Franchisee A/C (260) | Franchisee accounting | Not directly mapped | Pending/design decision |

### Actions Required
- [ ] Verify `BusinessLedgerTab` has Cash Payouts (debit) and Cash Receipts (credit) entries
- [ ] Verify Credit Card Submission/Realisation workflow is accessible
- [ ] Confirm Till Management (Status, Cash Lift, Reconciliation) maps to POS or Ledger
- [ ] Verify 12 Cash Report equivalents in SMRITI (MnuNo 460)
- [ ] Franchisee A/C (MnuNo 260) — flag for multi-company design

---

## Tier 3 — Governance Masters (31 entries, 25 in scope)

SMRITI workspace: `masters` → `MasterManagementTab`

### Shoper9 Capability Groups → SMRITI Equivalents

| Shoper9 Group | Key Functions | SMRITI Equivalent | Gap |
|---|---|---|---|
| Housekeeping (500) | Open Day, Close Day, Backup, Restore, Compact, Purge | Company Setup / DB Manager | Day open/close critical path |
| Schedule for Reports (580) | Scheduled report generation | Report Designer — Scheduler | Scheduler confirm |
| Promotions (608) | Define Sales Promotions | Loyalty Studio / Terms Engine | Promotions design |
| Payment Mode (610) | Payment mode master | Masters — Payment Modes | Verify present |
| HO Chain Stores (611) | Head-office chain store config | Config — not built | Multi-company scope |
| Sales/Stock Factors (609) | Pricing/stock multipliers | Item Master / Terms Engine | Factor design |
| Customer Price Groups (613) | Price group master | Item Master / CRM | Price group confirm |
| General Config (720) | System Parameters, Stock Methodology | Company Setup | Param parity |
| Year-end & Archival (750) | Year End, Re-open Day, Archival, Tax Re-computation | DB Manager / System | Year-end workflow |

### Actions Required
- [ ] `Open Day` / `Close Day` (SR322600/SR309900) → map to shift management
- [ ] `Year End Process` (SR428100) → SMRITI equivalent?
- [ ] `Define Sales Promotions` (SR430300) → Loyalty Studio?
- [ ] `Database Archival` (SR329700) → DB Manager
- [ ] `HO Chain Stores` — multi-company, defer to PENDING design

---

## Workspaces with Full SMRITI Coverage (No Gaps Found)

| Workspace | Reason |
|---|---|
| Barcode Studio | 5/5 MAPPED — BarcodeStudioTab feature-complete |
| Numbering Engine | 3/3 MAPPED — DocumentSeriesTab covers serial numbering |
| Print Studio | 2/2 MAPPED — PrintStudioTab covers template design |
| Approval Matrix | 1/1 MAPPED — ApprovalMatrixTab covers signing authority |
| Staff Management | 4/4 MAPPED — StaffManagementTab covers HR directory |

---

## Multi-Instance Entries Requiring Special Handling

| Workspace | MnuNo/Opt | Caption | SMRITI Workspace | Action Needed |
|---|---|---|---|---|
| Report Designer | 470/482 | Sales Promotions Report | Report Designer | Multi-tab report session |
| Report Designer | 650/656 | Schedule Details | Report Designer | Background scheduler tab |
| Sales Workspace | 280/281 | Collect Payment | Sales Studio | Concurrent payment collection |
| Audit Logs | 460/463 | Pending Submissions | Business Ledger | Concurrent pending review |

---

## PENDING Entries (8 total — require architecture decision)

| MnuNo/Opt | Caption | Reason Pending |
|---|---|---|
| TBD | AST Replication | Multi-company replication not designed |
| TBD | Secondary DB Import | Secondary DB architecture not decided |
| TBD | Stock across Chain | Multi-branch stock not implemented |
| TBD | HO Chain Config | Head-office chain multi-company |
| 460/461+others | Business Ledger reports | Partial — 3 entries pending |
| Data Exchange | 4 entries | Replaced/pending ETL design |
| Reports Portal | 1 entry | Deprecated variant |
| Business Ledger | Franchisee A/C | Multi-company pending |

---

## Sprint 8 Definition of Done

For this sprint, parity is verified when:

1. Each Tier 1/2/3 workspace **action item** above is answered with either:
   - `VERIFIED` — SMRITI equivalent confirmed in code
   - `GAP FOUND` — capability missing, tracked as backlog item
   - `DEFERRED` — by design (multi-company, deprecated, PENDING)

2. The `smriti_legacy_menu_map.migration_status` for each entry is updated
   from `MAPPED` → `MERGED` (when SMRITI implementation is confirmed complete)
   or left as `MAPPED` (when a gap exists and is tracked).

3. A gap registry is produced listing every `GAP FOUND` item with:
   - Shoper9 `MnuNo/MenuOpt`
   - SMRITI workspace
   - Description of missing capability
   - Priority (P1/P2/P3)

---

## Next Steps

| Step | Action |
|---|---|
| 8a | Inspect `ReportDesignerTab` — verify 46 Shoper report equivalents |
| 8b | Inspect `BusinessLedgerTab` — verify Cash + Till + Credit parity |
| 8c | Inspect `MasterManagementTab` — verify Housekeeping + Config parity |
| 8d | Produce Gap Registry (`SH9_PARITY_GAPS.md`) |
| 8e | Update `migration_status` for confirmed MERGED entries via seed re-run |
