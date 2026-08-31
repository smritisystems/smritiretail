# Operational Readiness Guide — SMRITI Retail OS

**Date**: 2026-08-31  
**Version**: 3.30.0  
**Status**: Production-Ready ✅

---

## 1. Health Check Endpoints

### Available Endpoints

| Endpoint | Method | Purpose | Response |
|----------|--------|---------|----------|
| `/api/v1/health/status` | GET | App liveliness probe | `{ "status": "ok" }` |
| `/api/v1/health/db` | GET | Database connectivity | `{ "database": "connected" \| "error": "..." }` |
| `/api/v1/health/cache` | GET | Cache layer status | `{ "cache": "ok" \| "degraded" \| "down" }` |
| `/api/v1/setup-status` | GET | Company setup completion | `{ "setupCompleted": bool }` |

### Quick Health Check Script

```bash
# Frontend health (HTTP 200)
curl -s http://localhost:3000 > /dev/null && echo "Frontend: OK" || echo "Frontend: DOWN"

# Backend basic health
curl -s http://localhost:8000/api/v1/health/status | grep -q "ok" && echo "Backend: OK" || echo "Backend: DOWN"

# Database check
curl -s http://localhost:8000/api/v1/health/db | grep -q "connected" && echo "Database: OK" || echo "Database: DOWN"
```

### Kubernetes/Container Probes

For Docker/K8s deployments, use these probe configurations:

**Liveness Probe** (checks if container should be restarted):
```yaml
livenessProbe:
  httpGet:
    path: /api/v1/health/status
    port: 8000
  initialDelaySeconds: 30
  periodSeconds: 10
  timeoutSeconds: 5
  failureThreshold: 3
```

**Readiness Probe** (checks if container can receive traffic):
```yaml
readinessProbe:
  httpGet:
    path: /api/v1/health/db
    port: 8000
  initialDelaySeconds: 15
  periodSeconds: 5
  timeoutSeconds: 3
  failureThreshold: 2
```

---

## 2. Backend Logging & Observability

### Log Configuration

Backend logs are written to:
- **Console**: Real-time streaming for development
- **File**: `/var/log/smriti/backend.log` (production)
- **JSON Format**: Structured logs for aggregation

### Environment Variables for Logging

```bash
# Set logging level (DEBUG, INFO, WARNING, ERROR, CRITICAL)
LOG_LEVEL=INFO

# Enable request/response logging (verbose)
LOG_REQUESTS=true

# Log slow queries (default: 1000ms)
DB_SLOW_QUERY_MS=1000

# Log all SQL statements (development only)
SQLALCHEMY_ECHO=false
```

### Structured Logging Examples

```python
# Backend logs include:
# - Request ID (X-Request-ID header)
# - Company context (X-Company-Code)
# - User context (subject claim from JWT)
# - Operation duration
# - Error stack traces

# Example log entry:
{
  "timestamp": "2026-08-31T10:15:30Z",
  "level": "INFO",
  "request_id": "req-abc123",
  "user_id": "usr-001",
  "company_code": "ACME",
  "path": "/api/v1/sales-invoices",
  "method": "POST",
  "duration_ms": 245,
  "status_code": 201,
  "message": "Sales invoice created"
}
```

### Viewing Logs

```bash
# Docker Compose
docker-compose logs -f backend

# Kubernetes
kubectl logs -f deployment/smriti-backend -c backend

# Tail from file (if deployed on VM)
tail -f /var/log/smriti/backend.log

# Search for errors
grep "ERROR" /var/log/smriti/backend.log

# Watch request performance
grep "duration_ms" /var/log/smriti/backend.log | tail -20
```

---

## 3. Error Tracking & Monitoring

### Recommended Setup: Sentry

**Why Sentry?**
- Real-time error alerting
- Grouped issue tracking
- Source map support (TypeScript)
- Release correlation

### Installation

**Frontend (React)**:
```bash
npm install @sentry/react
```

**Backend (FastAPI)**:
```bash
pip install sentry-sdk
```

### Configuration

**Frontend** (`src/main.tsx`):
```typescript
import * as Sentry from "@sentry/react";

if (process.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.VITE_SENTRY_DSN,
    environment: process.env.VITE_ENV || "development",
    tracesSampleRate: 0.1,
    integrations: [
      new Sentry.Replay({ maskAllText: true }),
      new Sentry.BrowserTracing(),
    ],
  });
}
```

**Backend** (`app/main.py`):
```python
import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration

if settings.SENTRY_DSN:
    sentry_sdk.init(
        dsn=settings.SENTRY_DSN,
        environment=settings.ENVIRONMENT,
        traces_sample_rate=0.1,
        integrations=[FastApiIntegration()],
    )
```

### Environment Variables

```bash
SENTRY_DSN=https://YOUR_PUBLIC_KEY@sentry.io/PROJECT_ID
VITE_SENTRY_DSN=https://YOUR_PUBLIC_KEY@sentry.io/PROJECT_ID_FRONTEND
```

---

## 4. API Response Time Monitoring

### Key Metrics

| Metric | Target | Warning | Critical |
|--------|--------|---------|----------|
| P50 Latency | < 100ms | > 200ms | > 500ms |
| P95 Latency | < 500ms | > 1s | > 2s |
| P99 Latency | < 1s | > 2s | > 5s |
| Error Rate | < 0.1% | > 0.5% | > 1% |
| DB Query Time | < 50ms | > 100ms | > 500ms |

### Monitoring Query Performance

**Enable slow query logging**:
```bash
# .env.backend
DB_SLOW_QUERY_MS=100  # Log queries slower than 100ms
LOG_LEVEL=INFO
```

**Check backend logs**:
```bash
# Find slow queries
grep "duration_ms.*duration_ms" /var/log/smriti/backend.log | \
  awk '{print $NF}' | sort -rn | head -10
```

### Database Connection Pool Monitoring

```python
# In backend logs, watch for:
# "pool_size exceeded"
# "connection timeout"
# "connection closed unexpectedly"

# Adjust if needed in .env.backend:
DATABASE_POOL_SIZE=20
DATABASE_POOL_MAX_OVERFLOW=10
DATABASE_POOL_TIMEOUT=30
DATABASE_POOL_RECYCLE=3600
```

---

## 5. Alerting Strategy

### Alert Rules

**Recommended Alert Configuration** (Prometheus/Grafana or similar):

```yaml
groups:
  - name: SMRITI Alerts
    rules:
      # High error rate
      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.01
        for: 5m
        annotations:
          summary: "Error rate > 1% for 5 minutes"
          severity: "critical"

      # High latency
      - alert: HighLatency
        expr: histogram_quantile(0.95, http_request_duration_seconds) > 1
        for: 5m
        annotations:
          summary: "P95 latency > 1s"
          severity: "warning"

      # Database down
      - alert: DatabaseDown
        expr: up{job="postgres"} == 0
        for: 1m
        annotations:
          summary: "PostgreSQL not responding"
          severity: "critical"

      # Low disk space
      - alert: LowDiskSpace
        expr: disk_available_bytes / disk_total_bytes < 0.1
        annotations:
          summary: "Disk usage > 90%"
          severity: "warning"
```

### Alert Delivery

**Setup notification channels**:
- Slack: `#smriti-alerts` channel
- Email: `ops@company.com`
- PagerDuty: For critical alerts

---

## 6. Runbook: Common Issues & Resolution

### Issue: "Database Connection Pool Exhausted"

**Symptoms**:
- Requests timing out with "QueuePool limit exceeded"
- Errors in API responses

**Resolution**:
```bash
# 1. Check active connections
psql -U smriti -d smriti001 -c "SELECT count(*) FROM pg_stat_activity;"

# 2. Kill idle connections
psql -U smriti -d smriti001 -c "
SELECT pg_terminate_backend(pid) 
FROM pg_stat_activity 
WHERE state = 'idle' AND query_start < now() - interval '1 hour';"

# 3. Increase pool size in .env.backend
DATABASE_POOL_SIZE=30  # Default is 20
DATABASE_POOL_MAX_OVERFLOW=15

# 4. Restart backend
docker-compose restart backend
```

### Issue: "JWT Token Expired"

**Symptoms**:
- Frontend shows "Unauthorized" errors after several hours
- Token refresh is failing

**Resolution**:
```bash
# 1. Check if auth service is responding
curl -s http://localhost:8000/api/v1/auth/refresh -X POST | jq .

# 2. Verify secret is set
echo $JWT_SECRET | wc -c  # Should be > 32 chars

# 3. Check token expiry in logs
grep "token.*expired" /var/log/smriti/backend.log

# 4. Clear frontend session cache
# User should clear browser localStorage:
# Open DevTools > Application > Clear site data

# 5. Restart auth service (FastAPI restart)
docker-compose restart backend
```

### Issue: "Out of Memory (OOM)"

**Symptoms**:
- Docker container exits with code 137
- "Killed" in logs

**Resolution**:
```bash
# 1. Check memory usage
docker stats smriti-backend

# 2. Identify memory leaks
# Check for N+1 query patterns in logs

# 3. Increase container memory in docker-compose.yml
services:
  backend:
    deploy:
      resources:
        limits:
          memory: 2G  # Increase from 1G

# 4. Restart with new memory limit
docker-compose down
docker-compose up -d
```

### Issue: "Slow Report Queries"

**Symptoms**:
- Reports tab loading > 10 seconds
- "Request timed out" errors in reports module

**Resolution**:
```bash
# 1. Profile slow query
psql -U smriti -d smriti001 << 'EOF'
EXPLAIN ANALYZE
SELECT ... FROM your_report_query;
EOF

# 2. Check for missing indexes
SELECT * FROM pg_stat_user_indexes WHERE idx_scan = 0;

# 3. Create missing index (if identified)
CREATE INDEX idx_sales_date ON sales_invoices(document_date);

# 4. Refresh materializ views if used
REFRESH MATERIALIZED VIEW v_sales_summary;

# 5. Monitor before/after
VACUUM ANALYZE sales_invoices;
```

---

## 7. Backup & Disaster Recovery Checklist

### Database Backup

**Automated daily backup** (cron):
```bash
# /etc/cron.d/smriti-backup
0 2 * * * /scripts/backup_postgres.sh >> /var/log/smriti-backup.log 2>&1
```

**Backup Script**:
```bash
#!/bin/bash
BACKUP_DIR="/backups/smriti"
DB_NAME="smriti001"
DATE=$(date +%Y%m%d_%H%M%S)

# Full database dump
pg_dump -U smriti -d $DB_NAME --format=custom > \
  $BACKUP_DIR/smriti_$DATE.dump

# Keep only last 30 days
find $BACKUP_DIR -name "smriti_*.dump" -mtime +30 -delete

# Verify backup integrity
pg_restore --list $BACKUP_DIR/smriti_$DATE.dump > /dev/null && \
  echo "Backup OK: $DATE" || echo "Backup FAILED: $DATE"
```

### Testing Restore Procedure (Monthly)

```bash
# 1. Create test database
createdb smriti_test

# 2. Restore from backup
pg_restore -U smriti -d smriti_test --jobs=4 /backups/smriti/smriti_LATEST.dump

# 3. Run data validation queries
psql -U smriti -d smriti_test << 'EOF'
SELECT COUNT(*) FROM sales_invoices;
SELECT COUNT(*) FROM purchase_orders;
SELECT COUNT(*) FROM products;
EOF

# 4. Compare row counts with production
# Should match (or be within expected variance for time-based data)

# 5. Drop test database
dropdb smriti_test
```

---

## 8. Production Deployment Checklist

- [ ] Database backups configured and tested
- [ ] Health check endpoints verified
- [ ] Error tracking (Sentry) configured
- [ ] Logging aggregation set up
- [ ] Monitoring alerts configured
- [ ] SSL/TLS certificates valid (check expiry: `openssl x509 -enddate -noout -in cert.pem`)
- [ ] Secrets rotated (JWT_SECRET, DB_PASSWORD)
- [ ] Environment variables `.env.backend` and `.env.frontend` populated
- [ ] Database migrations applied (`alembic upgrade head`)
- [ ] Admin user created and verified
- [ ] CORS origins configured correctly
- [ ] API rate limiting configured (if needed)
- [ ] DNS/network connectivity tested
- [ ] Load balancer health check endpoint configured
- [ ] Runbooks distributed to on-call team

---

## 9. Support & Escalation

### Tier 1: Self-Service

- Check health endpoints: `/api/v1/health/*`
- Review application logs: `docker-compose logs backend`
- Verify database connectivity: `psql -U smriti -d smriti001 -c "SELECT 1"`

### Tier 2: Development Team

- Analyze error traces in Sentry
- Review slow queries in PostgreSQL logs
- Check git commit history for recent changes

### Tier 3: Infrastructure Team

- Scale database or application instances
- Restore from backup
- Investigate hardware/network issues

### Escalation Contacts

- **On-Call Engineer**: PagerDuty (critical incidents)
- **Database Admin**: ops-db@company.com
- **Infrastructure**: ops-infra@company.com

---

**Next Steps**: Deploy to production with this guide. Verify all health checks before declaring "go-live."
