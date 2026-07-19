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

# SMRITI Retail OS Release & Rollback Governance Checklist

This document contains the official checklists for preparing, validating, executing, and rolling back product releases of SMRITI Retail OS.

---

## 1. Pre-Release Checklist
- [ ] **Tests Passed:** Verify that both Node frontend tests (`npm test`) and Pytest backend tests (`pytest`) pass 100% locally.
- [ ] **Governance Check:** Run `python scripts/validate_governance.py` and confirm that UADHP headers and walkthrough indices are clean.
- [ ] **Open Database Migrations:** Ensure all migrations in `backend/alembic/versions/` have corresponding downgrade logic.
- [ ] **Dependency Audit:** Execute `pip-audit` and `npm audit --audit-level=high` to confirm zero critical vulnerabilities.
- [ ] **Version Bump:** Update the application version inside:
  - `package.json`
  - `backend/app/core/config.py`
  - Repository Constitution
- [ ] **CHANGELOG:** Verify that `CHANGELOG.md` is updated with a section outlining all additions, changes, and deprecations.

---

## 2. Release Deployment Checklist
- [ ] **Tag Generation:** Create a cryptographically signed git tag:
  ```bash
  git tag -s v3.32.0 -m "Release version 3.32.0"
  git push target v3.32.0
  ```
- [ ] **CI Pipeline Validation:** Verify that the GitHub Actions Release Workflow triggers successfully.
- [ ] **Asset Checks:** Ensure the release artifacts (`.tar.gz`, `.zip`), rollback packages, and `sha256_checksums.txt` are attached to the GitHub release.
- [ ] **Docker Hub/GHCR:** Verify that the built frontend and backend images are tagged with the release version and pushed to the registry.

---

## 3. Rollback Playbook & Checklist
If a release causes database locks, API outages, or memory leaks post-deployment:
- [ ] **Route Shutdown:** Set a maintenance banner on the gateway proxy.
- [ ] **Container Downgrade:** Revert container image tags in the compose files to the previous stable release version.
- [ ] **Database Restoration:** Run the Alembic downgrade command to revert database schema migrations (if schema migrations were applied):
  ```bash
  cd backend
  alembic downgrade -1  # Revert the latest migration
  ```
  *(Or restore the pre-release pg_dump backup if the migrations are destructive or fail to downgrade).*
- [ ] **Verify Status:** Trigger the system diagnostic test suite to verify connectivity and API responsiveness:
  ```bash
  python -m pytest backend/app/tests/test_system_doctor.py
  ```
- [ ] **Re-enable Routes:** Remove the maintenance banner and resume normal POS operations.
