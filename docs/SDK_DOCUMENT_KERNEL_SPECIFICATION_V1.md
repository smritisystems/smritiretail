<!--
  Project      : SMRITI Retail OS
  Organization : SmritiSys
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
  Version      : 1.0.0
  Created      : 2026-08-04
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal Architecture Specification
-->

# SMRITI Document Kernel Specification (SDK v1.0)

**Status:** FROZEN — Universal Document Kernel v1.0 (2026-08-04)
**Scope:** Universal Document Lifecycle, Versioning, Status Machine, & Audit Journal

---

## 1. Universal Document Lifecycle State Machine

`SDK v1.0` serves as the centralized, immutable document lifecycle engine for all business transaction documents across all SMRITI business studios.

```text
 ┌────────────────────────────────────────────────────────────────────────┐
 │ SDK V1.0 UNIVERSAL DOCUMENT LIFECYCLE STATE MACHINE                     │
 ├────────────────────────────────────────────────────────────────────────┤
 │                                                                        │
 │   ┌───────────┐     Submit     ┌─────────────┐    Approve   ┌────────┐ │
 │   │   DRAFT   ├───────────────►│  SUBMITTED  ├─────────────►│APPROVED│ │
 │   └─────┬─────┘                └──────┬──────┘              └───┬────┘ │
 │         │                             │                         │      │
 │         │ Cancel                      │ Reject                  │ Post │
 │         ▼                             ▼                         ▼      │
 │   ┌───────────┐                ┌─────────────┐              ┌────────┐ │
 │   │ CANCELLED │                │  REJECTED   │              │ POSTED │ │
 │   └───────────┘                └─────────────┘              └───┬────┘ │
 │                                                                 │      │
 │                                                                 │Archive
 │                                                                 ▼      │
 │                                                             ┌────────┐ │
 │                                                             │ARCHIVED│ │
 │                                                             └────────┘ │
 └────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Universal Document Registry & Consumer Matrix

All transaction documents consume `SDK v1.0` to enforce consistent document numbers, status transitions, version history, and audit trails:

| Business Studio | Document Type | SDK Document Code | Target Platform Registries |
|---|---|---|---|
| **Purchase Studio** | Purchase Order | `PO` | UFR, UWR, USR, UPRT, SBPK |
| **Purchase Studio** | Goods Receipt Note | `GRN` | Inventory Kernel, SBPK |
| **Purchase Studio** | Supplier Bill | `VINV` | AP Ledger, URR |
| **Sales Studio** | Sales Order | `SO` | ATP Reservation, UWR |
| **Sales Studio** | Tax Invoice | `SINV` | AR Ledger, GST Engine, SBPK |
| **POS Studio** | Counter Receipt | `POS` | Cash Register, SBPK Thermal |
| **Inventory Studio**| Stock Movement Journal | `STK` | Inventory Kernel Ledger |
| **Warehouse Studio**| Bin Transfer Challan | `WMS` | Bin Location Master |
| **Accounting Studio**| Journal Voucher | `JV` | General Ledger Engine |
