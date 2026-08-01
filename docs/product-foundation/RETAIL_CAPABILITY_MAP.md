<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
  Version      : 1.0
  Created      : 2026-08-01
  Modified     : 2026-08-01
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Retail Capability Map
-->

# SMRITI Retail Capability Map

**Status:** ACTIVE — Product Foundation and Studio execution blueprint  
**Effective:** 2026-08-01  
**Scope:** Retail OS product domains, shared engines, and delivery alignment

---

## 1. Purpose

This capability map provides the master blueprint that ties Product Foundation engines to Studio implementations. It helps translate the frozen platform foundation into concrete retail operating capabilities.

---

## 2. Capability Hierarchy

```text
Retail OS
├── Commerce
│   ├── Sales
│   ├── POS
│   ├── Returns
│   └── Promotions
│
├── Inventory
│   ├── Stock
│   ├── Transfers
│   ├── Physical Count
│   └── Valuation
│
├── Procurement
│   ├── Purchase
│   ├── Supplier
│   ├── GRN
│   └── Vendor Bills
│
├── Finance
│   ├── Accounting
│   ├── GST
│   ├── Banking
│   └── Receivables
│
├── Customer
│   ├── CRM
│   ├── Loyalty
│   ├── Wallet
│   └── Support
│
└── Analytics
    ├── Reports
    ├── Dashboards
    ├── AI
    └── Forecasting
```

---

## 3. Capability-to-Engine Mapping

### 3.1 Commerce
- Sales Studio → Pricing, Workflow, Document, Reporting
- POS Studio → Pricing, Discounts, Promotions, Workflow, Document
- Returns → Workflow, Document, Accounting integration

### 3.2 Inventory
- Inventory Studio → Inventory Rules, Stock Ledger, Allocation, Batch/Serial, Reporting
- Transfers and Physical Count → Workflow, Document, Reporting

### 3.3 Procurement
- Purchase Studio → Approval Workflow, Document Engine, GST, Reporting
- Supplier and Vendor Bills → Document Engine, Accounting integration

### 3.4 Finance
- Accounting Studio → GST, Voucher Posting, Receivables, Payables, Banking
- Settlement and reconciliation → Workflow and Reporting

### 3.5 Customer
- CRM Studio → Workflow, Search, Reporting, AI Assistant
- Loyalty and Wallet → Pricing and Promotion engine integration

### 3.6 Analytics
- Reporting Studio → Reporting Engine, Dashboards, AI Assistant, Search
- Forecasting and recommendations → AI Assistant and Reporting integration

---

## 4. Product Foundation Engine Domains

### Commerce Engine
- Pricing
- Discounts
- Promotions
- Offers
- Coupons
- Loyalty
- Wallet

### Inventory Engine
- Stock Ledger
- Costing
- Reservations
- Allocation
- Batch
- Serial
- Warehouse Rules

### Accounting Engine
- GST
- Tax
- Voucher Posting
- Receivables
- Payables
- Settlement
- Banking

### Workflow Engine
- Approval
- Status
- Tasks
- Notifications
- SLA
- Escalation

### Document Engine
- Numbering
- Templates
- Printing
- PDF
- Barcode
- QR
- Labels

### Intelligence Engine
- Search
- Dashboards
- Reports
- AI Assistant
- Forecasts
- Recommendations

---

## 5. Delivery Model

The Product Foundation should power Studios through shared engine domains rather than duplicated studio logic.

```text
Retail Studios
    │
    ▼
Product Foundation Engines
    │
    ▼
Platform Foundation
```

---

## 6. Product Foundation Promotion Rule

A capability should only be promoted into Product Foundation when it meets at least one of the following:

- it is reused by at least two Studios;
- it is clearly business-neutral and reusable across multiple retail domains;
- it removes duplication across multiple workflows.

---

## 7. Execution Order

### Phase 1
- POS Studio
- Sales Studio
- Inventory Studio

### Phase 2
- Purchase Studio
- Accounting Studio

### Phase 3
- CRM Studio
- Reporting Studio

### Phase 4
- License Studio
- Customer Portal
- Mobile Workspace

---

## 8. Success Measures

The success of this capability map should be judged by customer-visible outcomes:

- can a retailer complete a sale in under 10 seconds;
- can inventory reconcile reliably;
- can Purchase → GRN → Invoice complete without manual repair;
- can accounting post automatically;
- can a new employee learn the system quickly.
