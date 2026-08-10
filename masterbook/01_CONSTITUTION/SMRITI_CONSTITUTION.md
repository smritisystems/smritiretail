<!--
  SMRITI Retail OS — Masterbook
  Document  : 01_CONSTITUTION/SMRITI_CONSTITUTION.md
  Purpose   : Platform constitution — product philosophy, core rules, frozen contracts
  Status    : FROZEN (CON-001)
  Version   : 1.0.0  |  Created: 2026-08-10
  Copyright : © SMRITIBooks.com. All Rights Reserved.
-->

# SMRITI Constitution

> *"Simplicity is the highest form of enterprise software."*
> — Jawahar R. Mallah, Chief Systems Architect

---

## Founder's Design Promise

> **"A retailer should think about serving customers and selling products — not about which screen to open. SMRITI adapts to the business, so the business never has to adapt to the software."**

---

## Core Product Philosophy

| Principle | Statement |
|---|---|
| **One Workspace. Infinite Business Scenarios.** | A single workspace adapts to all retail business scenarios through policy, not duplication. |
| **Policy over Proliferation** | Business behavior is driven by policies and configuration — never by creating duplicate screens or modules. |
| **Configuration over Duplication** | Any behavior difference between business scenarios is achieved through configuration. |
| **Reuse Before Creation** | If an existing platform capability satisfies ≥70% of a requirement, it must be promoted and extended (PBC-001). |
| **Customer Workflow First** | Every feature decision starts with the retailer's workflow, not the software's convenience. |
| **Enterprise Power. Consumer Simplicity.** | The platform is enterprise-grade under the hood, consumer-simple at the surface. |

---

## Constitutional ADRs (FROZEN — CON-001)

The following ADRs form the SMRITI Developer Operating System Constitution and are **permanently frozen**. Direct edits, rewrites, or renumbering are strictly prohibited.

| ADR | Title |
|---|---|
| ADR-023 | Platform Kernel Independence (KND-001) |
| ADR-024 | Universal Platform Registry Architecture |
| ADR-025 | Single Workspace Principle (SWP-001) |
| ADR-026 | Authentication Design Standard (AUTH-001) |

---

## Single Workspace Principle (PROD-002 / SWP-001) — FROZEN

**There shall be exactly four universal workspaces:**

| Workspace | Studio ID | Business Domain |
|---|---|---|
| Billing Workspace | `sales-billing-studio` | Sales, Invoicing, POS |
| Purchase Workspace | `purchase-studio` | Purchase Orders, Receiving |
| Inventory Workspace | `item-master` | Products, Stock, Variants |
| Universal Person Workspace | `crm-studio` | Customers, Suppliers, Leads |

**Mandatory AI Decision Checklist:**
1. Can an existing Workspace adapt through Policy? → If YES: extend Policy Engine. Do NOT create a new module.
2. Will this create a duplicate menu, screen, master, or registry? → If YES: REJECT immediately.

---

## Authentication Design Standard (AUTH-001) — FROZEN

```
Authenticate User (username + password)
    ↓
Resolve Assigned Tenant
    ↓
Resolve Company  ──► Single company? Auto-select → Dashboard
    ↓               Multiple companies? Show selector
Resolve Branch
    ↓
Load Permissions (RBAC + ABAC via SPK.security)
    ↓
Open Workspace
```

**Rule:** Never ask for Company, Database, or Infrastructure selection on the login form.

---

## Platform Mode: PRODUCT MODE (MANDATORY)

**Rule PROD-001 — Customer Value Priority:**
> If a proposed change does not help a retailer **sell faster**, **buy better**, **manage inventory more accurately**, or **comply with regulations** — it is not a priority during Product Mode.

Architecture refactoring and non-essential infrastructure tasks are **prohibited** during Product Mode.

---

## Environment Rules

| Rule | Mandate |
|---|---|
| PROD-003 | Fresh production install: zero business transactions, zero master data |
| PROD-004 | Production / Demo / Training / Test / Dev must be completely isolated |
| PROD-005 | Every screen identifies the active environment persistently |
| PROD-006 | Offline/fallback session states must show `OfflineSessionBadge` — never masked |

---

## Platform Kernel Independence (KND-001) — FROZEN

`SPK.ule` and all platform kernel services must **never** depend on:
- React, Vue, or any UI framework
- DOM or browser-specific APIs
- UI components or renderers

The kernel exposes only: contracts, manifests, data, and capabilities.
All presentation concerns belong to the UI layer.

---

## Universal Platform Registry (UPR) Naming Matrix

| Abbreviation | Registry | SPK Facade |
|---|---|---|
| WNG | Workspace Navigation Governance | `SPK.navigation` |
| UFR | Universal Form Registry | `SPK.forms` |
| USR | Universal Security Registry | `SPK.security` |
| URR | Universal Report Registry | `SPK.reports` |
| UPRT | Universal Print Registry | `SPK.printing` |
| UWR | Universal Workflow Registry | `SPK.workflow` |
| UDR | Universal Dashboard Registry | `SPK.dashboard` |
| UAR | Universal AI Skill Registry | `SPK.ai` |

---

*Status: FROZEN — CON-001 | Version: 1.0.0 | 2026-08-10*
