<!--
  Project      : SMRITI Retail OS
  Organization : SmritiSys
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.29.0
  Created      : 2026-07-06
  Modified     : 2026-07-19
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# SMRITI UI & Agent Verification Governance Rules

**Status:** FROZEN — v1.1 (2026-07-06)
**Supersedes:** `AGENTS_ADDENDUM.md`, which is now fully merged into Rules 7—10 below and should be deleted from `.agents/`. Its Rule 8 specified a binary Done/Unverified status; that conflicted with this document's four-state system (Rule 7) and is resolved in favor of the four-state system here.

To prevent unverified or phantom claims of code completion and testing, all coding assistant agents MUST follow these strict rules before declaring a task "done" or reporting test results:

## 1. Verifiable Code Diffs (MANDATORY)
For every file modified, created, or deleted, you MUST run a git diff and paste the literal `git diff` output for that exact file.
- Do NOT paraphrase the diff in prose.
- If a file is claimed to be modified but no diff can be produced, state that it was not actually committed or changed.
- For a **newly created** file: plain `git diff` shows nothing for an untracked file. Run `git add -N <file>` (or `git add <file>`) first, then paste the `git diff` or `git diff --cached` output so the actual content is shown.
- For a **deleted** file: state explicitly whether the pasted diff is staged (`git diff --cached`) or unstaged (`git diff`), and paste whichever reflects the current state of the working tree.
- Empty `git diff` output on a file you claim to have created or deleted is not evidence of anything â€” it usually means the file is untracked or the wrong diff command was used, not that there's nothing to show.

## 2. Literal Terminal Test Outputs
Do not summarize test results in tables or bullet points (e.g., "9/9 passed") without providing the literal terminal output of the test run.
- Paste the exact command executed.
- Paste the literal stdout and stderr returned by the test runner.

## 3. Mandatory Validator/Linter Re-run
After editing any file, you must run the relevant validator or linter script (e.g. `validate_tokens.py` for CSS/style changes) and paste the exact console output of the linter execution.
- If no linter exists for the modified file type, state so explicitly.

## 4. Measurement Evidence for Metrics
Do not claim metrics (e.g. "80% query reduction", "0 console errors") unless you provide the exact before-and-after measurements taken.
- If a metric was not measured, do not state a percentage or integer; describe the qualitative changes instead.

## 5. Verify Prior Session Claims
Do not build on top of a previous session summary's claims without first inspecting the actual codebase to verify those claims are true.
- The inspection itself must be shown, not just asserted: paste the command run (e.g. `grep`, `cat`, `git log`) and its literal output confirming or contradicting the prior claim.
- "I checked and confirmed X" with no shown command/output does not satisfy this rule â€” it is the same unverified-claim pattern this rule exists to prevent, one level removed.

## 6. Granular and Enumerated Scope
Do not summarize file changes under high-level descriptions (e.g., "fixed the whole module" or "updated all templates") unless you list every single affected file and confirm the changes for each one individually.

## 7. Explicit Verification Status (MANDATORY)
Every task, file, or claim must be labeled with exactly one of these four objective status values â€” nothing else:
```
Done                 â€” change made, verified with evidence per Rules 1â€“4
Failed                â€” change attempted, verification shows it did not work
Partially Verified    â€” some evidence gathered, some claims still unconfirmed
Unverified            â€” claimed, but no evidence has been gathered yet
```
These are states, not opinions â€” they describe what was checked, not how good the result is. Do not substitute a different word for these four. Do not round up a Partially Verified or Unverified item to Done.

## 8. Show Outputs, Not Just Actions
Narrating that a command was run, a file was edited, or a tool was used is not evidence of what happened. Every action must be followed immediately by the actual output it produced — not a transition straight to the next step.
- "Ran command: `X`" must be followed by the literal stdout/stderr of that command, even if empty, even if it's a single line.
- "Edited `file.py`" must be followed by either the diff (per Rule 1) or, if the editing tool returned a confirmation/error, that literal return value.
- "Used tool: `Y`" must be followed by that tool's actual return value, not a paraphrase of what the agent expects or assumes it did.
- A sequence of "Ran command... Edited... Ran command..." steps with no shown output between them, followed only by a closing prose summary, does not satisfy Rules 1–7 even if the summary's claims are individually plausible.

## 9. Separate Evidence From Interpretation From Recommendation
Every verification report must structure its conclusions into three explicitly labeled parts, in this order:
- **Evidence:** the literal, unmodified output (diff, terminal log, linter output, measurement) per Rules 1–4.
- **Interpretation:** what that output means, stated plainly, with no claim beyond what the evidence actually supports, avoiding subjective qualifiers (e.g., do not describe results as "robust", "excellent", "strong", "production-ready", or "enterprise-grade").
- **Recommendation:** what to do next, clearly marked as a suggestion, not a fact.
- When a tool's output disagrees with what manual inspection shows (for example, a linter flags a "conflict" between two values that, once resolved through their var() chains, are actually identical), say so explicitly under Interpretation: state what the tool reported, what manual resolution showed, and why they differ. Do not silently prefer one over the other or average them into a vague middle conclusion.
- A Recommendation must never be phrased as if it were Evidence. "This should be reviewed before expanding scope" is a Recommendation. "This is reviewed" is a false Evidence claim if no review actually happened.


## 10. Evidence Policy (MANDATORY)
Every completion claim must be backed by directly observable evidence. If evidence is unavailable, the agent must report the status as "claimed but unverified" rather than marking it complete.

## 11. Workspace UI Navigation Governance (WNG-002)
1. **Single Purpose Screens**:
   - **Login**: Authenticates user identity.
   - **Launchpad**: Renders ONLY authorized application domain tiles (Max 12 tiles).
   - **Workspace**: Single-domain operational workspace.
   - **Dashboard**: Analytic views shown ONLY when user explicitly enters that application.
2. **Role-Based Dynamic Generation**:
   - Launchpad tiles MUST be generated dynamically from backend RBAC permission scopes.
   - Disabled/greyed-out application tiles MUST NOT be rendered.
3. **Consistent UI Structure**:
   - Master entities MUST implement the **Object Page Pattern** (Fixed summary header + horizontal tabs).
   - Transaction domains MUST implement the **List Report Pattern** (Filter bar + Search + Actionable Data Table).
4. **Single Persistent Sidebar & Filter Drawer Architecture (WNG-003 — MANDATORY)**:
   - Primary navigation belongs exclusively to the main left sidebar. Workspaces MUST NEVER render a second persistent navigation sidebar.
   - UI regions MUST adhere strictly to clear architectural roles:
     - **Primary Navigation**: Left sidebar ONLY.
     - **Workspace Navigation**: Top tabs.
     - **Filtering & Quick Views**: Slide-out drawer, collapsible filter panel, or top filter bar.
     - **Actions**: Top toolbar.
     - **Content**: Main grid / list workspace.
   - Domain filtering (such as Master Registry trees, Categories, Brands, Quick Views) MUST be implemented as a toggleable slide-out filter drawer or collapsible filter bar, granting 100% horizontal width to content when closed.
5. **Enterprise Context-Aware Domain Navigation Model (WNG-004 — MANDATORY)**:
   - Navigation MUST adhere strictly to the 5-Level Enterprise Navigation Hierarchy:
     `Level 1 (Launchpad) ──► Level 2 (Business Domain) ──► Level 3 (Business Module) ──► Level 4 (Workspace Tabs) ──► Level 5 (Task / Form Inspector)`.
   - **Context-Aware Left Sidebar**: The left navigation sidebar MUST NEVER display all system modules simultaneously. It MUST render exclusively the modules belonging to the currently active business domain (e.g. Sales, Purchase, Inventory, Accounting, CRM, Reports).
   - **Domain Switching**: Selecting or switching business domains (via Launchpad or Domain Switcher) immediately updates the left sidebar to show only that domain's modules.
   - **Module Workspace Scoping**: Workspace top tabs belong exclusively to the selected module (e.g., Master Registry, Spreadsheet Studio, Dynamic Attributes, Variant Templates, Analytics).
6. **Declarative UPR Navigation Architecture (WNG-005 — MANDATORY)**:
   - Navigation MUST NEVER be constructed procedurally or using hardcoded `if (domain === "...")` branches in UI components.
   - All domain metadata, icons, emojis, ordering, permissions, feature flags, and module relationships MUST be declared through metadata in the Universal Platform Registry (`UPR` / `SPK.navigation`).
   - Renderer components MUST act strictly as generic consumers of UPR metadata facade (`SPK.navigation.getSidebar(activeDomain)`).
   - Plugins and Industry Packs (e.g. Manufacturing, Restaurant, Medical, Jewellery) MUST extend navigation by registering domain metadata with UPR without modifying React UI component code.
7. **Navigation Standard v1.0 Status (FROZEN)**:
   - Rules `WNG-001` through `WNG-005` are officially **FROZEN v1.0**.
   - No structural or procedural changes to navigation are permitted without an approved Architecture Decision Record (`docs/adr/ADR-xxx.md`).
8. **Universal Platform Registry (UPR) Capability Naming Matrix**:
   - `WNG`: Workspace Navigation Governance (`SPK.navigation`)
   - `UFR`: Universal Form Registry (`SPK.forms`)
   - `USR`: Universal Security Registry (`SPK.security`)
   - `URR`: Universal Report Registry (`SPK.reports`)
   - `UPRT`: Universal Print Registry (`SPK.printing`)
   - `UWR`: Universal Workflow Registry (`SPK.workflow`)
   - `UDR`: Universal Dashboard Registry (`SPK.dashboard`)
   - `UAR`: Universal AI Skill Registry (`SPK.ai`)

## 12. Universal Form Registry Governance (UFR Standard v1.0 — FROZEN)
1. **Metadata-Driven Forms Only (UFR-001 — MANDATORY)**:
   - Forms MUST NEVER be constructed as handcrafted TSX forms. All form sections, field spans, and labels MUST be declared in UPR metadata (`FormRegistry` / `SPK.forms`).
2. **Universal Entity Definition Framework (UFR-002 — MANDATORY)**:
   - Business entities, fields, data types, and primary keys MUST be defined exclusively in `EntityRegistry` (`UEDF` / `SPK.entities`).
3. **Registry-Driven Field Control Resolution (UFR-003 — MANDATORY)**:
   - UI input controls MUST be resolved exclusively through `FieldRegistry` (`SPK.fields.getFieldControl()`). Handcrafted `switch(field.type)` statements in UI components are strictly prohibited.
4. **Centralized Validation Engine Execution (UFR-004 — MANDATORY)**:
   - Form validation rules (required, min, max, email, GSTIN, PAN, mobile, custom) MUST execute exclusively through `ValidationRegistry` (`SPK.validation`).
5. **Declarative Layout Grid Resolution (UFR-005 — MANDATORY)**:
   - Form and section responsive grid spans and column breakpoints MUST be resolved exclusively through `LayoutRegistry` (`SPK.layouts`).
6. **Business-Agnostic Renderer Component (UFR-006 — MANDATORY)**:
   - `UniversalFormRenderer` MUST remain 100% generic and contain zero domain-specific or hardcoded business logic.
7. **UFR Standard v1.0 Status (FROZEN)**:
   - Rules `UFR-001` through `UFR-006` are officially **FROZEN v1.0**.

## 13. Universal Security Governance (USR Standard v1.0 — FROZEN)
1. **Permission Definitions (USR-001 — MANDATORY)**:
   - All permissions MUST be defined in `PermissionRegistry` (`SPK.security.permissions`). Handcoded permission string assertions in UI components are strictly prohibited.
2. **Role Hierarchy & Inheritance (USR-002 — MANDATORY)**:
   - Roles and parent role inheritance MUST be declared in `RoleRegistry` (`SPK.security.roles`).
3. **Attribute-Based Policy Authorization (USR-003 — MANDATORY)**:
   - ABAC authorization rules MUST execute through `PolicyRegistry` (`SPK.security.policies`).
4. **Licensing & Feature Enablement (USR-004 — MANDATORY)**:
   - Platform editions and feature flag enablement MUST be verified via `LicenseRegistry` (`SPK.security.licenses`).
5. **Tenant Isolation & Metadata (USR-005 — MANDATORY)**:
   - Multi-tenant organization metadata MUST be resolved via `TenantRegistry` (`SPK.security.tenants`).
6. **Security Audit Logging (USR-006 — MANDATORY)**:
   - Security access decisions MUST be logged to `AuditRegistry` (`SPK.security.audit`).
7. **Single Authorization Entry Point (USR-007 — MANDATORY)**:
   - All workspace access decisions MUST execute exclusively through `SPK.security.evaluateAccess()`.
8. **USR Standard v1.0 Status (FROZEN)**:
   - Rules `USR-001` through `USR-007` are officially **FROZEN v1.0**.

## 14. Universal Configuration Governance (UCR Standard v1.0 — FROZEN)
1. **Branding Metadata Ownership (UCR-001 — MANDATORY)**:
   - Corporate identity, app logos, themes, and titles MUST be owned by `BrandingRegistry` (`SPK.configuration.branding`).
2. **Regional Formatting Ownership (UCR-002 — MANDATORY)**:
   - Currency symbols, date formats, timezones, and number formatting MUST be owned by `RegionalRegistry` (`SPK.configuration.regional`).
3. **Preference Scope Isolation (UCR-003 — MANDATORY)**:
   - User, tenant, and workspace preferences MUST be resolved via `PreferenceRegistry` (`SPK.configuration.preferences`).
4. **Environment & Runtime Metadata (UCR-004 — MANDATORY)**:
   - Runtime configuration and API endpoints MUST be owned by `EnvironmentRegistry` (`SPK.configuration.environment`).
5. **Central Configuration Facade (UCR-005 — MANDATORY)**:
   - All configuration access across platform workspaces MUST execute exclusively through `SPK.configuration`.
6. **Immutable Execution Context (UCR-006 — MANDATORY)**:
   - `PlatformContext` MUST remain read-only and immutable for the duration of a request.
7. **UCR Standard v1.0 Status (FROZEN)**:
   - Rules `UCR-001` through `UCR-006` are officially **FROZEN v1.0**.

## 15. Universal Workflow Governance (UWR Standard v1.0 — FROZEN)
1. **Metadata-Driven Workflows (UWR-001 — MANDATORY)**:
   - All entity state machines, states, and transition flows MUST be declared in UPR metadata (`WorkflowRegistry` / `SPK.workflow`).
2. **Single Transition Execution Entry Point (UWR-002 — MANDATORY)**:
   - State transitions MUST execute exclusively through `SPK.workflow.executeTransition()`.
3. **Delegated Security Authorization (UWR-003 — MANDATORY)**:
   - Workflow transition role and permission checks MUST delegate exclusively to `SPK.security`.
4. **Delegated Validation Engine (UWR-004 — MANDATORY)**:
   - Pre-transition business rule validations MUST delegate exclusively to `SPK.validation`.
5. **Immutable Context Enforcement (UWR-005 — MANDATORY)**:
   - Workflow execution MUST consume immutable `PlatformContext`.
6. **No Custom Workflow Engines (UWR-006 — MANDATORY)**:
   - Retail business modules MUST NOT implement custom procedural workflow engines or state switch statements.
7. **UWR Standard v1.0 Status (FROZEN)**:
   - Rules `UWR-001` through `UWR-006` are officially **FROZEN v1.0**.

## 16. Universal Report Governance (URR Standard v1.0 — FROZEN)
1. **Metadata-Driven Reports Only (URR-001 — MANDATORY)**:
   - All report definitions, parameters, and analytical columns MUST be declared in UPR metadata (`ReportRegistry` / `SPK.reports`).
2. **Single Execution Entry Point (URR-002 — MANDATORY)**:
   - Reports MUST execute exclusively through `SPK.reports.executeReport()`.
3. **Delegated Security Authorization (URR-003 — MANDATORY)**:
   - Report permissions and user access MUST delegate exclusively to `SPK.security`.
4. **Delegated Parameter Validation (URR-004 — MANDATORY)**:
   - Report parameter validation MUST delegate exclusively to `SPK.validation`.
5. **Immutable Context Enforcement (URR-005 — MANDATORY)**:
   - Report execution MUST consume immutable `PlatformContext`.
6. **Delegated Exporter Engine (URR-006 — MANDATORY)**:
   - PDF, Excel, CSV, and JSON export rendering MUST be delegated to registered exporter engines.
7. **URR Standard v1.0 Status (FROZEN)**:
   - Rules `URR-001` through `URR-006` are officially **FROZEN v1.0**.

## 17. Universal Print Governance (UPRT Standard v1.0 — FROZEN)
1. **Metadata-Driven Templates (UPRT-001 — MANDATORY)**:
   - Print templates, layout schemas, and paper size profiles MUST be declared in UPR metadata (`PrintRegistry` / `SPK.printing`).
2. **Single Rendering Execution Entry Point (UPRT-002 — MANDATORY)**:
   - Print document rendering MUST execute exclusively through `SPK.printing.renderDocument()`.
3. **Automated Placeholder Data Binding (UPRT-003 — MANDATORY)**:
   - Dynamic parameter substitution MUST be executed by the print engine.
4. **Delegated Security Authorization (UPRT-004 — MANDATORY)**:
   - Template printing permissions MUST delegate exclusively to `SPK.security`.
5. **Immutable Context Enforcement (UPRT-005 — MANDATORY)**:
   - Document rendering MUST consume immutable `PlatformContext`.
6. **Delegated Renderers (UPRT-006 — MANDATORY)**:
   - Output generation (Thermal ESC/POS, HTML, PDF, ZPL) MUST be delegated to registered renderers.
7. **UPRT Standard v1.0 Status (FROZEN)**:
   - Rules `UPRT-001` through `UPRT-006` are officially **FROZEN v1.0**.

## 18. Universal Dashboard Governance (UDR Standard v1.0 — FROZEN)
1. **Metadata-Driven Dashboards (UDR-001 — MANDATORY)**:
   - Dashboard layouts, widget schemas, and chart parameters MUST be declared in UPR metadata (`DashboardRegistry` / `SPK.dashboard`).
2. **Single Widget Rendering Entry Point (UDR-002 — MANDATORY)**:
   - Widget calculations and layout rendering MUST execute exclusively through `SPK.dashboard.renderWidget()`.
3. **Delegated Security Authorization (UDR-003 — MANDATORY)**:
   - Dashboard domain and widget access MUST delegate exclusively to `SPK.security`.
4. **Delegated Layout Grid Resolution (UDR-004 — MANDATORY)**:
   - Dashboard widget column/row grid spans MUST delegate exclusively to `SPK.layouts`.
5. **Immutable Context Enforcement (UDR-005 — MANDATORY)**:
   - Dashboard widget execution MUST consume immutable `PlatformContext`.
6. **UDR Standard v1.0 Status (FROZEN)**:
   - Rules `UDR-001` through `UDR-006` are officially **FROZEN v1.0**.

## 19. Universal AI Skill Governance (UAR Standard v1.0 — FROZEN)
1. **Metadata-Driven AI Skills (UAR-001 — MANDATORY)**:
   - All AI skills, prompt templates, and advisory schemas MUST be declared in UPR metadata (`AIRegistry` / `SPK.ai`).
2. **Single Skill Execution Entry Point (UAR-002 — MANDATORY)**:
   - Skill execution MUST execute exclusively through `SPK.ai.executeSkill()`.
3. **AI Optionality & Advisory Enforcement (UAR-003 — MANDATORY)**:
   - In accordance with **Rule AOP-001 (AI Optionality Principle)**, all AI skill recommendations MUST specify `isAdvisoryOnly: true` and NEVER execute financial or core domain transactions automatically.
4. **Delegated Security Authorization (UAR-004 — MANDATORY)**:
   - Skill execution permissions MUST delegate exclusively to `SPK.security`.
5. **Immutable Context Enforcement (UAR-005 — MANDATORY)**:
   - Skill execution MUST consume immutable `PlatformContext`.
6. **UAR Standard v1.0 Status (FROZEN)**:
   - Rules `UAR-001` through `UAR-006` are officially **FROZEN v1.0**.

## 20. Single Workspace Principle (PROD-002 / SWP-001 — FROZEN)
1. **Four Universal Workspaces Only (SWP-001 — MANDATORY)**:
   - There shall be exactly one Billing Workspace (`sales-billing-studio`), one Purchase Workspace (`purchase-studio`), one Inventory Workspace (`item-master`), and one Universal Person Workspace (`crm-studio`).
2. **Policy-Driven Behavior (SWP-002 — MANDATORY)**:
   - Business behavior MUST be determined by policies, customer/supplier profiles, document type, and configuration—NOT by duplicate screens, menus, or modules.
3. **Mandatory AI Checklist Before Creating Modules (SWP-003 — MANDATORY)**:
   - Check if an existing Workspace can adapt through Policy. If YES, extend Policy Engine (`CustomerPolicyEngine`, `SupplierPolicyEngine`, `PersonPolicyEngine`). Do NOT create a duplicate workspace or screen.

> **Key Takeaway:** SMRITI Retail OS is built on an unshakable architectural foundation and a customer-first product philosophy. Guided by the Single Workspace Principle (`PROD-002 / SWP-001`), every business process is unified into a single adaptive workspace rather than fragmented across duplicate screens, menus, or modules. SMRITI adapts to the business—not the other way around. Retailers focus on running their business, while the platform intelligently applies policies, pricing, taxation, and workflows behind the scenes. **One Workspace. Infinite Business Scenarios.**


---


### Self-check before sending any report
Before presenting a verification report, the agent should confirm:
- [ ] Every modified file has a pasted diff (Rule 1), not a description
- [ ] Every test claim has pasted terminal output (Rule 2)
- [ ] Every lint/validator claim has pasted console output (Rule 3)
- [ ] Every metric has a shown before/after measurement (Rule 4)
- [ ] Prior session claims were independently re-checked, not assumed (Rule 5)
- [ ] Scope is enumerated file-by-file, not summarized at module level (Rule 6)
- [ ] Every item is labeled with one of exactly four states — Done, Failed, Partially Verified, Unverified — not a score or adjective (Rule 7)
- [ ] Every "Ran command" / "Edited" / "Used tool" line is followed by its actual output (Rule 8)
- [ ] Evidence, Interpretation, and Recommendation appear as distinct labeled sections, not blended into one narrative (Rule 9)

---

## Environment Rule: DEV vs TEST (MANDATORY — PERMANENT)

| Location / Path | Purpose | Rule |
|---|---|---|
| Development Workspace | **Development** — all code is written and committed here | All edits, new files, and git commits happen in the development workspace |
| `F:\SMRITI9TEST` | **Testing** — receives code via git sync for testing only | ALWAYS use `F:\SMRITI9TEST` for testing. NEVER use the development/coding folder for testing execution |

### Workflow

1. Write all code in the active Development repository workspace (`f:\SMRITRretailNXmgrt`).
2. Commit and push from Development workspace ONLY.
3. Pull/sync into `F:\SMRITI9TEST` to deploy and execute tests in the dedicated test environment.
4. NEVER perform testing execution inside the development/coding folder.
5. NEVER write code directly in `F:\SMRITI9TEST`.
6. **NEVER execute `git push` from `F:\SMRITI9TEST` under any circumstances.** Pushes happen EXCLUSIVELY from Development workspace (`f:\SMRITRretailNXmgrt`). `F:\SMRITI9TEST` operates strictly read-only via `git pull --rebase`.

---

## Environment Rule: Docker Execution Policy (MANDATORY — PERMANENT)

> [!IMPORTANT]
> **STRICT USER DIRECTIVE:** DO NOT start or use host Vite dev server under any circumstances until the user explicitly requests to use it. ALL frontend applications, backend services, and databases MUST execute exclusively inside Docker containers (`docker compose up`).

| Service | Execution Mode | Rule |
|---|---|---|
| Workspace & Frontend | **Docker Container (`smriti-workspace`)** | ALWAYS run and serve frontend via Docker container (`docker compose up workspace`). NEVER use host Vite dev server. |
| Core API | **Docker Container (`smriti-api`)** | ALWAYS run and serve backend API via Docker container (`docker compose up api`). |
| Database | **Docker Container (`smriti-db`)** | ALWAYS run PostgreSQL database via Docker container (`docker compose up db`). |

This rule applies to ALL sessions, ALL agents, all tasks. No exceptions.

---

# SMRITI Three-Tier Governance Hierarchy & Architecture Constitution

**Status:** FROZEN — Level 1 SMRITI Architecture Constitution v1.0 (2026-07-22)

```text
 ┌────────────────────────────────────────────────────────────────────────┐
 │ LEVEL 1: SMRITI ARCHITECTURE CONSTITUTION (FROZEN - PERMANENT RULES)   │
 │  AOP-001 (AI Optionality) | AOP-002 (Four-Tier Apps) | AOP-003 (Contracts)│
 │  AOP-004 (Additive DB)   | AOP-005 (Auth Isolation) | AOP-006 (Trace ID)  │
 ├────────────────────────────────────────────────────────────────────────┤
 │ LEVEL 2: ENGINEERING STANDARDS (VERSIONED STANDARDS)                   │
 │  Verification Evidence (Rules 1-10) | DGP | WGP | IPGP | HREP | DEV/TEST│
 ├────────────────────────────────────────────────────────────────────────┤
 │ LEVEL 3: OPERATIONAL PROCEDURES (EVOLVING DAILY WORKFLOWS)             │
 │  Git Workflows | Docker Compose | Alembic Migrations | Vite Pipelines   │
 └────────────────────────────────────────────────────────────────────────┘
```

---

# LEVEL 1: SMRITI ARCHITECTURE CONSTITUTION (FROZEN — PERMANENT)

### AOP-001: AI Optionality Principle (Rule AI-001 — AI Optional Architecture)
Artificial Intelligence services shall never be mandatory for any core business transaction. SMRITI Retail OS must operate 100% standalone and offline-first without AI. All AI capabilities must operate strictly as optional advisory services. On default installation, AI Engine is disabled (`AI_ENABLED=false`), API keys are unconfigured, zero AI SDKs/runtimes are initialized, and AI elements/tiles are completely hidden from the UI. AI features shall only be activated through explicit administrator configuration under Settings → AI Configuration with appropriate RBAC permissions (`AI_ADMIN`, `AI_CONFIGURATION`, `AI_CHAT`, `AI_REPORTS`, `AI_AUTOMATION`, `AI_PROMPTS`). The absence, failure, network disconnect, or disablement of AI must not impact the correctness, availability, performance, or completion of any core retail workflow.

### AOP-002: Four-Tier Enterprise Architecture & Independence Principle
1. **The Four Independent Tier Products**:
   - **SMRITI Website (Marketing)**: Public website (`www.smritisys.com`), Pricing, Features, Blog, Contact, Public Documentation.
     > **SMRITI Website is NOT a part of the Retail Platform. It is an independent marketing product.** It can be hosted on a completely different server, repository, technology stack, database, and deployment pipeline.
   - **SMRITI Portal (Customer Self-Service)**: Customer Account Portal (`portal.smritisys.com`), Software Downloads, License Management, Subscriptions, Support Tickets, Device Activation, Billing. Consumes Platform API over published contracts.
   - **SMRITI Workspace (Retail Operations App)**: Retail Operations App (`workspace.smritisys.com` / `localhost:3000`), POS, Inventory, Purchase, Sales, CRM, Accounting, Reports. Consumes Platform API over published contracts.
   - **SMRITI Platform API (Core Engine)**: Headless backend system-of-record (`api.smritisys.com` / `backend/app/`), PostgreSQL Database.
     - **Modular Platform Services**: Identity, License, Organization, Notification, Integration, Retail, Accounting, Workflow.
     - **Independent Service Evolution**: Each Platform Service is independently deployable. A service may evolve from an in-process module to an independent service without changing client contracts.
     - **API Gateway Routing**: `/api/public/v1/*` (Portal/Website/Mobile) and `/api/internal/v1/*` (Workspace).

2. **The Golden Rules of Application Independence**:
   - **Rule 1**: No application shall directly depend on another application. Every application communicates ONLY with the Platform API through published contracts (`Workspace ──► Platform API ◄── Portal`).
   - **Rule 2**: Every SMRITI application must be installable, deployable, upgradeable, and removable independently without affecting any other application.
   - **Rule 3**: Platform owns business logic. Applications own user experience.
   - **Rule 4**: Each business domain has exactly one authoritative owner.
   - **Rule 5**: Applications are replaceable. Platform services are reusable. Business data is permanent.

3. **Ecosystem Capabilities & Zero Database Cross-Contamination**:
   - **SMRITI SDK**: Applications consume Platform API via `SMRITI SDK` handling JWT tokens, retries, offline queues, and contract compatibility.
   - **Event Bus Integration**: Platform services communicate asynchronously via Event Bus (`Invoice Created` → `Accounting` + `Notification` + `Audit` + `Analytics`).
   - **Plugin Architecture**: Extensions (GST, POS, WhatsApp, Tally, Barcode, Gateways, AI) register dynamically with the Platform API Plugin Registry.
   - **Zero Cross-Contamination**: Website/Portal MUST NEVER access the Retail Application's database (`smriti-db`). Cloud/portal interactions operate strictly as optional advisory HTTP API calls.

### AOP-003: Backward Compatibility & Deprecation Lifecycle Principle
Platform APIs are binding contracts. Published APIs (`/api/public/v1/*` and `/api/internal/v1/*`) shall not introduce breaking payload changes within the same major version. All API endpoints, plugins, and SDK components MUST adhere to the formal 4-stage deprecation lifecycle:
`Experimental` ──► `Supported` ──► `Deprecated` (6-month min. deprecation lifecycle) ──► `Removed`

### AOP-004: Additive Schema Evolution & Data Safety Principle
Database schema evolution shall be additive whenever possible (`ADD COLUMN IF NOT EXISTS`). Columns must be marked deprecated before removal. Any destructive migration requires a verified rollback plan and pre-migration backup assertion.

### AOP-005: Security & API Authorization Isolation Principle
- **Public API Gateway (`/api/public/v1/*`)**: Enforces OAuth2 / JWT authentication, IP rate limiting, CORS origin isolation, and granular token scopes.
- **Internal API Gateway (`/api/internal/v1/*`)**: Enforces mutual service authentication (`X-Internal-Service-Key`), network isolation, and internal RBAC.

### AOP-006: Distributed Observability & Tracing Principle
Every API request across Platform Services, Workspace, and Portal MUST generate and propagate a unique `Trace-ID`, `Correlation-ID`, `Span-ID`, and `Audit-ID` in HTTP response headers and structured logs.

### AOP-007: Mandatory Architecture Decision Record (ADR) Governance
Any constitutional or fundamental architectural change (Level 1 modification) MUST be preceded by an approved Architecture Decision Record (`docs/adr/ADR-xxx.md`) detailing problem context, options considered, decisions made, and trade-offs accepted.

### AOP-008: Field Change Lifecycle (FCL) & Field Registry Studio Principle (Rule FCL-001 — ADR-014)
Neither developers nor AI coding agents shall add, modify, or remove an entity field on an ad-hoc basis as a simple UI or model edit. Every field change MUST follow the formal 7-stage **Field Change Lifecycle (FCL)**: `Business Request (CR)` ──► `13-Layer Field Impact Analysis` ──► `9-Point Property Clarification` ──► `Auto Task Graph` ──► `Implementation` ──► `13-Layer Verification Gate` ──► `Field Registry Catalog Update`. Every field modification MUST evaluate and update the 13 impacted layers: Database Schema, Alembic Migration, ORM Model Class, Repository Layer, Domain Service, REST API Schema, UI Form/Pattern, Global Search Index, Reports & BI, Barcode Engine, Data Exchange Hub (Excel), Print Framework, and RBAC/Security. Direct uncoordinated field additions without a registered Change Request are strictly prohibited.

### AOP-009: Installation Bootstrap & Authentication Purity Principle
The Installation Bootstrap Service shall be the only component permitted to modify system initialization data, seeded accounts, bootstrap metadata, or legacy migration state. All runtime services, including authentication, authorization, and business modules, shall treat these artifacts as read-only. Authentication services must be stateless with respect to account initialization. Account creation, migration, and reconciliation belong exclusively to the Installation Bootstrap Service. Authentication must never modify user credentials or account state as a side effect of login.

### SSA-001: System Super Administrator Standard
The built-in `super` account is the platform owner and has unrestricted administrative capabilities through the authorization framework. It does not bypass authentication or security controls. All privileged actions must be authenticated, authorized, logged, and auditable. No hidden backdoors or undocumented privilege escalation mechanisms are permitted.

### SMRITI TAX GOVERNANCE CONSTITUTION (TG-001 — TG-006)

#### Rule TG-001: Zero Manual Tax Selection Policy (MANDATORY)
Manual GST/Tax selection is strictly prohibited in all sales transactions (POS Billing, Sales Invoice, Tax Invoice, Sales Order, Retail Billing). UI controls for GST Type, GST %, CGST, SGST, IGST, Tax Code, Tax Template, Inclusive/Exclusive, and Tax Mode shall be removed or rendered read-only. Tax shall always be resolved automatically by STRE.

#### Rule TG-002: Centralized Tax Calculation Authority (MANDATORY)
All tax calculations across the platform shall pass exclusively through the SMRITI Smart Tax Resolution Engine (`STRE`). No module, component, screen, hook, utility, or billing engine may independently calculate tax.

#### Rule TG-003: Immutable Document Tax Snapshot (MANDATORY)
Once a transaction is posted, the resolved tax details (rates, profiles, rule version, breakdown, and trace) shall be stored as a versioned, immutable `DocumentTaxSnapshot` object on the document and never recalculated retrospectively.

#### Rule TG-004: Tax Master Data Authority (MANDATORY)
Tax determination shall be based exclusively on approved master data (Tax Profile Master, HSN/SAC Master, Customer Group, Customer, Item, Company Policy). Transaction screens shall never serve as the source of tax configuration.

#### Rule TG-005: Effective-Dated Tax Rules (MANDATORY)
All statutory tax rates, classifications, and rules shall be effective-date driven. STRE shall resolve tax using the transaction `documentDate` matched against `effectiveFrom` and `effectiveTo` date ranges in the master data.

#### Rule TG-006: No Silent Fallbacks (MANDATORY)
If STRE cannot determine a valid tax using approved master data and statutory rules, it shall NEVER guess, default, or silently apply a tax rate. The transaction must be blocked with an actionable validation message identifying the missing master data. Only authorized master data updates or recorded overrides may resolve the block.



### Rule SLP-002: Launchpad Composition Framework Principle
The Launchpad shall not contain business logic. It shall compose its interface exclusively from registered modules, widgets, services, and metadata. Application modules may contribute tiles, quick actions, widgets, search providers, notification providers, and status providers through standardized registration interfaces.

### Rule SLP-003: Launchpad Independence Principle (MANDATORY)
The Launchpad shall never directly import or invoke business-domain logic. All interactions with business modules must occur through published manifests, registries, providers, or capability interfaces. This guarantees modularity, testability, and the independent evolution of the platform and business applications.

### Rule SLGP-R6: Modules Shall Never Control the Viewport (MANDATORY)
Business modules must not define viewport dimensions (`100vh`, `100vw`, `h-screen`, `w-screen`) or application-level overflow behavior. Only the Layout Manager and Workspace Framework may control viewport sizing and scroll behavior. Modules shall consume the allocated workspace boundaries and render within Pattern A (Scrollable), Pattern B (Fixed Studio), or Pattern C (Master-Detail) contracts.

### Rule GR-000: Business Capability Before Technology Principle (MANDATORY)
Technology frameworks (`FastAPI`, `React`, `Postgres`) are execution details. SMRITI Retail OS is designed exclusively around permanent retail business capabilities (`Inventory`, `Sales`, `Purchase`, `Accounting`, `CRM`, `POS`). Frameworks change; business capabilities endure for 200 years.

### Rule GR-001: Single Source of Truth (SSOT) Principle (MANDATORY)
Every business rule, calculation, validation, configuration, UI component, API contract, and data definition shall have **EXACTLY ONE** authoritative implementation. Duplication is strictly prohibited. Reuse is mandatory across GST calculations, pricing engines, barcode generators, customer selectors, design tokens, and API endpoints.

### AI Agent Mandatory Code Reuse Directive (MANDATORY)
Before writing ANY new code or creating files, all AI agents and engineers MUST execute the 5-step search chain: `Search Project` ──► `Find Existing Implementation` ──► `Reuse` ──► `Else Extend` ──► `Else Create & Document Justification`.

### SMRITI Engineering Core Principles (GR-002 — GR-010)
- **GR-002 (DRY)**: Don't Repeat Yourself across modules or layers.
- **GR-003 (High Cohesion / Low Coupling)**: Modules communicate exclusively via Published Service Interfaces or Domain Event Bus (`DomainEvents`).
- **GR-004 (Separation of Concerns)**: Clear boundaries between Presentation (React), API Controllers (FastAPI), Business Logic (Services), and Persistence (Repositories).
- **GR-005 (Composition Over Inheritance)**: Favor modular composable contracts over deep class hierarchies.
- **GR-006 (Open-Closed Principle)**: Modules open for capability extension, closed for breaking modifications.
- **GR-007 (Convention Over Configuration)**: Standardized naming and folder structure (`backend/app/modules/`).
- **GR-008 (KISS)**: Keep implementation simple, readable, and maintainable.
- **GR-009 (YAGNI)**: Implement only verified business requirements.
- **GR-010 (Production-First)**: Zero business mock data or static fallback bypasses in production environments.
- **GR-011 (Canonical Ownership)**: Every business capability has exactly ONE authoritative owner service. GST calculations belong to `TaxService`. Barcodes belong to `BarcodeService`. Pricing belongs to `PricingService`. No capability may be silently re-implemented in a different module.
- **GR-012 (No Silent Duplication)**: Upgrading a service means modifying the existing canonical service, never creating `ProductServiceV2`, `NewProductService`, or `BetterProductService` as parallel implementations.
- **GR-013 (Backward Compatibility)**: Public APIs (`/api/public/v1/*`) and database schema contracts (columns, table names, FK relationships) must never break existing client contracts within the same major version. Use the 4-stage deprecation lifecycle (`Experimental` → `Supported` → `Deprecated` → `Removed`) before any removal.
- **GR-014 (Code-First Review)**: No new code shall be written until the existing implementation has been reviewed and a reuse analysis has been completed. Every implementation proposal must identify what already exists, what can be reused, what must be extended, and what genuinely needs to be created.
- **SCP-001 (Compliance Isolation Principle — MANDATORY)**: All statutory, regulatory, and jurisdiction-specific business rules must be implemented through the SMRITI Compliance Platform (SCP). Transaction modules (Sales, Purchase, POS, Inventory, Accounting, Payroll, etc.) must NEVER embed compliance logic directly. They may only invoke the Compliance Platform through its published APIs and SDK contracts (`IComplianceModule`, `StatutoryValidator`, `GstTaxEngine`).
- **STWS-001 (SMRITI Transaction Workspace Standard — MANDATORY)**: Every transactional document in SMRITI Retail OS (Sales, Purchase, Stock, Accounting, POS, Delivery Challan, Notes) shall support a standalone workspace mode. The standalone mode shall be provided by the SMRITI Window Management Framework (SWMF) and shall render the transaction in a dedicated window without application navigation shells. Transaction modules shall not implement custom popout logic but shall invoke the platform `WindowManager` service (`WindowManager.openTransaction({ transactionType, documentId, mode })`).
- **SLP-001 (Universal Label Printing Studio — MANDATORY)**: SMRITI Universal Label Printing Studio (SLPS) shall be the SINGLE label printing application for the entire platform. Modules (Sales, Purchase, Inventory, POS, etc.) must NEVER build isolated label printing screens; they must delegate to SLPS.
- **SLP-002 (Label Print History & Audit Trail)**: Every label print action (job number, date, time, user, printer, template, source document, copies printed) must be stored in Print History and produce an immutable audit log entry.
- **SLP-003 (PRN Template & Variable Engine)**: PRN template scripts (ZPL, TSPL, EPL) must resolve placeholders dynamically (`${item.name}`, `${item.price}`, `${item.barcode}`) using the platform PRN Variable Engine.
- **SLP-004 (Printer & Network Management)**: Printers must be managed via central printer profiles supporting language selection (TSPL/ZPL), DPI, dimensions, and communication protocols.
- **SLP-005 (Enterprise Print Queue)**: All label print operations must pass through the Enterprise Print Queue supporting job states (`Queued`, `Printing`, `Completed`, `Failed`, `Cancelled`) with background processing and retry capability.
- **SLP-006 (Universal Lookup & Range Filtering)**: Label selection must support universal cross-entity lookup (Item, Barcode, Article, Style, Brand, GRN, Invoices, Batches) and range/variant filtering (MRP range, Size matrix).
- **SLP-007 (Label Profile Auto-Resolution)**: Items automatically resolve to their configured Label Profile ──► PRN Script ──► Printer Language. Manual override is permitted.
- **SLP-008 (Pluggable Print Provider Framework)**: Printing operations must decouple logic from transport layers via pluggable providers (`BrowserPrintProvider`, `PDFPrintProvider`, `QZTrayProvider`, `NetworkPrintProvider`). Direct unabstracted socket code in UI modules is strictly prohibited.
- **CON-001 (Constitution Freeze — MANDATORY)**: The SMRITI Developer Operating System Constitution (`ADR-023`, `ADR-024`, `ADR-025`, `ADR-026`) is permanently FROZEN. Direct edits, rewrites, or renumbering of these constitutional ADRs are strictly prohibited. The platform evolution transitions 100% to Product Mode (Business Capabilities, Domain Packs, and Implementation Specifications / IPS).
- **PROD-001 (Customer Value Priority — MANDATORY)**: If a proposed change does not help a retailer sell faster, buy better, manage inventory more accurately, or comply with regulations, it is not a priority during Product Mode. Architecture refactoring and non-essential infrastructure tasks are prohibited.

### AI Agent Mandatory 5-Phase Review Protocol (MANDATORY — ALL FEATURES)

Before implementing any feature, AI agents MUST execute the following protocol in order:

**Phase 1 — Discovery**
- Scan project structure (`list_dir`, `grep_search`)
- Identify affected modules and cross-module dependencies

**Phase 2 — Existing Code Review (Search First)**
Search for existing: Service · Repository · API Endpoint · React Component · Hook · Utility · Validator · Domain Event · Tests
> Critical question: **"Does this functionality already exist?"** If YES → Reuse. If PARTIALLY → Extend. Only if NO → Create.

**Phase 3 — Gap Analysis Report**
Produce a structured report before writing a single line of new code:
```text
CODE REVIEW REPORT
Files Reviewed: [list every file examined]
Already Exists: [✓ list reusable items]
Needs Extension: [✓ list items to extend]
New Code Required: [✗ list genuinely new items with justification]
Duplicate Risk: LOW / MEDIUM / HIGH
```

**Phase 4 — Architecture Compliance Check**
Verify against: SEB v1.0 · GR-001 (SSOT) · Relevant ADR · SLGP-001 Layout Rules · API Gateway Rules · Repository Pattern (ADR-006)

**Phase 5 — Implementation**
Write new code only for items in "New Code Required" from the Gap Analysis.

---



# LEVEL 2: ENGINEERING STANDARDS (VERSIONED STANDARDS)

## 1. Platform Capability & Plugin Registry Governance
- **Capability Registry Metadata Schema**: Every Platform Service registers: `[Service ID, Version, Owner, Status, Public API Endpoints, Internal API Endpoints, Event Bus Subjects, Service Dependencies]`.
- **Plugin Certification & Governance**: Every dynamic extension plugin MUST declare: `[Plugin ID, Version, Target API Version, Cryptographic Signature, Scoped Permissions, Certification Status]`.

## 2. Standardized Ecosystem Terminology Governance
- **Mandatory Terms**:
  - ✅ **SMRITI Platform API** (Backend System-of-Record)
  - ✅ **Platform Services** (Domain Modules)
  - ✅ **System-of-Record** (Authoritative DB Engine)
- **Prohibited Terms (Deprecated)**:
  - ❌ `Core Engine` (Ambiguous; replace with **SMRITI Platform API**)
  - ❌ `Python Core` (Implementation detail; replace with **Platform API**)

## 3. Release Compatibility Matrix
| Application / Tier | Current Version | Target Platform API | Contract Compatibility |
| :--- | :--- | :--- | :--- |
| **SMRITI Platform API** | v3.29.0 | v3.x | System-of-Record Core |
| **SMRITI Workspace** | v3.29.0 | v3.x | `/api/internal/v1/*` |
| **SMRITI Portal** | v2.9.0 | v3.x | `/api/public/v1/*` |
| **SMRITI Website** | v1.0.0 | Independent | Marketing Product |
| **SMRITI SDK** | v3.0.0 | v3.x | Public & Internal SDK |

---

# SMRITI Database Blueprint Governance Policy (DBP) — ADR-012

**Status:** FROZEN — Level 2 Engineering Standard (2026-07-28)
**Documents:** `docs/database/SMRITI_DATABASE_BLUEPRINT_v1.0.md` · `docs/database/SMRITI_CANONICAL_DATA_MODEL_v1.0.md` · `docs/database/TABLE_OWNERSHIP_REGISTRY.md`

## DBP-001 — Database Blueprint is Authoritative
The `SMRITI_DATABASE_BLUEPRINT_v1.0.md` is the single authoritative reference for all database schema decisions.
**No new Alembic migration shall be committed unless:**
1. The corresponding table/column is documented in the Database Blueprint.
2. The change is reviewed against the Canonical Data Model.
3. The migration docstring references the Blueprint section and ADR number.

## DBP-002 — Canonical Table Ownership
Every database table has exactly **ONE** owning module. Other modules consume data only through:
- Repository Pattern (ADR-006)
- Published Service Interface
- Published API Contract (`/api/internal/v1/*`)

**Cross-module direct table access and parallel duplicate schemas are prohibited (GR-001 + GR-011).**

> **Supplier Ownership Decision (ADR-012):** `suppliers` is owned by **Purchase**. CRM reads supplier data exclusively via `/api/internal/v1/purchase/suppliers`. No `Supplier` model in `crm.py` or any other module.

## DBP-003 — Migration Traceability (MANDATORY)
Every Alembic migration file MUST include a docstring header:
```python
"""<Migration description>

DBP Reference : SMRITI_DATABASE_BLUEPRINT_v1.0.md §<section>
CDM Reference : SMRITI_CANONICAL_DATA_MODEL_v1.0.md — <Entity> (if applicable)
ADR Reference : ADR-<number>
Revision ID   : <alembic revision id>
"""
```
Migrations committed without this header on or after 2026-07-28 are non-compliant.

## DBP-004 — BaseEntity Inheritance (MANDATORY)
All new SQLAlchemy models MUST inherit `BaseEntity` or `RowSecuredMixin` from `backend/app/db/base.py`.
This automatically provides: `id`, `uuid`, `tenant_id`, `company_id`, `branch_id`, `created_at`, `modified_at`, `created_by`, `updated_by`, `is_active`, `is_deleted`, `deleted_at`, `deleted_by`, `version`.
**Never redefine these fields in individual model classes.**

## ERD Maintenance
Five module ERDs are maintained in `docs/database/`:
- `ERD_core.mmd` — Tier 1 core entities
- `ERD_inventory.mmd` — Inventory module
- `ERD_sales.mmd` — Sales module
- `ERD_purchase.mmd` — Purchase module
- `ERD_accounting.mmd` — Accounting module (current + Phase 1 planned)

Update the relevant ERD whenever a structural schema change is committed.

---

# SMRITI Walkthrough Governance Policy (WGP) - Agent Rules



# SMRITI Walkthrough Governance Policy (WGP) - Agent Rules

Every AI agent working on the SMRITI Retail OS codebase must adhere to the following rules:

1. **Mandatory Walkthrough Generation**:
   * Every completed implementation that changes the repository in a meaningful way (e.g., bug fixes, optimizations, migrations, new modules) must generate a walkthrough document.
2. **Standard Location**:
   * Walkthroughs must be saved under the `docs/walkthrough/` directory, organized by area (e.g., `docs/walkthrough/procurement/`, `docs/walkthrough/foundation/`).
3. **No Overwrites**:
   * Existing walkthrough documents must **never** be overwritten. A new walkthrough must be created for each version or phase.
4. **Append to Master Index**:
   * The master index table in `docs/walkthrough/README.md` must be updated chronologically with each new walkthrough.
5. **WGP Required Sections**:
   * Each walkthrough must include these 13 sections:
     1. Purpose
     2. Scope
     3. Files Created
     4. Files Modified
     5. Architecture Decisions
     6. Design Rationale
     7. Implementation Summary
     8. Tests Executed
     9. Verification Results
     10. Known Limitations
     11. Future Work
     12. Related ADRs
     13. Related RFCs
6. **Naming Convention**:
   * Files must be named as: `<Area>_<Topic>_v<Version>.md` (e.g., `Procurement_Matrix_Optimize_And_Supplier_Sync_v2.1.1.md`).

---

# SMRITI Human-Readable Error Policy (HREP)

## Objective
SMRITI must never expose raw programming, framework, database, or machine-generated error messages to end users. All user-facing errors must be translated into clear, friendly, human-readable language.

The user should understand:
* What happened
* Why it happened (if appropriate)
* What they can do next
without requiring any technical knowledge.

## 1. Never Show Technical Errors (Rule 1)
The following must never be displayed directly to end users:
* Python / Server-Side Tracebacks
* SQL / Database Query Errors
* Exception Class Names
* Underlying Framework or Platform-Specific Errors
* HTTP Stack Traces
* File Paths / Source Code / Function Names
* JSON Parse Errors / Database Constraint Errors
These details belong only in internal logs. Never expose framework, platform, database, or implementation errors to end users. Only business-friendly messages may be displayed.

## 2. Business Language & Guidance (Rules 2â€“4)
* Convert exceptions into business-friendly messages.
* Messages must use business terminology (avoid saying API, SQL, Repository, JSON, Exception, Traceback, Object, Attribute, Stack).
* Every message must include guidance (What happened? What should the user do next?).

## 3. Severity & Dictionary (Rules 5â€“7)
* Group user-facing errors by severity: Information, Success, Warning, Validation, Permission, Business Error, System Error.
* Maintain and use the SMRITI Error Dictionary catalog (e.g., `SMRITI-PERM-001`, `SMRITI-VAL-001`, `SMRITI-NET-001`, `SMRITI-DATA-001`) instead of hardcoding messages.

## 4. User Experience Standard (Rule 8)
Structure messages as:
* **Title**: Short, clear description.
* **Explanation**: Simple business-language explanation.
* **Suggested Action**: Guidance on what to do next.
* **Reference ID**: Support reference (e.g., `SMRITI-ERR-YYYYMMDD-XXXXXX`).

---

# SMRITI Documentation Governance Policy (DGP)

## Objective
Documentation is a first-class engineering artifact. Every code change must automatically determine which documentation is affected (using `docs/documentation_registry.yml`) and update only those documents.

## 1. Documentation Impact Analysis (Rule 1)
Before completing any implementation, the AI must perform a Documentation Impact Analysis using `docs/documentation_registry.yml` to determine affected documents (User Guide, Developer Guide, Architecture, Walkthrough, etc.).

## 2. Auto Documentation Update (Rules 2â€“4)
When implementation is completed, the AI must automatically:
1. Update the affected documentation based on change classification (Code Only, API Change, Business Workflow Change, Architecture Change, Governance Change).
2. Update the Walkthrough.
3. Append the Walkthrough Index.
4. Update the Knowledge Base.

## 3. Documentation Report & Validation (Rules 5â€“6)
At the end of every implementation, generate a Documentation Impact Report summarizing updated files, walkthroughs, and guides. Verify all required document updates are completed before closing the task.

---

# SMRITI License & Copyright Governance Policy

## 1. Third-Party Code Protection
The AI must never modify the license, copyright, or attribution of third-party code.
Only SMRITI-owned source files may receive SMRITI copyright notices or SPDX identifiers.

## 2. Governance Tracking for Licensing Changes
License changes are governance changes. Any modification to licensing, copyright, SPDX identifiers, NOTICE, COPYING, or THIRD_PARTY_LICENSES.md requires:
- Documentation update
- Walkthrough
- Knowledge Base update
- CHANGELOG entry

# AI Optionality Principle (AOP-001)

**Policy ID:** AOP-001  
**Status:** MANDATORY — PERMANENT — ALL agents, ALL sessions, ALL modules  
**Effective:** 2026-07-20

Artificial Intelligence services shall never be mandatory for any core business transaction. All AI capabilities must operate as optional advisory services. The absence, failure, or disablement of AI must not impact the correctness, availability, performance, or completion of any core workflow.

---

# SMRITI Implementation Plan Governance Policy (IPGP)


## 1. Mandatory Implementation Plan (Rules 1-2)
Before implementing any significant feature, enhancement, optimization, migration, refactoring, framework, SDK component, studio, API, security improvement, or infrastructure change, the AI must create or update an Implementation Plan.
All plans must be stored under `docs/implementation/` organized by area (e.g. `docs/implementation/foundation/`).

## 2. Engineering History & Identification (Rules 3-5)
The AI must never overwrite historical plans. Instead: create a new version, append new phases, mark previous plans as superseded, and preserve history.
Search `docs/implementation/` and identify existing plans before starting. Generate missing historical retrospective plans based on Git, walkthroughs, and ADRs where missing.

## 3. Master Index & Required Sections (Rules 6-7)
Maintain `docs/implementation/README.md` as a chronological master index table.
Every plan must contain these 19 sections:
1. Objective
2. Business Motivation
3. Scope
4. Current State
5. Gap Analysis
6. Architecture Impact
7. Proposed Design
8. Files Created
9. Files Modified
10. Dependencies
11. Risks
12. Rollback Strategy
13. Verification Plan
14. Test Plan
15. Documentation Impact
16. Deployment Plan
17. Status
18. Related ADRs
19. Related Walkthroughs

## 4. Documentation Sync & Lifecycle (Rules 8-9)
Create/update plans must automatically synchronize index tables, walkthroughs, Knowledge Base, CHANGELOG, architecture docs, and developer/user guides.
Lifecycle statuses allowed: Draft, Approved, In Progress, Completed, Superseded, Cancelled.

## 5. Definition of Done (Rule 10)
No task is completed until:
âœ“ Implementation Plan updated
âœ“ Walkthrough created
âœ“ Walkthrough Index updated
âœ“ Implementation Index updated
âœ“ Knowledge Base updated
âœ“ CHANGELOG updated
âœ“ Documentation synchronized
âœ“ Tests completed
âœ“ Architecture Guard passed
âœ“ License Guard reviewed (if applicable)
âœ“ Status marked Completed

---

# SMRITI Wiki Documentation-First Policy

## Documentation-First Governance

No implementation is considered complete until all of the following are finished:

- Source code implemented
- Tests executed successfully
- Documentation updated
- GitHub Wiki updated
- Release Notes updated
- CHANGELOG updated
- Architecture documentation updated (if applicable)
- User documentation updated (if applicable)
- API documentation updated (if applicable)
- Screenshots or diagrams updated (if UI changed)
- Cross-links validated
- No broken wiki links
- Documentation committed and published

## AI Agent Verification Checklist

Every verification report must include an objective documentation and publishing checklist in the following format:

```
Implementation Status

âœ“ Code Complete
âœ“ Tests Passed
âœ“ Documentation Updated
âœ“ Wiki Updated
âœ“ CHANGELOG Updated
âœ“ Release Notes Updated
âœ“ Architecture Updated
âœ“ GitHub Published
âœ“ Links Verified

Evidence Level: [A/B/C/D]
```

## Documentation Quality Gates

The AI agent must fail the task and report the issue if any of the following occur:

* Missing wiki page
* Broken internal links
* Duplicate content
* Empty sections
* Placeholder text ("TODO", "Coming Soon")
* References to prohibited platform terminology (per SMRITI branding policy)
* Inconsistent terminology

---

# SMRITI Continuous Repository Governance (Auto-Update Policy)

This rule is mandatory.

Every completed implementation, bug fix, enhancement, refactoring, architecture change, documentation update, release, or governance modification MUST automatically review and update all affected repository assets before the task is considered complete.

## Always Auto-Update

The AI agent shall automatically update, when applicable:

### Documentation
- GitHub Wiki
- README.md
- CHANGELOG.md
- RELEASE_NOTES.md
- Architecture documents
- Implementation Plans
- Walkthroughs
- User Manual
- Developer Guide
- API Documentation
- Knowledge Base
- FAQ
- Troubleshooting Guide

### GitHub Repository
- Pull Request Template
- Issue Templates
- Discussion Templates
- CODEOWNERS
- CONTRIBUTING.md
- SECURITY.md
- SUPPORT.md
- Labels (if managed)
- Milestones (if managed)
- Projects (if managed)
- GitHub Releases

### Governance
- AGENTS.md
- Architecture Constitution
- Coding Standards
- Documentation Standards
- Branding Standards
- Testing Standards

### Navigation
Automatically update:
- Wiki Home page
- Table of Contents
- Cross-links
- Index pages
- Navigation menus
- Release history

### Validation
Automatically verify:
- No broken links
- No duplicate pages
- No orphan documentation
- No outdated references
- Consistent terminology
- Branding compliance
- Documentation completeness

### Completion Gate
No task is considered complete until all affected documentation and governance assets have been reviewed and updated.
If no update is required, explicitly state:
"Reviewed â€” No changes required."
The AI agent must never skip this review.

---

## Auto-Update Targets (Dependency-Driven Mapping)
The agent must discover what needs updating based on the files it changed:

- **If source code changes:**
  - Update Wiki
  - Update README (if needed)
  - Update CHANGELOG
  - Update RELEASE_NOTES
- **If UI changes:**
  - Update screenshots
  - Update walkthroughs
  - Update user manual
- **If API changes:**
  - Update API docs
  - Update examples
  - Update Wiki
- **If architecture changes:**
  - Update architecture docs
  - Update diagrams
  - Update governance
- **If new feature:**
  - Create Wiki page
  - Add FAQ
  - Add release notes
  - Update roadmap






---

---

# SMRITI Backend System-of-Record Policy

**Status:** MANDATORY — applies to ALL agents, ALL sessions, ALL tasks.
**Effective:** 2026-07-12

## Rule 1. FastAPI + Postgres Backend
FastAPI + Postgres (`backend/app/`) is the system of record for all transactional data. Express (`server.ts`, `src/routes/*.ts`) and `db_store.json` are in feature freeze — no new business logic, routes, or data models may be added there, for any reason, until this policy is explicitly revised.

## Rule 2. Strangler-Fig Migration Order
Migration proceeds module by module (strangler-fig), in this order: Reports → Inventory/Products → Auth → Sales/Purchase/POS. A module is not "migrated" until the frontend calls FastAPI directly for it via `src/lib/apiFetchV1.ts` AND the equivalent Express/db_store.json path for that data has been removed.

## Rule 3. AI and Analytical Capabilities
Any AI/forecast/OCR/recommendation module under `backend/app/ai/` stays unimplemented (scaffolding only) until real transaction volume exists in Postgres to build it against. Do not build analytical features against seed/test data and present them as functional.

## Rule 4. Backend Capability Target
Every new backend capability, from this point forward, goes into `backend/app/`, never into `server.ts` or `src/routes/*.ts`.

## Rule 5. Integration & Compliance Gateways (MANDATORY)
All external government, banking, tax, and third-party integrations (GSTN, NIC, E-Way Bill, E-Invoice, Payment Gateways), including their credentials storage, audit logging, and background retry queue engines, must reside inside the FastAPI + Postgres backend (`backend/app/`). Express is in feature freeze and must never handle credentials decryption, queue scheduling, or external compliance gateway communication. It may only act as a proxy router to FastAPI compliance endpoints.

---

# SMRITI Platform Abstraction Layer (PAL) — Permanent Governance Rules

**Status:** MANDATORY — applies to ALL agents, ALL sessions, ALL tasks.

## 1. SMRITI Architecture Dependency Rule
Dependencies shall point inward only:
```text
UI (Frontend)
    ↓
Express API (Dev/Mock Routing Gateway)
    ↓
Platform Abstraction Layer (PAL Container & Interfaces)
    ↓
FastAPI + Postgres (Transactional System-of-Record Backend)
```
* No lower layer may reference a higher layer.
* Business services shall remain framework-independent and database-agnostic.

## 2. API Communication Policy
* Client applications must use `src/lib/apiFetch.ts` for Express API endpoints (`/api/*`) and `src/lib/apiFetchV1.ts` for FastAPI API endpoints (`/api/v1/*`).
* Direct raw fetch or XMLHttpRequest calls are prohibited outside these helper modules.
* Express serves as the layout routing host and dev mock server; FastAPI serves as the true transactional backend.

## 3. Database Layer Independence
* All transactional data (stock movements, shifts, invoices, purchase orders) must reside in PostgreSQL.
* Express-level in-memory stores are for transient UI caching/migration fallback only and must not be used as transactional systems of record.

---

# SMRITI Universal Author Details & File Header Policy (UADHP)

**Policy ID:** UADHP-v1.0  
**Status:** MANDATORY — PERMANENT — ALL agents, ALL sessions, ALL file types  
**Effective:** 2026-07-11

## ABSOLUTE RULE: Every File Must Carry Author Details

Every first-party file created or modified — source code, Markdown document, walkthrough, implementation plan, user guide, developer guide, troubleshooting guide, CHANGELOG, README, wiki page, configuration file, or governance document — MUST begin with the standard SMRITI author details block appropriate to its file type.

No exceptions. No file may be saved without author details. Missing author details is a policy violation equal to missing code.

---

## Author Details Templates by File Type

### A. Source Code Files (`.ts`, `.tsx`, `.js`, `.jsx`, `.py`, `.css`)

Use a block comment at the very top of the file:

```text
/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Email        : support@smritibooks.com
 * Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
 * Version      : <current codebase version e.g. 2.1.3>
 * Created      : <YYYY-MM-DD — preserve original; use today only on new files>
 * Modified     : <YYYY-MM-DD — always update to today on every edit>
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 */
```

### B. Markdown Documentation Files (`.md`) — All Docs, Guides, Walkthroughs, Plans

Use an HTML comment block at the very top of the file:

```markdown
<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Email        : support@smritibooks.com
  Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
  Version      : <current codebase version e.g. 2.1.3>
  Created      : <YYYY-MM-DD — preserve original; use today only on new files>
  Modified     : <YYYY-MM-DD — always update to today on every edit>
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->
```

### C. CHANGELOG.md, README.md, HOME.md (Repository-Level Files)

Same HTML comment block as Template B above — placed at line 1 before any other content.

### D. JSON / YAML / TOML Configuration Files

If the format supports comments, add:
```yaml
# Project   : SMRITI Retail OS
# Author    : Jawahar Ramkripal Mallah
# Email     : support@smritibooks.com
# Modified  : <YYYY-MM-DD>
# Copyright : © SMRITIBooks.com. All Rights Reserved.
```
If the format does not support comments (e.g., strict JSON), add an `"_smriti_meta"` key at the top:
```json
{
  "_smriti_meta": {
    "project": "SMRITI Retail OS",
    "author": "Jawahar Ramkripal Mallah",
    "email": "support@smritibooks.com",
    "modified": "YYYY-MM-DD"
  }
}
```

---

## Author Details Field Rules

| Field | Rule |
| :--- | :--- |
| `Project` | Always `SMRITI Retail OS` — never change |
| `Author` | Always `Jawahar Ramkripal Mallah` for all AI-generated and team files |
| `Email` | Always `support@smritibooks.com` |
| `Websites` | Always `smritibooks.com \| erpnbook.com \| aitdl.com` |
| `Version` | Must match the current codebase version in `package.json` at time of writing |
| `Created` | Set ONCE on file creation — NEVER change on subsequent edits |
| `Modified` | Update to TODAY'S DATE on every single edit — no exceptions |
| `Copyright` | Always `© SMRITIBooks.com. All Rights Reserved.` |
| `License` | Always `Proprietary Commercial Software` for source files; `Proprietary` for docs |
| `Classification` | `Internal` for docs and governance; omit for source code |

---

## Verification Requirement

After creating or editing any file, the agent MUST verify:
1. Author block exists at line 1 (or within first 3 lines for shebang scripts).
2. `Modified` date is set to today's date (YYYY-MM-DD).
3. `Created` date is preserved if the file previously existed.
4. No duplicate author blocks exist in the same file.

If any check fails, fix it before reporting the file as Done.

---


# SMRITI Document Auto-Generation & Perpetual Maintenance Policy (DAGPMP)

**Policy ID:** DAGPMP-v2.0  
**Status:** MANDATORY — PERMANENT — applies to ALL agents, ALL sessions, ALL tasks  
**Effective:** 2026-07-11  
**Supersedes:** DCAP (formerly appended above as "SMRITI Documentation Consolidation & Appending Policy")  
**Authority:** SMRITI Product Constitution (SPC-012)

---

## PURPOSE

Every implementation, bug fix, refactor, architecture change, or governance update changes the system. That change is incomplete until ALL affected documents are updated. AI agents must never require human reminders to update documentation. This policy mandates autonomous, comprehensive, perpetual document maintenance as a first-class deliverable equal to code.

---

## RULE 1 — Documentation Is Non-Optional (ABSOLUTE)

No task is Done until every document affected by the change is updated.

- Documentation updates are not "optional follow-up" — they are part of the implementation.
- If a document cannot be updated (e.g., file locked, path unknown), the agent must state this explicitly and block task completion with status `Partially Verified`.
- "I'll update docs later" or "docs can be updated separately" is a policy violation.

---

## RULE 2 — Trigger Classification (MANDATORY FIRST STEP)

Before writing a single line of code, the agent MUST classify the change type and determine which documents are affected:

| Change Type | Triggered Documents |
| :--- | :--- |
| **Code Only** (internal refactor, no API/UI change) | Walkthrough, CONSOLIDATED_WALKTHROUGHS, Implementation Plan, CONSOLIDATED_PLANS, DEVELOPER_GUIDE, CHANGELOG |
| **API Change** (new/modified endpoint, payload, auth) | All Code Only + USER_GUIDE (if user-facing), API docs |
| **UI / UX Change** (new screen, field, button, hotkey) | All Code Only + USER_GUIDE, TROUBLESHOOTING, screenshots/recordings |
| **Business Workflow Change** (new rule, new entity, pricing) | All UI/UX + domain walkthrough, FAQ, Knowledge Base |
| **Architecture Change** (new pattern, layer, engine) | All Business + PLATFORM_ADAPTER_RULES, architecture diagrams |
| **Governance / Policy Change** | AGENTS.md, SMRITI_PRODUCT_CONSTITUTION, CHANGELOG, Knowledge Base |
| **New Module / Feature** | ALL of the above + Wiki Home page update |
| **Bug Fix** | Walkthrough, TROUBLESHOOTING (add resolution entry), CONSOLIDATED_WALKTHROUGHS |

---

## RULE 3 — Walkthrough Auto-Creation (MANDATORY ON EVERY IMPLEMENTATION)

After every implementation that changes the repository, the agent MUST:

1. **Create a versioned walkthrough file** in the correct area subfolder:
   - Path: `docs/walkthrough/<area>/<Area>_<Topic>_Walkthrough_v<X.Y.Z>.md`
   - Example: `docs/walkthrough/pos/POS_DeepReview_Fixes_Walkthrough_v2.1.3.md`
   - Must contain all 13 WGP sections (Purpose, Scope, Files Created, Files Modified, Architecture Decisions, Design Rationale, Implementation Summary, Tests Executed, Verification Results, Known Limitations, Future Work, Related ADRs, Related RFCs).
   - Must NEVER overwrite an existing walkthrough — always create a new versioned file.

2. **Append to CONSOLIDATED_WALKTHROUGHS.md** immediately after creating the individual file:
   - Path: `docs/walkthrough/CONSOLIDATED_WALKTHROUGHS.md`
   - Append format:
     ```markdown
     ---
     ## [YYYY-MM-DD] vX.Y.Z — <Topic Name>
     *Area: `<area>` | Original File: [Filename](./area/Filename.md)*
     
     <full walkthrough content, excluding metadata comment header>
     ```

3. **Update `docs/walkthrough/README.md`** index table with a new row pointing to both the individual file and the consolidated anchor.

---

## RULE 4 — Implementation Plan Auto-Creation (MANDATORY ON EVERY FEATURE / FIX)

After every implementation, the agent MUST:

1. **Create a versioned implementation plan file** in the correct area subfolder:
   - Path: `docs/implementation/<area>/<Area>_<Topic>_Plan_v<X.Y.Z>.md`
   - Must contain all 19 IPGP sections.
   - Must NEVER overwrite — always create a new versioned file.

2. **Append to CONSOLIDATED_PLANS.md** immediately:
   - Path: `docs/implementation/CONSOLIDATED_PLANS.md`
   - Same append format as Rule 3 (date header + link + full content).

3. **Update `docs/implementation/README.md`** index table.

---

## RULE 5 — USER_GUIDE.md Auto-Update (MANDATORY ON UI/UX/WORKFLOW CHANGES)

Path: `docs/user_guide/USER_GUIDE.md`

When any user-facing feature, screen, hotkey, workflow, field, or behavior is added or changed, the agent MUST:
- Append or update the relevant section in `USER_GUIDE.md`.
- Add a dated change log entry at the top of the guide.
- Never delete existing content — append, update, or annotate only.
- Format: clear numbered steps, user-friendly language, no technical jargon (per HREP).

---

## RULE 6 — DEVELOPER_GUIDE.md Auto-Update (MANDATORY ON CODE / ARCHITECTURE CHANGES)

Path: `docs/developer_guide/DEVELOPER_GUIDE.md`

When any code pattern, component, service, hook, context, API, or architecture element is added or changed, the agent MUST:
- Append or update the relevant section in `DEVELOPER_GUIDE.md`.
- Document: what changed, why, how to use it, and any gotchas.
- Add a dated change log entry at the top of the guide.

---

## RULE 7 — TROUBLESHOOTING.md Auto-Update (MANDATORY ON BUG FIXES / UX CHANGES / KNOWN ISSUES)

Path: `docs/troubleshooting/TROUBLESHOOTING.md`

For every bug fix, edge case discovered, or known limitation documented in a walkthrough, the agent MUST:
- Add a new entry in `TROUBLESHOOTING.md` in the format:
  ```markdown
  ### [SMRITI-<CODE>] <Short Problem Description>
  **Symptom:** What the user sees.
  **Cause:** Root cause (business language only — no stack traces per HREP).
  **Resolution:** Steps to resolve.
  **Fixed In:** vX.Y.Z (if applicable)
  ```
- Never remove existing entries — only append new ones.

---

## RULE 8 — CHANGELOG.md Auto-Update (MANDATORY ON EVERY COMMIT-WORTHY CHANGE)

Path: `CHANGELOG.md` (repository root)

On every implementation, the agent MUST prepend a new entry:
```markdown
## [vX.Y.Z] — YYYY-MM-DD
### Added
- Brief description of additions
### Changed
- Brief description of changes
### Fixed
- Brief description of bug fixes
### Documentation
- List of all docs updated
```

---

## RULE 9 — docs/HOME.md Auto-Update (MANDATORY ON EVERY VERSION BUMP)

Path: `docs/HOME.md`

The wiki home page "Recent Changes" table must be updated with a new row:
```markdown
| YYYY-MM-DD | vX.Y.Z | <Area> | <What changed> |
```

---

## RULE 10 — Document Naming Convention (MANDATORY)

All auto-generated documents MUST follow these naming patterns:

| Document Type | Pattern |
| :--- | :--- |
| Walkthrough | `<Area>_<Topic>_Walkthrough_v<X.Y.Z>.md` |
| Implementation Plan | `<Area>_<Topic>_Plan_v<X.Y.Z>.md` |
| Architecture Decision Record | `ADR-<ID>-<Topic>.md` |
| RFC | `RFC-<ID>-<Topic>.md` |
| Release Notes | `RELEASE_NOTES_v<X.Y.Z>.md` |

Rules:
- Use PascalCase with underscores between segments.
- Version must match the codebase version at time of writing.
- Never use spaces, slashes, or special characters in filenames.

---

## RULE 11 — Directory Placement Rules (MANDATORY)

| Document Class | Root Path | Area Subfolder |
| :--- | :--- | :--- |
| Walkthroughs | `docs/walkthrough/` | `pos/`, `sales/`, `purchase/`, `crm/`, `foundation/`, `ui/` |
| Implementation Plans | `docs/implementation/` | same areas as walkthrough |
| Architecture Docs | `docs/architecture/` | flat or by layer |
| User Guide | `docs/user_guide/` | single consolidated file |
| Developer Guide | `docs/developer_guide/` | single consolidated file |
| Troubleshooting | `docs/troubleshooting/` | single consolidated file |
| Wiki Home | `docs/` | `HOME.md` |
| CHANGELOG | repository root | `CHANGELOG.md` |

If the area subfolder does not exist, **create it** before writing the file.

---

## RULE 12 — The 12-Step Documentation Completion Gate (MANDATORY CHECKLIST)

Before marking any task `Done`, the agent MUST verify and report every item:

```
SMRITI DAGPMP Documentation Gate — vX.Y.Z
==========================================
[ ] 1.  Versioned WALKTHROUGH file created in correct area subfolder
[ ] 2.  CONSOLIDATED_WALKTHROUGHS.md appended with full walkthrough content
[ ] 3.  docs/walkthrough/README.md index table updated
[ ] 4.  Versioned IMPLEMENTATION PLAN file created in correct area subfolder
[ ] 5.  CONSOLIDATED_PLANS.md appended with full plan content
[ ] 6.  docs/implementation/README.md index table updated
[ ] 7.  USER_GUIDE.md updated (if UI/UX/workflow change)
[ ] 8.  DEVELOPER_GUIDE.md updated (if code/architecture change)
[ ] 9.  TROUBLESHOOTING.md updated (if bug fix or known limitation added)
[ ] 10. CHANGELOG.md prepended with new version entry
[ ] 11. docs/HOME.md "Recent Changes" table updated
[ ] 12. TypeScript/linter verified — exit code 0
```

Each checkbox must be marked with either `[x] Done` or `[!] Skipped — <reason>`.  
Any `[!] Skipped` item requires an explicit justification.  
A task with unresolved `[ ]` items is `Partially Verified`, not `Done`.

---

## RULE 13 — Consolidated Ledger Append Format (EXACT SPECIFICATION)

The exact format for appending to `CONSOLIDATED_WALKTHROUGHS.md` and `CONSOLIDATED_PLANS.md`:

```markdown
---

## [YYYY-MM-DD] vX.Y.Z — <Descriptive Topic Title>

*Area: `<area-name>` | Version: `vX.Y.Z` | Status: Completed*  
*Original File: [Filename.md](./area/Filename.md)*

---

<Full document content here — all 13 WGP sections or 19 IPGP sections>
<Exclude only the HTML/comment metadata header block>

```

Agents must not summarize or truncate the content — the full text must appear.

---

## RULE 14 — README Index Table Append Format (EXACT SPECIFICATION)

When updating `docs/walkthrough/README.md` or `docs/implementation/README.md`, append to the existing index table:

```markdown
| YYYY-MM-DD | vX.Y.Z | <Area> | [Topic](./area/Filename.md) | [Ledger Entry](./CONSOLIDATED_WALKTHROUGHS.md#date-version--topic) |
```

---

## RULE 15 — No Phantom Claims on Documentation

The same Rule 9 (Show Outputs, Not Just Actions) from the Verification Governance section applies to documentation:
- "Updated USER_GUIDE.md" must be followed by the literal diff of the change or the tool's confirmation output.
- "Appended to CONSOLIDATED_WALKTHROUGHS.md" must be followed by evidence (diff or tool output showing the appended content).
- Stating "docs updated" without showing what was written is a policy violation equivalent to saying "tests passed" without showing test output.

---

## ENFORCEMENT

Any agent that:
- Completes code changes without updating documentation,
- Claims documentation is updated without showing evidence,
- Creates a new walkthrough without appending to the consolidated ledger,
- Updates USER_GUIDE without updating DEVELOPER_GUIDE when both are affected,

...is in violation of DAGPMP-v2.0. The task must be reopened and documentation completed before the session can be considered closed.

---

*DAGPMP-v2.0 | Effective 2026-07-11 | Jawahar Ramkripal Mallah | support@smritibooks.com*


To ensure that all generated design and review logs (including Walkthroughs, Implementation Plans, Architecture constitution revisions, etc.) are easily queryable and consolidated, all agents MUST adhere to these rules:

## 1. Consolidated Ledger Maintenance
- A master consolidated walkthrough ledger document MUST be maintained at `docs/walkthrough/CONSOLIDATED_WALKTHROUGHS.md`.
- A master consolidated implementation plan ledger document MUST be maintained at `docs/implementation/CONSOLIDATED_PLANS.md`.
- A master User Guide & Help Manual document MUST be maintained at `docs/user_guide/USER_GUIDE.md`.
- A master Developer & Architecture Guide document MUST be maintained at `docs/developer_guide/DEVELOPER_GUIDE.md`.
- A master Troubleshooting & Support Manual document MUST be maintained at `docs/troubleshooting/TROUBLESHOOTING.md`.

## 2. Compulsory Appending and Updates
Whenever a new individual walkthrough or implementation plan file is generated:
1. First, create the versioned, localized file in the correct subfolder (e.g. `docs/walkthrough/sales/`) following WGP/IPGP protocols.
2. Second, locate the corresponding consolidated ledger file (`CONSOLIDATED_WALKTHROUGHS.md` or `CONSOLIDATED_PLANS.md`).
3. Append a horizontal rule separator (`---`), a date-version header (e.g. `## [YYYY-MM-DD] vX.Y.Z — Topic Name`), and a link to the original file (e.g. `*Original File: [Topic_Plan_vX.Y.Z.md](./area/Topic_Plan_vX.Y.Z.md)*`).
4. Append the full content of the newly created document (excluding standard copyrights/metadata comment headers) directly to the end of the consolidated ledger.
5. Update the master index table in the module's root `README.md` (e.g. `docs/walkthrough/README.md`) to point to both the individual file and the corresponding anchor header in the consolidated ledger file.

Whenever user-facing, developer-facing, or operational code changes occur:
1. Identify all affected manuals (User Guide, Developer Guide, Troubleshooting Guide) based on change categorization.
2. Append or merge new feature logs, developer parameters, and troubleshooting resolution checklists directly into `USER_GUIDE.md`, `DEVELOPER_GUIDE.md`, and `TROUBLESHOOTING.md` respectively.
3. Ensure that all added sections preserve a clean hierarchy, chronological order, and standardized SMRITI header protocols.

---

# SMRITI DAGPMP — Rule 16: Author Details Mandate in All Generated Documents

**Policy ID:** DAGPMP-RULE-16  
**Status:** MANDATORY — PERMANENT  
**Cross-Reference:** UADHP-v1.0 (above)

## Rule 16.1 — Every Document Generated During Development Must Carry Full Author Details

Without exception, every file created or modified during any development session — whether it is source code, a walkthrough, an implementation plan, a user guide, a developer guide, a troubleshooting entry, a CHANGELOG entry, a README, a wiki page, a configuration file, or a governance document — MUST include the complete SMRITI author details block defined in UADHP-v1.0.

This is not a formatting preference. It is a binding governance requirement.

## Rule 16.2 — Author Details for Each Document Class

| Document Class | Template to Use | Placement |
| :--- | :--- | :--- |
| `.ts`, `.tsx`, `.js`, `.jsx`, `.py` | Template A (block comment `/** ... */`) | Line 1 |
| `.css`, `.scss` | Template A (block comment `/* ... */`) | Line 1 |
| `.md` (any Markdown file) | Template B (HTML comment `<!-- ... -->`) | Line 1 |
| `CHANGELOG.md` | Template B | Line 1 |
| `README.md` | Template B | Line 1 |
| `docs/HOME.md` | Template B | Line 1 |
| `AGENTS.md` | Template B | Line 1 |
| `.yaml`, `.yml`, `.toml` | Template D (YAML comments) | Line 1 |
| `.json` (strict) | Template D (`_smriti_meta` key) | First key |

## Rule 16.3 — Author Details Must Be Verified After Every File Write

After writing or modifying any file, the agent MUST confirm:

```
Author Details Verification — UADHP-v1.0
=========================================
[ ] Author block present at line 1
[ ] Project = "SMRITI Retail OS"
[ ] Author = "Jawahar Ramkripal Mallah"
[ ] Email = "support@smritibooks.com"
[ ] Version = current version (matches package.json)
[ ] Created = original creation date preserved (not overwritten)
[ ] Modified = today's date (YYYY-MM-DD)
[ ] Copyright = "© SMRITIBooks.com. All Rights Reserved."
[ ] No duplicate author blocks
```

Any `[ ]` that cannot be checked = `Partially Verified` status for that file.

## Rule 16.4 — The Documentation Gate Is Extended to 13 Steps

The DAGPMP 12-Step Documentation Completion Gate (Rule 12) is hereby extended to 13 steps. Step 13 is:

```
[ ] 13. All created/modified files verified to carry correct author details block (UADHP-v1.0)
```

No task is `Done` until step 13 is confirmed.

## Rule 16.5 — Retroactive Application

When any agent edits an existing file that is missing its author details block, it MUST add the correct block immediately — even if the primary edit is unrelated to the header. This applies to all legacy files encountered during normal work.

---

## Quick-Reference: Standard Author Block Templates

### For source code (`.ts`, `.tsx`, `.js`, `.jsx`, `.py`, `.css`):
```javascript
/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Email        : support@smritibooks.com
 * Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 2.1.3
 * Created      : 2026-07-11
 * Modified     : 2026-07-11
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 */
```

### For all Markdown docs (`.md`) including Walkthrough, Plan, Guide, Wiki, CHANGELOG, README:
```markdown
<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Email        : support@smritibooks.com
  Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
  Version      : 2.1.3
  Created      : 2026-07-11
  Modified     : 2026-07-11
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->
```

### For YAML / config files:
```yaml
# Project      : SMRITI Retail OS
# Author       : Jawahar Ramkripal Mallah
# Email        : support@smritibooks.com
# Version      : 2.1.3
# Modified     : 2026-07-11
# Copyright    : © SMRITIBooks.com. All Rights Reserved.
```

---

*DAGPMP Rule 16 | UADHP-v1.0 | Effective 2026-07-11 | Jawahar Ramkripal Mallah | support@smritibooks.com*

---

# SMRITI Regulatory Engine (SRE) & Basic Accounting Rules

**Status:** MANDATORY — v1.0 (2026-07-19)

## Rule 17. SMRITI Regulatory Engine (SRE) Architecture Constitution

To ensure compliance features scale modularly as tax rules evolve, all agents must adhere to the SRE architectural rules:

1. **Naming & Scope:** The compliance module must be named **SMRITI Regulatory Engine (SRE)**. Inventory compliance is mapped as one capability inside the SRE framework.
2. **Rule Isolation:** Core rule matching must be decoupled from the ledger. An evaluation layer must evaluate dispatches against tax boundaries and log decisions to an immutable `sre_compliance_decisions` table recording: `dispatch_id`, `evaluated_rule`, `decision`, `reason`, `evaluated_at`, and `engine_version`.
3. **Explicit State Machines:** Dispatches must follow explicit state transitions: `Draft -> Dispatched -> Deferred -> Warning -> Expired -> Deemed Supply -> Returned -> Closed`.
4. **Outbound Event Broadcast:** SRE must broadcast status changes to the core Event Bus via structured event types:
   - `compliance.dispatch.logged`
   - `compliance.warning.150days`
   - `compliance.warning.175days`
   - `compliance.deemed_supply`
   - `compliance.tax_invoice_required`
   - `compliance.closed`

## Rule 18. Simplified Financial & Accounting Policy for v1.0

To prevent over-engineering the core accounting logic in normal retail/distributor operations, the following rules apply:

1. **Supported Accounting Masters:** Focus only on Chart of Accounts, Bank/Cash Accounts, Customer/Supplier ledgers, GST ledgers, Income heads, and Expense heads.
2. **Supported Accounting Vouchers:** Implement only standard transactions: Sales/Purchase Invoices, Returns, Cash/Bank Receipts, Payments, Contra, Journals, and Debit/Credit Notes.
3. **Automatic Silent Posting:** Every business document (Invoice, Receipt, Payment) must automatically trigger the journal posting silently. Manual journal builder controls are not exposed to normal operations.
4. **Prohibited Features in v1.0:** Cost centers allocation, accounting workflows, multi-level approvals, posting previews, and financial rule engines are explicitly excluded from the v1.0 footprint.

---

# SWSDK v1.0 & Rule SWSDK-001 — Declarative Workspace Principle

**Status:** MANDATORY LEVEL-1 CONSTITUTION — v1.0 (2026-07-30)

## Rule SWSDK-001 – Declarative Workspace Principle

Every workspace shall declare its metadata, lifecycle, actions, capabilities, permissions, search providers, events, and routing through versioned manifests (`schemaVersion: "1.0"`). Platform services (SUNEF, SPF, SUPOE) consume these manifests to provide standardized behavior. Workspaces shall not directly implement platform concerns that are already provided by the platform. All workspace manifests must pass the 6-stage schema and dependency validation pipeline before registration: `Schema Validation` ──► `Dependency Validation` ──► `Permission Validation` ──► `Capability Validation` ──► `Route Validation` ──► `Registration`.

---

# SMRITI Intelligent Change Management Engine (ICME) v1.0

**Status:** CONSTITUTIONAL MANDATE — ICME-001 through ICME-010 (2026-07-31)

## Constitutional Rule ICME-001: Mandatory Impact & Dependency Analysis
No file shall be modified until its dependency graph, impact analysis, compatibility validation, regression risk assessment, and auto-remediation plan have been completed.

## Constitutional Rules ICME-001 — ICME-010
- **ICME-001**: No code modification without complete dependency analysis.
- **ICME-002**: All reverse dependencies (direct and indirect usages) must be scanned before applying edits.
- **ICME-003**: All affected interfaces, builders, mocks, and type contracts must be synchronized automatically.
- **ICME-004**: API contracts must remain strictly backward compatible or follow semantic versioning.
- **ICME-005**: Every change must produce a Change Impact Matrix evaluating UI, API, DB, Tests, Docs, Config, Types, Events, and Security.
- **ICME-006**: Auto-remediation is mandatory for imports, types, interfaces, forms, and test assertions.
- **ICME-007**: Compilation (`npx tsc`), linting, unit tests, integration tests, and architecture validation must pass before completion.
- **ICME-008**: Documentation, examples, and SDK manifests must be updated whenever public contracts change.
- **ICME-009**: No change may introduce circular dependencies, orphaned code, or unhandled exports.
- **ICME-010**: A task is considered complete ONLY after all 13 execution phases and validation gates pass.

## ICME 13-Phase Execution Flow
1. **Dependency Scanner**: Identify imports, exports, interfaces, hooks, stores, routes, configs, and schemas.
2. **Reverse Dependency Scanner**: Tracing all downstream components consuming modified symbols.
3. **Change Impact Matrix**: Evaluate multi-layer impact (UI, API, DB, Tests, Docs, Config, Types, Events).
4. **Auto-Remediation Plan**: Prepare automatic drop-in updates for caller functions and test mocks.
5. **Smart Refactoring**: Synchronize builder functions, test fixtures, validators, and serializers.
6. **Database Impact Assessment**: Validate migrations, ORM entities, repositories, DTOs, and seeds.
7. **API Contract Validation**: Verify endpoints against OpenAPI specs, frontend SDKs, and tests.
8. **UI Impact Assessment**: Audit forms, grids, dialogs, filters, and reports for visual/state continuity.
---

# SMRITI Knowledge Graph Framework (KGF) & Guiding Governance Principle

**Status:** MANDATORY LEVEL-1 CONSTITUTION — v1.0 (2026-07-31)

## The Guiding Governance Principle
> **"No code change is complete until its architectural impact has been analyzed, all dependent artifacts have been synchronized, all validation gates have passed, and the platform remains internally consistent."**


## Rule KGF-001 – Persistent Knowledge Graph & Semantic Dependency Engine
The SMRITI Platform Kernel (SPK) shall maintain a persistent project Knowledge Graph (`KGF`) indexing all Files, Classes, Interfaces, APIs, Domain Events, Database Schemas, Routes, Tests, and Documentation. All ICME dependency scans and impact analyses shall consume `KGF` for semantic dependency resolution and sub-second incremental change evaluation.

---

# 20. Repository-wide Author Signature Standardization & Governance

**Status:** MANDATORY LEVEL-1 CONSTITUTION (2026-08-03)

## Author Signature Policy (ASG-001)

All files maintained in the SMRITI Retail OS repository MUST automatically include the official canonical Author Signature.

### 1. Canonical Author Signature (Full — Public Docs, Architectures, Constitutions, ADRs, Public SDKs, AUTHORS.md)

```markdown
# AUTHORS

## Author, Creator & Chief Systems Architect

**Jawahar Ramkripal Mallah**

### Founder
- SmritiSys
- AITDL Networks

### Creator
- SMRITI Retail OS

### Responsibilities
- Product Vision
- Product Strategy
- Platform Architecture
- Enterprise Architecture
- UX Architecture
- Inventory Kernel Architecture
- Platform Constitution
- Engineering Standards & Governance

### Websites
- smritisys.com
- smritibooks.com
- aitdl.com

### Contact
- jawahar.mallah@gmail.com

---

Copyright © 2026 SmritiSys.
All Rights Reserved.
```

### 2. Short Source Header (Internal Implementation Files: Python, TS/JS/TSX, SQL, Markdown, Shell, YAML)

```text
Author & Creator:
Jawahar Ramkripal Mallah

Founder:
SmritiSys
AITDL Networks

Role:
Chief Systems Architect

Web:
smritisys.com | smritibooks.com | aitdl.com

Email:
jawahar.mallah@gmail.com

Copyright © 2026 SmritiSys.
All Rights Reserved.
```

### 3. Execution Rules
- **Rule 1 (Preserve & Standardize)**: Update existing headers to canonical format; never duplicate signatures.
- **Rule 2 (Comment Syntax)**: Wrap using native comment syntax (`"""` for Python, `/* ... */` for JS/TS, `--` for SQL, `<!-- ... -->` for MD, `#` for Shell/YAML).
- **Rule 3 (Exclusions)**: Exclude `node_modules`, `vendor`, `third_party`, `dist`, `build`, `coverage`, `.next`, `.venv`, `.git`, `.pytest_cache`, `__pycache__`, framework auto-generated migrations (`alembic/versions`), binary files, and lock files.
- **Rule 4 (No Code Logic Mutations)**: Never modify program logic, algorithms, imports, or exports during signature standardization.
- **Rule 5 (New File Generation)**: Every newly created internal source file or architecture document MUST automatically receive the canonical author signature.
- **Rule 6 (Python Future Import)**: In Python files containing `from __future__ import ...`, the `from __future__` statement MUST remain at line 1, placed immediately BEFORE the author signature docstring.




