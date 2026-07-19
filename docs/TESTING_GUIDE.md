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

# SMRITI Retail OS Testing Guide

This document describes the test execution processes, mock configurations, and integration test setup for SMRITI Retail OS.

---

## 1. Backend Pytest Framework

FastAPI backend tests are executed using `pytest` and `pytest-asyncio`:
* **Location:** `/backend/app/tests/`
* **Configuration:** `/backend/app/tests/conftest.py`
* **Database Isolation:** Tests utilize a transaction-rollback setup. The database is initialized and seed fixtures are loaded before every test, and the transaction is rolled back after each test run to ensure strict isolation.

### Execute Backend Tests
```bash
cd backend
pytest -v
```

---

## 2. Frontend Vitest Framework

Vite frontend tests are executed using `vitest`:
* **Location:** `/src/tests/`
* **Mocking:** Utilizes Mock Service Worker (MSW) or stubbed functions to bypass direct API connections.

### Execute Frontend Tests
```bash
npm run test
```

---

## 3. Governance Test Gate

All pull requests trigger the CI actions verifying UADHP compliance:
* Checked by running:
  ```bash
  python scripts/validate_governance.py
  ```
* This validation ensures all modified code includes legal headers and walkthrough documents exist before merging is authorized.
