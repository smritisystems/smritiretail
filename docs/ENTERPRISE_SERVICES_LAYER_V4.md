<!--
  Project      : SMRITI Retail OS
  Organization : SmritiSys
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
  Version      : 4.0.0
  Created      : 2026-08-04
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal Architecture Specification
-->

# SMRITI Enterprise Services Layer & Event Bus Specification (ESL v4.0)

**Status:** FROZEN — Enterprise Services Layer Specification v4.0 (2026-08-04)
**Scope:** SMRITI Event Bus (SEB), Enterprise Search (SES), Notification Platform (SNP), & Workflow Automation (SWA)

---

## 1. Enterprise Services Layer (ESL v4.0) Topology

`Enterprise Services Layer (ESL v4.0)` introduces centralized platform services positioned between shared kernels and the Master Data Platform (MDP v3.1).

```text
 ┌────────────────────────────────────────────────────────────────────────┐
 │ SMRITI DIGITAL COMMERCE PLATFORM OS V4.0 TOPOLOGY                      │
 ├────────────────────────────────────────────────────────────────────────┤
 │ Level 1: Platform OS & UX (SXP v1.0, SEEF v1.0, SEDS v1.0, WNG)       │
 ├────────────────────────────────────────────────────────────────────────┤
 │ Level 2: Shared Platform Kernels (Inventory, SDK, SBPK, SIK, SPPK, SNK)│
 ├────────────────────────────────────────────────────────────────────────┤
 │ Level 3: Enterprise Services Layer (SEB, SES, SNP, SWA, AI Services)  │
 ├────────────────────────────────────────────────────────────────────────┤
 │ Level 4: Master Data Platform (MDP v3.1, RDH, MDGC Governance)         │
 ├────────────────────────────────────────────────────────────────────────┤
 │ Level 5: Universal Registries (UFR, UWR, URR, USR, UPRT)               │
 ├────────────────────────────────────────────────────────────────────────┤
 │ Level 6: Enterprise Business Studios (12 Certified Studios)            │
 └────────────────────────────────────────────────────────────────────────┘
```

---

## 2. SEB — SMRITI Event Bus (Event-Driven Architecture)

`SEB v1.0` decouples business studios by publishing domain events over an asynchronous event bus:

```text
 ┌────────────────────────────────────────────────────────────────────────┐
 │ SEB V1.0 EVENT PUBLISHER & SUBSCRIBER FLOW                             │
 ├────────────────────────────────────────────────────────────────────────┤
 │                                                                        │
 │  ┌─────────────────┐      Publish      ┌──────────────────────┐        │
 │  │ EVENT PUBLISHER ├──────────────────►│ SMRITI EVENT BUS     │        │
 │  │ (e.g. Item Save)│                   │ (SEB Engine)         │        │
 │  └─────────────────┘                   └──────────┬───────────┘        │
 │                                                   │                    │
 │         ┌───────────────────┬─────────────────────┼──────────────────┐ │
 │         ▼                   ▼                     ▼                  ▼ │
 │  ┌─────────────┐    ┌───────────────┐    ┌─────────────────┐  ┌──────┐ │
 │  │ POS ENGINE  │    │ CATALOG SYNC  │    │ PRICING ENGINE  │  │ CRM  │ │
 │  └─────────────┘    └───────────────┘    └─────────────────┘  └──────┘ │
 └────────────────────────────────────────────────────────────────────────┘
```

### SEB Core System Events
- `product.created` / `product.updated` / `product.discontinued`
- `inventory.received` / `inventory.adjusted` / `inventory.quarantined`
- `order.submitted` / `order.approved` / `order.dispatched`
- `customer.registered` / `customer.tier_promoted` / `wallet.credited`
- `payment.collected` / `journal.posted` / `period.closed`

---

## 3. SES — SMRITI Enterprise Search Platform

`SES v1.0` provides a unified, zero-latency global search bar searching across all master and transactional entities:
- **Global Indexing:** Products, SKUs, Barcodes, Customers, Suppliers, Invoices, POs, GRNs, Journal Vouchers.
- **Search Capabilities:** Exact Match, Prefix Match, Fuzzy Spelling Match, Phonetic Match, HSN Lookup.

---

## 4. SNP — SMRITI Notification Platform

`SNP v1.0` centralizes dispatch across multi-channel communication providers:
- **Channels:** WhatsApp Business API, SMS Gateways, SMTP Email, Web Push, In-App Notifications.
- **Notification Queue:** Transactional alerts, PO approval requests, low stock warnings, GSTR filing reminders.

---

## 5. SWA — SMRITI Workflow Automation Engine

`SWA v1.0` enables rule-based trigger automation without writing code:
```text
  WHEN: Purchase Order State == "Approved"
  THEN: 1. Auto-generate Draft GRN Document via SDK
        2. Send WhatsApp Notification to Warehouse Manager via SNP
        3. Notify Supplier EDI Endpoint via SIK
```
