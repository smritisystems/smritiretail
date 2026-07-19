<!--
  Project         : SMRITI Retail OS
  Organization    : SmritiSys

  Founders
  • Pushpa Devi Jawahar Mallah
    Founder & Chairperson

  • Jawahar Ramkripal Mallah
    Founder, Chief Executive Officer (CEO) &
    Chief Systems Architect

  Email           : support@smritisys.com
  Website         : https://smritisys.com
  Other Domains   : smritibooks.com | erpnbook.com | aitdl.com

  Version         : 3.32.0
  Created         : 2026-07-19
  Modified         : 2026-07-19

  Copyright       : © SmritiSys. All Rights Reserved.
  License         : Proprietary Commercial Software
  Classification  : Internal
-->

# GitHub Branch Protection Guidelines

This document specifies the mandatory branch protection settings that must be configured by GitHub administrators for the SMRITI Retail OS repository. These settings enforce the rules established in the **Repository Constitution**.

---

## 1. Protected Branch: `main` (Production)

The `main` branch holds the stable production code. Pushing directly to this branch is strictly disabled.

### Branch Protection Settings

1. **Require a pull request before merging:** **Enabled**
   * *Require approvals:* **Enabled**
   * *Required number of approvals before merging:* **2** (or **1** if the repository has only one active maintainer)
   * *Dismiss stale pull request approvals when new commits are pushed:* **Enabled**
   * *Require review from Code Owners:* **Enabled** (Must be approved by `@smritisys` for protected paths)
   * *Restrict who can dismiss pull request reviews:* **Enabled**

2. **Require status checks to pass before merging:** **Enabled**
   * *Require branches to be up to date before merging:* **Enabled**
   * *Status checks that must pass:*
     * `Formatter / Linter Compliance`
     * `TypeScript / Python Compile Check`
     * `Unit & Integration Tests (Vitest / Pytest)`
     * `Security Secret & Dependency Scan`
     * `Docker Build Verification`
     * `Alembic Database Migration Validation`
     * `Governance Policy Audit`

3. **Require signed commits:** **Enabled**
   * Enforces that all commits merged into `main` must carry verified cryptographically signed GPG or SSH tags.

4. **Require linear history:** **Enabled**
   * Prevents merge commits from being pushed. Only squash merging or fast-forward rebase/merges (as permitted by release rules) are allowed.

5. **Block force pushes:** **Enabled**
   * Force pushing is strictly disabled for all users, including administrators.

6. **Require deployments to succeed before merging:** **Enabled**
   * *Required deployment environments:* `staging`

---

## 2. Protected Branch: `develop` (Integration)

The `develop` branch (or migration integration branches such as `smritiNX`) is the integration target for working branches.

### Branch Protection Settings

1. **Require a pull request before merging:** **Enabled**
   * *Required number of approvals before merging:* **1**
   * *Require review from Code Owners:* **Enabled** (Applies to all files in `/backend/app/core/`, `/backend/app/db/`, etc.)

2. **Require status checks to pass before merging:** **Enabled**
   * *Status checks that must pass:*
     * `Formatter / Linter Compliance`
     * `TypeScript / Python Compile Check`
     * `Unit & Integration Tests (Vitest / Pytest)`
     * `Governance Policy Audit` (Walkthroughs and file headers present)

3. **Block force pushes:** **Enabled**
   * Direct force pushing is disabled.

---

## 3. Protected Branch: `staging` (UAT / QA)

The `staging` branch receives release candidates for staging and pre-production deployments.

### Branch Protection Settings

1. **Require a pull request before merging:** **Enabled**
   * *Required number of approvals before merging:* **1**
   * *Require review from Code Owners:* **Enabled**

2. **Require status checks to pass before merging:** **Enabled**
   * *Status checks that must pass:*
     * All checks required for `develop`.
     * `Smoke, UI, and API Integration Tests`.
     * `Docker Image Vulnerability Scanning (Trivy)`.
     * `Performance and Latency Regression Benchmarks`.

3. **Block force pushes:** **Enabled**
