<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.32.0
  Created      : 2026-07-19
  Modified     : 2026-07-19
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# SMRITI Retail OS Repository Constitution

**Status:** APPROVED — v1.1 (2026-07-19)  
**Priority:** Highest Authority Governance Document  

This document serves as the supreme governance framework for the SMRITI Retail OS codebase. Every developer, AI agent, contributor, CI/CD pipeline, and automation script must adhere strictly to the rules, policies, and laws defined herein. No other document, guidelines, or manual instructions may override or contradict this Constitution.

---

## Precedence & Governance Hierarchy

To resolve conflicts or ambiguity, the following hierarchy of authority is established:
1. `REPOSITORY_CONSTITUTION.md` (Highest Authority — Root level)
2. `.agents/AGENTS.md` (Workspace-scoped Agent rules)
3. Module-level `AGENTS.md` (Local component instructions)
4. CI/CD workflows and automation checks
5. Project coding standards and styling guidelines
6. Developer guides and user manuals

Any lower-level policy that conflicts with a higher-level policy is void.

---

## The Seven Repository Laws

These laws are immutable and cannot be bypassed under any circumstances without explicit repository owner approval.

### Law 1: Production is Sacred
Production is the core asset of SmritiSys. No user, developer, or AI agent may modify, commit, or push code directly to the `main` or production branch. 

### Law 2: Backend is the System of Record
FastAPI + PostgreSQL (`backend/app/`) is the transactional system of record for all business data. Frontend (React/TypeScript) and legacy Express middleware are interface and routing layers, respectively, and must never serve as the source of truth for transactional data.

### Law 3: Completeness Requirement
Every feature branch, optimization, or bug fix must include:
* Successful unit/integration tests.
* Updated developer and user documentation.
* A structured Walkthrough file matching the Walkthrough Governance Policy (WGP).
* A detailed CHANGELOG update.
* A verified rollback plan.

### Law 4: Database Safety
No destructive database changes may be performed in a single release. Column modifications, renaming, or deletions must be executed in a phased, multi-release cycle (Add → Migrate → Remove).

### Law 5: API Compatibility
Public APIs must remain backward-compatible. A breaking API change is strictly prohibited without an approved RFC, maintainer sign-off, a major version bump, and a deprecation cycle.

### Law 6: Governance Gate Strictness
Every Pull Request must pass 100% of the automated CI/CD governance gates. Emergency exceptions are permitted only through the documented Exception Process (Section 18), require explicit approval by an authorized maintainer, and must be recorded with a remediation plan.

### Law 7: AI Agent Status
AI Agents are auxiliary contributors, not repository maintainers. AI agents can create, refactor, document, and test code, but they are forbidden from merging protected branches, modifying repository secrets, altering license terms, or rewriting git history.

---

## 1. Vision & Principles
SMRITI Retail OS is designed to be a secure, resilient, and analytical enterprise retail platform. Core design principles are:
* **Tenant Isolation:** Multi-tenant databases and services must enforce strict data boundaries.
* **Deterministic Execution:** Business operations, billing engines, and numbering series must be immutable and audit-logged.
* **Traceable Changes:** Every code change must have a verifiable line of custody, clear git diffs, and detailed documentation.

---

## 2. Repository Governance
All governance decisions, branch policy shifts, and pipeline updates are governance-class changes. Any modification to this Constitution, `AGENTS.md`, copyright policies, or repository licensing requires:
* A formal Architecture and Licensing Review.
* Creation of a Walkthrough detailing the governance change.
* Registration in the repository-wide CHANGELOG.

---

## 3. Branch Strategy
To maintain stability, the repository uses a structured, multi-tier branching strategy:

* **`main` (Production):** Protected. Receives code only via release pull requests from `staging` or `release/vX.Y.Z`. Direct pushes, force pushes, and deletions are disabled.
* **`develop` (Integration):** Primary target for feature branches. Requires CI verification (linting, formatting, unit tests) before merge.
* **`staging` (UAT / QA):** Deployed to testing environments. Receives release candidates. Requires passing integration, performance, and smoke tests.
* **`release/vX.Y.Z` (Release Candidate):** Frozen branch for pre-release validation. Only documentation fixes, version tag adjustments, and critical release-blocking bug fixes are permitted.
* **`hotfix/*` (Emergency Fixes):** Branched directly from `main` to address production outages. Automatically merged back to both `develop` and `main` upon approval.
* **Working Branches (`feature/*`, `bugfix/*`, `refactor/*`, `security/*`, `performance/*`, `docs/*`):** Short-lived developer and AI branches. Must be merged into `develop` via Pull Requests.

---

## 4. AI Agent Constitution
To ensure stability when interacting with AI coding assistants:
* **Forbidden Actions:**
  * ❌ Push directly to `main`, `develop`, or `staging`.
  * ❌ Execute a force push (`git push -f`).
  * ❌ Delete remote branches or rewrite Git history.
  * ❌ Modify copyright headers, third-party licenses, or `LICENSE` files.
  * ❌ Skip, bypass, or disable any CI pipeline checks.
  * ❌ Automatically rename database tables or API endpoints.
* **Permitted Actions:**
  * ✅ Create feature branches.
  * ✅ Implement code, refactor components, and fix bugs on feature branches.
  * ✅ Write unit, integration, and UI tests.
  * ✅ Update developer documentation and generate walkthrough files.
  * ✅ Open Pull Requests for maintainer review.
* **AI Confidence Block Requirement:**
  Every Pull Request generated or proposed by an AI Agent must include a structured summary containing:
  ```text
  Confidence Level: [High / Medium / Low]
  Assumptions Made:
  Potential Risks & Side Effects:
  Human Review Required Areas:
  ```

---

## 5. Development Workflow (Local Conventions)
To ensure isolation, local paths and environments are separated into strict tiers:
* **Dev Environment (`D:\Smriti_Retail_OS` or workspace root):** All local code edits, new file creations, and Git commits are done here.
* **Test Environment (`F:\Smriti9` or workspace test mirror):** This environment is strictly deploy-only. It receives updates via `git pull` from the remote repository. Files must never be edited directly in the Test Environment.
* **AI Branch Workflow:**
  1. Create a `feature/*` or `bugfix/*` branch from `develop`.
  2. Implement code changes.
  3. Run formatting and lint checks.
  4. Execute unit and integration tests.
  5. Generate a walkthrough document and update the index.
  6. Commit changes using Conventional Commits.
  7. Push the branch to the remote origin.
  8. Open a Pull Request and attach change/test reports.
* **Mandatory Pull Request Template:**
  Every Pull Request must strictly contain the following sections:
  * **Purpose:** High-level summary of changes.
  * **Scope:** Affected modules and directories.
  * **Files Changed:** Granular file-by-file list.
  * **Database Impact:** Schema modifications, migration scripts, or locking behavior.
  * **API Impact:** OpenAPI modifications or route changes.
  * **Performance Impact:** Latency, CPU, memory, or bundle size changes.
  * **Security Impact:** Permission levels, secret usage, and authentication.
  * **Rollback Plan:** Step-by-step restoration checklist.
  * **Testing Evidence:** Literal stdout of tests and linter outputs.
  * **Walkthrough:** Link to the corresponding walkthrough document.
  * **Screenshots / Recordings:** Required for any user interface modifications.

---

## 6. Architecture Protection & CODEOWNERS
Core system directories are designated as **Protected Architecture Modules**. Any changes to files in these directories require an **Architecture Impact Report** before implementation:
* `/backend/app/core/` (Configurations, base security, auth, core middleware)
* `/backend/app/db/` (Database drivers, connection pool, session hooks, base models)
* `/backend/app/compliance/` (Tax gateways, GSTN, invoicing integrations)
* `/docs/architecture/` (System design specifications, ADRs)
* `/.agents/` (AI agent governance rules)

### CODEOWNERS Integration
GitHub CODEOWNERS configuration must enforce mandatory maintainer approval for any PR modifying the protected paths listed above. No merges are permitted into `develop` or `main` without explicit approval from the designated code owners of these modules.

### Architecture Decision Records (ADR)
Every significant architectural change, framework introduction, design pattern modification, or core dependency update must document the decision by creating an Architecture Decision Record (ADR) under `docs/architecture/adr/` following a chronological format (e.g., `ADR-001_Database_Migration_Policy.md`).

---

## 7. Backend System-of-Record Policy
* **FastAPI + PostgreSQL** is the transactional system of record.
* Legacy Express endpoints and `db_store.json` caching files are frozen. No new business logic, database entities, or API routes may be created in Express.
* Strangler-Fig Migration: Capabilities must migrate module-by-module to FastAPI + PostgreSQL. A module is only migrated when the frontend calls the FastAPI endpoint (`/api/v1/*`) directly via `src/lib/apiFetchV1.ts`.

---

## 8. Database Migration Policy
Destructive schema changes must be broken down into three separate releases:
1. **Release 1 (Add):** Create the new column or database table. Ensure application code continues to write to the old structure but can fall back or handle the new one.
2. **Release 2 (Migrate):** Run data migration scripts to sync old data into the new structure. Ensure application code reads/writes from the new structures.
3. **Release 3 (Remove):** Safely drop the old column/table/indexes once the system is stable in production.

---

## 9. API Compatibility Policy
* Public endpoints under `/api/v1/*` must maintain backward compatibility.
* If a breaking change is unavoidable:
  * An RFC must be approved by the maintainer.
  * A deprecation notice must be added (returning `Warning: 199` headers or similar deprecation warnings).
  * An OpenAPI diff (`oasdiff`) must be generated and committed to the PR.
  * The version endpoint must be incremented.

---

## 10. Security Policy & Secrets Management
All commits must pass a secrets scan. Pull Requests will be automatically blocked if any of the following are detected:
* Hardcoded passwords, credentials, or API keys.
* Cleartext tokens (AWS, GCP, Azure, JWT secrets, Firebase credentials, OAuth secrets).
* Google service account JSON key files.
* Private keys, certificates, SSH keys, or environment variables (`.env`).
* Unencrypted database connection strings or production database dumps (`.sql`, `.dump`).

---

## 11. Documentation Governance
Documentation is treated as first-class source code.
* **Auto-Update Trigger:** If source code or APIs change, the corresponding user guide, API documentation, and Wiki must be updated in the same PR.
* **Walkthrough Governance Policy (WGP):** Walkthrough files must follow the naming convention `<Area>_<Topic>_v<Version>.md` under `docs/walkthrough/`. Walkthrough files must never be overwritten; new walkthroughs must be created chronologically and appended to `docs/walkthrough/README.md`.
* **Required Sections:** Walkthrough documents must contain the 13 standard sections (Purpose, Scope, Files Created, Files Modified, Architecture Decisions, Design Rationale, Implementation Summary, Tests Executed, Verification Results, Known Limitations, Future Work, Related ADRs, Related RFCs).

---

## 12. Universal Author Details Policy (UADHP)
Every newly created or modified file (source code, markdown, scripts, configs) must start with the standard SMRITI Author Details Block:

```markdown
<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
  Version      : <current version>
  Created      : <original date>
  Modified     : <current date>
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->
```

---

## 13. Testing Policy & Repository Health Dashboard
All code modifications require verification via automated tests:
* Unit tests must be written for all services and utilities.
* Integration and schema verification tests must run against PostgreSQL.
* UI and responsive layout elements must be validated via component tests.

### Repository Health Dashboard
The CI pipeline must publish repository health metrics upon every integration run, tracking:
* Unit & integration test coverage trend.
* Pipeline build status.
* Security score (vulnerabilities and secret scans).
* Dependency health and licensing compliance.
* Documentation completeness and walkthrough registration.
* Docker build status.
* Core API performance and latency trends.

---

## 14. Docker & Infrastructure Policy
Docker configurations are integrated into the main repository for development, staging, and production:
* **Docker Structure:**
  * `docker-compose.dev.yml` (Development services, hot-reloading)
  * `docker-compose.staging.yml` (Testing, UAT, QA environment)
  * `docker-compose.prod.yml` (Production configurations)
  * `docker-compose.monitoring.yml` (Prometheus, Grafana, alerts)
* **Rules:**
  * Do not expose internal service ports (e.g., PostgreSQL `5432` or Redis `6379`) to the public host in staging or production Compose files.
  * Explicitly pin all base image versions (e.g., `postgres:16-alpine` instead of `postgres:latest`).
  * Run vulnerability scanning (e.g., Trivy or Docker Scout) on built images in the CI/CD pipeline.
  * Build containers locally and verify they boot successfully before opening a Pull Request.

---

## 15. Release Governance & Tagging
Only authorized personnel possess the authority to merge pull requests into the protected `main` branch, publish official releases, or modify release pipeline settings.

Authorized roles are restricted to:
* Repository Owner
* Release Manager
* Maintainers with designated Release permission

### Release Signing & Artifacts
Every official production release must strictly enforce:
* **Signed Git Tags:** Release tags must be cryptographically signed using GPG or SSH keys.
* **Signed Releases:** Release files and binaries published on GitHub must carry matching signatures.
* **Integrity Hashes:** SHA256 checksums must be generated and published alongside all releases and installer scripts.
* **Archival:** All release artifacts must be permanently archived and mirrored in secure backup storage.

---

## 16. Versioning Policy
* **Semantic Versioning (SemVer):** Version numbers must follow the `MAJOR.MINOR.PATCH` pattern.
  * **MAJOR:** Breaking API changes.
  * **MINOR:** New backward-compatible feature additions.
  * **PATCH:** Backward-compatible bug fixes.
* **Conventional Commits:** Commits must utilize structured prefixes (`feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `security:`, `chore:`, `style:`, `build:`).

---

## 17. Emergency Procedures
In the event of a security leak, production outage, or critical data integrity issue, the repository owner or release manager may trigger an **Emergency Lockdown**:
* Merges to all branches except `hotfix/*` are automatically suspended.
* API key and credential rotation scripts are initiated.
* Rollback procedures are immediately executed in staging and production.

---

## 18. Exception Process
If a temporary deviation from these rules is required (e.g., bypass code coverage constraints for a critical production hotfix):
* An explicit override issue must be filed in the repository tracker.
* An authorized maintainer must explicitly sign off and approve the exception.
* The exception must be logged in the release notes with a defined remediation date.

---

## 19. Dependency Approval Policy
No third-party dependency, package, or library (npm or python requirements) may be added to the repository without undergoing a mandatory approval review:
* **License Review:** Verify that the license is commercial-friendly (e.g., MIT, Apache 2.0, BSD) and does not contain copyleft terms (e.g., GPL, AGPL) that violate SMRITI proprietary licensing.
* **Security Review:** Scan the library for known CVEs using automated vulnerability indices.
* **Maintenance Review:** Verify that the package is actively maintained (active commits, issues triage, and releases).
* **Bundle Size Review:** Assess the package size impact on the production build and frontend bundles.
* **Production Suitability:** Confirm that the package is stable, well-tested, and appropriate for enterprise deployment.

---

## 20. Backup & Disaster Recovery Policy
To guarantee operational continuity and prevent loss of transactional and configuration data:
* **Daily Backup Policy:** Automated daily snapshots of database contents, configuration files, and state storage must be captured and pushed to isolated, secure storage.
* **Weekly Restore Verification:** Backups must undergo automated restore validation weekly to guarantee that snapshots are uncorrupted and bootable.
* **Backup Encryption:** All database backups and configuration snapshots must be encrypted at rest using AES-256 before being transferred.
* **Recovery Objectives:** The system target values are established as:
  * **Recovery Point Objective (RPO):** Maximum 24 hours of data loss.
  * **Recovery Time Objective (RTO):** Maximum 4 hours to full service restoration.

---

## Appendix: Automated CI Checklist

The following checks are executed on every Pull Request. A failure in any step blocks merging:
1. **Formatting & Linting:** Run code checkers (TypeScript/Python/CSS linters).
2. **Type Checking:** Compile TypeScript and Python type checkers (`tsc --noEmit` and `mypy`).
3. **Unit & Integration Tests:** Run pytest and vitest test suites.
4. **Security Analysis:** Secrets scan and static code analysis.
5. **Dependency Check:** Verify dependency licenses and vulnerability indices.
6. **Docker Verify:** Build and validate Docker Compose structure.
7. **Database Migration Test:** Verify database schema changes execute successfully against a test database.
8. **HREP & UADHP Compliance:** Check user-facing errors and file headers.
9. **Documentation Match:** Validate walkthrough indices, markdown formats, and wiki references.
