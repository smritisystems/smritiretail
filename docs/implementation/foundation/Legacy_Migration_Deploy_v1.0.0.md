<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 1.0.0
  Created      : 2026-08-24
  Modified     : 2026-08-24
  Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Sprint 6 — Deployment Guide
## Shoper9 → SMRITI Legacy Migration: Test Environment Activation

**Target environment:** `F:\Smriti9` (TEST — read from git pull only, never edit directly)  
**Source environment:** `F:\SMRITRretailNX` (DEV — all code lives here)  
**Date:** 2026-08-24

---

> **MANDATORY — Environment Rule**  
> Per `AGENTS.md` Environment Policy:  
> - `D:\Smriti_Retail_OS` = DEV → all code edits here  
> - `F:\Smriti9` = TEST → receives code via `git pull` ONLY  
> Never write files directly to `F:\Smriti9`.

---

## Pre-Conditions

Before starting, verify the following are true:

```powershell
# 1. Confirm DEV commits are pushed
cd F:\SMRITRretailNX
git log -6 --oneline
# Expected: 2589fb83 through f7384642 (6 sprint commits visible)

# 2. Confirm current alembic head in DEV
cd backend
python -m alembic current
# Expected: v1370_tenant_capability_binding_status (head)
#           (v1371 is staged but NOT yet applied — that happens in TEST)
```

---

## Step 1 — Pull into Test Environment

```powershell
cd F:\Smriti9
git pull origin smritiNX
git log -6 --oneline
# Confirm all 6 sprint commits are present
```

---

## Step 2 — Apply Alembic Migration v1371

```powershell
cd F:\Smriti9\apps\smriti_retail_os\backend

# Verify current alembic head before upgrade
python -m alembic current
# Expected: v1370_tenant_capability_binding_status (head)

# Apply v1371
python -m alembic upgrade head

# Verify after upgrade
python -m alembic current
# Expected: v1371_legacy_menu_map (head)
```

**What `upgrade head` does for v1371:**
- Creates table `smriti_legacy_menu_map` (29 columns)
- Creates `UniqueConstraint` on `(sh9_mnu_no, sh9_menu_opt)`
- Creates `CHECK` constraint on `migration_status` enum
- Creates `CHECK` constraint on non-negative ids
- Creates 4 indexes: `ix_legacy_map_mnu_no`, `ix_legacy_map_status`,
  `ix_legacy_map_menu_id`, `ix_legacy_map_module`
- Idempotent: safe to re-run (checks `information_schema.tables` before creating)

**Expected terminal output:**
```
INFO  [alembic.runtime.migration] Context impl PostgreSQLImpl.
INFO  [alembic.runtime.migration] Will assume transactional DDL.
INFO  [alembic.runtime.migration] Running upgrade v1370_tenant_capability_binding_status -> v1371_legacy_menu_map, Create smriti_legacy_menu_map table
```

---

## Step 3 — Verify Table Created

```powershell
# Connect to smritisys (or smriti_retail) Postgres and run:
python -c "
import os, sys
sys.path.insert(0, 'F:/Smriti9/apps/smriti_retail_os/backend')
import asyncio
from sqlalchemy import text, create_engine

db_url = open('F:/Smriti9/apps/smriti_retail_os/backend/.env').read()
db_url = [l.split('=',1)[1].strip() for l in db_url.splitlines() if l.startswith('DATABASE_URL=')][0]
engine = create_engine(db_url.replace('+asyncpg',''))

with engine.connect() as conn:
    result = conn.execute(text('''
        SELECT table_name, 
               (SELECT count(*) FROM information_schema.columns 
                WHERE table_name=t.table_name AND table_schema=''public'') AS cols
        FROM information_schema.tables t
        WHERE table_schema=''public'' AND table_name=''smriti_legacy_menu_map''
    '''))
    row = result.fetchone()
    if row:
        print(f'Table found: {row[0]}  Columns: {row[1]}')
    else:
        print('ERROR: Table not found -- upgrade may have failed')
"
# Expected: Table found: smriti_legacy_menu_map  Columns: 29
```

---

## Step 4 — Seed the Table

```powershell
cd F:\Smriti9\apps\smriti_retail_os

# Dry-run first (no DB writes)
python scripts/sh9_seed.py --dry-run
# Expected:
#   Loaded 265 rows from SH9_MAP_MATRIX.csv
#   [DRY RUN] Would upsert 265 rows. No DB changes made.

# Live seed (reads DATABASE_URL from backend/.env automatically)
python scripts/sh9_seed.py
# Expected:
#   Loaded 265 rows from SH9_MAP_MATRIX.csv
#   =====================================================
#   SPRINT 2 SEED COMPLETE
#   =====================================================
#   Inserted : 265
#   Updated  :   0
#   Errors   :   0
#   Total    : 265 / 265
#   All rows seeded successfully.
```

---

## Step 5 — Verify Row Counts

```powershell
python -c "
import sys
sys.path.insert(0, 'F:/Smriti9/apps/smriti_retail_os/backend')
from sqlalchemy import text, create_engine

db_url = open('F:/Smriti9/apps/smriti_retail_os/backend/.env').read()
db_url = [l.split('=',1)[1].strip() for l in db_url.splitlines() if l.startswith('DATABASE_URL=')][0]
engine = create_engine(db_url.replace('+asyncpg',''))

with engine.connect() as conn:
    # Total rows
    total = conn.execute(text('SELECT count(*) FROM smriti_legacy_menu_map')).scalar()
    print(f'Total rows      : {total}')

    # Status breakdown
    rows = conn.execute(text('''
        SELECT migration_status, count(*) as cnt
        FROM smriti_legacy_menu_map
        GROUP BY migration_status
        ORDER BY cnt DESC
    ''')).fetchall()
    print('Status breakdown:')
    for r in rows:
        print(f'  {r[0]:<12} {r[1]}')
"
```

**Expected output:**
```
Total rows      : 265
Status breakdown:
  MAPPED         201
  MERGED          27
  PENDING          8
  DEPRECATED      14
  REPLACED        10
  NOT_APPLIC       5
```

---

## Step 6 — Restart FastAPI Backend

```powershell
cd F:\Smriti9\apps\smriti_retail_os\backend
# Stop any running uvicorn instance, then:
uvicorn app.main:app --reload --port 8000
```

---

## Step 7 — Verify API Endpoints Live

```powershell
# Using curl or PowerShell (replace TOKEN with a valid MANAGER JWT)
$TOKEN = "eyJ..."

# 7a. Stats endpoint
Invoke-RestMethod `
  -Uri "http://localhost:8000/api/v1/legacy-menu-map/stats" `
  -Headers @{ Authorization = "Bearer $TOKEN" }
# Expected JSON:
# { "total":265, "mapped":201, "merged":27, "pending":8,
#   "deprecated":14, "replaced":10, "not_applic":5,
#   "coverage_pct":96.9, "modules":{...}, "multi_instance_count":8 }

# 7b. Shoper9 natural-key lookup (Sales Invoice entry)
Invoke-RestMethod `
  -Uri "http://localhost:8000/api/v1/legacy-menu-map/sh9/100/101" `
  -Headers @{ Authorization = "Bearer $TOKEN" }

# 7c. List with status filter
Invoke-RestMethod `
  -Uri "http://localhost:8000/api/v1/legacy-menu-map/?status=PENDING&size=10" `
  -Headers @{ Authorization = "Bearer $TOKEN" }
# Expected: items array with 8 PENDING entries
```

---

## Step 8 — Verify Launchpad Tile Visible

1. Open SMRITI Retail OS frontend in browser
2. Login as MANAGER or SYSADMIN
3. Navigate to **Fiori Launchpad**
4. Scroll to **System & Operations** group
5. Confirm tile: **"Shoper9 → SMRITI Migration"** (violet accent, `Migration` badge)
6. Click tile → verify **LegacyMigDashTab** loads
7. Verify arc-gauge shows ~96.9% coverage
8. Click any status chip → verify Browse view opens with filtered rows

---

## Step 9 — Re-seed After Future Mapping Updates

If `SH9_MAP_MATRIX.csv` is updated (e.g., after 8 PENDING entries are resolved):

```powershell
# In DEV: re-run mapping
cd F:\SMRITRretailNX
python scripts/sh9_map.py
# Commit the updated CSV
git add docs/legacy/shoper/SH9_MAP_MATRIX.csv
git commit -m "feat(migration): resolve pending entries -- [describe change]"
git push

# In TEST: pull + re-seed (idempotent)
cd F:\Smriti9
git pull origin smritiNX
python scripts/sh9_seed.py
# Expected: Inserted: 0, Updated: [n], Errors: 0
```

---

## Rollback (if needed)

```powershell
cd F:\Smriti9\apps\smriti_retail_os\backend

# Downgrade: drops smriti_legacy_menu_map table
python -m alembic downgrade v1370_tenant_capability_binding_status

# Confirm rollback
python -m alembic current
# Expected: v1370_tenant_capability_binding_status (head)
```

> **Note:** Downgrade drops all seeded data. The CSV source remains intact
> in `docs/legacy/shoper/SH9_MAP_MATRIX.csv` and can be re-seeded
> after re-upgrading.

---

## Deployment Checklist

```
Pre-deployment
  [ ] DEV commits pushed (6 sprint commits: f7384642 → 2589fb83)
  [ ] TEST environment accessible

Deployment
  [ ] git pull into F:\Smriti9
  [ ] alembic upgrade head → v1371 applied
  [ ] Table smriti_legacy_menu_map exists (29 columns)
  [ ] sh9_seed.py dry-run: 265 rows, 0 errors
  [ ] sh9_seed.py live: Inserted=265, Updated=0, Errors=0
  [ ] Row count verified: 265 total
  [ ] Status breakdown matches expected (201 MAPPED, etc.)
  [ ] FastAPI restarted

Verification
  [ ] GET /api/v1/legacy-menu-map/stats → 200, correct counts
  [ ] GET /api/v1/legacy-menu-map/sh9/100/101 → 200
  [ ] GET /api/v1/legacy-menu-map/?status=PENDING → 8 items
  [ ] Launchpad tile visible (MANAGER+)
  [ ] Dashboard loads, arc-gauge displays
  [ ] Browse view filters work

Sign-off
  [ ] Walkthrough committed to docs/walkthrough/foundation/
  [ ] CHANGELOG updated (v3.27.0)
  [ ] Implementation index updated
```
