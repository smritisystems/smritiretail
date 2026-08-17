<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.21.0
  Created      : 2026-08-17
  Modified     : 2026-08-17
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# SMRITI Party Stock Visibility (PSV) Architecture Specification v1.0

**Status:** ARCHITECTURE_VERIFIED / IMPLEMENTED  
**Service:** `app.services.psv_projection_service.PSVProjectionService`  
**Configuration Model:** `app.models.control.control_models.ControlPSVConfig`  
**Data Models:** `app.models.psv.PSVStockEvent`, `app.models.psv.PSVStockBalance`, `app.models.psv.PSVParty`, `app.models.psv.PSVSKUTracking`  

---

## 1. Executive Summary & Purpose

Party Stock Visibility (PSV) is a decoupled, asynchronous shadow-ledger projection subsystem that provides real-time channel, consignment, vendor, and multi-party stock visibility across partner networks.

### Critical Architectural Boundary
> **PSV is Shadow Inventory & Inventory Intelligence — NEVER the Core Inventory Authority.**
> PSV projections do not directly mutate core inventory tables (`products`, `stock_movements`, `inventory_ledger_entries`), accounting ledgers, or statutory tax records. It maintains an immutable stream of shadow stock events and aggregated party balances.

---

## 2. PSV Data Topology & Flow

```text
Operational Transaction (Sales Invoice / Consignment Dispatch / GRN)
                               │
                               ▼
                    [PSV Enabled for Company?]
                      (ControlPSVConfig Check)
                               │
                               ▼ (Yes)
                     PSVProjectionService
                               │
            ┌──────────────────┴──────────────────┐
            ▼                                     ▼
     PSVStockEvent                        PSVStockBalance
  (Immutable Event Log)                (Aggregated Party SKU Balance)
```

---

## 3. Data Models & Schema

1. **`ControlPSVConfig`** (Control Plane):
   - Company-level toggle to enable or disable PSV shadow event emission.
   - Fields: `company_id`, `is_psv_enabled`, `sync_mode`, `retention_days`.

2. **`PSVStockEvent`** (Event Stream):
   - Append-only immutable log of party inventory movements.
   - Fields: `id`, `company_id`, `party_id`, `party_type`, `sku_id`, `event_type`, `quantity`, `reference_doc_type`, `reference_doc_id`, `event_timestamp`, `status`.
   - **Idempotency Key:** Compound unique index on `(company_id, reference_doc_type, reference_doc_id, event_type)`.

3. **`PSVStockBalance`** (Read Model / Projections):
   - Running balances per party, company, and SKU.
   - Fields: `id`, `company_id`, `party_id`, `sku_id`, `available_qty`, `reserved_qty`, `in_transit_qty`, `last_updated_at`.

4. **`PSVParty` & `PSVSKUTracking`**:
   - Partner registry and tracking metadata.

---

## 4. Operational Invariants & Service Guarantees

1. **Idempotent Projections:** Duplicate event emissions with identical document references return `SKIPPED_ALREADY_PROJECTED` without double-incrementing balances.
2. **Reversibility:** Cancellations and returns emit inverse events with negative quantities, preserving full auditability.
3. **Multi-Tenant Isolation:** All PSV queries and balance computations strictly filter by `company_id`.
4. **Session Separation:** `PSVProjectionService` accepts an explicit session parameter, allowing execution in a separate database session if targeted.

---

## 5. Database Deployment Reality

- **Target Architecture Design:** Separate dedicated database (`SmritiPSV`).
- **Current Deployed Reality:** PSV tables (`psv_parties`, `psv_sku_tracking`, `psv_stock_events`, `psv_stock_balances`) are provisioned directly in `smritisys` (Control Plane) and company databases (`smriti001`). `SmritiPSV` is not provisioned as a standalone database instance.
- **Impact:** Functionality is 100% operational in tests and runtime; architectural separation into an isolated database instance is an operational migration task.
