# ADR-022: SMRITI Platform Control Center (SPCC) Enterprise Governance Standard v1.0

**Status:** FROZEN — v1.0 (2026-08-06)  
**Author:** Jawahar Ramkripal Mallah (Chief Systems Architect & Creator)  
**Classification:** Level 1 Architecture Decision Record  
**Supersedes:** N/A  

---

## Context & Problem Statement

As SMRITI Retail OS grows to incorporate hundreds of modules, thousands of screens, dynamic RBAC permission matrices, F2 search registries, AI intents, and custom workspace layouts, the platform requires a centralized, enterprise-grade command center. Without a single control surface, modules risk becoming inaccessible due to missing navigation menus, dead routes, orphan workspaces, or unindexed search aliases.

However, introducing an administrative studio must not violate the core kernel architecture baseline (**SMRITI Enterprise SaaS Architecture v1.4**), nor create duplicate procedural logic or standalone data stores.

---

## Scope & Architectural Boundary

### What This ADR Governs:
- ✅ **Platform Governance**: Metadata contracts, manifest staging, version compatibility, and health scoring.
- ✅ **Navigation Governance**: Module identity, domain hierarchy, sidebar menus, and route registration.
- ✅ **Registry Governance**: Registry completeness matrix, capability mapping, and search indexing.
- ✅ **Certification Governance**: Platform Doctor auto-repair, drift detection, and release readiness gates.

### What This ADR Does NOT Govern:
- ❌ **Business Domain Logic**: Custom pricing, tax calculation rules, or retail workflow execution.
- ❌ **Database Schemas**: PostgreSQL entity tables, migration scripts, or foreign keys.
- ❌ **Runtime Execution**: Component rendering pipelines, HTTP API routing, or WebSocket sessions.
- ❌ **Industry-Specific Functionality**: Specific restaurant, medical, or jewellery features.

---

## Architectural Glossary & Terminology

| Term | Full Name | Governance Role |
| :--- | :--- | :--- |
| **SPCC** | SMRITI Platform Control Center | **Platform Control Plane** (Metadata management, health audits, certification) |
| **SPK** | SMRITI Platform Kernel | **Platform Execution Plane** (Runtime event dispatch, security, core services) |
| **UPR** | Universal Platform Registry | Central metadata facade for Navigation, Forms, Security, Reports & AI |
| **BCR** | Business Capability Registry | 5-Tier lifecycle & full-stack traceability registry for retail features |
| **BPR** | Business Process Registry | End-to-end business workflow certification registry |
| **Platform Manifest** | `PlatformManifest` JSON | Declarative canonical contract governing all platform configurations |
| **Smriti Communicator** | Integration Bridge | Two-way synchronization bridge between SMRITI OS and Accounting Systems |

---

## Architecture Decision & Governance Constitution

It is decided that **SMRITI Platform Control Center (SPCC)** is established as the official enterprise **Platform Control Plane** for SMRITI Retail OS.

### The Golden Principle (SPCC-GOV-001)
> **SPCC must never become another kernel. SPCC is the Platform Control Plane. SPK remains the Platform Execution Plane.**

SPCC does **not** own data. It reads from and mutates metadata via Level 1 **SMRITI Platform Kernel (SPK)** Registry APIs using a declarative **Platform Manifest (`PlatformManifest`)** contract.

---

## Key Governance Rules

### Rule 1: Control Plane vs. Execution Plane (SPCC-GOV-002)
- **SPCC (Control Plane):** Renders administrative controls, performs health audits, calculates impact analysis, validates configuration rules, and edits the Platform Manifest.
- **SPK (Execution Plane):** Executes runtime operations, enforces RBAC permissions, routes navigation events, and serves UI components.

### Rule 2: Role-Based Management Modes (SPCC-GOV-003)
SPCC enforces strict access tiering:
1. `Observer`: Read-only viewing of health reports and telemetry.
2. `Auditor`: Read-only access to compliance audits, permission matrices, and data model traceability.
3. `Administrator`: Modifies menus, feature flags, configuration, and search aliases.
4. `Platform Architect`: Full control including module install/uninstall, dependency tree edits, and platform manifest publication.

### Rule 3: Design-Time vs. Live Runtime Separation (SPCC-GOV-004)
SPCC strictly isolates **Design-Time** capabilities (Modules, Features, Menus, Routes, Configurations, Permissions) from **Live Runtime** diagnostics (Memory, Event Bus, Queue, Telemetry, Active Sessions).

### Rule 4: Pre-Save Impact Analysis Engine (SPCC-GOV-005)
Before committing any changes (such as hiding a module or disabling a feature), SPCC executes an impact assessment detailing affected roles, dashboards, search aliases, favorites, and dependent modules.

### Rule 5: Safe Mode & Versioned Snapshots (SPCC-GOV-006)
Every published change creates a versioned snapshot (`PlatformSnapshot`). Administrators can instantly execute a 1-click rollback (`Restore Last Published`) if invalid configurations are introduced.

### Rule 6: Pre-Publish Validation Engine (SPCC-GOV-007)
SPCC prohibits publishing configurations that contain:
- Duplicate routes or duplicate menus
- Circular module dependencies
- Missing workspace targets or unmapped components
- Hidden parent menus with visible child screens
- Broken search aliases or orphan features

### Rule 7: Declarative Platform Manifest Contract (SPCC-GOV-008)
All platform navigation, route, menu, RBAC, search, AI intent, and module metadata is serialized into a single canonical `PlatformManifest` JSON schema.

### Rule 8: Event-Driven Update Bus (SPCC-GOV-009)
Mutations in SPCC emit SPK system events (`MenuUpdated`, `PlatformManifestPublished`, `PermissionCacheRefreshed`). Presentation components reactively update via event subscribers without page reloads.

### Rule 9: Plugin Auto-Registration (SPCC-GOV-010)
Core platform modules, marketplace extensions, and industry packs auto-register with UPR/SPK without requiring manual code modifications in UI components.

### Rule 10: 13-Category Platform Integrity Audit (SPCC-GOV-011)
The Platform Integrity Auditor calculates a weighted health score across 13 distinct platform dimensions:
`Kernel`, `Navigation`, `Modules`, `Routes`, `Permissions`, `Search`, `Workspace`, `Licensing`, `Telemetry`, `Performance`, `UX`, `Accessibility`, and `Security`.

### Rule 11: Registry Completeness Rule (SPCC-GOV-012 — MANDATORY)
No module can be marked **Production Ready** unless it satisfies the 11-point Registry Completeness Matrix:
1. ✅ Module registered in UPR
2. ✅ Features registered
3. ✅ Navigation menu registered
4. ✅ Active route registered
5. ✅ RBAC permission scope mapped
6. ✅ F2 Search aliases indexed
7. ✅ Workspace component assigned
8. ✅ License tier mapped
9. ✅ Telemetry enabled & Health score ≥ 95%
10. ✅ Business Capability Registry (BCR) mapped
11. ✅ Business Process Registry (BPR) mapped (when applicable)

### Rule 12: Manifest Staging & Lifecycle Workflow (SPCC-GOV-013)
Platform Manifest updates MUST execute through a strict 6-stage lifecycle:
`Draft Manifest` ➔ `Validate` ➔ `Impact Analysis` ➔ `Approve` ➔ `Publish` ➔ `Snapshot` ➔ `Activate`.

### Rule 13: One-Click Platform Doctor (SPCC-GOV-014)
SPCC includes an automated **Platform Doctor Engine** (`repairPlatform()`) capable of repairing broken routes, re-linking orphan workspaces, auto-generating missing search aliases, and syncing permission scopes with a single click.

### Rule 14: Platform Drift Detection (SPCC-GOV-015 — MANDATORY)
After deployment, SPCC executes `detectPlatformDrift()` to compare the canonical `PlatformManifest` against live runtime registries, workspace definitions, and permission stores. Any divergence is flagged immediately as **Configuration Drift**.

### Rule 15: Registry Version Compatibility (SPCC-GOV-016)
All platform registries (`NavigationRegistry`, `ManifestSchema`, `WorkspaceRegistry`, `PermissionRegistry`) must declare schema semantic versions. Publishing is blocked if version incompatibility is detected.

### Rule 16: Platform Governance Boundary (SPCC-GOV-017 — MANDATORY)
SPCC shall govern metadata, configuration, certification, and platform integrity only. Business transactions, master data, and operational records shall remain under their respective domain services. SPCC shall never become a transactional subsystem.

### Rule 17: Operational Accounting Boundary (SMRITI-ACC-001 — MANDATORY)
SMRITI Retail OS shall not duplicate enterprise financial accounting capabilities. SMRITI Retail OS is strictly the **Operational System of Record**. Financial accounting, statutory books, Trial Balance, P&L, and final accounts shall be delegated to supported external accounting platforms (TallyPrime, Busy, Marg ERP, Zoho Books, SAP) through the **Smriti Communicator** integration layer. SMRITI Retail OS may expose operational financial summaries (Today's Sales, Cash Position, Customer/Supplier Outstanding, Gross Margin) for real-time decision support; however, such operational summaries shall not constitute statutory books of account.

#### Domain Responsibility Breakdown:
- **SMRITI Retail OS Owns (Operations Plane):** Sales, Purchase, Inventory, POS, CRM, Pricing, Promotions, Loyalty, Warehouses, Barcode Printing, Serial/Batch Tracking, Cash Registers, Store Expenses, Petty Cash, Day Closing, Transactional GST, Customer Outstanding, Supplier Outstanding.
- **External Accounting Systems Own (Financial Plane):** Journal Vouchers, Contra Vouchers, General Ledger, Trial Balance, Balance Sheet, Profit & Loss (P&L), Cash Flow, Cost Centers, Depreciation, Final Accounts, Statutory GST Filing, Financial Audit Books.

### Rule 18: Accounting Event Synchronization Contract (SMRITI-ACC-002 — MANDATORY)
Operational events created within SMRITI Retail OS are the single immutable system of record. Financial accounting entries are synchronization artifacts generated downstream by accounting adapters. Core retail modules MUST NEVER generate financial journal vouchers directly; they emit business events (Sales Invoices, GRNs, Cashier Closings) which **Smriti Communicator** transforms into accounting entries for external accounting packages.

---

## The Four Constitutional Principles

```text
┌────────────────────────────────────────────────────────────────────────┐
│ PRINCIPLE 1: SPCC  ──► Platform Control Plane (Metadata & Governance) │
│ PRINCIPLE 2: SPK   ──► Platform Execution Plane (Runtime Engine)       │
│ PRINCIPLE 3: SMRITI ──► Operational System of Record (Business Events) │
│ PRINCIPLE 4: ACC   ──► Financial System of Record (Accounting Books)   │
└────────────────────────────────────────────────────────────────────────┘
```

---

## Vendor-Agnostic Operational Workflow & Integration Architecture

```text
SMRITI Retail OS (Operational System of Record)
 ├── Sales & Billing Domain
 ├── Purchase & Sourcing Domain
 ├── Inventory & Warehouse Domain
 └── POS Checkout & Cash Register Domain
 │
 │ [Emits Immutable Business Events: Invoices, Receipts, GRNs, Day Closings]
 │
 ▼
 Smriti Communicator (Two-Way Synchronization Bridge)
 │
 ▼
 Accounting Adapter Matrix
 ├── TallyPrime Adapter
 ├── Busy ERP Adapter
 ├── Zoho Books Adapter
 └── SAP / Enterprise Adapter
 │
 ▼
 External Financial Accounting System (Financial System of Record)
 └── General Ledger, Trial Balance, P&L, Balance Sheet, Statutory Audit Books
```

---

## Architecture Freeze Status

**Status:** FROZEN — v1.0 Baseline Certified.  
No further structural or procedural changes are permitted to SPCC governance without an approved Architecture Decision Record (`docs/adr/ADR-xxx.md`). Future engineering focus shifts to registering, auditing, certifying, and discovering existing business modules.
