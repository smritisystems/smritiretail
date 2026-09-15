# Shoper 9 Developer Reference and SMRITI Comparison

**Scope:** Read-only analysis of the extracted Shoper 9 Distributor and POS help bundles against the current SMRITI Retail OS codebase.

**Source folders:**

- [`shoper9/`](../shoper9/) - Shoper 9 Distributor reference. The Distributor identity is confirmed by `ShoperDistributor.hhc`, `ShoperDistributor.hhk`, and `ShoperDistributor.brs`.
- [`shoper9pos/`](../shoper9pos/) - Shoper 9 POS reference. The POS identity is confirmed by the corresponding Shoper POS project files and POS-specific topics.

There is no `shoper9m` folder. This document treats `shoper9` as the requested Distributor folder.

## 1. Executive Summary

Shoper 9 is documented as two closely related products with a large shared operational vocabulary:

- Distributor: order, dispatch, approval issue, transport, chain-store, and distribution reporting.
- POS: billing, till, cash control, payment settlement, returns, exchange, service orders, and cashier reporting.

SMRITI already has a more modern domain architecture than the legacy documentation suggests. It has separate APIs and models for POS, sales, purchase, WMS, distribution, pricing, promotions, barcode, accounting, synchronization, and governance.

The correct use of Shoper documentation is therefore:

1. Use it as a workflow and business-invariant reference.
2. Map each capability to the existing SMRITI domain model.
3. Add missing state transitions, controls, reports, and audit requirements.
4. Do not copy the legacy database shape or the mixed `GenLookUp` design.

## 2. Extracted Bundle Inventory

| Bundle | Files | HTML topics | Images/assets | Approx. size |
|---|---:|---:|---:|---:|
| `shoper9` | 1,040 | 415 | 617 | 10.4 MB |
| `shoper9pos` | 1,314 | 535 | 771 | 13.3 MB |

Both bundles contain these top-level areas:

```text
Cash
catalogue
Common
Help
housekeep
Licensing
Reports
Sales
Setup
Stock
Tools
What's_New
```

Primary navigation files:

- [`shoper9/ShoperDistributor.hhc`](../shoper9/ShoperDistributor.hhc)
- [`shoper9/ShoperDistributor.hhk`](../shoper9/ShoperDistributor.hhk)
- [`shoper9pos/ShoperPOS.hhc`](../shoper9pos/ShoperPOS.hhc)
- [`shoper9pos/ShoperPOS.hhk`](../shoper9pos/ShoperPOS.hhk)

The bundles are RoboHelp HTML help systems. Their topics commonly contain navigation paths, prerequisites, actions, keyboard shortcuts, screenshots, and operational warnings.

## 3. Shared Capability Map

### 3.1 Catalogue and master data

Both products document:

- General Lookup
- Vendor catalogue
- Customer catalogue
- Customer price groups
- Item master
- Item classification
- Size and style management
- Tax catalogue
- Price revisions
- Sales factors
- Payment modes
- Sales personnel
- Customer mailer and address labels

Representative topics:

- Distributor: [`shoper9/catalogue/Item_Master.htm`](../shoper9/catalogue/Item_Master.htm)
- POS: [`shoper9pos/catalogue/IM_Item_Master.htm`](../shoper9pos/catalogue/IM_Item_Master.htm)
- Distributor: [`shoper9/catalogue/General_lookup.htm`](../shoper9/catalogue/General_lookup.htm)
- POS: [`shoper9pos/catalogue/General_lookup.htm`](../shoper9pos/catalogue/General_lookup.htm)

### 3.2 Stock and inventory

Both bundles cover:

- Goods inwards and goods receipts
- Goods outwards
- Purchase-order-referenced receipts
- PT/PDT file import
- Size-wise and stock-number-wise entry
- Physical verification and stock take
- Stock discrepancy handling
- Batch-wise stock reports
- Barcode design and printing
- Purchase-order generation, import, closure, reopening, export, reprint, and status

Representative topics:

- [`shoper9/Stock/Goods_Inwards.htm`](../shoper9/Stock/Goods_Inwards.htm)
- [`shoper9pos/Stock/GI_Goods_Inwards.htm`](../shoper9pos/Stock/GI_Goods_Inwards.htm)
- [`shoper9/Stock/Physical_Stock_Management.htm`](../shoper9/Stock/Physical_Stock_Management.htm)
- [`shoper9pos/Stock/PSM-Physical_Stock_Management.htm`](../shoper9pos/Stock/PSM-Physical_Stock_Management.htm)

### 3.3 Synchronization and housekeeping

Both bundles document:

- Backup and restore
- Database compaction and tuning
- Day opening and day end
- Temporary-table cleanup
- Customer and item import/export
- Price revision import
- POS-HO synchronization
- Replication export/import
- Tally posting
- Scheduler services
- Purging

Representative topic:

- [`shoper9/housekeep/POS-HO_Synchronisation.htm`](../shoper9/housekeep/POS-HO_Synchronisation.htm)
- [`shoper9pos/housekeep/POS-HO_Synchronisation.htm`](../shoper9pos/housekeep/POS-HO_Synchronisation.htm)

### 3.4 Reports

Shared report families include:

- Daily, bill-wise, item-wise, and tax sales
- Discounts and promotions
- Salesperson sales
- Cancelled and returned bills
- Size and attribute sales
- Stock balance, movement, aging, and discrepancy
- Goods registers
- Monthly and financial-year comparison
- Rate variation and sales analysis
- Pending transactions
- Gross margin
- Customer offtake

These are behavior contracts. A report name alone is not enough; its filters, grouping, state rules, and stock dimensions must be mapped.

## 4. Distributor-Specific Reference

The Distributor bundle emphasizes document-chain workflows:

- Sales order
- Sales order conversion
- Pending order and transaction closure
- Sales DC
- Approval Issue DC
- Transport receipt and LR number
- Sales DC to Approval Issue DC conversion
- Chain stores and node-wise stock
- Distribution-oriented customer offtake

Representative topics:

- [`shoper9/Sales/Sales_Order-Distributor.htm`](../shoper9/Sales/Sales_Order-Distributor.htm)
- [`shoper9/Sales/DC_generation.htm`](../shoper9/Sales/DC_generation.htm)
- [`shoper9/Sales/Sales_DC-distributor.htm`](../shoper9/Sales/Sales_DC-distributor.htm)
- [`shoper9/Sales/Approval_Issue_DC-distributor.htm`](../shoper9/Sales/Approval_Issue_DC-distributor.htm)
- [`shoper9/Sales/LR_Number_Entry-distributor.htm`](../shoper9/Sales/LR_Number_Entry-distributor.htm)

The important design idea is that a dispatch document is not merely a sales order with a different label. It has its own state, stock effect, approval meaning, transport data, and closure rules.

## 5. POS-Specific Reference

The POS bundle adds a larger operational surface for fast retail execution.

### 5.1 POS billing

POS billing topics cover:

- New bill
- Bill cancellation
- Sales return with reference
- Sales return without reference
- Bill and return reprint
- Bill prefix changes
- Payment handling
- Exact-cash workflow
- Keyboard-driven operation
- Bill suspension and recall
- Exchange with and without reference
- Service orders and service billing
- Walk-in entry

Representative topics:

- [`shoper9pos/Sales/Billing.htm`](../shoper9pos/Sales/Billing.htm)
- [`shoper9pos/Sales/Walk-In_Entry.htm`](../shoper9pos/Sales/Walk-In_Entry.htm)
- [`shoper9pos/Sales/Service_Order.htm`](../shoper9pos/Sales/Service_Order.htm)
- [`shoper9pos/Sales/Change_Payment_Mode.htm`](../shoper9pos/Sales/Change_Payment_Mode.htm)
- [`shoper9pos/Sales/Returns_Exchanges_without_Bill_Reference_POS.htm`](../shoper9pos/Sales/Returns_Exchanges_without_Bill_Reference_POS.htm)

### 5.2 Till and cash control

POS documents a full till lifecycle:

- Till opening balance
- Till status
- Cash receipt and payout
- Cash lift
- Open cash drawer
- Shift close
- Till reconciliation
- Cash denomination
- Till reprint
- Cashier and counter reports
- Till activity logs

Representative topics:

- [`shoper9pos/Cash/Till_Management.htm`](../shoper9pos/Cash/Till_Management.htm)
- [`shoper9pos/Cash/Till_Reconciliation.htm`](../shoper9pos/Cash/Till_Reconciliation.htm)
- [`shoper9pos/Cash/Till_Opening_Balance.htm`](../shoper9pos/Cash/Till_Opening_Balance.htm)
- [`shoper9pos/Reports/Cash_Reports.htm`](../shoper9pos/Reports/Cash_Reports.htm)

This is directly relevant to SMRITI POS shift and cash controls.

## 6. Shoper Concepts Mapped to SMRITI

| Shoper capability | Current SMRITI correspondence |
|---|---|
| POS billing | `src/components/billing/propos/ProPosBillingTerm.tsx`, sales invoice APIs |
| Till management | `src/components/PosTerminalTab.tsx`, `backend/app/models/pos.py` |
| Shift close and reconciliation | `ProPosShiftCloseDl.tsx`, `/api/v1/pos/shifts/close` |
| Cash-in, cash-drop, till expense | `ProPosCashMovesDlg.tsx`, shift cash transaction models |
| Sales order | `SalesOrderFormPremium.tsx`, `/api/v1/sales/orders` |
| Distributor dispatch | `PrepareDispatchDlg.tsx`, distribution and loading-sheet APIs |
| WMS transfer | `WmsStudioTab.tsx`, `/api/v1/wms/transfers` |
| Purchase order and receipt | `PurchaseStudioTab.tsx`, purchase order/receipt APIs |
| Barcode | `BarcodeStudioTab.tsx`, barcode and label APIs |
| Customer catalogue | `CustMasterWs.tsx`, CRM customer APIs |
| Billing/shipping locations | `CustMailingDlg.tsx`, customer location tables |
| Price groups | pricing models and customer price tiers |
| Promotions | `backend/app/models/promotions.py`, promotion services |
| Stock take and discrepancy | physical stock and stock ledger modules |
| Reports | report APIs and report designer |
| Synchronization/import | data exchange, sync, PSV, and import modules |

## 7. Architectural Comparison

### Shoper strengths

- Clear task-oriented workflows
- Explicit navigation paths
- Strong keyboard and operational guidance
- Mature edge-case vocabulary
- Detailed returns, reprints, physical verification, and reconciliation behavior
- Clear distinction between stock-number and size-wise operations
- Strong POS and Distributor process knowledge

### Shoper weaknesses

- Legacy file-based synchronization assumptions
- Mixed generic lookup design
- Numeric internal categories with hidden meaning
- Business behavior spread across specialized tables and flags
- Limited visible tenant isolation in the help model
- Filename and product-variant naming inconsistencies
- Direct migration of table meanings would be risky

### SMRITI strengths

- Separate modern API domains
- Company and branch database routing
- Canonical item, variant, barcode, batch, and serial structures
- Explicit POS shift and cash invariants
- WMS, warehouse, transfers, and stock audit support
- Separate pricing and promotion models
- Governance, audit, import, and legacy mapping support
- Dedicated customer billing and delivery locations

### SMRITI risks

1. Legacy `products` and canonical `items` still coexist in parts of the codebase.
2. Shoper DC, approval issue, transport, and closure semantics need explicit state mapping.
3. POS migration must preserve shift immutability, cash variance, denomination, and idempotency rules.
4. File synchronization semantics need retry, acknowledgement, duplicate, and ordering controls.
5. Shoper report behavior must be mapped by filters and calculations, not just report names.
6. General Lookup must not become a replacement for payment, currency, bank, tax, or accounting masters.
7. CHM filename similarity is unreliable; use TOC paths and topic meaning for mapping.

## 8. General Lookup Recommendation

Shoper General Lookup is documented as category-based code and description storage:

- [`shoper9/catalogue/General_lookup.htm`](../shoper9/catalogue/General_lookup.htm)
- [`shoper9pos/catalogue/General_lookup.htm`](../shoper9pos/catalogue/General_lookup.htm)

It supports adding multiple values under a category, editing descriptions, searching, and preventing deletion when a value is already used.

SMRITI should adopt:

- Stable code plus editable description
- Category/type ownership
- Active/inactive state
- Usage-aware deletion protection
- Search and keyboard-friendly management
- Source provenance for Shoper migration
- Company/branch scope for organization-specific values

SMRITI should not copy the mixed legacy table as-is. Keep dedicated models for:

- Currency
- Payment modes
- Company bank accounts
- Tax references
- Chart of accounts
- Document series
- Price groups
- Promotions

## 9. Recommended Developer Work Plan

### Phase 1: Capability matrix

Create a read-only mapping for every relevant topic:

```text
variant
module
topic_path
business_capability
document_type
state_transitions
required_masters
shortcuts
smriti_frontend
smriti_api
smriti_tables
coverage_status
```

### Phase 2: Workflow invariants

Document and test the rules behind the screens:

- Which actions are allowed in each document state
- Which actions affect stock
- Which actions affect accounting
- Which records become immutable after posting
- Which references are required for returns, exchanges, dispatch, and settlement
- Which operations can be reversed or voided

### Phase 3: Migration staging

Keep Shoper source records and workflow mappings separate from operational records:

```text
source_system = SHOPER9
source_variant = DISTRIBUTOR or POS
source_topic
source_record_id
mapping_status
reviewed_by
reviewed_at
```

### Phase 4: Focused SMRITI hardening

Prioritize:

1. Canonical item and barcode ownership.
2. Distributor document-state mapping.
3. POS till and shift invariants.
4. Payment-mode capability mapping.
5. Report parity for critical sales, stock, cash, and customer reports.
6. General Lookup scope and protected deletion.
7. File/API synchronization reconciliation.

## 10. Final Assessment

Shoper 9 documentation is valuable as a mature retail-process reference. It contains many operational details that are easy to miss when designing a new system, especially around POS cash control, returns, reprints, distribution documents, physical stock, and synchronization.

SMRITI should not become a Shoper clone. The best target is:

```text
Shoper workflow knowledge
+ SMRITI domain separation
+ barcode-first inventory identity
+ tenant isolation
+ explicit audit and state transitions
= safer long-term retail platform
```

The extracted folders are documentation evidence. They should be used to drive capability mapping, regression tests, and migration decisions, not copied as a legacy schema.
