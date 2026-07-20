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
  Created         : 2026-07-10
  Modified         : 2026-07-19

  Copyright       : © SmritiSys. All Rights Reserved.
  License         : Proprietary Commercial Software
  Classification  : Internal
-->

# SMRITI Retail OS

[![Security Scan](https://github.com/smritisystems/smritiretail/actions/workflows/security.yml/badge.svg)](https://github.com/smritisystems/smritiretail/actions)
[![Tests & Verification](https://github.com/smritisystems/smritiretail/actions/workflows/tests.yml/badge.svg)](https://github.com/smritisystems/smritiretail/actions)
[![License: Proprietary](https://img.shields.io/badge/License-Proprietary-red.svg)](LICENSE)

SMRITI Retail OS is an enterprise-grade AI-powered Retail ERP platform built as a modular monolith. It provides support for POS billing, inventory tracking, GST compliance, multi-company/multi-branch operations, and dynamic dashboard layouts.

---

## 1. Product Description
SMRITI Retail OS acts as a centralized retail system-of-record. It enables high-volume retail locations to manage cash register shifts, barcode scan inventory, record sales, automate tax calculations, print billing receipts, and aggregate real-time analytical reports from multiple business branches under a unified corporate group structure.

---

## 2. Key Features
* **POS Billing & Invoicing:** High-speed barcode scanning billing layout with support for cash drawer shifts, hold tickets, and receipt template customization.
* **Smart Inventory Management:** Barcode registration, SKU tracking, stock ledger entries, and automated low-stock notifications.
* **GST & Tax Compliance:** Local and interstate tax calculation rules, HSN code registration, and structural GSTIN check digit verification.
* **Multi-Tenant Operations:** Support for multi-company groups and multi-branch isolation boundaries.
* **SMRITI Layout Engine (SRLE):** Dynamically rendered widget workspaces for cashier operations and reporting.
* **Print Engine Studio:** Raw template layout design using ZPL (Zebra) and TSPL (TSC) label printers.

---

## 3. Default Login Accounts (Seed Credentials)

After a fresh installation, the following default accounts are automatically created by the database seed.

> [!WARNING]
> **Change all default passwords immediately** after first login in any production or staging environment.

| Username  | Password       | Role             | Scope                                   |
|-----------|----------------|------------------|-----------------------------------------|
| `super`   | `Smriti@1234`  | System Admin     | Platform-wide root access               |
| `manager` | `Password@123` | Store Manager    | All modules for `Default Branch`        |
| `cashier` | `Cashier@1234` | Cashier Operator | POS billing and sales for `Default Branch` |

### How Seeding Works

- **Docker startup (`startup.bat` / `docker compose up`):** Seeds run automatically via `entrypoint.sh`.
- **Local development (`npm run start:fastapi`):** Seeds run automatically on FastAPI startup via the `lifespan` hook.
- **Manual seed:** `python -m app.db.seed` (from `backend/` with `.venv` activated).

All seed functions are **idempotent** — safe to run multiple times without creating duplicates.

---

## 3. Architecture Overview

SMRITI Retail OS follows an inward-pointing dependency architecture:

```text
       ┌───────────────────────────────────────────────────┐
       │                 React Frontend                    │
       └─────────────────────────┬─────────────────────────┘
                                 │ HTTP / JSON
                                 ▼
       ┌───────────────────────────────────────────────────┐
       │                Express API Proxy                  │
       └─────────────────────────┬─────────────────────────┘
                                 │ Route Delegation
                                 ▼
       ┌───────────────────────────────────────────────────┐
       │       Platform Abstraction Layer (PAL)            │
       └─────────────────────────┬─────────────────────────┘
                                 │ Inject Context
                                 ▼
       ┌───────────────────────────────────────────────────┐
       │            FastAPI (Python) Backend               │
       └─────────────────────────┬─────────────────────────┘
                                 │ SQLAlchemy ORM
                                 ▼
       ┌───────────────────────────────────────────────────┐
       │               PostgreSQL Database                 │
       └───────────────────────────────────────────────────┘
```

* **Frontend:** Serves as a single-page app (SPA) executing in the browser.
* **Express Gateway:** Serves layout routes, caches transient UI states, and proxies requests.
* **PAL Container:** Enforces inward-pointing layer dependencies and company boundaries.
* **FastAPI Backend:** Coordinates core business entities, security rules, and calculations.

---

## 4. Technology Stack
* **Core Languages:** TypeScript, Python, HTML5, CSS3.
* **Frontend:** React 18, Vite, Tailwind CSS v4, Lucide Icons, Vitest.
* **Backend:** FastAPI, Python 3.11, Pydantic v2, SQLAlchemy 2.x, Alembic, Pytest.
* **Database:** PostgreSQL 16.
* **Deployment:** Docker, Docker Compose.

---

## 5. Folder Structure
```text
f:\SMRITRretailNXmgrt\
├── .github/                 # GitHub Workflows and Templates
├── backend/                 # FastAPI Python Backend
│   ├── app/                 # Core API endpoints, models, and schemas
│   │   ├── api/             # API routes (v1)
│   │   ├── core/            # Configs and cryptographic security helpers
│   │   ├── models/          # SQLAlchemy Database entity definitions
│   │   ├── schemas/         # Pydantic data serialization schemas
│   │   └── services/        # Core business operations
│   └── alembic/             # Database schema migrations
├── src/                     # React Frontend Source Code
│   ├── components/          # Reusable UI component registry
│   ├── contexts/            # User context providers
│   ├── lib/                 # Core utilities (apiFetch, helpers)
│   └── routes/              # Routing modules
├── docs/                    # Architecture, design, and RFC documents
├── package.json             # Node.js project configurations
└── docker-compose.yml       # Development container cluster setup
```

---

## 6. Installation & Setup

### Local Prerequisites
* Node.js v18+
* Python v3.11
* PostgreSQL v16

### Quick Start
1. **Clone the Repository:**
   ```bash
   git clone https://github.com/smritisystems/smritiretail.git
   cd smritiretail
   ```

2. **Frontend Setup:**
   ```bash
   npm install
   npm run dev
   ```

3. **Backend Setup:**
   ```bash
   cd backend
   python -m venv .venv
   source .venv/bin/activate # On Windows: .venv\Scripts\activate
   pip install -r production.txt -r dev.txt
   uvicorn app.main:app --reload
   ```

---

## 7. Docker & Containerized Running
Run the entire platform (Frontend, Backend, and Postgres database) using Docker Compose:

```bash
docker compose up --build
```
* Frontend Dev Server: `http://localhost:5173`
* Backend FastAPI Docs: `http://localhost:8000/docs`

---

## 8. Configuration
Environmental variables are handled by the system configuration:
* Production settings require explicit environment values and will fail to load fallback `.env.example` configurations.
* JWT signing tokens, PostgreSQL connection keys, and API credentials must be set in your `.env` structure.

---

## 9. Security & Access Control
SMRITI enforces Role-Based Access Control (RBAC) across five system roles:
* **SYSADMIN:** Global system configurer.
* **MANAGER:** Tenant company administrative executor.
* **CASHIER:** Local POS register operator.
* **REPORT_USER:** Read-only analyst with print and export capabilities.
* **VIEWER:** Global read-only auditor.

Dynamic permission controls use a tri-state logic (Explicit Deny > Explicit Allow > Inherited Allow > Default Deny).

---

## 10. Testing
Run tests to verify changes:
* **Python Backend Tests:**
  ```bash
  cd backend
  pytest
  ```
* **Frontend Tests:**
  ```bash
  npm test
  ```

---

## 11. Support
For issues, configuration inquiries, or setup help:
* **Email:** support@smritisys.com
* **Security reports:** Please email security@smritisys.com privately for any vulnerability disclosures.

---

## 12. License
SMRITI Retail OS is proprietary commercial software.
Copyright © SmritiSys. All Rights Reserved.
Refer to the [LICENSE](LICENSE) file for usage terms and restrictions.

---

## 13. Capability Matrix (Indian Retail Compliance)

Capability Matrix Status Vocabulary: ✅ Implemented / 🟡 Partial / 🔵 Planned / ⚪ Out of Scope / 🔴 Deprecated

| Feature Area | Sub-feature / Requirement | Status | Details / Constraints |
|---|---|---|---|
| **POS Billing** | Shifts, hold tickets, register checkout, tax calculations | ✅ Implemented | Fully verified via test suite (`test_pos.py`, `test_sales.py`). |
| **Inventory Management** | Barcode registration, SKU tracking, stock ledger entries | ✅ Implemented | Verified via `test_inventory_endpoint_permissions`. |
| **Multi-Tenant Isolation** | Multi-company & multi-branch boundary checks | ✅ Implemented | Enforced in database session filters and checked via `test_tenant_isolation.py`. |
| **GSTIN Validation** | Structural checksum validation (Luhn mod 36) | ✅ Implemented | Centralized check digit algorithm in `app/core/gstin.py` and covered in `test_gstin_compliance.py`. |
| **GSTIN Registry** | Active taxpayer registry verification via GSTN/GSP portal | 🔵 Planned | Out of scope for this phase. Requires external API integration. |
| **Payment Recording** | Payment Mode Recording (CASH, CARD, UPI, CREDIT) | ✅ Implemented | Supported in backend schemas and database models. |
| **UPI Gateway** | UPI Gateway Integration | 🔵 Planned | Direct collection with payment gateway is not implemented in this phase. |
| **UPI Signatures** | UPI Signature Verification | 🔵 Planned | Requires cryptographic key rotation and signature verification. |
| **UPI Webhooks** | UPI Webhook Processing | 🔵 Planned | Background webhook endpoint and status polling is planned. |
| **GST Rate Validation** | GST Rate Validation & Slabs | 🔵 Planned | `gst_rate` is currently an unconstrained Decimal (default 18.00) with no slab enforcement. |
| **E-Way Bill** | E-Way Bill Number Field Recording | 🟡 Partial | Manual entry of `eway_bill_no` in Sales Invoice only. |
| **E-Way Bill Auto** | E-Way Bill Auto Generation via NIC APIs | 🔵 Planned | Out of scope for this phase. |
| **E-Invoicing** | IRN / Signed QR Code Auto Generation | 🔵 Planned | Requires sandbox credentials, IRN API, and receipt QR code integration. |
| **HSN/SAC Validation** | Dynamic verification against master HSN database | ⚪ Out of Scope | Tracked separately; static text registration is supported. |
| **Reverse Charge** | Reverse Charge (RCM) Transaction Handling | ⚪ Out of Scope | Tracked separately. |
| **TCS/TDS** | Tax Collected at Source / Tax Deducted at Source | ⚪ Out of Scope | Tracked separately. |
| **Export GST** | Export Invoice Tax Rules & Zero-rated sales | ⚪ Out of Scope | Tracked separately. |
| **SEZ Transactions** | Special Economic Zone invoice validation | ⚪ Out of Scope | Tracked separately. |

---

## 14. Regulatory Compliance Roadmap (India)

### E-Invoicing Integration Prerequisites (Status: 🔵 Planned)
Before automated E-Invoicing can be deployed, the following milestones must be achieved:
1. **NIC Sandbox Access:** Secure staging access and testing endpoints from the National Informatics Centre.
2. **IRP Credentials:** Register a test GSTIN on the sandbox Invoice Registration Portal.
3. **IRN API Development:** Implement the JSON schema for Invoice Reference Number (IRN) generation.
4. **Signed QR Code Rendering:** Integrate decoding and printing of signed JWT-based QR codes on POS receipts.
5. **Cancellation & Amendment APIs:** Support automated invoice cancellation within the 24-hour window.
6. **Retry & Fallback Queue:** Build a background worker retry engine to queue failed registration attempts.
7. **Production Certification:** Run compliance audits and receive NIC GSP direct integration approval.
