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

  * Version    : 3.16.0
  * Created    : 2026-07-10
  * Modified   : 2026-08-19
  * Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
  * License    : Proprietary Commercial Software
-->

# SMRITI Retail OS (React + FastAPI Full Stack)

This repository contains the React frontend and FastAPI backend for **SMRITI Retail OS**, built as an enterprise-grade multi-company retail operating system.

---

## 1. Canonical Multi-Company Architecture

SMRITI Retail OS enforces strict physical multi-database tenant isolation:

```text
                    SMRITI RETAIL OS
                           │
                      smritisys
                    CONTROL PLANE
                           │
                 CompanyDatabaseResolver
                           │
          ┌────────────────┼────────────────┐
          ▼                ▼                ▼
      smriti001        smriti002        smriti00N
      Company 001      Company 002      Company N
          │                │                │
          ├─ Sales         ├─ Sales        ├─ Sales
          ├─ Purchase      ├─ Purchase     ├─ Purchase
          ├─ Inventory     ├─ Inventory    ├─ Inventory
          ├─ POS           ├─ POS          ├─ POS
          ├─ Accounting    ├─ Accounting   ├─ Accounting
          ├─ Barcode       ├─ Barcode      ├─ Barcode
          ├─ eCommerce     ├─ eCommerce    ├─ eCommerce
          └─ PSV           └─ PSV          └─ PSV
```

- **`smritisys` (Control Plane):** Identity, auth, RBAC roles/permissions, company/branch registries, database routing metadata (`company_database_registries`), immutable menus (34 items), central static masters, and system audit logs. Zero operational transactional writes.
- **`smriti<Code>` (Company Operational DB):** Dedicated physical database per registered company (e.g. `smriti001`, `smriti002`). Hosts all operational transactions (sales invoices, purchase orders, inventory stock, customer ledgers).
- **`CompanyDatabaseResolver`:** Authoritative gateway for dynamically resolving and binding database sessions.
- **`Party Stock Visibility (PSV)`:** 100% Company-local shadow inventory and intelligence layer inside each Company DB (`smriti<Code>`). Projections do not mutate core stock balances.

The frozen blueprint is tracked separately from implementation progress. See [SMRITI Platform Implementation Status](docs/architecture/SMRITI_PLATFORM_IMPLEMENTATION_STATUS.md) for the current verified, partial, and pending areas.
- **`eCommerce & Omnichannel`:** Core capability channel feeding the company operational DB via unified commerce flows.

---

## 2. Technology Stack
- **Frontend:** React 18, TypeScript, Tailwind CSS, Vite
- **Backend:** FastAPI (Python 3.13), SQLAlchemy 2.x (Asyncpg), PostgreSQL 17
- **Routing:** Platform Abstraction Layer (PAL), `CompanyDatabaseResolver`
- **Testing:** Pytest (336 / 336 Passed, Exit Code 0)

---

## 3. Development & Execution

### Install Backend Dependencies:
```bash
cd backend
pip install -r production.txt
pip install -r dev.txt
```

### Run Test Suites:
```bash
# Suite 1: Production Contract Suite (158 Tests)
pytest tests/

# Suite 2: App Async Unit & Integration Suite (178 Tests)
pytest app/tests/
```

### Run API Server:
```bash
cd backend
python -m uvicorn app.main:app --reload --port 8000
```

### Run Frontend:
```bash
npm install
npm run dev
```

## Environment Configuration Behavior
- Production: requires real environment variables and will not fall back to `.env.example`.
- Development: uses `.env` when present, and may use `.env.example` only under approved local/test conditions.
- CI / tests: may use `.env.example` when explicitly running the test environment.

## Architecture Note
This configuration behavior is an implementation detail. It does not modify the metadata architecture defined in `ADR-002-SMRITI-METADATA-ARCHITECTURE` and therefore does not require a superseding ADR.
Future changes affecting metadata ownership, runtime metadata, or architecture must follow the governance process documented in `docs/governance/GOVERNANCE_FREEZE_CHECKLIST.md`.

## Note
This repository now contains a full-stack React frontend and FastAPI backend for SMRITI Retail OS v5.0. Legacy Express/Frappe proxy code has been removed from the active stack.
