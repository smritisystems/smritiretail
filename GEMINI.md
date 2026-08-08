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

## Rule PROD-003 – Production Data Integrity & Clean Installation (MANDATORY)

A fresh SMRITI Retail OS installation shall never preload business transactions or master data into a production database. Clean installation, upgrades, database restores, and multi-tenant provisioning must strictly maintain clean production boundaries. Production databases (`smriti_prod`) contain strictly system metadata (Company/Branch setup, Admin User, System Config, Roles, Permissions, Tax Rates, UOM, Currencies, Countries). Business masters (Customers, Suppliers, Items) and transactional ledgers (Invoices, POs, Payments, Stock) MUST start strictly empty (0 records). Demo, training, sample, and test data shall exist only in explicitly created, isolated environments and only when requested by the user.

## Rule PROD-004 – Environment Isolation (MANDATORY)

Production (`smriti_prod`), Demo (`smriti_demo`), Training (`smriti_training`), Test (`smriti_test`), and Development (`smriti_dev`) environments shall remain completely isolated. Business data, transactions, users, and ledgers shall never be shared automatically across environments. Every database profile shall record explicit metadata (`database_id`, `database_name`, `environment_type`, `is_demo`, `created_on`, `version`) and display its environment badge persistently on login screens and application headers. Any movement of data must occur only through explicit backup, restore, import, export, or migration operations.

## Rule PROD-005 – Environment Awareness (MANDATORY)

Every workspace screen, report, print template, exported data file, and API response MUST clearly identify the active execution environment (`PRODUCTION`, `DEMO`, `TRAINING`, `TEST`, `DEVELOPMENT`). Demo/Training documents and printouts MUST carry a persistent statutory watermark (`DEMO ENVIRONMENT - NOT FOR ACCOUNTING`). Environment types are immutable once provisioned, and production database deletion from application interfaces is strictly prohibited.

## Rule PROD-006 – Fallback Session Transparency & Offline Awareness (MANDATORY)

Whenever the platform operates in local mock, cached fallback, or offline bypass mode (e.g. `smriti_jwt_*`, `demo_*`, `token_demo`, `dev-bypass-token`), the UI MUST render a persistent `OfflineSessionBadge` component (`CACHED OFFLINE` / `DEMO SESSION`) alerting the user that API network calls are operating via local cache/mock provider. Silent masking of fallback session states is strictly prohibited.

### SMRITI Product Philosophy (Founder's Principle)
**By Jawahar R. Mallah**

> **"Simplicity is the highest form of enterprise software."**

**Design Promise**
> **"A retailer should think about serving customers and selling products—not about which screen to open. SMRITI adapts to the business, so the business never has to adapt to the software."**

**Core Philosophy**
- **One Workspace. Infinite Business Scenarios.**
- **Policy over Proliferation.**
- **Configuration over Duplication.**
- **Reuse before Creation.**
- **Customer Workflow First.**
- **Enterprise Power. Consumer Simplicity.**

**Founder Statement**
> **"Software should adapt to people—not force people to adapt to software. Every duplicate screen is a design failure; every unified workflow is a step toward simplicity. That is the philosophy behind SMRITI Retail OS."**
>
> — **Jawahar R. Mallah**

### Mandatory AI Decision Checklist:
1. **Can an existing Workspace adapt through Policy?** If YES, extend the Policy Engine (`CustomerPolicyEngine`, `SupplierPolicyEngine`, `PersonPolicyEngine`). Do NOT create a new module/screen.
2. **Will this create a duplicate menu, screen, master, or registry?** If YES, REJECT and redesign immediately.

## Rule AUTH-001 – SMRITI Authentication Design Standard (MANDATORY P0)

Always authenticate the **user first**. Never ask for Company, Database, or Infrastructure selection on login forms.
`Authenticate User ──► Resolve Assigned Tenant ──► Resolve Company ──► Resolve Branch ──► Load Permissions ──► Open Workspace`.
- **Single Assignment:** If user has access to 1 company/branch, auto-select and open dashboard (Zero Prompts).
## Rule AP-008 – Item Attribute Snapshot Governance (MANDATORY P0 — FROZEN)

String equality between Product attribute values and `MasterValue.name` does NOT constitute persistent identity linkage. `MasterValue` governs future item creation, Excel import validation, and selection dropdowns; `Product` retains its point-in-time historical item snapshot. Master lookup value updates MUST NOT retroactively mutate existing item attributes, SKUs, barcodes, or transaction document ledgers. E8 Edit-Time Synchronization is **CLOSED BY ARCHITECTURAL DESIGN**.

## Rule DOC-001 – Automatic Documentation Maintenance (MANDATORY P0)

AI agents must automatically append and synchronize all respective documentation files (`SYSTEM_TROUBLESHOOTING_LOG.md`, `CHANGELOG.md`, `AGENTS.md`, `GEMINI.md`, and architectural specs) whenever code changes, bug fixes, or design standards are implemented. Never wait for or ask the user for explicit instructions to update documentation.

---

### Key Takeaway
> **SMRITI Retail OS is built on an unshakable architectural foundation and a customer-first product philosophy. Guided by the Single Workspace Principle (PROD-002 / SWP-001), every business process is unified into a single adaptive workspace rather than fragmented across duplicate screens, menus, or modules.**
>
> **SMRITI adapts to the business—not the other way around. Retailers focus on running their business, while the platform intelligently applies the right policies, pricing, taxation, permissions, and workflows behind the scenes.**
>
> **One Workspace. Infinite Business Scenarios.**




