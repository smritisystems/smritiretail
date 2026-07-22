<!--
  Project      : SMRITI Retail OS
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

1. Write all code in the active Development repository workspace.
2. Commit and push from Development workspace.
3. Pull/sync into `F:\SMRITI9TEST` to deploy and execute tests in the dedicated test environment.
4. NEVER perform testing execution inside the development/coding folder.
5. NEVER write code directly in `F:\SMRITI9TEST`.

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

### AOP-001: AI Optionality Principle
Artificial Intelligence services shall never be mandatory for any core business transaction. All AI capabilities must operate as optional advisory services. The absence, failure, or disablement of AI must not impact the correctness, availability, performance, or completion of any core workflow.

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

### AOP-003: Backward Compatibility & Contract Binding Principle
Platform APIs are binding contracts. Published APIs (`/api/public/v1/*` and `/api/internal/v1/*`) shall not introduce breaking payload changes within the same major version. Breaking changes require either a new major API version or an explicit 6-month deprecation lifecycle.

### AOP-004: Additive Schema Evolution & Data Safety Principle
Database schema evolution shall be additive whenever possible (`ADD COLUMN IF NOT EXISTS`). Columns must be marked deprecated before removal. Any destructive migration requires a verified rollback plan and pre-migration backup assertion.

### AOP-005: Security & API Authorization Isolation Principle
- **Public API Gateway (`/api/public/v1/*`)**: Enforces OAuth2 / JWT authentication, IP rate limiting, CORS origin isolation, and granular token scopes.
- **Internal API Gateway (`/api/internal/v1/*`)**: Enforces mutual service authentication (`X-Internal-Service-Key`), network isolation, and internal RBAC.

### AOP-006: Distributed Observability & Tracing Principle
Every API request across Platform Services, Workspace, and Portal MUST generate and propagate a unique `Trace-ID`, `Correlation-ID`, `Span-ID`, and `Audit-ID` in HTTP response headers and structured logs.

---

# LEVEL 2: ENGINEERING STANDARDS (VERSIONED STANDARDS)






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

