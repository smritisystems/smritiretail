# Backup & Disaster Recovery Guide — SMRITI Retail OS

**Date**: 2026-08-31  
**Version**: 3.30.0  
**Status**: Production-Ready ✅

---

## 1. Backup Strategy

### RTO & RPO Targets

| Component | Recovery Time Obj. | Recovery Point Obj. | Backup Freq. |
|-----------|-------------------|-------------------|--------------|
| **Database** | 1 hour | 15 minutes | Every 15 min |
| **Application State** | 30 minutes | 1 hour | Hourly |
| **User Uploads** | 4 hours | 1 day | Daily |
| **Configuration** | 30 minutes | 1 day | Daily |

### Backup Schedule

```yaml
# Production Backup Schedule
database:
  - frequency: every 15 minutes (continuous WAL archiving)
  - full: daily at 2:00 AM UTC
  - retention: 30 days full backups, 7 days transaction logs

application:
  - frequency: hourly (application state snapshots)
  - retention: 7 days

files:
  - frequency: daily at 3:00 AM UTC
  - retention: 30 days

configuration:
  - frequency: daily at 1:00 AM UTC
  - retention: 90 days
```

---

## 2. Database Backup

### PostgreSQL Automated Backup

**Setup WAL archiving** (continuous backup):

```bash
# In postgresql.conf
archive_mode = on
archive_command = '/usr/local/bin/pg_archive_wal.sh %p %f'
archive_timeout = 300

# Create archive script (/usr/local/bin/pg_archive_wal.sh)
#!/bin/bash
WAL_ARCHIVE_DIR="/backups/postgres/wal_archive"
mkdir -p "$WAL_ARCHIVE_DIR"
cp "$1" "$WAL_ARCHIVE_DIR/$2"
echo "Archived WAL: $2 at $(date)" >> /var/log/pg_archive.log
```

### Full Backup Script

**Daily full backup** (`/opt/smriti/scripts/backup-db-full.sh`):

```bash
#!/bin/bash
# Run daily at 2:00 AM UTC via cron: 0 2 * * * /opt/smriti/scripts/backup-db-full.sh

set -e

# Configuration
BACKUP_DIR="/backups/postgres/full"
DB_NAME="smriti001"
DB_USER="smriti"
RETENTION_DAYS=30
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/smriti_full_$TIMESTAMP.dump"

mkdir -p "$BACKUP_DIR"

echo "[$(date)] Starting full database backup..."

# Create dump (custom format for efficiency)
pg_dump \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  --format=custom \
  --verbose \
  --file="$BACKUP_FILE" \
  2>&1 | tee -a /var/log/smriti-backup.log

if [ ${PIPESTATUS[0]} -eq 0 ]; then
    echo "[$(date)] ✅ Backup successful: $BACKUP_FILE"
    
    # Verify integrity
    pg_restore --list "$BACKUP_FILE" > /dev/null && \
        echo "[$(date)] ✅ Backup verified" || \
        echo "[$(date)] ❌ Backup verification failed!"
    
    # Compress backup
    gzip "$BACKUP_FILE"
    BACKUP_FILE="${BACKUP_FILE}.gz"
    
    # Calculate checksum
    sha256sum "$BACKUP_FILE" > "${BACKUP_FILE}.sha256"
    
    # Upload to S3
    aws s3 cp "$BACKUP_FILE" "s3://smriti-backups/postgres/$(date +%Y/%m/%d)/" --storage-class GLACIER
    
    # Cleanup old backups (keep 30 days)
    find "$BACKUP_DIR" -name "smriti_full_*.dump.gz" -mtime +$RETENTION_DAYS -delete
    
    # Alert success
    echo "Database backup: SUCCESS at $(date)" >> /var/log/smriti-maintenance.log
    
else
    echo "[$(date)] ❌ Backup FAILED"
    
    # Send alert
    curl -X POST https://hooks.slack.com/services/YOUR/WEBHOOK/URL \
      -d '{"text":"❌ CRITICAL: Database backup failed on $(date)"}'
    
    exit 1
fi
```

**Add to crontab**:
```bash
# Daily full backup at 2 AM UTC
0 2 * * * /opt/smriti/scripts/backup-db-full.sh >> /var/log/cron.log 2>&1
```

### Incremental Backups

**Every 6 hours via transaction log backup**:
```bash
#!/bin/bash
# /opt/smriti/scripts/backup-db-incremental.sh
# Run every 6 hours: 0 */6 * * * ...

# Already handled by WAL archiving (see archive_command above)
# Just verify WAL files are being archived

WAL_ARCHIVE_DIR="/backups/postgres/wal_archive"
RECENT_WALS=$(find "$WAL_ARCHIVE_DIR" -mmin -360 | wc -l)

if [ "$RECENT_WALS" -gt 0 ]; then
    echo "✅ Incremental backup (WAL): $RECENT_WALS files archived"
else
    echo "⚠️ WARNING: No WAL files archived in last 6 hours"
    curl -X POST https://hooks.slack.com/services/YOUR/WEBHOOK/URL \
      -d '{"text":"⚠️ WARNING: Database WAL archiving may be failing"}'
fi
```

---

## 3. Application State Backup

### Configuration Backup

**Daily config backup** (`/opt/smriti/scripts/backup-config.sh`):

```bash
#!/bin/bash
# Run daily at 1:00 AM UTC

set -e

CONFIG_DIR="/opt/smriti/config"
BACKUP_DIR="/backups/config"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

mkdir -p "$BACKUP_DIR"

# Backup .env files (secrets handled separately)
tar --exclude='.env*' --exclude='*.local' \
    -czf "$BACKUP_DIR/config_$TIMESTAMP.tar.gz" \
    -C /opt/smriti \
    config/ \
    alembic/

echo "Config backup: $BACKUP_DIR/config_$TIMESTAMP.tar.gz" >> /var/log/smriti-backup.log

# Upload to S3
aws s3 cp "$BACKUP_DIR/config_$TIMESTAMP.tar.gz" \
    s3://smriti-backups/config/$(date +%Y/%m/%d)/

# Keep 90 days locally
find "$BACKUP_DIR" -name "config_*.tar.gz" -mtime +90 -delete
```

### File Uploads Backup

**Daily file backup** (`/opt/smriti/scripts/backup-files.sh`):

```bash
#!/bin/bash
# Run daily at 3:00 AM UTC

UPLOAD_DIR="/var/lib/smriti/uploads"
BACKUP_DIR="/backups/files"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

mkdir -p "$BACKUP_DIR"

# Only backup files changed in last 24 hours (incremental)
find "$UPLOAD_DIR" -type f -mtime -1 | \
    tar -czf "$BACKUP_DIR/files_incremental_$TIMESTAMP.tar.gz" \
    -T - \
    2>/dev/null || true

# Weekly full file backup
if [ $(date +%A) == "Sunday" ]; then
    tar -czf "$BACKUP_DIR/files_full_$(date +%Y%m%d).tar.gz" \
        -C "$UPLOAD_DIR" . 2>/dev/null || true
fi

echo "Files backup: complete" >> /var/log/smriti-backup.log

# Upload to S3
aws s3 sync "$BACKUP_DIR" "s3://smriti-backups/files/" --delete --storage-class GLACIER
```

---

## 4. Backup Verification & Testing

### Weekly Backup Integrity Check

**Test script** (`/opt/smriti/scripts/verify-backups.sh`):

```bash
#!/bin/bash
# Run weekly on Saturday at 4:00 AM UTC

echo "====== BACKUP VERIFICATION REPORT ======"
echo "Date: $(date)"

# 1. Check database backup integrity
echo ""
echo "1. Database Backup Integrity:"
LATEST_DUMP=$(ls -1 /backups/postgres/full/smriti_full_*.dump.gz | tail -1)

if [ -z "$LATEST_DUMP" ]; then
    echo "❌ No recent database backup found"
    exit 1
fi

if pg_restore --list "$LATEST_DUMP" > /dev/null 2>&1; then
    echo "✅ Database backup is valid"
else
    echo "❌ Database backup is CORRUPTED"
    exit 1
fi

# 2. Check backup file sizes (sanity check)
echo ""
echo "2. Backup File Sizes:"
ls -lh /backups/postgres/full/smriti_full_*.dump.gz | tail -3

# 3. Check SHA256 checksums
echo ""
echo "3. Checksum Verification:"
cd /backups/postgres/full
for file in smriti_full_*.dump.gz; do
    if [ -f "${file}.sha256" ]; then
        sha256sum -c "${file}.sha256" && echo "✅ $file" || echo "❌ $file"
    fi
done

# 4. Check S3 backup sync status
echo ""
echo "4. Cloud Backup Status:"
aws s3 ls s3://smriti-backups/ --summarize | head -20

# 5. Check backup age
echo ""
echo "5. Backup Age Check:"
LATEST_TIME=$(ls -1 /backups/postgres/full/smriti_full_*.dump.gz | tail -1 | xargs ls -1t | head -1 | xargs stat -f%m 2>/dev/null || stat -c%Y)
NOW=$(date +%s)
AGE_HOURS=$(( ($NOW - $LATEST_TIME) / 3600 ))

if [ $AGE_HOURS -lt 24 ]; then
    echo "✅ Latest backup is ${AGE_HOURS} hours old"
else
    echo "⚠️ WARNING: Latest backup is ${AGE_HOURS} hours old"
fi

echo ""
echo "Verification complete: $(date)" >> /var/log/smriti-backup-verify.log
```

**Add to crontab**:
```bash
# Weekly verification on Saturday at 4 AM UTC
0 4 * * 6 /opt/smriti/scripts/verify-backups.sh | tee -a /var/log/backup-verification.log
```

---

## 5. Disaster Recovery Procedures

### Scenario 1: Database Corruption

**Detection**: Application returns database errors, queries fail

**Recovery Steps**:

```bash
# 1. Identify latest valid backup
ls -lh /backups/postgres/full/ | tail -5

# 2. Stop application to prevent writes
docker-compose stop backend

# 3. Create backup of corrupted database (for forensics)
pg_dump -U smriti -d smriti001 --format=custom > /backups/corrupted_smriti001_$(date +%s).dump

# 4. Drop corrupted database
psql -U postgres -c "DROP DATABASE IF EXISTS smriti001;"

# 5. Create fresh database
psql -U postgres -c "CREATE DATABASE smriti001 OWNER smriti;"

# 6. Restore from backup
pg_restore \
  -U smriti \
  -d smriti001 \
  --clean \
  /backups/postgres/full/smriti_full_YYYYMMDD_HHMMSS.dump.gz

# 7. Apply transaction logs to recover to latest point
# (if using PITR - Point In Time Recovery)
# Requires configuration of recovery.conf

# 8. Run migrations to ensure schema is current
cd /opt/smriti/backend
alembic upgrade head

# 9. Restart application
docker-compose up -d backend

# 10. Run smoke tests
curl http://localhost:8000/api/v1/health/db

# 11. Monitor application logs
docker-compose logs -f backend
```

**Estimated Recovery Time**: 15-30 minutes

---

### Scenario 2: Disk Space Exhaustion

**Detection**: Application fails with "no space left on device"

**Recovery Steps**:

```bash
# 1. Check disk usage
df -h

# 2. Identify large files/directories
du -sh /var/lib/smriti/* | sort -rh | head -10
du -sh /backups/* | sort -rh | head -10

# 3. Clean up old backups (if not on critical path)
find /backups -name "*.dump.gz" -mtime +30 -delete  # Keep 30 days

# 4. Clean up old logs
find /var/log/smriti -name "*.log" -mtime +90 -delete  # Keep 90 days

# 5. Compress inactive logs
find /var/log/smriti -name "*.log" -mtime +30 ! -name "*.gz" -exec gzip {} \;

# 6. Verify disk space is recovered
df -h

# 7. Restart application if it crashed
docker-compose restart backend
```

**Estimated Recovery Time**: 5-10 minutes

---

### Scenario 3: Complete Server Failure

**Detection**: Server/VM is unreachable

**Recovery Steps** (using automated deployment):

```bash
# 1. Verify backup availability
aws s3 ls s3://smriti-backups/postgres/

# 2. Launch new VM/server from template
# (e.g., via AWS AMI, Google GCE snapshot, etc.)

# 3. Restore from latest backup
# (automated via init script or deployment workflow)

# 4. Run post-restore validation
cd /opt/smriti/backend
alembic current  # Check migrations
pytest tests/test_smoke.py  # Smoke tests

# 5. Update DNS/load balancer to point to new server
# (or automatic via infrastructure-as-code)

# 6. Monitor application
docker-compose logs -f

# 7. Failback to original server (when ready)
# Depends on your failover architecture
```

**Estimated Recovery Time**: 30-60 minutes (automated) or 2-4 hours (manual)

---

### Scenario 4: Data Loss / Accidental Delete

**Detection**: Users report missing data, business logic failure

**Recovery Steps**:

```bash
# 1. STOP: Don't make changes to production database yet

# 2. Identify when data was deleted
# Check audit logs or application logs for timestamp

# 3. Find backup from BEFORE the deletion
ls -lh /backups/postgres/full/ | grep "before_deletion_date"

# 4. Restore to temporary database for inspection
createdb smriti001_restore_point

pg_restore \
  -U smriti \
  -d smriti001_restore_point \
  /backups/postgres/full/smriti_full_BEFORE_DELETION.dump.gz

# 5. Verify data is present
psql -U smriti -d smriti001_restore_point \
  -c "SELECT COUNT(*) FROM sales_invoices;"

# 6. Extract missing data
psql -U smriti -d smriti001_restore_point -c \
  "SELECT * FROM sales_invoices WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC LIMIT 100;" \
  > /tmp/deleted_invoices.csv

# 7. Merge back into production database
# Option A: Restore entire database (if large data loss)
#   (follow Scenario 1: Database Corruption recovery)

# Option B: Surgical merge (if small data loss)
#   1. Export missing records from restore_point
#   2. Import into production
#   3. Verify record counts match

# 8. Cleanup
dropdb smriti001_restore_point
```

**Estimated Recovery Time**: 30-90 minutes (depends on data loss scope)

---

## 6. Backup Disaster Recovery Test Plan

### Monthly DR Drill

**1st Saturday of every month at 10 AM**:

```bash
#!/bin/bash
# /opt/smriti/scripts/monthly-dr-drill.sh

echo "====== MONTHLY DR DRILL ======"
echo "Start time: $(date)"

# 1. Restore latest backup to staging
STAGING_DB="smriti001_dr_test"
LATEST_BACKUP=$(ls -1 /backups/postgres/full/*.dump.gz | tail -1)

echo "Using backup: $LATEST_BACKUP"

# Drop old test DB if exists
psql -U postgres -c "DROP DATABASE IF EXISTS $STAGING_DB;" || true

# Create and restore
createdb $STAGING_DB -O smriti
pg_restore -U smriti -d $STAGING_DB "$LATEST_BACKUP"

# 2. Run validation queries
echo "Running validation..."

INVOICE_COUNT=$(psql -U smriti -d $STAGING_DB -t -c "SELECT COUNT(*) FROM sales_invoices;")
PRODUCT_COUNT=$(psql -U smriti -d $STAGING_DB -t -c "SELECT COUNT(*) FROM products;")
USER_COUNT=$(psql -U smriti -d $STAGING_DB -t -c "SELECT COUNT(*) FROM users;")

echo "  Invoices: $INVOICE_COUNT"
echo "  Products: $PRODUCT_COUNT"
echo "  Users: $USER_COUNT"

if [ "$INVOICE_COUNT" -lt 100 ]; then
    echo "❌ ERROR: Data looks incomplete!"
    exit 1
fi

# 3. Run application schema checks
echo "Checking application compatibility..."
SCHEMA_VERSION=$(psql -U smriti -d $STAGING_DB -t -c "SELECT version FROM alembic_version;")
echo "  Schema version: $SCHEMA_VERSION"

# 4. Cleanup
dropdb $STAGING_DB

echo "✅ DR Drill Complete: $(date)"
echo "Result: PASS" >> /var/log/dr-drill-results.log
```

---

## 7. Backup Storage & Redundancy

### Multi-Region Backup

```bash
# Primary: Local backups (for quick restore)
/backups/postgres/full/  # Keep 30 days locally

# Secondary: Cloud storage (for disaster recovery)
aws s3 cp /backups/postgres/full/smriti_full_*.dump.gz \
    s3://smriti-backups-primary/postgres/ \
    --storage-class STANDARD_IA  # Infrequent Access (cheaper)

# Tertiary: Cross-region backup (for major disaster)
aws s3 cp s3://smriti-backups-primary/postgres/ \
    s3://smriti-backups-replica-us-east-1/postgres/ \
    --region us-east-1 \
    --recursive \
    --storage-class GLACIER  # Long-term archive
```

### Cost Optimization

| Storage | Retention | Cost/month |
|---------|-----------|-----------|
| Local SSD | 30 days | ~$50 |
| S3 Standard IA | 30 days | ~$10 |
| S3 Glacier | 1 year | ~$5 |
| **Total** | **Max 1 year** | **~$65** |

---

## 8. Backup Monitoring Dashboard

**Track backup health metrics**:

```bash
#!/bin/bash
# Generate backup status report

echo "📊 BACKUP STATUS REPORT"
echo "Generated: $(date)"
echo ""

# Last backup age
LATEST=$(ls -1 /backups/postgres/full/*.dump.gz | tail -1)
LATEST_TIME=$(stat -c%Y "$LATEST" 2>/dev/null)
NOW=$(date +%s)
AGE_MINS=$(( ($NOW - $LATEST_TIME) / 60 ))

echo "Last Database Backup:"
echo "  File: $(basename $LATEST)"
echo "  Age: ${AGE_MINS} minutes"
echo "  Status: $([ $AGE_MINS -lt 1440 ] && echo '✅ OK' || echo '❌ STALE')"
echo ""

# Total backup size
BACKUP_SIZE=$(du -sh /backups | cut -f1)
echo "Backup Storage:"
echo "  Local: $BACKUP_SIZE"
echo ""

# S3 sync status
S3_SIZE=$(aws s3 ls s3://smriti-backups --summarize --recursive | grep "Total Size" | awk '{print $3}')
echo "  Cloud: $S3_SIZE"
echo ""

# Backup success rate (last 30 days)
SUCCESS=$(grep "Backup successful" /var/log/smriti-backup.log | wc -l)
FAILED=$(grep "Backup FAILED" /var/log/smriti-backup.log | wc -l)
echo "Backup Success Rate (30 days):"
echo "  Successful: $SUCCESS"
echo "  Failed: $FAILED"
echo "  Rate: $(( SUCCESS * 100 / (SUCCESS + FAILED + 1) ))%"
```

---

## 9. Recovery Contacts & Escalation

| Role | Name | Phone | Email |
|------|------|-------|-------|
| Database Admin | - | - | dba@company.com |
| Infrastructure | - | - | ops@company.com |
| Security Lead | - | - | security@company.com |
| On-Call (Critical) | - | +1-XXX-XXX-XXXX | oncall@company.com |

---

## 10. Compliance Checklist

- [ ] Backups are automated (no manual steps)
- [ ] Backups are encrypted in transit and at rest
- [ ] Backup integrity is tested monthly
- [ ] Restoration procedures are documented
- [ ] Recovery time target (1 hour) is achievable
- [ ] Backups are stored in multiple regions
- [ ] Backup retention meets compliance requirements
- [ ] Backup logs are retained for audit
- [ ] Team is trained on recovery procedures

---

**Next Steps**: 
1. Set up automated backup cron jobs
2. Configure AWS S3 or equivalent cloud storage
3. Schedule monthly DR drills
4. Train team on recovery procedures
5. Document your specific backup paths and credentials (in secure location, not in this file)

