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

# SMRITI UI/UX Control Plane Architecture Audit v1.0

**Status: AUDIT_COMPLETE**  
**Audit Timestamp:** 2026-08-15 04:35:50 UTC  
**Database Mutations:** **ZERO (0 Mutations Verified)**  
**Excel Workbook:** [`SMRITI_UI_UX_Control_Plane_Audit.xlsx`](file:///F:/SMRITRretailNX/SMRITI_UI_UX_Control_Plane_Audit.xlsx)

---

## 1. Executive Summary
This architectural audit inspects the existing Control Plane database (`smritisys`), FastAPI backend models, React layout engine, design token system, and adaptive context actions (ACAS/AWE) to determine Control Plane ownership boundaries without creating duplicate database tables or altering live database state.

---

## 2. Existing Database Control Plane Tables

| Table Name | Row Count | Ownership | Current Purpose |
|---|---|---|---|
| **`smriti_menus`** | **34** | Control Plane / SmritiSys | Authoritative Control Plane Menu Registry |
| **`smriti_audit_log`** | **40** | Control Plane / SmritiSys | Authoritative Enterprise Audit Trail |
| **`system_configs`** | **15** | Control Plane | Core system configuration parameters |
| **`master_types`** | **18** | Control Plane | Master data framework entity types |
| **`master_values`** | **80** | Control Plane | Master data framework entity values |
| **`smriti_settings`** | **0** | Control Plane | Pre-existing settings registry (REUSE) |
| **`smriti_themes`** | **0** | Control Plane | Pre-existing theme registry (REUSE) |
| **`smriti_theme_variants`** | **0** | Control Plane | Pre-existing theme variants registry (REUSE) |
| **`smriti_workspace_profiles`** | **0** | Control Plane | Pre-existing workspace profile registry (REUSE) |
| **`smriti_field_security_masks`** | **0** | Control Plane | Pre-existing field security masks registry (REUSE) |

---

## 3. Key Findings by Audit Phase

### Phase 1–3: Backend & Frontend Registries
- **Menu Registry**: `smriti_menus` PostgreSQL table is the single authoritative source of truth. Frontend layout store (`layout_store.tsx`) consumes `/api/v1/menus/resolved` with an offline degraded fallback.
- **Master Data**: `master_types` & `master_values` DB tables serve as the authoritative master entity registry.

### Phase 4: Theme & Design System
- **CSS Variables**: `src/index.css` defines core Tailwind v4 design tokens (`--font-sans`, `--font-display`, `--font-mono`, `--c-theme-base`, `--c-theme-surface-*`).
- **Theme Selection**: Stored as a user-level personalization preference in `localStorage` under key `smriti-theme`. Pre-existing DB table `smriti_themes` should be REUSED if system themes are seeded in the future.

### Phase 5: AWE / SAEF / ACAS Audit
- **Context Actions (ACAS)**: `src/context-actions/ContextRegistry.ts` contains adaptive context actions. State & recents are stored in `localStorage` (`smriti_acas_*`).
- **Workspace Modes**: Item Master mode (`SIMPLE` / `ADVANCED`) stored in `localStorage` under `smriti_item_master_mode`.

### Phase 6–7: Single Workspace & Form Configuration
- **Single Workspace Principles**: 1 Billing Workspace (`/pos`), 1 Purchase Workspace (`/purchase`), 1 Inventory Workspace (`/inventory`), 1 Universal Person Workspace (`/supplier-mgmt`).
- **Dynamic Form Attributes**: `attribute_definitions` DB table provides configurable product attributes via `/api/v1/attributes/definitions`.

### Phase 8: User Personalization Isolation
- Personal display preferences (`smriti_layout_preferences`, `smriti-theme`, `smriti_workspace_focus_mode`, `smriti_workspace_global_zoom`) are isolated in `localStorage` and MUST NOT be forced into Control Plane DB tables.

---

## 4. Duplicate Registry Detection & Resolution

1. **Workspace Navigation**:
   - *Source A*: `layout_store.tsx` (`registeredWorkspaces` static fallback)
   - *Source B*: `smriti_menus` (Database Table)
   - *Resolution*: **REUSE `smriti_menus`** via `/api/v1/menus/resolved`.
2. **Master Types**:
   - *Source A*: `masters_registry.ts` (Static Code)
   - *Source B*: `master_types` (Database Table)
   - *Resolution*: **REUSE `master_types`** via `/api/v1/masters`.

---

## 5. Recommended Database Ownership Model

```text
SMRITI CONTROL PLANE (smritisys)
│
├── smriti_menus (Authoritative Menu Registry)
├── smriti_audit_log (Authoritative Audit Trail)
├── system_configs (System Parameters)
├── master_types & master_values (Master Framework)
├── smriti_themes (System Theme Registry - REUSE)
└── smriti_workspace_profiles (AWE/SAEF Profile Registry - REUSE)

COMPANY BUSINESS DB
│
├── Transactional Data (Sales, Purchase, Stock)
├── Company Configuration (companies, branches, stores)
└── Dynamic Form Definitions (attribute_definitions, barcode_layouts)

USER PERSONALIZATION (Browser localStorage)
│
├── Sidebar Layout & Last Workspace (smriti_layout_preferences)
├── Theme Preference (smriti-theme)
├── Focus Mode & Zoom Level (smriti_workspace_focus_mode, smriti_workspace_global_zoom)
└── Pinned Taskbar Items & Shortcuts (smriti_taskbar_pinned, smriti_custom_shortcuts)
```

---

## 6. Read-Only Database Verification

- **`smriti_menus` Row Count:** 34 rows
- **`smriti_audit_log` Row Count:** 40 rows
- **Database State Mutations:** **ZERO (0 Mutations Verified)**
- **Audit Status:** **`AUDIT_COMPLETE`**
