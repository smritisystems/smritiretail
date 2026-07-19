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

# SMRITI Retail OS Installation Guide

This document describes the manual step-by-step installation instructions for installing SMRITI Retail OS on local environments.

---

## 1. System Requirements
* **OS:** Linux (Ubuntu 22.04 LTS recommended), macOS, or Windows 11.
* **Node.js:** Version 18.x or 20.x.
* **Python:** Version 3.11.x.
* **Database:** PostgreSQL v16+.

---

## 2. Step-by-Step Installation

### Step A: Clone the Repository
```bash
git clone https://github.com/smritisystems/smritiretail.git
cd smritiretail
```

### Step B: Frontend Build Setup
1. Install dependencies:
   ```bash
   npm install
   ```
2. Build the static distribution assets:
   ```bash
   npm run build
   ```
3. Test locally:
   ```bash
   npm run dev
   ```

### Step C: Python Backend Setup
1. Create a Python virtual environment:
   ```bash
   cd backend
   python -m venv .venv
   source .venv/bin/activate  # On Windows: .venv\Scripts\activate
   ```
2. Install packaging tools and dependencies:
   ```bash
   python -m pip install --upgrade pip
   pip install -r production.txt -r dev.txt
   ```
3. Create the database:
   Create a local PostgreSQL database named `smriti_retail_db`.
4. Apply Alembic migrations:
   ```bash
   alembic upgrade head
   ```
5. Launch the FastAPI server:
   ```bash
   uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
   ```
