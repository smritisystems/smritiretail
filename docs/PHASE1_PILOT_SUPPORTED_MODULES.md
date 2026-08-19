<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.16.0
  Created      : 2026-08-19
  Modified     : 2026-08-19
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal Governance & Pilot Readiness Specification
-->

# SMRITI Retail OS — Phase 1 Pilot Supported vs Preview Modules

**Phase:** Phase 1 — Stabilize Tier A Money Path (Days 1–30)  
**Branch:** `smritiNX`  
**Target Release:** v3.16.0  
**Status:** Approved for Pilot Deployment  

---

## 1. Executive Summary

This document establishes the official pilot deployment boundaries for SMRITI Retail OS. To guarantee operational stability, fiscal correctness, and strict multi-tenant database isolation, modules are formally classified into two tiers:
- **Supported for Pilot (Tier A Money Path + Core Masters)**: Fully verified end-to-end, integrated with FastAPI + PostgreSQL transactional core, hardened tenant isolation, and protected against data corruption.
- **Preview (Available for Evaluation)**: Functional for demonstration and non-transactional pilot staging, but undergoing subsequent consolidation or hardware certification before general production signoff.

---

## 2. Supported Modules for Pilot (Tier A Money Path)

The following modules constitute the core transactional money path and master registry, fully supported for commercial pilot operations:

| Module Identifier | Display Name | Category | Backend Endpoint | Pilot Capability & Verification Scope |
| :--- | :--- | :--- | :--- | :--- |
| `dashboard` / `launchpad` | **SMRITI Launchpad** | Operations | `/api/v1/auth/me` | Unified workspace director with 33 canonical routes; neutral status indicators. |
| `pos` | **Billing Desk (POS)** | Sales & POS | `/api/v1/pos/`, `/api/v1/sales/` | Cashier shift management, barcode scanning, cart calculation, cash drawer reconciliation, receipt printing. |
| `sales` | **Sales Studio** | Sales & POS | `/api/v1/sales/` | B2C retail invoice creation, multi-tender transactions, sales register, return processing. |
| `purchase` | **Purchase Studio** | Inventory & Sourcing | `/api/v1/purchase/` | Vendor purchase orders, goods receiving (GRN), inventory batch receiving. |
| `item-master` | **Item Master & Catalog** | Inventory & Sourcing | `/api/v1/products/` | Database-level paginated product catalog (`LIMIT/OFFSET`), deterministic sorting, multi-field database search (`ILIKE`). |
| `customer-master` | **Customer Master** | Sales & POS | `/api/v1/crm/` | Customer directory, GSTIN records, phone lookup, credit limit verification. |
| `supplier-mgmt` | **Supplier Directory** | Inventory & Sourcing | `/api/v1/purchase/suppliers` | Vendor master registry, payment terms, GSTIN verification, payable balance tracking. |
| `stock-ledger` | **Stock Movement Ledger** | Inventory & Sourcing | `/api/v1/inventory/ledger` | Real-time immutable stock movement history, inward/outward audit entries. |
| `profiles` | **POS Profiles & Counters** | Sales & POS | `/api/v1/pos/profiles/` | Counter profile assignment, cashier locks, default customer mapping. |
| `document-series` | **Document Series Engine** | Data & Config | `/api/v1/numbering/` | Fiscal year prefixing, sequential numbering, auto-increment resets. |
| `terms-engine` | **Commercial Terms Engine**| Data & Config | `/api/v1/terms/` | Legal terms, invoice footer conditions, return & warranty clauses. |
| `approval-matrix` | **Approval Matrix Engine** | Data & Config | `/api/v1/workflow/` | Signing authority thresholds, discount approval workflows. |
| `staff-management` | **Staff & HR Management** | Operations | `/api/v1/users/` | Operator accounts, role-based access control (RBAC), credentials management. |
| `user-profile` | **My Profile Dashboard** | Operations | `/api/v1/auth/me` | Active session inspection, password update, security credentials. |
| `about-smriti` | **About SMRITI** | System | `/api/v1/system/` | System diagnostic information, licensing, architectural compliance. |

---

## 3. Preview Modules (Evaluation & Staging Mode)

These modules are enabled in the interface for operational evaluation, but remain outside the Tier A pilot guarantee:

| Module Identifier | Display Name | Pilot Status | Reason for Preview Classification |
| :--- | :--- | :--- | :--- |
| `create-tax-invoice` | **Create Tax Invoice (B2B)** | Preview | B2B statutory invoice UI undergoing DocumentStudio shell consolidation in Phase 2. |
| `barcode` | **Barcode Studio** | Preview | Thermal label engine active; hardware printer certification scheduled in Phase 2. |
| `business-ledger` | **Business Accounts Ledger**| Preview | Sales journal verified; full double-entry accounting reconciliation scheduled for Phase 3. |
| `accounting-sync` | **Accounting Sync** | Preview | External ERP synchronization connector interface in evaluation. |
| `report-designer` | **Report Designer** | Preview | Standard FastAPI reporting operational; visual drag-and-drop builder in preview. |
| `print-studio` | **Print Studio** | Preview | Template customizer available; statutory invoice formats default to verified standard templates. |
| `print-history` | **Print History Logs** | Preview | Audit logging active; mass reprint permissions in preview. |
| `crm` / `loyalty` | **CRM & Loyalty Studio** | Preview | Core membership active; automated promotional campaign engine in evaluation. |
| `masters` | **Master Framework** | Preview | Generic lookup manager active; specialized lookup extensions in evaluation. |
| `data-exchange` | **Data Exchange Hub** | Preview | Bulk CSV data import engine active for initial onboarding migrations. |
| `company-setup` | **Company Setup Wizard** | Preview | Onboarding assistant available for staging environments. |
| `ufe` | **Field Explorer (UFE)** | Preview | Dynamic metadata inspection tool for administrative users. |
| `formulas` | **KPI Registry** | Preview | Analytical metric expressions registry in evaluation. |
| `psv` | **Channel Visibility (PSV)** | Preview | Multi-channel partner stock telemetry in preview. |
| `dev-tracker` | **Dev Intelligence Center** | Preview | Internal developer diagnostics and health monitor. |
| `audit-logs` | **Security & Audit Logs** | Preview | Security audit trails active; immutable export scheduled in Phase 3. |
| `wiki` | **SMRITI Gyan Kendra** | Preview | Integrated markdown documentation viewer. |
| `training-academy` | **Training Academy** | Preview | Training simulation tutorials for cashier onboarding. |

---

## 4. Multi-Tenant Isolation & Security Standards

During pilot deployment, all client requests MUST supply:
1. `Authorization: Bearer <JWT>`
2. `X-Company-ID: <COMP-ID>`
3. `X-Branch-ID: <BR-ID>`

The backend enforces fail-closed isolation across all Tier A routes: any request missing tenant context or mismatched across database scopes is rejected with `HTTP 401/403`.
