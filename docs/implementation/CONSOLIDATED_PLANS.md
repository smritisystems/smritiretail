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

  * Author     : Jawahar Ramkripal Mallah
  * Designation: Chief Systems Architect & Creator
  * Email      : support@smritibooks.com
  * Version    : 6.99.1
  * Created    : 2026-07-11
  * Modified   : 2026-10-24
  * Copyright  : © SMRITIBooks.com. All Rights Reserved. (also © AITDL.com)
  * License    : Proprietary Commercial Software
-->

# SMRITI Retail OS — Consolidated Implementation Plans Ledger

This document serves as the master chronological repository of all technical implementation plans generated during the SMRITI Retail OS engineering lifecycle.

---

## [2026-07-10] v2.1.1 — Sales Studio Expansion

*Original File: [Sales_Studio.md](./sales/Sales_Studio.md)*

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
- [Sales Studio Expansion Walkthrough](../../walkthrough/sales/Sales_Studio.md)

---

## [2026-07-11] v2.1.2 — CRM, Auditing, and POS Upgrades

*Original File: [CRM_Audit_And_POS.md](./sales/CRM_Audit_And_POS.md)*

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
- `/src/components/AdvancedBillingEng.tsx`
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
- [CRM, Auditing, and POS Upgrades Walkthrough](../../walkthrough/sales/Sales_CRM_Audit.md)

---

## [2026-07-11] v2.1.4 — PostgreSQL Standalone Modular Architecture

*Area: `db` | Version: `v2.1.4` | Status: Completed*  
*Original File: [POS_DeepReview.md](./pos/POS_DeepReview.md)*

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
`docs/walkthrough/db/PostgreSQL.md`

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
- [PostgreSQL Standalone Connection & Seeding Walkthrough](../../walkthrough/db/PostgreSQL.md)

---

## [2026-07-11] v3.1.0 — Docker Orchestration & Auto-Startup

*Area: `devops` | Version: `v3.1.0` | Status: Completed*  
*Original File: [Clean_Arch_And.md](./foundation/Clean_Arch_And.md)*

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
`docs/walkthrough/devops/Docker.md`

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
- [Docker Orchestration & Auto-Startup Walkthrough](../../walkthrough/devops/Docker.md)

---
## [2026-07-11] v3.3.0 — Project Header Standardization
*Area: `foundation` | Original File: [Project_Header.md](./foundation/Project_Header.md)*

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
  * Copyright    : © SMRITIBooks.com. All Rights Reserved. (also © AITDL.com)
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
*Area: `foundation` | Original File: [About_Module_Plan.md](./foundation/About_Module_Plan.md)*

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
- [Fdn_About_Module.md](../walkthrough/foundation/Fdn_About_Module.md)

---

## [2026-07-11] v3.5.0 — SMRITI Development Intelligence Center (SDIC)
*Original File: [Dev_Tracker_Plan.md](./foundation/Dev_Tracker_Plan.md)*

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
- [Fdn_Dev_Tracker.md](../walkthrough/foundation/Fdn_Dev_Tracker.md)

---

## [2026-07-11] v3.6.0 — SMRITI FastAPI Core Backend
*Original File: [FastAPI_Core_Plan.md](./foundation/FastAPI_Core_Plan.md)*

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
- [Fdn_FastAPI_Core.md](../walkthrough/foundation/Fdn_FastAPI_Core.md)

---

## [2026-10-16] v1.0.0 — Conditional Store Code & Automatic PSV Account Mapping (Phase 2)

*Area: `sales` | Version: `v1.0.0` | Status: Completed*  
*Original File: [Conditional_Store_Code_And_PSV_Mapping_v1.0.md](./sales/Conditional_Store_Code_And_PSV_Mapping_v1.0.md)*

---

### 1. Objective
Implement conditional Store Code visibility and idempotent automatic Party Stock Visibility (PSV) account resolution/creation for Modern Trade in SMRITI Retail OS. The system reuses the existing canonical Store Master (`customer_delivery_locations`), backend multi-tenant architecture, inventory ledger, and SMRITI UI Configuration Engine without duplicate sources of truth or premature ledger mutations.

### 2. Business Motivation
In Modern Trade and Large Format Retail (LFR) commerce (e.g. Reliance Retail, Shoppers Stop, Lifestyle, Trent), suppliers ship goods directly to specific store locations, each identified by a unique Store Code (e.g. `1888`, `T97D`, `TYAC`). Tracking inventory sell-through, consignment stocks, and out-of-stock risk at each store requires:
1. Ensuring operators select a valid, active store location whenever billing through Modern Trade channels.
2. Automatically and idempotently mapping that store to a corresponding Party Stock Visibility (PSV) account without manual account creation or double-entry mistakes.
3. Preventing Store Code clutter for General Trade and Counter Cash billing where individual store-level tracking is unnecessary.

### 3. Scope
- **Channel Capability Configuration**: Define authoritative Sales Channel capability layer (`requires_store_location`) supporting `MODERN_TRADE` (true) and extensible to other channels (`GENERAL_TRADE`, `B2B_WHOLESALE`, `POS_RETAIL`, `ECOMMERCE`) with override support via SMRITI System Parameter Governance (`smritiSystemParameterService`).
- **Database Hardening**: Add partial unique indexes on `psv_parties` for `(company_id, delivery_location_id)` and `(company_id, host_customer_id, store_code)` via Alembic migration `v1535`.
- **Backend Service & API**: Implement `resolve_or_create_store_psv_party` in `PSVProjectionService` with strict tenancy, active status, customer ownership validation, concurrency safety, and zero stock movement side-effects. Expose `POST /api/v1/psv/resolve-store-party`.
- **Frontend Billing Terminal Integration**: Update `BillingTerm.tsx` and `types.ts` to conditionally display and mandate Delivery Location / Store Code when the active sales channel requires store-level tracking, while preserving historical associations and persisting `psv_party_id`.
- **Automated Verification**: Complete Pytest and Vitest test suites verifying channel rules, account creation/reuse, race condition resilience, error rejections, and zero stock movements.

### 4. Current State
- `customer_delivery_locations` acts as the canonical store master with unique constraint on `(customer_id, store_code)` for active locations.
- `psv_parties` exists but has only a non-unique index `ix_psv_parties_company_store`, creating duplicate account risks during concurrent operations.
- `PSVProjectionService.project_posted_invoice` only created a `PSVParty` lazily upon invoice posting if one was missing.
- In `BillingTerm.tsx`, Delivery Location and Store Code badge rendered unconditionally in the B2B corporate strip without checking sales channel requirements.
- Transaction channel was conflated with `billingSource` (order ingress like `CUSTOMER_PO` vs `DIRECT`) rather than operational sales channel (`MODERN_TRADE`, `B2B_WHOLESALE`, etc.).

### 5. Gap Analysis
1. **Missing Schema Uniqueness**: No database-level unique constraint on `psv_parties` for `(company_id, delivery_location_id)` or `(company_id, host_customer_id, store_code)`.
2. **Missing Pre-Invoice Resolution API**: No authorized endpoint exists to resolve or provision a PSV account at the moment an operator selects a store during invoice drafting.
3. **Missing Channel Governance**: No explicit sales channel capability registry defining `requires_store_location` or integrating with `smritiSystemParameterService`.
4. **Static UI Presentation**: Store Code rendered statically without validation preventing invoice checkout when Modern Trade is selected without a store.

### 6. Architecture Impact
- **Database**: Additive schema migration adding 2 partial unique indexes on `psv_parties`. Zero data loss, zero destructive changes.
- **Backend**: New endpoint `POST /api/v1/psv/resolve-store-party` and new service method in `PSVProjectionService`.
- **Domain Independence**: PSV remains strictly a shadow projection and visibility layer. Resolving or creating an account produces zero entries in `stock_movements`, `psv_stock_events`, or financial ledgers.
- **Frontend**: Responsive UI adaptation based on channel capabilities, reusing SMRITI design tokens (`surface-container-low`, `border-outline-variant`, `primary`, `error`).

### 7. Proposed Design
```text
Sales Channel Selection (e.g. MODERN_TRADE)
    ↓
Channel Capability Check: requires_store_location = true
    ↓
Show & Mandate Delivery Location / Store Code in B2B Strip
    ↓
Operator Selects Delivery Location
    ↓
POST /api/v1/psv/resolve-store-party
    ↓
PSVProjectionService.resolve_or_create_store_psv_party()
    ├─ Validate Location (active, not deleted, company_id match, customer_id match)
    ├─ Check Existing PSVParty by (company_id, delivery_location_id)
    ├─ Check Existing PSVParty by (company_id, host_customer_id, store_code)
    ├─ Concurrency Guard (Advisory lock / Savepoint fallback)
    └─ Create PSVParty (if not found; 0 stock movements)
    ↓
Returns { psv_party_id, store_code, delivery_location_id, is_newly_created }
    ↓
Binds psvPartyId & deliveryStoreCode into BillingHeaderState
```

### 8. Files Created
- `backend/alembic/versions/v1535_psv_parties_store_uniqueness.py`
- `backend/alembic/versions/v1536_sales_invoice_sales_channel.py`
- `backend/app/core/sales_channels.py`
- `backend/app/tests/test_psv_store_mapping.py`
- `src/tests/conditionalStoreCodePsv.test.ts`
- `docs/implementation/sales/Conditional_Store_Code_And_PSV_Mapping_v1.0.md`
- `docs/walkthrough/sales/Conditional_Store_Code_And_PSV_Mapping_v1.0.md`

### 9. Files Modified
- `backend/app/models/psv.py`
- `backend/app/models/sales.py`
- `backend/app/schemas/canonical_posting.py`
- `backend/app/schemas/psv.py`
- `backend/app/schemas/sales.py`
- `backend/app/services/canonical_sales_writer.py`
- `backend/app/services/psv_projection.py`
- `backend/app/services/sales.py`
- `backend/app/tests/conftest.py`
- `src/components/billing/types.ts`
- `src/components/billing/BillingTerm.tsx`
- `docs/implementation/README.md`
- `docs/walkthrough/README.md`

### 10. Dependencies
- PostgreSQL 14+ with support for partial unique indexes (`CREATE UNIQUE INDEX ... WHERE ...`).
- SMRITI System Parameter Service (`smritiSystemParameterService.ts`) for tenant overrides.
- Existing `customer_delivery_locations` and `customers` master data.

### 11. Risks
- **Race Condition on Concurrent Store Account Creation**: Addressed via database unique constraint and atomic advisory locking / savepoint retry.
- **Historical Invoices Mutation**: Addressed by ensuring conditional visibility does not clear or mutate persisted invoice records.
- **Premature Ledger Entries**: Addressed by strictly prohibiting stock movement writes during account resolution.

### 12. Rollback Strategy
- Alembic downgrade script drops the partial unique indexes.
- Code changes in API and UI are non-destructive and backward compatible with optional fallback defaults.

### 13. Verification Plan
- Column and index verification using live PostgreSQL catalog queries.
- Pytest suite covering all resolution branches, error cases, and concurrency.
- Vitest suite covering UI state transitions and validation rules.
- TypeScript compilation verification (`npx tsc --noEmit`).

### 14. Test Plan
- `backend/app/tests/test_psv_store_mapping.py` (15 Integration Tests):
  1. `test_sales_channel_capabilities_logic`
  2. `test_get_channel_capabilities_api_endpoint`
  3. `test_resolve_or_create_store_psv_party_creates_new_with_zero_stock_ledger`
  4. `test_resolve_or_create_store_psv_party_idempotent_reuse`
  5. `test_resolve_or_create_store_psv_party_links_legacy_unlinked_party`
  6. `test_resolve_or_create_store_psv_party_rejects_inactive_or_deleted_location`
  7. `test_resolve_or_create_store_psv_party_rejects_customer_mismatch`
  8. `test_resolve_or_create_store_psv_party_rejects_cross_tenant_access`
  9. `test_api_resolve_store_party_endpoint`
  10. `test_api_resolve_store_party_handles_validation_error`
  11. `test_psv_party_db_partial_unique_index_enforcement`
  12. `test_api_resolve_store_party_rejects_header_tampering`
  13. `test_resolve_store_party_guarantees_zero_stock_mutations`
  14. `test_canonical_sales_posting_persists_sales_channel`
  15. `test_canonical_sales_posting_defaults_sales_channel_to_b2b_wholesale`
- `src/tests/conditionalStoreCodePsv.test.ts` (6 Unit & Contract Tests):
  1. Defines canonical sales channels with correct display labels.
  2. Identifies `MODERN_TRADE` as requiring store location tracking by default.
  3. Identifies non-modern-trade channels as not requiring store location tracking.
  4. Enforces validation rule: `MODERN_TRADE` requires a delivery location before settlement.
  5. Validates non-modern-trade channels allow settlement without store location.
  6. Preserves store selection in state when channel toggles without destroying values.

### 15. Documentation Impact
- Update `docs/implementation/README.md`.
- Create `docs/walkthrough/sales/Conditional_Store_Code_And_PSV_Mapping_v1.0.md`.
- Update `docs/walkthrough/README.md`.

### 16. Deployment Plan
- Apply Alembic migration `v1535`.
- Deploy backend service and API updates.
- Deploy frontend build.

### 17. Status
Completed

### 18. Related ADRs
- ADR-042: SMRITI Canonical Parameter Namespace and Dual-Key Governance.
- ADR-028: PSV Shadow Projection & Non-Authoritative Visibility Engine.

### 19. Related Walkthroughs
- `docs/walkthrough/sales/Conditional_Store_Code_And_PSV_Mapping_v1.0.md`

---

## [2026-10-20] v6.99.0 — Inventory: Stock Movement Validation & Reconciliation Audit

*Area: `inventory` | Version: `v6.99.0` | Status: Approved*  
*Original File: [Inventory_Stock_Movement_Validation_And_Reconciliation_Audit_Plan_v6.99.0.md](./inventory/Inventory_Stock_Movement_Validation_And_Reconciliation_Audit_Plan_v6.99.0.md)*

---

### 1. Objective
Perform a comprehensive, fail-closed audit of inventory movements across every transaction lifecycle in SMRITI Retail OS (Purchase Orders, Goods Receipts / GRN, Sales Invoices, Sales Returns, Purchase Returns / Reversals, Warehouse Transfers, Stock Adjustments, Physical Count Audits, and POS Offline Synchronization). Establish immutable stock invariants, identify and rectify verified discrepancies and movement classification gaps, and build a high-performance read-only reconciliation reporting subsystem (API, CLI, and interactive UI) without corrupting existing historical stock data.

### 2. Business Motivation
In enterprise retail environments, discrepancy between physical stock, batch ledgers, immutable movement logs, and cached on-hand quantities leads to phantom stockouts, duplicate fulfillments, procurement over-ordering, and inaccurate financial valuations. SMRITI requires an authoritative, mathematical source of truth where the ledger (`stock_movements` and `product_batch_stocks`) governs all downstream read caches (`products.stock`), and any drift is immediately detectable, classifiable, and auditable.

### 3. Scope
- **Inspection & Analysis:** Complete review of database tables (`stock_movements`, `product_batch_stocks`, `products`, `warehouses`, `purchase_receipts`, `sales_invoices`, `sales_returns`, `stock_transfers`, `stock_audits`), schemas, and services.
- **Stock Invariant Definition:** Mathematical on-hand formulas and strict multi-tenant boundaries.
- **Defect Remediation:**
  - Movement classification harmonization in `StockSynchronizer` (`stock_synchronizer.py`) and `StockAccountingBoundaryService` (`stock_acct_svc.py`) to encompass `SALES_CANCEL`, `INWARD_INITIAL`, `OUTWARD_ECOM`, `ADJUSTMENT`, `TRANSFER`.
  - Column name correction in `UnifiedSalesLedgerService` (`sales_ledger_svc.py`) from legacy attributes (`batch_number`, `current_stock_qty`) to canonical (`batch_no`, `quantity`).
  - Automatic cache resynchronization and batch-stock awareness in Goods Receipt handler (`goods_receipt.py`).
  - Handling of initial catalog unledgered stock without double-deduction.
- **Read-Only Reconciliation Subsystem:**
  - Reconciliation audit service: `backend/app/services/stock_reconciliation_engine.py`.
  - Fast REST API endpoints in `backend/app/api/v1/inventory.py` (`/api/v1/inventory/reconciliation` and `/api/v1/inventory/reconciliation/correction-proposal`).
  - CLI subcommand: `smriti stock reconcile` via `backend/app/cli/commands/stock_cmd.py`.
  - Interactive UI modal: `src/components/inventory/StockReconciliationAuditModal.tsx` connected to `StockLedgerTab.tsx`.
- **Automated Test Suite:** Comprehensive pytest suite `backend/app/tests/test_stock_movement_reconciliation_audit.py` covering all 14 mandatory operational scenarios.

### 4. Current State
- The codebase relies on a dual-layer ledger: `product_batch_stocks` for batch-tracked items and `stock_movements` for general items, with `products.stock` as a materialized cache.
- In `StockSynchronizer`, `INFLOW_MOVEMENT_TYPES` omitted `SALES_CANCEL` (present 25 times in live DB), `INWARD_INITIAL`, and generic `ADJUSTMENT`/`TRANSFER`, causing cancelled sales to be excluded when computing balance from movements.
- In `sales_ledger_svc.py`, `ProductBatchStock` updates attempted to read `batch_number` and `current_stock_qty`, which do not exist on the SQLAlchemy model (`batch_no` and `quantity`).
- In `goods_receipt.py`, after recording `StockMovement` on GRN receipt and cancellation, cache resynchronization (`StockSynchronizer.sync_product_stock_cache`) was not called.
- In production, 139 non-batch products have non-zero cached stock without corresponding `OPENING_STOCK` movement logs.

### 5. Gap Analysis
| Component | Existing Behavior | Canonical Required Behavior |
|:---|:---|:---|
| `StockSynchronizer` | Ignores `SALES_CANCEL`, `INWARD_INITIAL`, `OUTWARD_ECOM`, generic `ADJUSTMENT` | Recognizes all canonical inflows and outflows, including signed adjustments |
| `goods_receipt.py` | Inserts `StockMovement` without calling `sync_product_stock_cache` | Calls cache synchronizer and updates batch stock |
| `sales_ledger_svc.py` | Queries non-existent `batch_number` & `current_stock_qty` | Uses canonical `batch_no` and `quantity` with positive movement quantities |
| Reconciliation Tooling | No multi-filter audit API or UI report | Full API, CLI, and UI reconciliation tool with 9-state discrepancy classification |
| Test Coverage | Fragmented tests across modules | Unified 14-scenario automated test suite proving all stock invariants |

### 6. Architecture Impact
- **No Schema Mutations:** Uses existing tables (`stock_movements`, `product_batch_stocks`, `products`, `warehouses`). No table drops or breaking DDL required.
- **Fail-Safe Read-Only Reporting:** The reconciliation report is strictly non-destructive.
- **Strict Tenant & Warehouse Isolation:** Queries are strictly bounded by `company_id` and optionally `warehouse_id`.

### 7. Proposed Design
1. **Canonical Movement Classifier (`StockSynchronizer`):**
   - Inflow: `IN`, `INWARD_PURCHASE`, `INWARD_GRN`, `GRN`, `PURCHASE`, `RETURN_INWARD`, `RETURN`, `ADJUSTMENT_IN`, `TRANSFER_IN`, `INWARD_SURPLUS`, `OPENING_STOCK`, `INWARD_INITIAL`, `SALES_CANCEL`, `INWARD`.
   - Outflow: `OUT`, `OUTWARD_SALE`, `SALE`, `POS_SALE`, `ADJUSTMENT_OUT`, `TRANSFER_OUT`, `RETURN_OUTWARD`, `OUTWARD_LOSS`, `OUTWARD_DISPATCH`, `DISPATCH`, `OUTWARD_ECOM`, `DAMAGE`, `WRITE_OFF`, `OUTWARD`.
   - Signed: `ADJUSTMENT` (+ for inflow, - for outflow).
2. **Reconciliation Engine (`StockReconciliationEngine`):**
   - Aggregates movements per item/warehouse.
   - Computes expected on-hand vs actual ledger stock vs materialized cached stock.
   - Detects and categorizes discrepancies into 9 discrete categories with severity and remediation suggestions.
   - Prepares non-destructive historical correction proposals.
3. **API & CLI Layer:**
   - Exposes `/api/v1/inventory/reconciliation` and `/api/v1/inventory/reconciliation/correction-proposal`.
   - Exposes `smriti stock reconcile` CLI command.
4. **Interactive UI Component:**
   - Exposes `StockReconciliationAuditModal` with KPI summary cards, filter bar, variance badges, and expandable audit trail.

### 8. Files Created
- `backend/app/services/stock_reconciliation_engine.py`: Core reconciliation auditing engine.
- `backend/app/cli/commands/stock_cmd.py`: CLI subcommand dispatcher for `smriti stock`.
- `backend/app/tests/test_stock_movement_reconciliation_audit.py`: 14-scenario automated test suite.
- `src/components/inventory/StockReconciliationAuditModal.tsx`: Interactive reconciliation UI report.
- `docs/implementation/inventory/Inventory_Stock_Movement_Validation_And_Reconciliation_Audit_Plan_v6.99.0.md`: This implementation plan.
- `docs/walkthrough/inventory/Inventory_Stock_Movement_Validation_And_Reconciliation_Audit_Walkthrough_v6.99.0.md`: Mandatory walkthrough.

### 9. Files Modified
- `backend/app/services/stock_synchronizer.py`: Movement classification expansion and opening balance safety.
- `backend/app/services/stock_acct_svc.py`: Movement classification alignment.
- `backend/app/services/sales_ledger_svc.py`: Fix batch stock column access and positive movement quantity.
- `backend/app/services/lifecycle/handlers/goods_receipt.py`: Add cache sync and batch stock mutation.
- `backend/app/api/v1/inventory.py`: Register reconciliation endpoints.
- `backend/app/cli/main.py`: Register `stock_cmd`.
- `src/components/StockLedgerTab.tsx`: Add "Reconciliation Audit" trigger button.
- `src/components/shell/TabRenderer.tsx`: Register `stock-reconciliation` route.
- `docs/implementation/README.md`: Update master index.
- `docs/implementation/CONSOLIDATED_PLANS.md`: Append plan ledger.
- `docs/walkthrough/README.md`: Update master index.
- `docs/walkthrough/CONSOLIDATED_WALKTHROUGHS.md`: Append walkthrough ledger.
- `CHANGELOG.md`: Record new version additions.

### 10. Dependencies
- FastAPI, SQLAlchemy AsyncSession, Pydantic v2.
- React 18, Vite, Lucide icons, Tailwind CSS / Vanilla tokens.
- PostgreSQL 15+.

### 11. Risks
- **Data corruption risk:** Solved by making reconciliation strictly read-only; no automatic adjustments to historical records without explicit administrative confirmation.
- **Lock contention:** Row-level locks (`SELECT FOR UPDATE`) are scoped to individual product IDs during live sync operations.

### 12. Rollback Strategy
If any defect occurs, changes are localized to Python service helpers and do not modify database schemas. Reverting modified files restores previous behavior without data loss.

### 13. Verification Plan
1. Run pytest suite `test_stock_movement_reconciliation_audit.py` covering all 14 scenarios.
2. Run pytest suite `test_sales_stock_authority.py` for regression verification.
3. Execute CLI command `python -m backend.app.cli stock reconcile` and verify literal terminal output.
4. Execute `npm run lint` / `tsc --noEmit` to verify frontend TypeScript compilation.

### 14. Test Plan
- Scenario 1: Purchase receipt increases stock once.
- Scenario 2: Completed inventory-affecting sale decreases stock once.
- Scenario 3: Purchase Order without a receipt does not increase physical stock.
- Scenario 4: Sales Order without dispatch does not decrease physical stock.
- Scenario 5: Sales return and purchase return have correct directional effects.
- Scenario 6: Cancelled transactions and reversals restore correct balance without double posting.
- Scenario 7: Warehouse transfers balance across source and destination locations.
- Scenario 8: Duplicate API requests, concurrent posting and offline-sync retries do not duplicate movements.
- Scenario 9: Article/color/size variants cannot affect the wrong item.
- Scenario 10: Cross-company and cross-warehouse isolation is enforced.
- Scenario 11: Opening stock and adjustments reconcile correctly.
- Scenario 12: Negative stock follows configured business policy.
- Scenario 13: Ledger, cached balance and stock reports reconcile.
- Scenario 14: Failed transactions roll back atomically without partial stock updates.

### 15. Documentation Impact
- `docs/implementation/inventory/Inventory_Stock_Movement_Validation_And_Reconciliation_Audit_Plan_v6.99.0.md` created.
- `docs/walkthrough/inventory/Inventory_Stock_Movement_Validation_And_Reconciliation_Audit_Walkthrough_v6.99.0.md` created.
- `docs/developer_guide/DEVELOPER_GUIDE.md` updated with stock movement classification and reconciliation API.
- `docs/troubleshooting/TROUBLESHOOTING.md` updated with resolution for unledgered opening balances and cancelled sales movements.
- `CHANGELOG.md` updated.

### 16. Deployment Plan
- Deploy backend service updates with zero downtime (no DB migrations needed).
- Frontend build.

### 17. Status
Approved

### 18. Related ADRs
- `ADR-0012`: Ledger Sole Source of Truth.
- `ADR-0021`: Item Variant SKU Resolution.

### 19. Related Walkthroughs
- `docs/walkthrough/inventory/Inventory_Stock_Movement_Validation_And_Reconciliation_Audit_Walkthrough_v6.99.0.md`




## Customer Store and Branch Relation Audit - v6.99.18

Plan: [Customer Store and Branch Relation Audit](./crm/Customer_Store_Branch_Relation_Audit_Plan_v6.99.18.md). Implemented CRM location persistence, tenant-scoped branch lookup, actual-data hierarchy display, unambiguous GRN mapping, and fail-closed store-code locks. No migration applied. Follow-up: reconcile database uniqueness with service ownership scope and add store-level sales report dimensions.


---

<a id="shell-premium-context-responsive-navigation-workspace-style"></a>
## [2026-10-24] v6.99.1 - Premium Shell Context, Responsive Navigation, and Workspace Style Accessibility

*Area: ui | Version: v6.99.1 | Status: Partially Verified*
*Original File: [SMRITI_Shell_Consistency_and_Accessibility_Plan_v6.99.1.md](./ui/SMRITI_Shell_Consistency_and_Accessibility_Plan_v6.99.1.md)*

---

# SMRITI Shell Consistency and Accessibility Implementation Plan

### 1. Objective

Make the shared shell calmer and more predictable across Regular and Classic workspace styles while removing sample values and improving responsive and keyboard behavior.

### 2. Business Motivation

The shell showed duplicate style controls, sample notifications and shift details, inconsistent company context, and header actions that disappeared or competed for space on narrow screens. These behaviors can obscure active context and reduce trust in the displayed information.

### 3. Scope

Update the global header, tenant selector, contextual rail, Classic menu, mobile navigation, style chooser, notifications, and status bar. Preserve the existing module routing and backend contracts.

### 4. Current State

The shell separates global and contextual navigation, but Classic and Regular navigation definitions are separate. The header had fabricated identity and notification fallbacks, company selection differed by style, and Classic menu visibility used viewport assumptions.

### 5. Gap Analysis

- Sample identity, shift, notification, and context values need to be removed or backed by real session data.
- Company and branch context needs consistent availability across styles.
- Small screens need a search affordance and a mobile navigation drawer.
- Classic menu overflow needs to use the available header container width.
- Workspace style selection needs keyboard focus management and a truthful state-preservation claim.
- Browser network state must not be described as application connectivity.

### 6. Architecture Impact

The shell reuses the authenticated `/menus/resolved` response as the allowed-module source for both navigation styles and `/auth/me` to confirm application/session connectivity. No API, database schema, authentication flow, or routing contract is changed. `AppShell` owns viewport and drawer state; `GlobalHeader` owns shared actions; `EnterpriseMenuBar` measures its own available width.

### 7. Proposed Design

Use one workspace style dialog entry point, keep company and branch selection in both styles, label session-scoped notifications accurately, remove fabricated identity and tenant fallbacks, use a measured Classic overflow menu, and expose mobile search plus a drawer. Filter Regular and Classic navigation using the same backend-resolved allowed-module IDs. Keep the selected module in the existing app tree while changing presentation style.

### 8. Files Created

- `docs/implementation/ui/SMRITI_Shell_Consistency_and_Accessibility_Plan_v6.99.1.md`
- `docs/walkthrough/ui/SMRITI_Shell_Consistency_and_Accessibility_Walkthrough_v6.99.1.md`
- `docs/walkthrough/CONSOLIDATED_WALKTHROUGHS.md`

### 9. Files Modified

- `src/App.tsx`
- `src/components/layout/CompanySelector.tsx`
- `src/components/shell/AppShell.tsx`
- `src/components/shell/EnterpriseMenuBar.tsx`
- `src/components/shell/GlobalHeader.tsx`
- `src/components/shell/NavRail.tsx`
- `src/components/shell/UxSwitcherModal.tsx`
- `src/components/shell/WorkspaceStatusBar.tsx`
- `src/components/shell/navigationResolver.ts`
- `src/components/shell/navigationAccess.ts`
- `src/notifications/notification_store.tsx`
- `src/layout_engine/layout_store.tsx`
- `src/lib/apiFetchV1.ts`
- `CHANGELOG.md`
- `docs/HOME.md`
- `docs/user_guide/USER_GUIDE.md`
- `docs/developer_guide/DEVELOPER_GUIDE.md`
- `docs/troubleshooting/TROUBLESHOOTING.md`
- Walkthrough and implementation indexes and consolidated ledgers.

### 10. Dependencies

No package or service dependency is added. The responsive Classic menu uses the browser `ResizeObserver` API with a window-resize fallback.

### 11. Risks

- The menu labels and grouping remain separate presentation definitions, while both modes now use the same backend-resolved allowed-module IDs.
- Notification state remains in-memory and session-scoped.
- The application connection indicator reflects the last authenticated `/auth/me` request and does not claim that every service is healthy.
- Browser interaction behavior has not been exercised in this environment.

### 12. Rollback Strategy

Revert the listed source changes and corresponding documentation changes in one reviewed change. No database migration or server-side rollback is required.

### 13. Verification Plan

Run the repository TypeScript linter. Then review the shell in both styles, check keyboard focus and Escape dismissal, and inspect narrow, medium, and wide viewport behavior in a browser.

### 14. Test Plan

No automated tests were requested or run for this task. If testing is later requested, cover company selector availability in both styles, empty notification state, Classic overflow measurement, mobile search and drawer, and style-dialog focus behavior.

### 15. Documentation Impact

The repository's `docs/documentation_registry.yml` is absent. Based on the repository governance rules, update the user guide, developer guide, troubleshooting guide, knowledge-base home, changelog, implementation index/ledger, and walkthrough index/ledger.

### 16. Deployment Plan

No deployment is performed. Apply through the normal reviewed repository workflow after code and documentation review.

### 17. Status

Partially Verified

The implementation is applied and TypeScript lint passed with exit code 0. Browser interaction and automated test results remain unverified.

### 18. Related ADRs

No related ADR was identified for this shell update.

### 19. Related Walkthroughs

- [SMRITI Shell Consistency and Accessibility Walkthrough](../../walkthrough/ui/SMRITI_Shell_Consistency_and_Accessibility_Walkthrough_v6.99.1.md)
