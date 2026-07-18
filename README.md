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

  * Version    : 2.1.1
  * Created    : 2026-07-10
  * Modified   : 2026-07-11
  * Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
  * License    : Proprietary Commercial Software
-->

# SMRITI Retail OS (React + FastAPI Full Stack)

This repository contains the React frontend and FastAPI backend for **SMRITI Retail OS v5.0**, built as a modular monolith with an enterprise-grade open-source stack.

## Overview
This repo includes:
- a React + TypeScript + Tailwind CSS frontend served via Vite
- a FastAPI backend using SQLAlchemy, Alembic, and PostgreSQL
- JWT-based auth, API-first design, and Docker development support
- a modern standalone architecture that avoids legacy Express/Frappe coupling

## Stack
- **React 18**
- **TypeScript**
- **Tailwind CSS v4**
- **Vite**
- **FastAPI**
- **SQLAlchemy 2.x**
- **Alembic**
- **PostgreSQL**

## Features Included
- SMRITI Layout Engine (SRLE) dynamic workspaces
- Print Engine Studio with real ZPL/TSPL template integration
- Drill-down global search and side-panels
- Notification Engine
- Metadata Registry API
- Mocked POS and Supply Chain dashboards

## Development

Install frontend dependencies:
```bash
npm install
```

Install backend dependencies:
```bash
cd backend
python -m pip install --upgrade pip
pip install -r production.txt
pip install -r dev.txt
```

Run the backend API server:
```bash
cd backend
python -m uvicorn app.main:app --reload
```

Run the frontend development server:
```bash
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
