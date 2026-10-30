<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.44.0
  Created      : 2026-09-23
  Modified     : 2026-09-23
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Architecture Specification — Canonical Field Ownership Contract
-->

# SMRITI Canonical Field Ownership Contract

**Standard Identifier:** `SMRITI-ARCH-CFOC-v1.0`  
**Author:** Jawahar Ramkripal Mallah, Chief Systems Architect & Creator  
**Status:** **MANDATORY & ENFORCED**  
**Effective Date:** 2026-09-23  

---

## 1. Executive Summary & Core Principle

SMRITI Retail OS enforces the strict single source of truth architectural rule:

> **ONE FIELD → ONE CANONICAL DEFINITION → ONE AUTHORITATIVE DB MAPPING → MANY UX REFERENCES**

UI screens, forms, grids, and backend API schemas must never become independent owners of business-field metadata (such as labels, placeholders, mandatory requirements, validation regular expressions, or maximum character lengths). All business fields must reference a canonical definition governed by this contract.

---

## 2. The 5 Distinct Architecture Layers

SMRITI establishes and enforces an absolute boundary between 5 distinct layers:

```
┌─────────────────────────────────────────────────────────────┐
│                 1. CANONICAL FIELD DEFINITION               │
│      (Business Identity, Logical Rules, Lifecycle Status)   │
└──────────────────────────────┬──────────────────────────────┘
                               │
            ┌──────────────────┼──────────────────┐
            ▼                  ▼                  ▼
┌───────────────────────┐ ┌───────────────┐ ┌──────────────────────────┐
│ 2. DATABASE MAPPING   │ │3. API CONTRACT│ │  4. SCREEN FIELD USAGE   │
│ (PostgreSQL Physical) │ │ (Pydantic/DTO)│ │    (Master UI Screens)   │
│  - Table & Column     │ │ - API Key     │ │  - Screen & Section      │
│  - Table Ownership    │ │ - API Path    │ │  - Order & Readonly      │
└───────────────────────┘ └───────────────┘ └────────────┬─────────────┘
                                                         ▼
                                            ┌──────────────────────────┐
                                            │   5. UI PRESENTATION     │
                                            │ (Widgets, Renderers, CSS)│
                                            └──────────────────────────┘
```

| Layer | Responsibility | Authoritative Source | Example |
| :--- | :--- | :--- | :--- |
| **1. Field Definition** | Logical business identity, validation rule, data type, label, help text, lifecycle status | `backend/app/governance/field_registry.py` & `smritisys.field_definitions` | `customer.mobile`, `item.barcode`, `invoice.total_amount` |
| **2. Database Mapping** | Physical PostgreSQL schema, table, column, data type, nullability, table ownership (`TENANT` vs `CONTROL_PLANE`) | PostgreSQL Information Schema via `CanonicalFieldDef` | `customers.mobile`, `products.barcode`, `sales_invoices.total_amount` |
| **3. API Contract** | Request / Response serialization key, DTO transformation, endpoint path | FastAPI Routers & Pydantic Schemas | `/api/v1/crm/customers` (`mobile`, `name`) |
| **4. Screen Field Usage** | Placement on a specific screen, section grouping, display order, visibility, editability context | Master Configs (`MasterFormFieldDef`, `MasterColumnDef`) | Customer Master Drawer (`section: "Contact Info"`, `order: 2`) |
| **5. UI Presentation** | Visual component rendering, CSS classes, theme styling, icons, interactive animations | MasterFormDrawer, MasterListScreen, Tailwind tokens | `<input type="text" className="font-mono text-xs..." />` |

---

## 3. Canonical Field ID Independence Rule

A Canonical Field ID is formatted as:
```text
<domain>.<entity>.<field>  OR  <entity>.<field>
```

Examples:
- `customer.name`
- `customer.mobile`
- `customer.gstin`
- `item.barcode`
- `item.sale_price`
- `invoice.invoice_number`
- `invoice.total_amount`

### Decoupling Rule
**The Canonical Field ID MUST NOT depend on the physical PostgreSQL column name.**

Changing the physical DB column name must NEVER force a breaking change on the canonical Field ID or the consuming UI screens.

```text
Logical Canonical Field ID:  customer.gstin
Physical Database Column:   customers.gst_number
```
If PostgreSQL column `customers.gst_number` is refactored, the business contract `customer.gstin` remains invariant.

---

## 4. Field Lifecycle State Machine

Every business field registered in SMRITI must declare an explicit lifecycle status:

```
  ┌─────────┐
  │  DRAFT  │ (Internal development only; rejected in production UX)
  └────┬────┘
       ▼
  ┌──────────┐
  │  ACTIVE  │ (Authoritative; fully supported in UX and APIs)
  └────┬─────┘
       ├─────────────────────────────────┐
       ▼                                 ▼
┌──────────────┐                  ┌──────────────┐
│  DEPRECATED  │                  │    LEGACY    │ (Historical field; requires
│ (Existing OK;│                  │ (Exception   │  active baseline exception)
│  No New UX)  │                  │  governed)   │
└──────┬───────┘                  └──────────────┘
       ▼
 ┌───────────┐
 │  RETIRED  │ (Decommissioned; CI FAILS if referenced anywhere)
 └───────────┘
```

### Lifecycle Rules:
1. **`DRAFT`**:
   - Intended for schema evolution and staging.
   - **Enforcement:** The CI Guard blocks any production UX screen from referencing a `DRAFT` field.
2. **`ACTIVE`**:
   - Standard operational status. Fully supported across all screens, forms, APIs, and models.
3. **`DEPRECATED`**:
   - Scheduled for retirement. Permitted in legacy screens during transition periods.
   - **Enforcement:** The CI Guard blocks `DEPRECATED` fields from being introduced into newly created screens.
4. **`RETIRED`**:
   - Completely decommissioned.
   - **Enforcement:** CI fails immediately if a `RETIRED` field is referenced anywhere in UI, API, or configurations.
5. **`LEGACY`**:
   - Retained only for historical compatibility.
   - **Enforcement:** Permitted only when backed by an explicit, non-expired record in the Exception Baseline.

---

## 5. Strict Exception Governance Model

No undocumented, silent, or permanent scanner exclusions are permitted in SMRITI. Every exception must be declared in `scripts/ux_field_governance_baseline.json` adhering to the mandatory schema:

```json
{
  "exception_id": "EXC-YYYYMMDD-XXXX",
  "field_id": "canonical.field.id",
  "reason": "Detailed business justification for the exception",
  "owner": "Responsible Engineering / Architecture Working Group",
  "created_at": "YYYY-MM-DD",
  "expires_at": "YYYY-MM-DD",
  "remediation_target": "Concrete file path or component to refactor"
}
```

### Expiry Enforcement:
The CI Guard evaluates `expires_at` against the current date. Any expired exception causes the CI build to fail with a `CRITICAL_EXPIRED_EXCEPTION` error.

---

## 6. New Field Lifecycle Policy

A new business field **MUST NEVER** be introduced directly into UI code.

The mandatory promotion order is:
```
1. Physical Database Schema Migration (Alembic DDL)
   ↓
2. Canonical Field Registration (backend/app/governance/field_registry.py)
   ↓
3. Control Plane Seeding (backend/app/db/seed_field_definitions.py)
   ↓
4. Client SSOT Generation (scripts/generate_ts_field_registry.py)
   ↓
5. API Contract Schema (Pydantic / FastAPI router)
   ↓
6. Master Screen Field Wiring (src/components/global/configs/*.tsx)
   ↓
7. Automated CI Governance Verification (scripts/ci_ux_field_governance_guard.py)
```

Any field introduced directly into UI code bypassing steps 1–4 will be intercepted by the CI Guard as `UNAUTHORIZED_HARDCODED_FIELD` or `ORPHAN_UX_FIELD`, terminating the build.
