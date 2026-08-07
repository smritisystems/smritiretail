# Architecture Freeze Rule (AFR-001)

Once an architecture, governance framework, audit framework, or platform specification reaches FROZEN status, AI agents must not expand, duplicate, rename, or replace it without explicit approval. Future work must focus on evidence collection, implementation, validation, and audit closure.

## Required Workflow

1. Audit
2. Evidence
3. Finding
4. Severity
5. Backlog
6. Implementation
7. Verification
8. Close Finding
9. Update Audit Score

## Traceability Rule

Every implementation PR must reference at least one Audit ID (AUD-xxx) and one Finding ID (F-xxx). Changes without audit traceability should not be merged.

## Rule 15 – Promote Before Create (PBC-001)

If an existing platform capability satisfies at least 70% of the requirement, it must be promoted and extended rather than replaced with a new engine, registry, framework, or runtime.

Decision Workflow:
Evidence → Audit → Reuse → Extend → Promote → Merge → Rename → Create New (Last Resort)

## Rule 17 – Kernel Independence (KND-001)

SPK.ule and all platform kernel services must never depend on React, UI components, renderers, or DOM/browser-specific APIs. Kernel exposes strictly contracts, manifests, data, and capabilities. All presentation concerns belong to the UI layer.

## Rule 18 – Discovery Compliance (DCP-001)

Any module that introduces search, lookup, filtering, or record selection MUST integrate with SPK.ule. Custom procedural implementations or duplicate standalone search popups require an approved architecture decision record (ADR).

## Rule 19 – Navigation Registry Authority (NRA-001)

Every navigation surface (Sidebar, Launchpad, Global Search, Breadcrumbs, Favorites, Recents, Workspace Switcher, Command Palette) MUST derive its module metadata from SPK.navigation. UI components may render navigation metadata but must not redefine module identity, hierarchy, permissions, or visibility.

## Architecture Freeze Rule (AFR-002)

SMRITI Enterprise SaaS Architecture v1.4 is the frozen architectural baseline. No new architectural capabilities, hierarchy changes, or platform redesign may be introduced until the Runtime Certification (Phases A–G) is successfully completed. During this period, engineering work is limited to implementation completion, bug fixes, security hardening, performance optimization, testing, documentation, and production certification. All future architectural ideas must be recorded in the **Future Architecture Backlog (v2.x+)** and deferred until after the first production release.

## Rule 20 – Navigation Contract Stability (NCS-001)

Public SPK.navigation APIs are Level-1 Platform Contracts. Breaking changes require an Architecture Decision Record (ADR), backward compatibility assessment, migration guidance, and version increment. Internal implementations may evolve, but public contracts must remain stable.

## Rule CON-001 – Constitution Freeze

The SMRITI Developer Operating System Constitution (`ADR-023`, `ADR-024`, `ADR-025`, `ADR-026`) is permanently FROZEN. Direct edits, rewrites, or renumbering of these constitutional ADRs are strictly prohibited. Platform evolution transitions 100% to Product Mode (Business Capabilities, Domain Packs, and Implementation Specifications / IPS).

## Rule PROD-001 – Customer Value Priority (MANDATORY)

If a proposed change does not help a retailer sell faster, buy better, manage inventory more accurately, or comply with regulations, it is not a priority during Product Mode. Architecture refactoring and non-essential infrastructure tasks are prohibited.

## Rule PROD-002 – Single Workspace Principle (SWP-001 — MANDATORY)

There shall be exactly one Billing Workspace (`sales-billing-studio`), one Purchase Workspace (`purchase-studio`), one Inventory Workspace (`item-master`), and one Universal Person Workspace (`crm-studio`). Business behavior MUST be determined by policies, customer/supplier profiles, document type, and configuration—NOT by duplicate screens, menus, or modules.

### SMRITI Product Philosophy (Founder's Principle)
**By Jawahar R. Mallah**

> **"Simplicity is the highest form of enterprise software."**
>
> **There shall be exactly one Billing Workspace, one Purchase Workspace, one Inventory Workspace, and one Universal Person Workspace. Business behavior shall be determined by policies, customer/supplier profiles, document type, and configuration—not by duplicate screens, menus, or modules.**
>
> **Every new capability must extend the platform, never fragment it. The software adapts to the business; the user should not have to choose between multiple versions of the same workflow.**

### Core Values
- **One Workspace, Many Behaviors**
- **Policy over Proliferation**
- **Configuration over Duplication**
- **Reuse before Creation**
- **Customer Workflow First**
- **Enterprise Power, Consumer Simplicity**

### Mandatory AI Decision Checklist:
1. **Can an existing Workspace adapt through Policy?** If YES, extend the Policy Engine (`CustomerPolicyEngine`, `SupplierPolicyEngine`, `PersonPolicyEngine`). Do NOT create a new module/screen.
2. **Will this create a duplicate menu, screen, master, or registry?** If YES, REJECT and redesign immediately.


