<!--
  SMRITI Retail OS — Masterbook
  Document  : 08_RECOVERY/DISASTER_RECOVERY.md
  Status    : FROZEN
  Version   : 1.0.0  |  Created: 2026-08-10
-->

# Disaster Recovery

---

## Backup Strategy

| Type | Frequency | Retention | Storage |
|---|---|---|---|
| Full DB backup | Daily | 30 days | Off-site |
| WAL archive (incremental) | Continuous | 7 days | Local + Off-site |
| Application snapshot | On every release | Indefinite | Git tags |
| Config snapshot | Weekly | 90 days | Off-site |

---

## Recovery Objectives

| Metric | Target |
|---|---|
| RTO (Recovery Time Objective) | < 4 hours for production |
| RPO (Recovery Point Objective) | < 1 hour data loss |

---

## Recovery Procedures

### Full Database Restore
```bash
# Stop application
systemctl stop smriti-api

# Restore from backup
pg_restore -d smriti_prod -F c /backups/smriti_prod_20260810.dump

# Run migrations to ensure schema is current
alembic upgrade head

# Restart application
systemctl start smriti-api
```

### Point-in-Time Recovery (PITR)
```bash
# Restore base backup + replay WAL to target time
pg_restore ... --target-time="2026-08-10 14:00:00"
```

---

## Environment Isolation in Recovery

**CRITICAL:** Never restore production data into demo/training/test environments without:
1. Explicit user authorization
2. Anonymizing PII (customer names, mobile numbers, GST numbers)
3. Marking the restored environment with `environment_type = TRAINING` or `is_demo = true`

Restoring a `smriti_prod` dump into `smriti_training` without anonymization violates PROD-004.

---

## Application Recovery

```bash
# Rollback a bad deployment
git checkout tags/v3.28.0
npm run build
pm2 restart smriti-frontend

# Backend rollback
git checkout tags/v3.28.0-backend
pip install -r requirements.txt
alembic downgrade -1  # if migration needs to be rolled back
uvicorn app.main:app --reload
```

---

*Status: FROZEN | Version: 1.0.0 | 2026-08-10*
