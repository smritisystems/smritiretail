<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.16.0
  Created      : 2026-08-15
  Modified     : 2026-08-15
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# SMRITI Configuration Ownership & Decision Matrix v1.0

**Status: AUDIT_COMPLETE / PENDING_HUMAN_DECISION**  
**Audit Timestamp:** 2026-08-15 05:04:24 UTC  
**Official Control Plane DB:** `smritisys`

---

## 1. Core Architectural Governance Invariants

> **A Control Plane configuration defines how the business application is permitted or expected to behave; the Company Business DB records what actually happened.**

```text
CONFIGURATION ≠ TRANSACTION STATE
POLICY ≠ AUTHORIZATION
FEATURE FLAG ≠ CAPABILITY
LICENSE ENTITLEMENT ≠ PERMISSION
MENU VISIBILITY ≠ AUTHORIZATION
```

---

## 2. Refined 25-Area Configuration Scope & Ownership Matrix

| Configuration Area | Current Table | Scope Level | Artifact Type | Target Candidate | Ownership & Refined Recommendation |
|---|---|---|---|---|---|
| **BILLING CONFIGURATION** | `system_configs` | `COMPANY` | `CONFIGURATION` | `smritisys` | Billing parameters (tax mode, discount caps) live in `system_configs`. `smriti_menus` controls navigation only. |
| **POS CONFIGURATION** | `cash_registers` | `BRANCH` | `CONFIGURATION` | `smritisys` / `COMPANY_DB` | Register metadata lives in `smritisys`; shift transaction state lives in Company DB. |
| **SALES CONFIGURATION** | `document_series` | `COMPANY` | `DOCUMENT_CONFIGURATION` | `smritisys` | REUSE `document_series` for sales invoice numbering policies. |
| **PURCHASE CONFIGURATION** | `purchase_reorder_configs` | `COMPANY` | `POLICY` | `smritisys` | REUSE `purchase_reorder_configs` for reorder thresholds. |
| **GRN CONFIGURATION** | `master_values` | `COMPANY` | `CONFIGURATION` | `smritisys` | REUSE `master_values` for GRN receipt types. |
| **INVENTORY CONFIGURATION** | `attribute_definitions` | `COMPANY` | `CONFIGURATION` | `smritisys` | REUSE `attribute_definitions` for dynamic product attributes. |
| **STOCK POLICY** | `system_configs` | `COMPANY` | `POLICY` | `smritisys` | Store stock valuation policy (FIFO / Weighted Avg) in `system_configs`. |
| **TAX / GST CONFIGURATION** | `purchase_jurisdiction_configs` | `COMPANY` | `POLICY` | `smritisys` | REUSE `purchase_jurisdiction_configs` for tax rules. Credentials in vault. |
| **E-WAY BILL / E-INVOICE CONFIG** | `system_configs` | `COMPANY` | `POLICY` | `smritisys` | Store NIC/E-Way Bill integration flags in `system_configs`. |
| **DOCUMENT SERIES / NUMBERING** | `document_series` | `COMPANY` | `DOCUMENT_CONFIGURATION` | `smritisys` | REUSE `document_series` for numbering series rules. |
| **PRINT CONFIGURATION** | `print_templates` | `COMPANY` | `CONFIGURATION` | `smritisys` | REUSE `print_templates` and `print_profiles` for layout formatting. |
| **TERMS & CONDITIONS** | `terms_defaults` | `COMPANY` | `POLICY` | `smritisys` | REUSE `terms_defaults` for invoice terms & clauses. |
| **DISCOUNT POLICY** | `system_configs` | `COMPANY` | `POLICY` | `smritisys` | Store maximum discount policy & threshold in `system_configs`. |
| **RETURN POLICY** | `system_configs` | `COMPANY` | `POLICY` | `smritisys` | Store sales return window and refund policy in `system_configs`. |
| **CREDIT POLICY** | `customer_groups` | `COMPANY` | `POLICY` | `smritisys` | REUSE `customer_groups` credit limits & payment terms. |
| **PAYMENT POLICY** | `master_values` | `COMPANY` | `POLICY` | `smritisys` | REUSE `master_values` for accepted payment modes. |
| **APPROVAL POLICY** | `requisition_approval_policies` | `COMPANY` | `POLICY` | `smritisys` | REUSE `requisition_approval_policies` for approval threshold definitions. |
| **WORKFLOW CONFIGURATION** | `approval_workflow_logs` | `COMPANY` | `WORKFLOW_CONFIGURATION` | `smritisys` | Requisition policies define workflow rules; logs track execution audit history. |
| **MODULE ENABLE / DISABLE** | `system_configs` | `PLATFORM / LICENSE` | `ENTITLEMENT` | `smritisys` | Module entitlements governed by SGIP License Vault. `smriti_menus` controls visibility. |
| **LICENSE / ENTITLEMENT** | `SGIP Vault / roles` | `LICENSE` | `AUTHORIZATION` | `smritisys` | License vault governs entitlements; `roles` define RBAC capabilities. |
| **FEATURE FLAGS** | `system_configs` | `PLATFORM` | `AUTHORIZATION` | `smritisys` | Feature flags govern platform capability rollouts, independent of menu permissions. |
| **INTEGRATION ENABLE / DISABLE** | `tally_configs` | `COMPANY` | `INTEGRATION_CONFIGURATION` | `smritisys` | REUSE `tally_configs` for connector settings. |
| **COMPANY SETTINGS** | `companies` | `COMPANY` | `CONFIGURATION` | `smritisys` | REUSE `companies` table for enterprise identity & setup. |
| **BRANCH SETTINGS** | `branches` | `BRANCH` | `CONFIGURATION` | `smritisys` | REUSE `branches` table for store location identity & setup. |
| **USER PERSONALIZATION** | `localStorage` | `USER` | `USER_PERSONALIZATION` | `USER_PERSONALIZATION` | Must remain in browser `localStorage` (theme, sidebar, focus mode, zoom). |

---

## 3. Scope Inheritance Cascade

```text
PLATFORM DEFAULT
       ↓
INDUSTRY PACK
       ↓
LICENSE / PLAN
       ↓
COMPANY OVERRIDE
       ↓
BRANCH OVERRIDE
       ↓
ROLE
       ↓
USER PERSONALIZATION (Browser localStorage)
```
