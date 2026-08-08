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
  Classification: Internal Architecture Book Reference
-->

# SMRITI Digital Commerce Platform Architecture Book (v2.0 Canonical Reference)

**Status:** FROZEN — Platform Architecture Reference Book v2.0 (2026-08-04)
**Scope:** Canonical Reference for Platform OS, Shared Kernels, Universal Registries, & Business Studios

---

## Volume 1 — Platform Operating System & UX Architecture

### 1. SXP (Studio Experience Platform v1.0)
- **Role:** Core application execution framework, dynamic module loader, and lifecycle manager.
- **Contract:** Immutable platform baseline (SXP-CS-001 through SXP-CS-010).

### 2. SEEF (Experience & Theme Engine v1.0)
- **Role:** 5-tier theme engine supporting Light, Dark Obsidian, SAP Fiori Lite, and High Contrast.
- **Contract:** Level 3 Semantic Component Tokens (SCT v1.0 / `smriti-semantic-tokens.css`). 12 SEEF Certification Gates (`SEEF-001` to `SEEF-012`). Zero undefined CSS variables.

### 3. SEDS (Smriti Enterprise Design System)
- **Role:** Reusable UI primitive library (Buttons, Dialogs, Tables, Toolbars, Badges).
- **Patterns:** Standardized List Report Pattern and Object Page Pattern.

### 4. WNG (Workspace Navigation Governance v1.0)
- **Role:** Enterprise 5-Level Navigation Hierarchy (WNG-002 through WNG-005).
- **Structure:** Single persistent left sidebar scoped strictly to active business domain.

---

## Volume 2 — Shared Platform Kernels & Universal Registries

### 1. Shared Platform Kernels
- **Inventory Kernel v1.0:** Immutable stock movement ledger, optimistic version locking, bin routing.
- **SDK Document Kernel v1.0:** Universal document lifecycle state machine (`Draft` $\rightarrow$ `Submitted` $\rightarrow$ `Approved` $\rightarrow$ `Posted` $\rightarrow$ `Archived`).
- **SBPK Printing Kernel v1.0:** 1D/2D barcode generation, ESC/POS Thermal, ZPL II, PDF/A, QZ Tray bridge.
- **SIK Integration Kernel v1.0:** Statutory GSTN sync, Tally XML sync, WhatsApp Business API, weighing scale HID drivers.
- **SPPK Pricing Kernel v1.0:** Price lists, BOGO, Mix & Match, Happy Hours, promo coupons.

### 2. Universal Registries (UPR Facade)
- **UFR:** Universal Form Registry (`SPK.forms`) — Metadata-driven forms.
- **UWR:** Universal Workflow Registry (`SPK.workflow`) — Entity state machines & transition locks.
- **URR:** Universal Report Registry (`SPK.reports`) — Analytical query engine & exporters.
- **USR:** Universal Security Registry (`SPK.security`) — ABAC authorization & tenant isolation.
- **UPRT:** Universal Print Registry (`SPK.printing`) — Print layout schemas.

---

## Volume 3 — Certified Enterprise Business Studios

Each business studio follows a uniform 6-dimensional certification model (`Dimension 1: Workflow`, `Dimension 2: Technical`, `Dimension 3: UX/SEEF`, `Dimension 4: Security`, `Dimension 5: Reliability`, `Dimension 6: Production`):

1. **Inventory Studio:** Stock ledgers, bin management, cycle counts (`10 Workspaces`).
2. **Purchase Studio:** Procurement, PO approvals queue, 3-way match (`6 Workspaces`).
3. **Sales Studio:** Order-to-Cash, tax invoices, customer credit limits (`8 Workspaces`).
4. **POS Studio:** Touch checkout, multi-tenders, thermal receipts, cash drawer (`6 Workspaces`).
5. **CRM Studio:** Customer 360 (14 Tabs), loyalty tiers, Customer Wallet, campaigns (`10 Workspaces`).
6. **Accounting Studio:** Chart of Accounts, GST Center, P&L, Balance Sheet (`10 Workspaces`).
7. **Warehouse Studio:** Dock receiving, directed put-away, wave picking (`10 Workspaces`).
8. **Merchandising Studio:** Assortment planning, buying calendar, clearance markdowns (`8 Workspaces`).
9. **Pricing & Promotion Studio:** Store price lists, BOGO, happy hour rules (`8 Workspaces`).
