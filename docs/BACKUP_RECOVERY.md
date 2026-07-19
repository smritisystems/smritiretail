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

# SMRITI Retail OS Backup & Recovery Guide

This document describes the backup protocols, recovery procedures, and backup scheduling instructions for SMRITI Retail OS databases.

---

## 1. Database Backup Strategy

To ensure zero transaction data loss, database backups utilize PostgreSQL standard tools:
* **Backup Tool:** `pg_dump` and `pg_dumpall`.
* **Frequency:**
  * **Daily Full Backups:** Scheduled at 01:00 AM (local branch time).
  * **Hourly Transaction Logs (WAL):** Archived for Point-in-Time Recovery (PITR) configurations.

---

## 2. Automated Backup Execution Script

Run the following cron command script to archive database snapshots:

```bash
#!/bin/bash
BACKUP_DIR="/var/backups/smriti"
DATE=$(date +%Y%m%d_%H%M%S)
DATABASE="smriti_retail_db"
USER="postgres"

pg_dump -U $USER -h localhost -F c -b -v -f "$BACKUP_DIR/smriti_backup_$DATE.dump" $DATABASE
```

---

## 3. Restore & Recovery Procedure

Follow these steps to restore a database dump:
1. **Stop active API servers** to prevent concurrent writes:
   ```bash
   docker compose stop backend
   ```
2. **Re-create database structure:**
   ```bash
   dropdb -U postgres -h localhost smriti_retail_db
   createdb -U postgres -h localhost smriti_retail_db
   ```
3. **Execute database restore:**
   ```bash
   pg_restore -U postgres -h localhost -d smriti_retail_db -v "/var/backups/smriti/smriti_backup_target.dump"
   ```
4. **Run Alembic checks:**
   Ensure migrations are synchronized:
   ```bash
   cd backend
   alembic upgrade head
   ```
5. **Start backend services:**
   ```bash
   docker compose start backend
   ```
