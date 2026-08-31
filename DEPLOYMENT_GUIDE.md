# Deployment Guide & Troubleshooting — SMRITI Retail OS

**Date**: 2026-08-31  
**Version**: 3.30.0  
**Status**: Production-Ready ✅

---

## 1. Pre-Deployment Checklist

### 48 Hours Before Deployment

- [ ] Verify all tests pass locally (`npm test -- --run`, `pytest tests/`)
- [ ] Run code quality checks (`npm run lint`, `mypy`, `pylint`)
- [ ] Build production bundle (`npm run build`) - verify no warnings
- [ ] Check bundle size hasn't increased significantly
- [ ] Review all commits since last deployment
- [ ] Confirm database migrations are tested
- [ ] Verify backup is current and restorable
- [ ] Notify stakeholders of deployment window
- [ ] Prepare rollback plan and test it
- [ ] Verify DNS/load balancer configuration is ready

### 24 Hours Before Deployment

- [ ] Final smoke tests on staging environment
- [ ] Security scan for vulnerabilities (`npm audit`, `pip safety`)
- [ ] Verify all environment variables are configured
- [ ] Test email notifications (if applicable)
- [ ] Review error tracking (Sentry) configuration
- [ ] Confirm monitoring dashboards are active
- [ ] Verify backup pre-deployment snapshot exists
- [ ] Brief team on deployment procedure

### 2 Hours Before Deployment

- [ ] Final status check: all systems green
- [ ] Notify stakeholders: deployment starting
- [ ] Have rollback commands ready
- [ ] Open monitoring dashboards
- [ ] Have team on standby

---

## 2. Deployment Steps

### Step 1: Build & Push Docker Images

```bash
# Frontend
cd /opt/smriti
docker build -f Dockerfile -t smriti-frontend:3.30.0 .
docker tag smriti-frontend:3.30.0 gcr.io/project-id/smriti-frontend:3.30.0
docker tag smriti-frontend:3.30.0 gcr.io/project-id/smriti-frontend:latest
docker push gcr.io/project-id/smriti-frontend:3.30.0
docker push gcr.io/project-id/smriti-frontend:latest

# Backend
cd /opt/smriti/backend
docker build -f Dockerfile -t smriti-backend:3.30.0 .
docker tag smriti-backend:3.30.0 gcr.io/project-id/smriti-backend:3.30.0
docker tag smriti-backend:3.30.0 gcr.io/project-id/smriti-backend:latest
docker push gcr.io/project-id/smriti-backend:3.30.0
docker push gcr.io/project-id/smriti-backend:latest
```

### Step 2: Backup Production Database

```bash
# Create snapshot
/opt/smriti/scripts/backup-db-full.sh

# Verify backup
ls -lh /backups/postgres/full/ | tail -1
pg_restore --list /backups/postgres/full/smriti_full_*.dump.gz > /dev/null && echo "✅ Backup verified"
```

### Step 3: Deploy Backend

**Blue-Green Deployment Strategy** (zero downtime):

```bash
# Current (Blue) environment is production
# New (Green) environment is staging

# 1. Deploy to Green (staging)
kubectl set image deployment/smriti-backend-green \
  container=smriti-backend=gcr.io/project-id/smriti-backend:3.30.0 \
  -n production

# 2. Wait for Green pods to be ready
kubectl rollout status deployment/smriti-backend-green -n production --timeout=5m

# 3. Run smoke tests against Green
curl http://smriti-backend-green-svc:8000/api/v1/health/status

# 4. Switch traffic to Green
kubectl patch service smriti-backend -p '{"spec":{"selector":{"version":"green"}}}' -n production

# 5. Monitor logs for errors
kubectl logs -f deployment/smriti-backend -n production --tail=100 | head -50

# 6. Verify health metrics
curl http://localhost/api/v1/health/status
curl http://localhost/api/v1/health/db
```

### Step 4: Run Database Migrations

```bash
# Connect to running container
kubectl exec -it deployment/smriti-backend -n production -- bash

# Apply migrations
cd /opt/smriti/backend
alembic upgrade head

# Verify migration completed
alembic current
```

### Step 5: Deploy Frontend

```bash
# Update Nginx configuration
cp /opt/smriti/.nginx/nginx.conf /etc/nginx/sites-available/smriti.conf

# Test Nginx config
nginx -t

# Reload Nginx (no downtime)
systemctl reload nginx

# Verify frontend is accessible
curl https://app.smritibooks.com/

# Check browser console for errors
# (manual step - open in browser and check Network/Console tabs)
```

### Step 6: Health Verification

```bash
# Backend health checks
echo "Checking backend..."
curl http://localhost/api/v1/health/status | jq .
curl http://localhost/api/v1/health/db | jq .
curl http://localhost/api/v1/health/cache | jq .

# Frontend health checks
echo "Checking frontend..."
curl -I https://app.smritibooks.com/ | head -1  # Should be 200

# API response time check
time curl http://localhost/api/v1/companies
# Should complete in < 1 second

# Database query check
curl http://localhost/api/v1/sales-invoices?limit=1 | jq '.data | length'
# Should return 1

echo "✅ All health checks passed"
```

---

## 3. Rollback Procedure

### If Deployment Fails

```bash
# IMMEDIATE: Switch traffic back to Blue (previous version)
kubectl patch service smriti-backend -p '{"spec":{"selector":{"version":"blue"}}}' -n production

# VERIFY: Health checks pass
curl http://localhost/api/v1/health/status
curl http://localhost/api/v1/health/db

# COMMUNICATE: Notify stakeholders of rollback
# MESSAGE: "Deployment rolled back to 3.29.0 due to [reason]"

# INVESTIGATE: Check logs for root cause
kubectl logs deployment/smriti-backend -n production | tail -50 > /tmp/rollback_logs.txt

# FOLLOW UP: Post-incident review within 24 hours
```

### Database Rollback (if migrations fail)

```bash
# List available migrations
alembic history --rev-range 1:current

# Rollback to previous version
alembic downgrade -1  # Rollback one migration
# OR
alembic downgrade a1d94f  # Rollback to specific revision

# Verify rollback
alembic current
```

---

## 4. Post-Deployment Verification

### Check Application Logs (30 minutes post-deploy)

```bash
# Backend logs
docker logs -f $(docker ps | grep smriti-backend | awk '{print $1}') | head -100

# Look for:
# ✅ "Application started successfully"
# ✅ "Database connection established"
# ✅ No ERROR or CRITICAL messages
# ❌ If errors present: investigate and potentially rollback
```

### Monitor Key Metrics

```bash
# API Response Time (P50, P95, P99)
# Expected: P50 < 100ms, P95 < 500ms, P99 < 1s
curl -s http://localhost/metrics | grep "response_time"

# Database Query Performance
# Expected: < 100ms for typical queries
# Check: slow_query_log in PostgreSQL

# Error Rate
# Expected: < 0.1% (less than 1 error per 1000 requests)
# Check: Sentry error tracking

# Memory Usage
# Expected: stable, < 80% of pod limit
docker stats | grep smriti-backend

# Disk Usage
# Expected: stable, previous + any new uploads
df -h | grep /var/lib/smriti
```

### User Acceptance Testing

```bash
# Core workflows to test manually:
# 1. Create a sales invoice
# 2. Create a purchase order
# 3. Create a stock transaction
# 4. Run a report
# 5. Export data
# 6. Create a new user
# 7. Verify permissions/roles work

# If any step fails: prepare rollback
```

---

## 5. Common Deployment Issues & Solutions

### Issue 1: Database Migration Fails

**Symptom**: Migration command hangs or errors

```
ERROR: Alembic upgrade failed: [error message]
Application fails to start
```

**Root Causes**:
1. Migration syntax error
2. Database lock held by another process
3. Insufficient disk space
4. Foreign key constraint violation

**Resolution**:

```bash
# 1. Check current migration state
alembic current
alembic status

# 2. Check for database locks
psql -U smriti -d smriti001 -c \
  "SELECT pid, usename, application_name, state, query \
   FROM pg_stat_activity WHERE state != 'idle';"

# 3. Kill blocking processes (carefully!)
# psql -U smriti -d smriti001 -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE pid != pg_backend_pid();"

# 4. Check disk space
df -h /var/lib/postgresql

# 5. Check for constraint violations (specific to migration)
# Review migration file for issues:
cat backend/alembic/versions/[migration_file].py

# 6. Rollback if needed
alembic downgrade -1

# 7. Test migration in staging before retry
# (Restore staging DB from backup, test migration there)
```

---

### Issue 2: High Memory Usage After Deployment

**Symptom**: Memory usage 90%+, pods getting OOMKilled

```
docker: Error response from daemon: OOMKilled
```

**Root Causes**:
1. Memory leak in new code
2. Increased query result set size
3. Cache not being cleared
4. Pod memory limit too low

**Resolution**:

```bash
# 1. Identify memory hog
docker stats --no-stream | sort -k4 -h | tail -5

# 2. Check application logs for leak indicators
docker logs [container-id] | grep -i memory

# 3. Restart the service to clear memory
docker restart [container-id]

# 4. Monitor memory after restart
docker stats --no-stream [container-id]

# 5. If memory grows immediately (leak):
   # - Check recent code changes
   # - Look for unclosed database connections
   # - Check for uncleared cache objects

# 6. Increase pod memory limit temporarily
kubectl set resources deployment/smriti-backend \
  --limits=memory=2Gi --requests=memory=1Gi \
  -n production

# 7. Investigate root cause while running (don't rollback immediately)
# 8. If unresolvable quickly: rollback
```

---

### Issue 3: API Response Time Degradation

**Symptom**: Requests taking 10+ seconds, timeouts

```
HTTP 504: Gateway Timeout
```

**Root Causes**:
1. Slow database query (N+1 problem)
2. Missing database index
3. External service dependency (email, SMS)
4. High concurrency

**Resolution**:

```bash
# 1. Enable slow query logging
psql -U postgres -d smriti001 -c \
  "ALTER SYSTEM SET log_min_duration_statement = 1000;"  # 1 second threshold
psql -U postgres -d smriti001 -c "SELECT pg_reload_conf();"

# 2. Check slow query log
tail -50 /var/log/postgresql/postgresql.log | grep "duration:"

# 3. Analyze slow query
EXPLAIN ANALYZE SELECT ... FROM sales_invoices WHERE ...;

# 4. Check for missing indexes
SELECT schemaname, tablename, indexname FROM pg_indexes WHERE schemaname = 'public';

# 5. Add missing index if needed
CREATE INDEX idx_sales_invoices_company_code ON sales_invoices(company_code);

# 6. Check connection pool usage
SELECT count(*) FROM pg_stat_activity;  # Should be < pool_size (20)

# 7. If external service is slow:
   # Check if that service has issues
   # Consider timeout or retry strategy
   # Possible temporary rollback to previous version

# 8. Monitor query performance
docker exec [backend-container] tail -50 /var/log/smriti/application.log | grep "query_time"
```

---

### Issue 4: Frontend Blank Page / JS Errors

**Symptom**: Browser shows blank page, console has JS errors

```
Uncaught Error: Cannot find module...
or
Uncaught TypeError: Cannot read property 'xxx' of undefined
```

**Root Causes**:
1. Bundle not built correctly
2. Asset path mismatch
3. API endpoint URL wrong
4. Missing environment variable in frontend build

**Resolution**:

```bash
# 1. Clear browser cache
# Developer Tools -> Application -> Cache Storage -> Clear All

# 2. Check if bundle was built
ls -lh /opt/smriti/dist/index.html
ls -lh /opt/smriti/dist/assets/

# 3. Rebuild frontend if needed
cd /opt/smriti
npm run build

# 4. Check API endpoint configuration
grep -r "API_URL" /opt/smriti/src/ | head -5
# Should be https://app.smritibooks.com/api/v1 in production

# 5. Verify .env configuration
cat /opt/smriti/.env | grep API_URL

# 6. Check for CORS errors
# Open browser DevTools -> Network tab
# Look for failed requests with "No 'Access-Control-Allow-Origin' header"

# 7. Check Sentry error tracking
# Navigate to Sentry dashboard -> Issues -> Latest

# 8. If CSS/assets not loading:
#    - Check Content-Security-Policy headers
#    - Verify Nginx static file path configuration
#    - Check browser Network tab for 404s

# 9. Rollback if unable to diagnose quickly
```

---

### Issue 5: Database Connection Pool Exhaustion

**Symptom**: "too many connections" error, applications hang

```
ERROR: remaining connection slots reserved for non-replication superuser connections
```

**Root Causes**:
1. Connection leak (unclosed connections)
2. Long-running queries holding connections
3. Too many concurrent requests
4. Application not using connection pooling

**Resolution**:

```bash
# 1. Check active connections
psql -U postgres -d smriti001 -c \
  "SELECT datname, count(*) as connections FROM pg_stat_activity GROUP BY datname;"

# 2. Identify connection hogs
psql -U postgres -d smriti001 -c \
  "SELECT pid, usename, application_name, query_start, state, query \
   FROM pg_stat_activity WHERE datname = 'smriti001' ORDER BY query_start;"

# 3. Kill idle connections (safely)
psql -U postgres -d smriti001 -c \
  "SELECT pg_terminate_backend(pid) FROM pg_stat_activity \
   WHERE datname = 'smriti001' AND state = 'idle' \
   AND query_start < now() - interval '10 minutes';"

# 4. Increase max connections (temporary)
psql -U postgres -c "ALTER SYSTEM SET max_connections = 300;"
psql -U postgres -c "SELECT pg_reload_conf();"
# Note: Restart PostgreSQL required for permanent change

# 5. Check application pool configuration
grep -r "pool_size\|max_overflow" /opt/smriti/backend/app/ | head -5
# Should be reasonable: pool_size=20, max_overflow=10

# 6. Review long-running queries
# Enable long-query logging (see Issue 3 above)

# 7. Monitor application connection usage
docker logs -f [backend-container] | grep "pool\|connection"

# 8. If issue persists: restart backend application
docker restart [backend-container]
```

---

### Issue 6: Authentication/JWT Token Errors

**Symptom**: Users get "Unauthorized" or "Token expired" after deployment

```
HTTP 401: Unauthorized
Invalid token or signature
```

**Root Causes**:
1. JWT secret changed
2. Token expiry time changed
3. Refresh token endpoint not working
4. Cookie not being set properly

**Resolution**:

```bash
# 1. Verify JWT secret hasn't changed
# Check .env.backend
grep JWT_SECRET /opt/smriti/.env.backend
# Should be same as before deployment (stored in secure vault)

# 2. Check token expiry settings
grep JWT_.*_EXPIRE /opt/smriti/.env.backend
# ACCESS: should be 15 minutes
# REFRESH: should be 30 days

# 3. Test login endpoint
curl -X POST http://localhost/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"test@company.com", "password":"..."}'

# 4. Check refresh token endpoint
curl -X POST http://localhost/api/v1/auth/refresh \
  -H "Cookie: refresh_token=YOUR_TOKEN"

# 5. Verify cookies are being set (with Secure, HttpOnly flags)
curl -I http://localhost/api/v1/auth/login | grep Set-Cookie

# 6. Check browser cookie storage
# DevTools -> Application -> Cookies -> look for "refresh_token"
# Should have: Secure, HttpOnly, SameSite=Strict flags

# 7. If JWT secret was rotated:
#    - All existing tokens become invalid
#    - Users must re-login
#    - This is expected behavior

# 8. Clear all user sessions (if necessary)
redis-cli FLUSHDB 0  # If using Redis for session store
```

---

## 6. Post-Deployment Monitoring

### First 24 Hours

```bash
# Monitor every 1 hour
watch -n 3600 'curl http://localhost/api/v1/health/status | jq .'

# Check error rate in Sentry
# Expected: < 5 errors per hour in first 24h (ramp-up period)

# Monitor database performance
psql -U smriti -d smriti001 -c \
  "SELECT query, calls, mean_time FROM pg_stat_statements \
   ORDER BY mean_time DESC LIMIT 10;"

# Check memory/CPU trending
docker stats --no-stream > /tmp/metrics_1h.txt
# Check again after 1 hour, compare
```

### First Week

```bash
# Daily review checklist:
# - Error rate trending down?
# - Performance metrics stable?
# - User reports of issues? (check support tickets)
# - Database size growing as expected?
# - Backup jobs completing successfully?

# Weekly summary to stakeholders
echo "Deployment 3.30.0 Summary:"
echo "✅ Zero downtime deployment successful"
echo "✅ All health checks passing"
echo "✅ No critical errors in Sentry"
echo "✅ Performance metrics: [P50=87ms, P95=234ms]"
```

---

## 7. Deployment Runbook Template

```markdown
# Deployment Runbook: Version 3.30.0

**Deployment Window**: 2026-09-01 02:00 - 04:00 UTC
**Duration**: 2 hours
**Rollback Estimate**: 15 minutes

## Pre-Deployment

- [ ] All tests passing
- [ ] Backup completed and verified
- [ ] Team notified
- [ ] Monitoring dashboards open

## Deployment

- [ ] Build and push Docker images
- [ ] Deploy backend (Blue-Green)
- [ ] Run database migrations
- [ ] Deploy frontend
- [ ] Verify health endpoints

## Verification

- [ ] Manual smoke tests pass
- [ ] Sentry errors < 5
- [ ] API response time < 500ms (P95)
- [ ] User reports: none

## Post-Deployment

- [ ] Notify stakeholders: SUCCESS
- [ ] Monitor for 24 hours
- [ ] Update deployment log

## Rollback Procedure (if needed)

1. Switch traffic to Blue environment
2. Run database rollback migrations
3. Notify stakeholders

---
**Deployed By**: [Name]
**Deployment Time**: [Actual time]
**Status**: ✅ SUCCESS / ❌ ROLLED BACK
```

---

## 8. Emergency Contacts

| Situation | Contact | Channel |
|-----------|---------|---------|
| Application down | On-call Engineer | Slack #incident |
| Database issues | Database Admin | Email + Phone |
| Security breach | Security Lead | Encrypted email |
| Performance degradation | Engineering Manager | Slack |

---

## 9. Deployment Success Metrics

✅ **Deployment is successful when**:
- All health checks pass
- Error rate < 0.1% in first hour
- P95 response time < 500ms
- Database migrations completed
- No user-reported issues
- Monitoring shows stable metrics

❌ **Trigger rollback if**:
- Critical errors in application
- Database migration fails
- API response time > 5 seconds
- Error rate > 1% within 30 minutes
- Database connection issues
- Authentication system down
- User-reported data loss/corruption

---

**Next Steps**:
1. Customize this runbook for your infrastructure
2. Test the deployment procedure in staging first
3. Schedule a dry-run deployment
4. Train team on deployment and rollback
5. Set up automated deployment alerts
6. Document your specific deployment commands/URLs

