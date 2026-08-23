<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.24.0
  Created      : 2026-07-09
  Modified     : 2026-08-23
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# SMRITI Retail OS — Third-Party Licenses & IP Boundary Register

This document registers and documents the licenses of upstream systems, frameworks, third-party runtime dependencies, and toolchains used by or interfaced with SMRITI Retail OS.

---

## 1. Upstream Open-Source Frameworks & Derivatives

| Component | Upstream Author / Organization | License | Repository / Website | Usage / Notes |
|---|---|---|---|---|
| **Frappe Framework** | Frappe Technologies Pvt. Ltd. | MIT | https://github.com/frappe/frappe | Upstream architecture references & metadata patterns |
| **ERPNext** | Frappe Technologies Pvt. Ltd. | GNU GPL v3.0 | https://github.com/frappe/erpnext | Upstream business domain models & ledger references |
| **India Compliance** | Resilient Tech & Contributors | GNU GPL v3.0 | https://github.com/resilient-tech/india-compliance | GST/E-Way Bill statutory validation references |
| **Redis** | Redis Ltd. / Redis Open Source | BSD-3-Clause | https://redis.io | In-memory caching and message queue broker |

---

## 2. Backend Runtime & Python Ecosystem

| Package | License | Author / Organization | Purpose in SMRITI |
|---|---|---|---|
| **FastAPI** | MIT | Sebastián Ramírez (tiangolo) | High-performance async REST API engine |
| **Starlette** | BSD-3-Clause | Encode OSS | ASGI core framework for FastAPI |
| **Pydantic** | MIT | Samuel Colvin & Pydantic Contributors | Type validation and schema serialization |
| **SQLAlchemy** | MIT | Michael Bayer & SQLAlchemy Authors | Relational database ORM and connection pooling |
| **Asyncpg** | Apache-2.0 | MagicStack Inc. | High-concurrency PostgreSQL async client |
| **Alembic** | MIT | Michael Bayer | Transactional forward-only database schema migrations |
| **Passlib / Bcrypt** | BSD / Apache-2.0 | Clivern / Passlib Contributors | Cryptographic password hashing and verification |
| **Python-Jose** | MIT | Michael Davis | JWT token encoding, decoding, and verification |
| **Uvicorn** | BSD-3-Clause | Encode OSS | Production ASGI web server worker |
| **Pytest** | MIT | Holger Krekel & Pytest Development Team | Automated test runner and assertion framework |
| **AnyIO** | MIT | Alex Grönholm | Asynchronous concurrency abstraction |

---

## 3. Frontend Client & JavaScript Ecosystem

| Package | License | Author / Organization | Purpose in SMRITI |
|---|---|---|---|
| **React** | MIT | Meta Platforms, Inc. | Declarative UI component engine |
| **React-DOM** | MIT | Meta Platforms, Inc. | Web DOM renderer for React |
| **Vite** | MIT | Evan You & Vite Contributors | Modern frontend build tool and dev server |
| **Tailwind CSS** | MIT | Tailwind Labs, Inc. | Utility-first styling framework |
| **Lucide-React** | ISC | Lucide Contributors | SVG enterprise icon library |
| **Recharts** | MIT | Recharts Group | Materialized charts and analytical visualization |
| **Motion** | MIT | Motion Software Ltd. | Micro-animation and layout transition engine |
| **jsPDF / html2canvas** | MIT | Parashuram & jsPDF Contributors | Client-side invoice rendering and PDF generation |
| **qrcode** | MIT | Soldair & Contributors | Dynamic QR code generation for UPI/B2C invoices |
| **TypeScript** | Apache-2.0 | Microsoft Corporation | Static typing and compile-time contract enforcement |

---

## 4. Intellectual Property Boundary & Compliance Principles

In strict accordance with the **SMRITI License & Copyright Governance Policy**:
1. **Third-Party Code Protection**: The licenses, copyright notices, and author attributions of all third-party software are permanently preserved without alteration.
2. **Proprietary Commercial Core**: All original first-party services, schemas, migrations, AST engines, and UI layers created by SMRITIBooks.com remain **Proprietary Commercial Software** (Copyright © SMRITIBooks.com. All Rights Reserved).
3. **No License Ambiguity**: The presence of upstream GPL-3.0 references (detailed in [`COPYING`](file:///F:/SMRITRretailNX/COPYING)) governs upstream copyleft components and derivative integrations, while SMRITI first-party assets retain their commercial proprietary status.
