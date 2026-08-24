<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.7.0
  Created      : 2026-07-11
  Modified     : 2026-07-11
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Implementation Plan: SMRITI Database Models & Repositories — v3.7.0

This plan details the integration and standardization of database models and repository patterns for the SMRITI FastAPI Core Backend.

---

## 1. Objective
Integrate CRM, Inventory, and Sales models into the FastAPI core framework, standardize the files under the Universal Author Details & File Header Policy (UADHP-v1.0), implement ProductRepository database query patterns, and verify through unit tests.

---

## 2. Business Motivation
Formalizing database model definitions in Python unlocks advanced SQL constraints, async database operations, and data analytics. Standardizing headers preserves SMRITI licensing and copyright integrity.

---

## 3. Scope
* **Models:** Standardize and register CRM (`CustomerGroup`, `Customer`), Inventory (`Product`), and Sales (`SalesInvoice`, `SalesInvoiceItem`) models.
* **Repositories:** Integrate `ProductRepository` with async session context.
* **Headers:** Upgrade all legacy headers in the affected files to follow the Universal Author Details & File Header Policy (UADHP-v1.0).
* **Testing:** Run pytest unit test suite validating schema instantiation.
* **Release:** Bump project version to `3.7.0` in `package.json`.

---

## 4. Current State
* The Python database models and repositories are implemented in the working tree but remain untracked, lack compliant UADHP headers, and are not registered in the project's documentation logs or changelog.

---

## 5. Gap Analysis
* Existing Python files (`crm.py`, `inventory.py`, etc.) lack `Author` and `Email` declarations required by DAGPMP Rule 16 / UADHP-v1.0.
* Package version in `package.json` is `3.6.0`, which needs to be bumped to `3.7.0` for the new release.
* The master indices for plans and walkthroughs do not register the new database files.

---

## 6. Architecture Impact
* Inward-only dependency rule is preserved: models import from `..db.base` and repositories depend on models, remaining framework-independent.

---

## 7. Proposed Design
* **Header Updates:** Insert the triple-quoted block at line 1 of each Python file, declaring Jawahar Ramkripal Mallah as the author and version `3.7.0`.
* **Version Bump:** Set `"version": "3.7.0"` in `package.json`.

---

## 8. Files Created
* `[NEW]` [Database_Models_And_Repositories_Implementation_Plan_v3.7.0.md](file:///d:/IMP/GitHub/SMRITRretailNX/docs/implementation/foundation/Database_Models_And_Repositories_Implementation_Plan_v3.7.0.md)
* `[NEW]` [Foundation_Database_Models_And_Repositories_Walkthrough_v3.7.0.md](file:///d:/IMP/GitHub/SMRITRretailNX/docs/walkthrough/foundation/Foundation_Database_Models_And_Repositories_Walkthrough_v3.7.0.md)

---

## 9. Files Modified
* `[MODIFY]` [crm.py](file:///d:/IMP/GitHub/SMRITRretailNX/backend/app/models/crm.py) — Standardize header.
* `[MODIFY]` [inventory.py](file:///d:/IMP/GitHub/SMRITRretailNX/backend/app/models/inventory.py) — Standardize header.
* `[MODIFY]` [sales.py](file:///d:/IMP/GitHub/SMRITRretailNX/backend/app/models/sales.py) — Standardize header.
* `[MODIFY]` [__init__.py](file:///d:/IMP/GitHub/SMRITRretailNX/backend/app/models/__init__.py) — Standardize header.
* `[MODIFY]` [product.py](file:///d:/IMP/GitHub/SMRITRretailNX/backend/app/repositories/product.py) — Standardize header.
* `[MODIFY]` [__init__.py](file:///d:/IMP/GitHub/SMRITRretailNX/backend/app/repositories/__init__.py) — Standardize header.
* `[MODIFY]` [test_models.py](file:///d:/IMP/GitHub/SMRITRretailNX/backend/app/tests/test_models.py) — Standardize header.
* `[MODIFY]` [package.json](file:///d:/IMP/GitHub/SMRITRretailNX/package.json) — Update version to 3.7.0.
* `[MODIFY]` [CHANGELOG.md](file:///d:/IMP/GitHub/SMRITRretailNX/CHANGELOG.md) — Document version 3.7.0 release.
* `[MODIFY]` [README.md](file:///d:/IMP/GitHub/SMRITRretailNX/docs/implementation/README.md) — Register plan in index.
* `[MODIFY]` [CONSOLIDATED_PLANS.md](file:///d:/IMP/GitHub/SMRITRretailNX/docs/implementation/CONSOLIDATED_PLANS.md) — Consolidate plan.
* `[MODIFY]` [README.md](file:///d:/IMP/GitHub/SMRITRretailNX/docs/walkthrough/README.md) — Register walkthrough in index.
* `[MODIFY]` [CONSOLIDATED_WALKTHROUGHS.md](file:///d:/IMP/GitHub/SMRITRretailNX/docs/walkthrough/CONSOLIDATED_WALKTHROUGHS.md) — Consolidate walkthrough.

---

## 10. Dependencies
* Python pytest and SQLAlchemy dependencies (already installed).

---

## 11. Risks
* None. Standardizing headers and tracking existing passing tests carries minimal risk.

---

## 12. Rollback Strategy
* Revert modifications using standard Git commands: `git checkout -- <files>`.

---

## 13. Verification Plan
* Assert that the Python test suite passes with zero failures.

---

## 14. Test Plan
* Run `python -m pytest backend/app/tests/` to verify Python test assertions.
* Run `npm run test` to verify Node side regressions.

---

## 15. Documentation Impact
* Update implementation index, walkthrough index, and change log history.

---

## 16. Deployment Plan
* Standard development build.

---

## 17. Status
* Draft (Pending User Approval).

---

## 18. Related ADRs
* None.

---

## 19. Related Walkthroughs
* [Foundation_Database_Models_And_Repositories_Walkthrough_v3.7.0.md](file:///d:/IMP/GitHub/SMRITRretailNX/docs/walkthrough/foundation/Foundation_Database_Models_And_Repositories_Walkthrough_v3.7.0.md)
