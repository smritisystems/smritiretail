<!--
  Project      : SMRITI Retail OS
  Repository   : SMRITIRetailNX
  Organization : AITDL NETWORKS

  Founders

  * Pushpa Devi Jawahar Mallah
    * Founder & Chairperson
    * Phone: +91 9324117007
    * Email: founder@aitdl.com

  * Jawahar Ramkripal Mallah
    * Founder, Chief Executive Officer (CEO) & Chief Software Architect
    * Email: founder@aitdl.com

  * Websites: aitdl.com | erpnbook.com | smritibooks.com

  * Version    : 2.1.2
  * Created    : 2026-07-11
  * Modified   : 2026-07-11
  * Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
  * License    : Proprietary Commercial Software
-->

# SMRITI Retail OS — Consolidated Implementation Plans Ledger

This document serves as the master chronological repository of all technical implementation plans generated during the SMRITI Retail OS engineering lifecycle.

---

## [2026-07-10] v2.1.1 — Sales Studio Expansion

*Original File: [Sales_Studio_Expansion_Plan_v2.1.1.md](./sales/Sales_Studio_Expansion_Plan_v2.1.1.md)*

### 1. Objective
Expand and modularize the Sales & Commerce Studio (`SalesStudioTab.tsx`) to match the structural patterns of SMRITI modules like `CrmLoyaltyTab.tsx`. This includes modernizing navigation, integrating smooth route animations, and standardizing scrolling behavior.

### 2. Business Motivation
A consistent design language and standardized container architecture are critical for reducing developer cognitive load and improving user interfaces. Aligning `SalesStudioTab.tsx` with other SMRITI modules ensures consistent aesthetics, reliable layout overflows, and predictable route transition animations.

### 3. Scope
- Move `SalesStudioTab.tsx`'s inner tab-bar selector into a top-level header navigation element matching `CrmLoyaltyTab.tsx`.
- Integrate `motion.div` from `motion/react` to provide micro-animations during subview shifts.
- Wrap all main contents in a dedicated `SmritiScrollArea` to ensure standardized overflow behavior across screen sizes.
- Verify that Quotations, Sales Orders, Sales Invoices, Sales Returns, and Customer views continue to load data correctly.

### 4. Current State
- `SalesStudioTab.tsx` was using an in-body pill-bar selector button row as its primary subview navigation.
- The root component returned a top-level standard `div` without unified header, title/subtitle, or layout integrations.
- Body content had hardcoded or native browser scroll behaviors, which led to visual drift compared to the rest of SMRITI.

### 5. Gap Analysis
- **Navigation Layout Gap**: Standardized modular tabs are styled with bottom-border indicators and high-contrast tab states at the header level. Sales Studio was using localized pill buttons.
- **Scroll Overflows Gap**: Outer page structure didn't utilize `SmritiScrollArea` for consistent custom scrollbars.
- **Micro-Animations Gap**: Layout changes loaded abruptly rather than smoothly transitioning through a subtle vertical-slide fade-in effect.

### 6. Architecture Impact
None. The data-fetching mechanisms, standard event bindings, and contextual menu handlers are fully preserved. Visual presentation layer has been standard-aligned.

### 7. Proposed Design
- Update top-level component structure to return a flex-column layout:
  ```tsx
  <div className="flex flex-col h-full bg-theme-surface-1 text-theme-primary font-sans">
    {/* Header Section */}
    {/* Sub Tabs Section */}
    {/* Scroll Area */}
  </div>
  ```
- Map each of the five subviews (`quotations`, `orders`, `invoices`, `returns`, `customers`) into standard UPPERCASE or Title Case labeled buttons with a `border-b-2` active indicator.

### 8. Files Created
None.

### 9. Files Modified
- `/src/components/SalesStudioTab.tsx`

### 10. Dependencies
- `motion/react` (animations)
- `./SmritiScrollArea.tsx` (scrolling container)

### 11. Risks
- **Visual Overlap**: Incorrect CSS flex properties could cause headers to scroll out of view.
  - *Mitigation*: Used standard `flex-1 overflow-hidden` wrapper style alongside `SmritiScrollArea`.
- **Import Errors**: Incorrect importing of `motion` or `SmritiScrollArea` could break compilation.
  - *Mitigation*: Run `npm run lint` and `npm run build` immediately following changes.

### 12. Rollback Strategy
- Restore `SalesStudioTab.tsx` to its pre-edited state using git checkout or from backups if compile fails.

### 13. Verification Plan
1. Compile the applet using `compile_applet`.
2. Confirm the linter passes using `lint_applet`.
3. Verify that the UI correctly switches tabs on clicking "Quotations", "Sales Orders", etc.

### 14. Test Plan
- **Sub-navigation Click Test**: Verify that clicking tabs updates `subView` state and re-fetches relevant tables without layout blinking.
- **Resize Integrity Test**: Confirm that the flex container scales correctly with viewport resizing.

### 15. Documentation Impact
None.

### 16. Deployment Plan
Integrate the code changes into the standard development and production build pipeline.

### 17. Status
Completed.

### 18. Related ADRs
None.

### 19. Related Walkthroughs
- [Sales Studio Expansion Walkthrough](../../walkthrough/sales/Sales_Studio_Expansion_Walkthrough_v2.1.1.md)

---

## [2026-07-11] v2.1.2 — CRM, Auditing, and POS Upgrades

*Original File: [CRM_Audit_And_POS_Upgrades_Plan_v2.1.2.md](./sales/CRM_Audit_And_POS_Upgrades_Plan_v2.1.2.md)*

### 1. Objective
Upgrading the core architecture and user interface of SMRITI Retail OS, focusing on unified customer CRM data synchronization, global backend audit logging, and split-payment, keyboard-driven POS Terminal enhancements.

### 2. Business Motivation
Aligning the isolated frontend prototype systems (CRM local storage cache fallbacks) into the centralized JSON backend database server. Auto-capturing all mutation API requests in the audit activity log, and closing critical cashier efficiency gaps in POS checkout registers.

### 3. Scope
- Add global mutation auditing middleware inside the Express backend persistence layer.
- Add backend GET/POST/PUT API endpoints for `/api/customers` and `/api/customers/groups`.
- Sync frontend `customerStore.ts` with these server endpoints on load and update, keeping local storage as a fallback offline queue.
- Support single and split payment tenders in `/api/pos/checkout` and allocate them to correct General Ledger accounts.
- Bind F2, F3, F12, and Escape keys in `PosTerminalTab.tsx` for fast cashier operations.

### 4. Current State
- Customer CRM operated completely within browser local storage.
- Audit logs were only updated manually on company setup wizard actions.
- POS checkouts supported only single payment modes and no keyboard-only hotkeys.

### 5. Gap Analysis
- **CRM Sync Gap:** Browser data was lost on session changes or clear actions.
- **Auditing Gap:** Mutations like pricing edits, product creation, and stock updates went untracked.
- **POS Desk Speed Gap:** Cashiers had to navigate via mouse clicks to execute hold or pay functions.

### 6. Architecture Impact
None. Preserves data models and adds standard endpoints and key event mappings.

### 7. Proposed Design
- Add `customers` and `customerGroups` arrays to backend database structure.
- Intercept Express requests to build audit trails automatically.
- Split tenders checkouts mapping: `paymentObj: { mode: "Split", breakup: { Cash: 500, UPI: 500 } }`.

### 8. Files Created
None.

### 9. Files Modified
- `/server.ts`
- `/src/App.tsx`
- `/src/services/customerStore.ts`
- `/src/components/AdvancedBillingEngine.tsx`
- `/src/components/PosTerminalTab.tsx`

### 10. Dependencies
None.

### 11. Risks
- **Key Interception:** Potential browser key defaults conflicts.
  - *Mitigation:* Prevent default key actions using `e.preventDefault()`.

### 12. Rollback Strategy
Git checkout of affected files.

### 13. Verification Plan
- Run `npm run lint` and `npm run build`.
- Manually run checkout and verify CRM outstanding changes.

### 14. Test Plan
- Hotkey triggers tests.
- Split payments and ledger allocations tests.

### 15. Documentation Impact
Walkthrough documentation added.

### 16. Deployment Plan
Commit and push code.

### 17. Status
Completed.

### 18. Related ADRs
None.

### 19. Related Walkthroughs
- [CRM, Auditing, and POS Upgrades Walkthrough](../../walkthrough/sales/Sales_CRM_Audit_And_POS_Upgrades_Walkthrough_v2.1.2.md)

---

## [2026-07-11] v2.1.4 — PostgreSQL Standalone Modular Architecture

*Area: `db` | Version: `v2.1.4` | Status: Completed*  
*Original File: [POS_DeepReview_Fixes_Plan_v2.1.3.md](./pos/POS_DeepReview_Fixes_Plan_v2.1.3.md)*

---

### 1. Objective
This document defines the approved architectural blueprint and implementation plan for **SMRITI Retail OS**. Based on strategic alignment, the system will maintain its modular Node.js Express backend, migrate to a **PostgreSQL** database, and preserve strict business module boundaries to ensure long-term stability and hot-swappable scalability.

### 2. Business Motivation
- **Database Durability:** Transitioning from file database serialization to standard SQL database models prevents race condition overwrites and ensures ACID compliance.
- **20+ Year Longevity:** Preserving modular boundaries prevents monolith lock-in, enabling isolated module upgrades (e.g. accounting, POS, print engine) without full-system rewrites.
- **AI Microservices Preparedness:** Isolating Python analytics from Node business logic ensures high-throughput asynchronous execution of ML forecasting scripts.

### 3. Scope
- Create the standard DDL schema script defining all SMRITI tables (customers, products, POS profiles, shifts, invoices, PSV ledger channels, and system audit logs).
- Build the node-postgres pool manager loading connection strings dynamically from `.env` files.
- Build the database initializer module executing table creation DDLs and seeding initial data from `db_store.json` on startup.
- Hook database initialization asynchronously inside `server.ts` before the server starts listening on ports.
- Refactor POS Products (GET, POST, PUT, DELETE, secondary barcodes) and POS Checkout REST APIs to perform database-level operations inside PostgreSQL transactions.

### 4. Current State
- The backend relies on in-memory array manipulation serialized to a flat JSON file (`db_store.json`) on mutating REST operations.

### 5. Gap Analysis
- Flat JSON DB is susceptible to file system locks and data corruption under high-concurrency billing.
- Transitioning directly to FastAPI would require a full backend rewrite. Implementing PostgreSQL connection pools inside the existing Express app secures database resilience with zero API regressions.

### 6. Architecture Impact
- Replaces `loadDb` / `saveDb` loops with transactional pooled connections.
- Introduces `pg` and `dotenv` modules.

### 7. Proposed Design
See schema, pool connection, and products/checkout refactored endpoints in:
`docs/walkthrough/db/PostgreSQL_Initialization_Walkthrough_v2.1.4.md`

### 8. Files Created
| File Path | Description |
| :--- | :--- |
| `src/db/pool.ts` | PostgreSQL client pool configuration |
| `src/db/schema.sql` | DDL schema script mapping SMRITI entities |
| `src/db/init.ts` | DB initializer executing SQL schemas and import flat-file seed JSON |

### 9. Files Modified
- `server.ts` — connected database initializer asynchronously at boot-up, and refactored products/checkout endpoints to PostgreSQL.

### 10. Dependencies
- `pg`
- `dotenv`
- `@types/pg`

### 11. Risks
- **Schema Lockup:** If connection strings fail, Express will crash.
  - *Mitigation:* Catch and log all connection anomalies during pool initialization.

### 12. Rollback Strategy
Git checkout of modified files and removal of newly created database directory files.

### 13. Verification Plan
- Run `npm run lint` to assert TS compilation.
- Inspect database table structures in the PostgreSQL console.
- Perform checkout transaction execution verification.

### 14. Test Plan
- Run Express boot-up process and check log streams to verify schema deployment and flat-file import execution.

### 15. Documentation Impact
Walkthrough documentation added.

### 16. Deployment Plan
Commit and push code.

### 17. Status
Completed.

### 18. Related ADRs
- None.

### 19. Related Walkthroughs
- [PostgreSQL Standalone Connection & Seeding Walkthrough](../../walkthrough/db/PostgreSQL_Initialization_Walkthrough_v2.1.4.md)

---

## [2026-07-11] v3.1.0 — Docker Orchestration & Auto-Startup

*Area: `devops` | Version: `v3.1.0` | Status: Completed*  
*Original File: [Clean_Architecture_And_Offline_First_Plan_v3.0.0.md](./foundation/Clean_Architecture_And_Offline_First_Plan_v3.0.0.md)*

---

### 1. Objective
Enable SMRITI Retail OS to start automatically, persist data, and recover from hardware reboots or power failures with zero manual interventions using a single, unified Docker command.

### 2. Business Motivation
In retail shop environments, cashiers and managers should not be expected to manually boot databases, execute node scripts, or run CLI commands. Containerizing the system and configuring OS-level startup scripts ensures the POS is always ready for billing immediately upon turning on the machine.

### 3. Scope
- Create a multi-stage production `Dockerfile`.
- Create a `docker-compose.yml` file orchestrating PostgreSQL and SMRITI API services.
- Define container health checks (blocking API initialization until PostgreSQL is healthy).
- Persist database records using host docker volumes.
- Create Windows startup batch scripts (`startup.bat`) and Linux shell scripts (`startup.sh`) that run container up configurations.
- Document system integration procedures (such as registering tasks in Windows Task Scheduler or shell startup groups).

### 4. Current State
- The system runs via local `npm run dev` tsx command.
- PostgreSQL database must be manually installed and running on the host OS.
- System fails to automatically restart upon operating system reboot.

### 5. Gap Analysis
- Flat JSON DB is susceptible to file system locks and data corruption under high-concurrency billing.
- Transitioning directly to FastAPI would require a full backend rewrite. Implementing PostgreSQL connection pools inside the existing Express app secures database resilience with zero API regressions.

### 6. Architecture Impact
- Replaces local node/db run with Docker-containerized services.
- Automates database checks and starts.

### 7. Proposed Design
See container configurations defined in:
`docs/walkthrough/devops/Docker_Orchestration_And_Automatic_Startup_Walkthrough_v3.1.0.md`

### 8. Files Created
- `Dockerfile` — Production-grade multi-stage node builder.
- `docker-compose.yml` — Container orchestrator.
- `startup.bat` — Windows startup batch launcher.
- `startup.sh` — Linux startup shell script.

### 9. Files Modified
- `.env.example` — Mapped port templates.

### 10. Dependencies
- Docker Desktop.

### 11. Risks
- Port conflict if port 3000 is used on host.

### 12. Rollback Strategy
Remove docker containers and images.

### 13. Verification Plan
- Run `docker compose up -d` ➔ check log streams for Postgres seeding and API health responses.

### 14. Test Plan
- Run `startup.bat` ➔ verify both containers are successfully launched.

### 15. Status
Completed.

### 16. Related ADRs
- None.

### 17. Related Walkthroughs
- [Docker Orchestration & Auto-Startup Walkthrough](../../walkthrough/devops/Docker_Orchestration_And_Automatic_Startup_Walkthrough_v3.1.0.md)

---
## [2026-07-11] v3.3.0 — Project Header Standardization
*Area: `foundation` | Original File: [Project_Header_Standardization_Plan_v3.3.0.md](./foundation/Project_Header_Standardization_Plan_v3.3.0.md)*

# Implementation Plan: Project Header Standardization — v3.3.0

This document defines the plan to update the standard project header across all applicable first-party source files in the repository.

---

## 1. Objective
Apply the latest approved project header consistently to all applicable first-party files in the repository, preserving existing dates while ensuring uniform branding and ownership metadata.

---

## 2. Business Motivation
Branding, ownership, and copyright attributions must be uniform across all source assets. This ensures correct governance, clear representation of founding leadership, and legal clarity regarding proprietary source code licenses.

---

## 3. Scope
- **Files Scanned:** 167 total files.
- **Files Eligible for Update:** 150 first-party files (`.ts`, `.tsx`, `.js`, `.jsx`, `.css`, `.scss`, `.html`, `.md`, `.sh`, `.bat`, `.ps1`, `.sql`).
- **Files Skipped:** 17 files, including generated assets (`db_store.json`), build folders (`dist`), third-party modules (`node_modules`), dependency locks (`package-lock.json`), configurations (`package.json`, `tsconfig.json`), env setups (`.env`, `.env.example`), and text licenses (`COPYING`, `NOTICE`, `THIRD_PARTY_LICENSES.md`).

---

## 4. Current State
- Files contain varying, older header configurations naming Jawahar Ramkripal Mallah alone.
- Some newer or configuration files (e.g., `vite.config.ts`) lack standard headers.

---

## 5. Gap Analysis
- Missing founders' metadata (Pushpa Devi Jawahar Mallah) and organization details (AITDL NETWORKS) in the current files.
- Inconsistent header formats across newly created utilities and config scripts.

---

## 6. Architecture Impact
- **Non-Functional Change:** No application logic, packages, database definitions, or routing features are affected.

---

## 7. Proposed Design

### Header Structure

#### A. JavaScript, TypeScript, CSS, SCSS, SQL (`/** ... */`)
```typescript
/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Organization : AITDL NETWORKS
 *
 * Founders
 *
 * * Pushpa Devi Jawahar Mallah
 *   * Founder & Chairperson
 *   * Phone: +91 9324117007
 *   * Email: founder@aitdl.com
 *
 * * Jawahar Ramkripal Mallah
 *   * Founder, Chief Executive Officer (CEO) & Chief Software Architect
 *   * Email: founder@aitdl.com
 *
 * * Websites: aitdl.com | erpnbook.com | smritibooks.com
 *
 * * Version    : {Version}
 * * Created    : {Created}
 * * Modified   : {Modified}
 * * Copyright  : {Copyright}
 * * License    : {License}
 */
```

#### B. Shell, PowerShell, Python (`# ...`)
```python
# Project      : SMRITI Retail OS
# Repository   : SMRITIRetailNX
# Organization : AITDL NETWORKS
# 
# Founders
# 
# * Pushpa Devi Jawahar Mallah
#   * Founder & Chairperson
#   * Phone: +91 9324117007
#   * Email: founder@aitdl.com
# 
# * Jawahar Ramkripal Mallah
#   * Founder, Chief Executive Officer (CEO) & Chief Software Architect
#   * Email: founder@aitdl.com
# 
# * Websites: aitdl.com | erpnbook.com | smritibooks.com
# 
# * Version    : {Version}
# * Created    : {Created}
# * Modified   : {Modified}
# * Copyright  : {Copyright}
# * License    : {License}
```

#### C. HTML, Markdown (`<!-- ... -->`)
```html
<!--
  Project      : SMRITI Retail OS
  Repository   : SMRITIRetailNX
  Organization : AITDL NETWORKS

  Founders

  * Pushpa Devi Jawahar Mallah
    * Founder & Chairperson
    * Phone: +91 9324117007
    * Email: founder@aitdl.com

  * Jawahar Ramkripal Mallah
    * Founder, Chief Executive Officer (CEO) & Chief Software Architect
    * Email: founder@aitdl.com

  * Websites: aitdl.com | erpnbook.com | smritibooks.com

  * Version    : {Version}
  * Created    : {Created}
  * Modified   : {Modified}
  * Copyright    : {Copyright}
  * License    : {License}
-->
```

#### D. Windows Batch (`REM ...`)
```batch
REM Project      : SMRITI Retail OS
REM Repository   : SMRITIRetailNX
REM Organization : AITDL NETWORKS
REM 
REM Founders
REM 
REM * Pushpa Devi Jawahar Mallah
REM   * Founder & Chairperson
REM   * Phone: +91 9324117007
REM   * Email: founder@aitdl.com
REM 
REM * Jawahar Ramkripal Mallah
REM   * Founder, Chief Executive Officer (CEO) & Chief Software Architect
REM   * Email: founder@aitdl.com
REM 
REM * Websites: aitdl.com | erpnbook.com | smritibooks.com
REM 
REM * Version    : {Version}
REM * Created    : {Created}
REM * Modified   : {Modified}
REM * Copyright  : {Copyright}
REM * License    : {License}
```

---

## 8. Files Created
- None.

---

## 9. Files Modified
- 150 first-party files across the repository.

---

## 10. Dependencies
- Native python script to perform bulk updates safely.

---

## 11. Risks
- **Syntax Breakers:** Inserting incorrect comment syntax into source code could cause compilation errors.
  - *Mitigation:* The script will identify extension types and apply matching comments correctly. We will run `npm run lint` immediately after.

---

## 12. Rollback Strategy
`git reset --hard HEAD` will revert all changed headers instantly before pushing.

---

## 13. Verification Plan
- Run `npm run lint` to verify zero TypeScript compile errors.
- Run a verification script checking for exact header match across the 150 target files.

---

## 14. Test Plan
- Run automated parser checking header uniformity and print a stats report.

---

## 15. Documentation Impact
- None.

---

## 16. Deployment Plan
Commit and push from development.

---

## 17. Status
Completed.

---

## 18. Related ADRs
- None.

---

## 19. Related Walkthroughs
- None.

---

## [2026-07-11] v3.4.0 — About SMRITI Retail OS
*Area: `foundation` | Original File: [About_Module_Implementation_Plan_v3.4.0.md](./foundation/About_Module_Implementation_Plan_v3.4.0.md)*

# Implementation Plan: Complete "About SMRITI Retail OS" Module — v3.4.0

This document defines the plan to implement the comprehensive **About SMRITI Retail OS** module.

---

## 1. Objective
Design and implement an enterprise-grade **About SMRITI Retail OS** module containing 20 sub-navigation items, internal search, responsive layout, print-friendly views, backend metadata integration, and unit tests.

---

## 2. Business Motivation
Provide users, operators, and auditors with a single, clear source of truth regarding product editions, versions, licenses, governance, founding team members, technological architecture, and system diagnostics.

---

## 3. Scope

### In Scope
- **Backend API:** Implement `/api/changelog` in `server.ts` to return the `CHANGELOG.md` file dynamically.
- **Frontend UI Component:** Completely redesign `src/components/AboutSmritiTab.tsx` with a responsive split-pane layout containing 20 menu items, search filtering, and print styles.
- **Diagnostics Dashboard:** Read live browser navigator parameters and database connection health to display dynamic environment variables.
- **Unit Testing:** Implement a regression test script `src/tests/about.test.ts` to validate endpoints and schema data.
- **Footer/Navigation Links:** Unify sidebar and taskbar reference links to open the About module.

### Out of Scope
- Modifications to core Express session routing outside the About module API.

---

## 4. Current State
- `AboutSmritiTab.tsx` exists as a stub with only 4 sidebar sections (About, Author, Modules, System).
- Lacks biographies for Chairperson Pushpa Devi Jawahar Mallah or CEO Jawahar Ramkripal Mallah.
- No internal search within the About tab.
- No live connection log, changelog integration, privacy policy, or terms panels.

---

## 5. Gap Analysis
- **Navigation Gap:** The current sidebar has 4 sections instead of the requested 20 items.
- **Changelog Gap:** No automated integration displaying the active `CHANGELOG.md` inside the UI.
- **System Information Gap:** Missing active plugins, storage counters, and live database pool diagnostic details.

---

## 6. Architecture Impact
- **Endpoint Additions:** Adds a non-blocking Express GET router (`/api/changelog`).
- **Layout Compliance:** Follows the SMRITI Platform Abstraction Layer (PAL) coding constitution with no direct platform-specific dependencies in UI layers.

---

## 7. Proposed Design

### Sidebar Categories & Navigation Structure
The left sidebar inside `AboutSmritiTab.tsx` will be organized into four thematic groups containing the 20 required submenus:

```
├── 📊 OPERATIONAL OVERVIEW
│   ├── Dashboard (Summary of version, environment, quick navigation cards)
│   └── About SMRITI Retail OS (Product identity, logo, websites)
├── 👥 LEADERSHIP & CULTURE
│   ├── Founders (Chairperson Pushpa Devi Jawahar Mallah & CEO Jawahar Ramkripal Mallah profiles)
│   ├── Our Story (Corporate evolution narrative and visual timeline)
│   ├── Vision & Mission (Strategic directions)
│   └── Core Values (Innovation, simplicity, trust, transparency, safety)
├── 🏗️ TECHNOLOGY & PLATFORM
│   ├── Product Journey (Idea ➔ Design ➔ Testing ➔ Release workflow)
│   ├── Milestones (Chronological milestone tags from v1.0.0 to v3.3.0)
│   ├── Technology (Frontend, backend, database stacks)
│   ├── Architecture (PAL layer dependencies visual layout block diagram)
│   └── AI Innovation (KPI analytics, debounced forecasts, formula explainers)
├── ⚖️ GOVERNANCE & LEGAL
│   ├── Licenses & Legal (Copyrights, trademarks, proprietary license terms)
│   ├── Privacy Policy (Data protection commitments)
│   ├── Terms of Use (Commercial seat policies)
│   └── Third-Party Licenses (Licenses of upstream dependencies)
└── 📞 CHANNELS & CREDITS
    ├── Contact (Email links, sites, support channels)
    ├── Credits (Contributors, AITDL network acknowledgments)
    ├── Version Information (Commit hashes, host OS, database engines)
    ├── Release Notes (Render of CHANGELOG.md via backend feed)
    └── System Information (Diagnostics, active plugins, storage, memory)
```

### Search Engine
An interactive text filter on the sidebar that queries the titles and contents of all 20 sections, highlighting matches and filtering the sidebar navigation links instantly.

### Print Layouts
Tailored CSS print media queries (`@media print`) will hide sidebars and render the active document block full-width in high-contrast monochrome with clean page breaks.

---

## 8. Files Created
- `src/tests/about.test.ts` [NEW] — Automated unit tests for metadata, config, and changelog APIs.

---

## 9. Files Modified
- [MODIFY] [AboutSmritiTab.tsx](file:///d:/IMP/GitHub/SMRITRretailNX/src/components/AboutSmritiTab.tsx) — Replace pane with 20 sections, search bar, contact form, visual timelines, and diagnostic fields.
- [MODIFY] [server.ts](file:///d:/IMP/GitHub/SMRITRretailNX/server.ts) — Register `/api/changelog` router endpoint.
- [MODIFY] [package.json](file:///d:/IMP/GitHub/SMRITRretailNX/package.json) — Add test execution command.

---

## 10. Dependencies
- Standard `lucide-react` icons.

---

## 11. Risks
- **Changelog Read Performance:** Reading a large markdown text file on each API request.
  - *Mitigation:* Cache the parsed file in-memory in `server.ts` upon initial startup.

---

## 12. Rollback Strategy
`git checkout -- src/components/AboutSmritiTab.tsx server.ts package.json` and deletion of the test script file.

---

## 13. Verification Plan

### Automated Verification
- Run linter: `npm run lint`.
- Run unit tests: `npm run test` to verify API outputs and metadata integrity.

### Manual Verification
- Launch application dev environment and navigate to the About page.
- Test responsive resizing in Chrome DevTools to verify sidebar collapse and fluid layout.
- Test print view to assert page formatting.

---

## 14. Test Plan
- Assert GET `/api/metadata` schema structure.
- Assert GET `/api/changelog` returns text containing `# SMRITI Retail OS — Changelog`.

---

## 15. Documentation Impact
- Update Walkthrough.
- Append Consolidated Walkthroughs and Consolidated Plans.

---

## 16. Deployment Plan
Commit and push from development.

---

## 17. Status
Completed.

---

## 18. Related ADRs
- None.

---

## 19. Related Walkthroughs
- [Foundation_About_Module_Walkthrough_v3.4.0.md](../walkthrough/foundation/Foundation_About_Module_Walkthrough_v3.4.0.md)

---

## [2026-07-11] v3.5.0 — SMRITI Development Intelligence Center (SDIC)
*Original File: [Dev_Tracker_Implementation_Plan_v3.5.0.md](./foundation/Dev_Tracker_Implementation_Plan_v3.5.0.md)*

### 1. Objective
Design and implement an automated **SMRITI Development Intelligence Center (SDIC)** that scans codebase files, routers, schemas, tests, and documentation, generates 15 live markdown reports in the workspace root, tracks historical metrics, and renders an interactive dashboard page.

### 2. Business Motivation
Provide real-time, evidence-based metrics showing codebase health, technical debt levels, and release scores without requiring manual maintenance.

### 3. Scope
- **Scanning Service:** Node-based code parser `src/modules/dev_tracker/scanner/`.
- **REST Endpoints:** Register `/api/dev-tracker` and `/api/dev-tracker/scan` in Express app.
- **Markdown Reports:** Dynamically create 15 reports in `docs/reports/` and `DEVELOPMENT_STATUS.md` in root.
- **Frontend Dashboard:** Build `src/modules/dev_tracker/ui/DevTrackerTab.tsx` with Recharts charts.
- **Unit Testing:** Implement validation script `src/modules/dev_tracker/tests/devTracker.test.ts`.

### 4. Files Created
- `src/modules/dev_tracker/models/interfaces.ts`
- `src/modules/dev_tracker/scanner/parser.ts`
- `src/modules/dev_tracker/scanner/metrics.ts`
- `src/modules/dev_tracker/scanner/markdown.ts`
- `src/modules/dev_tracker/scanner/reporter.ts`
- `src/modules/dev_tracker/scanner/scanner.ts`
- `src/modules/dev_tracker/api/devTracker.routes.ts`
- `src/modules/dev_tracker/api/devTracker.controller.ts`
- `src/modules/dev_tracker/ui/DevTrackerTab.tsx`
- `src/modules/dev_tracker/README.md`
- `src/modules/dev_tracker/tests/devTracker.test.ts`

### 5. Files Modified
- `server.ts`
- `src/layout_engine/layout_store.tsx`
- `src/App.tsx`
- `package.json`

### 6. Status
Completed.

### 7. Related ADRs
None.

### 8. Related Walkthroughs
- [Foundation_Dev_Tracker_Walkthrough_v3.5.0.md](../walkthrough/foundation/Foundation_Dev_Tracker_Walkthrough_v3.5.0.md)

---

## [2026-07-11] v3.6.0 — SMRITI FastAPI Core Backend
*Original File: [SMRITI_FastAPI_Core_Implementation_Plan_v3.6.0.md](./foundation/SMRITI_FastAPI_Core_Implementation_Plan_v3.6.0.md)*

### 1. Objective
Design and implement a top-level **FastAPI core backend** for SMRITI Retail OS, featuring SQLAlchemy 2.x, Alembic, Pydantic settings, security middleware, Ruff linting, and pytest suites.

### 2. Business Motivation
Establish the long-term, production-grade Python environment mapping SMRITI services, enabling advanced GenAI/Gemini orchestration, database migrations, and clean architecture isolation.

### 3. Scope
- **Directory Isolation:** Setup root `backend/` folder separate from frontend/Node components.
- **Dependency Management:** Setup `pyproject.toml` and `requirements.txt`.
- **Database ORM & Migrations:** Configure SQLAlchemy 2.x with asyncpg, and Alembic database migrations.
- **REST Endpoints & Versioning:** Expose `/health` routes and `/api/v1/` routes for metadata, changelog, and dev-tracker.
- **Developer Tooling:** Configure Ruff formatting and Pytest test suites.

### 4. Files Created
- `backend/requirements.txt`
- `backend/pyproject.toml`
- `backend/alembic.ini`
- `backend/app/main.py`
- `backend/app/core/config.py`
- `backend/app/core/logging.py`
- `backend/app/core/security.py`
- `backend/app/core/constants.py`
- `backend/app/db/session.py`
- `backend/app/db/base.py`
- `backend/app/middleware/request_logger.py`
- `backend/app/dev_tracker/scanner.py`
- `backend/app/dev_tracker/reports.py`
- `backend/app/api/v1/metadata.py`
- `backend/app/api/v1/changelog.py`
- `backend/app/api/v1/dev_tracker.py`
- `backend/app/tests/test_main.py`
- `backend/app/ai/*` (AI sub-module skeleton files)

### 5. Files Modified
- `package.json`

### 6. Status
Completed.

### 7. Related ADRs
None.

### 8. Related Walkthroughs
- [Foundation_FastAPI_Core_Walkthrough_v3.6.0.md](../walkthrough/foundation/Foundation_FastAPI_Core_Walkthrough_v3.6.0.md)


