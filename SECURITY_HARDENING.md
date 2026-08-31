# Security Hardening Guide — SMRITI Retail OS

**Date**: 2026-08-31  
**Version**: 3.30.0  
**Status**: Production-Ready ✅

---

## 1. TLS/HTTPS Configuration

### Frontend (Nginx/Reverse Proxy)

```nginx
# /etc/nginx/sites-available/smriti.conf
server {
    listen 443 ssl http2;
    server_name app.smritibooks.com;
    
    # SSL Certificates (use Let's Encrypt or your provider)
    ssl_certificate /etc/letsencrypt/live/app.smritibooks.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/app.smritibooks.com/privkey.pem;
    
    # Strong SSL config (Mozilla Modern)
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    ssl_session_tickets off;
    
    # HSTS (force HTTPS for 1 year)
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
    
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' *.sentry.io; style-src 'self' 'unsafe-inline';" always;
    
    # Redirect HTTP to HTTPS
    root /var/www/smriti/dist;
    index index.html;
    
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    location /api/v1 {
        proxy_pass http://backend:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# HTTP redirect
server {
    listen 80;
    server_name app.smritibooks.com;
    return 301 https://$server_name$request_uri;
}
```

### Backend (FastAPI SSL)

**In `.env.backend`**:
```bash
# SSL certificate paths
SSL_CERTFILE=/etc/certs/cert.pem
SSL_KEYFILE=/etc/certs/key.pem

# Force HTTPS in production
SECURE_SCHEME=https
```

**Verify certificate expiry** (alert before 30 days):
```bash
#!/bin/bash
CERT_FILE="/etc/certs/cert.pem"
EXPIRE_DATE=$(openssl x509 -enddate -noout -in $CERT_FILE | cut -d= -f2)
EXPIRE_EPOCH=$(date -d "$EXPIRE_DATE" +%s)
NOW_EPOCH=$(date +%s)
DAYS_LEFT=$(( ($EXPIRE_EPOCH - $NOW_EPOCH) / 86400 ))

if [ $DAYS_LEFT -lt 30 ]; then
    echo "ALERT: Certificate expires in $DAYS_LEFT days!"
    # Send alert to ops team
fi
```

---

## 2. API Rate Limiting

### FastAPI Configuration

**Install rate limiter**:
```bash
pip install slowapi
```

**Setup in `app/main.py`**:
```python
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter

# Public endpoints: 100 requests/hour
@app.get("/api/v1/auth/login")
@limiter.limit("100/hour")
async def login(request: Request, ...):
    ...

# Authenticated endpoints: 1000 requests/hour per user
@app.get("/api/v1/sales-invoices")
@limiter.limit("1000/hour")
async def list_invoices(request: Request, ...):
    ...

# Bulk operations: 10 requests/hour per user
@app.post("/api/v1/bulk-import")
@limiter.limit("10/hour")
async def bulk_import(request: Request, ...):
    ...
```

**Environment variables**:
```bash
# Rate limit config
RATE_LIMIT_ENABLED=true
RATE_LIMIT_BACKEND=redis  # or memory
RATE_LIMIT_REDIS_URL=redis://localhost:6379/0
```

### Frontend: Request Retry & Backoff

**In `src/lib/apiFetchV1.ts`**:
```typescript
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_BACKOFF_MS = 1000;  // 1s, 2s, 4s exponential backoff

async function apiFetchWithRetry(url: string, options: RequestInit, retries = 0) {
  try {
    const response = await fetch(url, options);
    
    if (response.status === 429) {  // Too Many Requests
      const retryAfter = response.headers.get("Retry-After") || DEFAULT_BACKOFF_MS * Math.pow(2, retries);
      
      if (retries < DEFAULT_MAX_RETRIES) {
        await new Promise(r => setTimeout(r, parseInt(retryAfter) * 1000));
        return apiFetchWithRetry(url, options, retries + 1);
      }
      throw new Error("Rate limit exceeded - max retries");
    }
    
    return response;
  } catch (error) {
    throw error;
  }
}
```

---

## 3. CORS Configuration

### Production CORS Policy

**In `.env.backend`**:
```bash
# Only allow your frontend domain
ALLOWED_ORIGINS=https://app.smritibooks.com,https://admin.smritibooks.com

# Optionally add mobile apps
# ALLOWED_ORIGINS=https://app.smritibooks.com,mobile://app.smritibooks

# Do NOT use "*" (allow all) in production!
```

**Backend validation** (in `app/core/config.py`):
```python
from typing import List

ALLOWED_ORIGINS: List[str] = [
    origin.strip() for origin in os.getenv("ALLOWED_ORIGINS", "").split(",")
    if origin.strip()
]

# Validate CORS is properly configured
if not ALLOWED_ORIGINS or "*" in ALLOWED_ORIGINS:
    if os.getenv("ENVIRONMENT") == "production":
        raise ValueError("ALLOWED_ORIGINS must be explicitly configured in production")
```

### CORS Middleware (in `app/main.py`)

```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,  # Never use ["*"]
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "X-Company-Code", "X-Branch-Code"],
    max_age=3600,  # 1 hour
)
```

---

## 4. JWT Configuration

### Token Expiry & Refresh

**In `.env.backend`**:
```bash
# JWT secrets (generate with `python -c "import secrets; print(secrets.token_urlsafe(32))"`)
JWT_SECRET=YOUR_SECRET_KEY_HERE  # Must be >= 32 chars, stored in vault
JWT_ALGORITHM=HS256

# Token expiry times
JWT_ACCESS_EXPIRE_MINUTES=15        # Short-lived access token
JWT_REFRESH_EXPIRE_DAYS=30          # Long-lived refresh token
JWT_REFRESH_EXPIRE_MINUTES=43200    # (same as 30 days)
```

### Token Rotation Strategy

**Access Token** (15 min expiry):
- Short-lived, reduces exposure window
- Stored in memory (never localStorage in production)
- Automatically refreshed before expiry

**Refresh Token** (30 days expiry):
- HttpOnly, Secure, SameSite=Strict cookie
- Can be revoked server-side
- Used to obtain new access tokens

**Implementation** (backend):
```python
from datetime import datetime, timedelta
from jose import JWTError, jwt

def create_access_token(subject: str, expires_delta: Optional[timedelta] = None):
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.JWT_ACCESS_EXPIRE_MINUTES)
    
    to_encode = {"sub": subject, "exp": expire, "type": "access"}
    encoded_jwt = jwt.encode(to_encode, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)
    return encoded_jwt

def create_refresh_token(subject: str):
    expire = datetime.utcnow() + timedelta(days=settings.JWT_REFRESH_EXPIRE_DAYS)
    to_encode = {"sub": subject, "exp": expire, "type": "refresh"}
    encoded_jwt = jwt.encode(to_encode, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)
    return encoded_jwt
```

### Refresh Endpoint

```python
@app.post("/api/v1/auth/refresh")
async def refresh_token(request: Request):
    """Refresh access token using refresh token from HttpOnly cookie."""
    refresh_token_value = request.cookies.get("refresh_token")
    
    if not refresh_token_value:
        raise HTTPException(status_code=401, detail="Refresh token not found")
    
    try:
        payload = jwt.decode(refresh_token_value, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Invalid token type")
        
        subject = payload.get("sub")
        new_access_token = create_access_token(subject)
        
        return {"access_token": new_access_token, "token_type": "bearer"}
    
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid refresh token")
```

---

## 5. Database Security

### Connection Encryption

**In `.env.backend`**:
```bash
# PostgreSQL SSL mode
DATABASE_URL=postgresql+asyncpg://smriti:PASSWORD@db.smritibooks.com/smriti001?ssl=require

# SSL certificate verification (optional, for self-signed certs)
# DATABASE_URL=...&sslmode=require&sslcert=/path/to/cert.pem
```

### Access Control

**Database user privileges** (principle of least privilege):

```sql
-- Create read-only user for analytics
CREATE USER smriti_analytics WITH PASSWORD 'SECURE_PASSWORD';
GRANT USAGE ON SCHEMA public TO smriti_analytics;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO smriti_analytics;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO smriti_analytics;

-- Create user with limited write access for specific module
CREATE USER smriti_sales WITH PASSWORD 'SECURE_PASSWORD';
GRANT USAGE ON SCHEMA public TO smriti_sales;
GRANT SELECT, INSERT, UPDATE ON sales_invoices TO smriti_sales;
GRANT SELECT ON products, customers TO smriti_sales;

-- Main app user (full access to intended schema)
CREATE USER smriti WITH PASSWORD 'SECURE_PASSWORD';
GRANT USAGE ON SCHEMA public TO smriti;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO smriti;
```

### Connection Pool Security

```python
# In app/db/session.py
from sqlalchemy.pool import QueuePool

DATABASE_POOL_CONFIG = {
    "poolclass": QueuePool,
    "pool_size": 20,
    "max_overflow": 10,
    "pool_timeout": 30,
    "pool_recycle": 3600,  # Recycle connections every hour
    "pool_pre_ping": True,  # Verify connection before use
    "echo": False,  # Don't log SQL in production
}
```

---

## 6. Secrets Management

### Never Commit Secrets

**`.env.backend.local`** (git-ignored):
```bash
# ❌ DO NOT COMMIT THIS FILE
JWT_SECRET=your_secret_key_here
DATABASE_PASSWORD=your_db_password_here
SENTRY_DSN=https://key@sentry.io/project_id
AWS_SECRET_ACCESS_KEY=your_aws_secret_key_here
```

**Use environment variables or secret vaults**:

```bash
# Option 1: Kubernetes Secrets
kubectl create secret generic smriti-secrets \
  --from-literal=JWT_SECRET=your_secret \
  --from-literal=DB_PASSWORD=your_password

# Option 2: AWS Secrets Manager
aws secretsmanager create-secret \
  --name smriti/production/secrets \
  --secret-string '{"JWT_SECRET":"...", "DB_PASSWORD":"..."}'

# Option 3: HashiCorp Vault
vault kv put secret/smriti/production \
  jwt_secret=... \
  db_password=...
```

### Secret Rotation

**Implement secret rotation every 90 days**:

```bash
#!/bin/bash
# scripts/rotate-secrets.sh

# 1. Generate new secrets
NEW_JWT_SECRET=$(python -c "import secrets; print(secrets.token_urlsafe(32))")
NEW_DB_PASSWORD=$(python -c "import secrets; print(secrets.token_urlsafe(24))")

# 2. Update secret store (e.g., AWS Secrets Manager)
aws secretsmanager update-secret \
  --secret-id smriti/production/secrets \
  --secret-string "{\"JWT_SECRET\":\"$NEW_JWT_SECRET\", \"DB_PASSWORD\":\"$NEW_DB_PASSWORD\"}"

# 3. Update database user password
psql -U postgres -c "ALTER USER smriti WITH PASSWORD '$NEW_DB_PASSWORD';"

# 4. Deploy new configuration (triggers container restart)
kubectl rollout restart deployment/smriti-backend

# 5. Log rotation event
echo "Secrets rotated at $(date)" >> /var/log/smriti-audit.log
```

---

## 7. Input Validation & Sanitization

### Frontend Validation

**Use Zod for schema validation**:
```typescript
import { z } from "zod";

const SalesInvoiceSchema = z.object({
  customerId: z.string().uuid(),
  items: z.array(z.object({
    productId: z.string().uuid(),
    quantity: z.number().positive().int(),
    unitPrice: z.number().positive(),
  })),
  notes: z.string().max(500).optional(),
  dueDate: z.date().min(new Date()),
});

type SalesInvoice = z.infer<typeof SalesInvoiceSchema>;

export function createInvoice(data: unknown): SalesInvoice {
  return SalesInvoiceSchema.parse(data);  // Throws on validation failure
}
```

### Backend Validation

**Use Pydantic for API request validation**:
```python
from pydantic import BaseModel, Field, validator
from datetime import date
from uuid import UUID

class SalesInvoiceCreate(BaseModel):
    customer_id: UUID
    items: List[InvoiceItem] = Field(..., min_items=1, max_items=100)
    notes: Optional[str] = Field(None, max_length=500)
    due_date: date = Field(..., gt=date.today())
    
    @validator('notes')
    def sanitize_notes(cls, v):
        if v:
            # Remove potential XSS vectors
            v = v.replace("<", "&lt;").replace(">", "&gt;")
        return v
```

---

## 8. Logging & Audit Trail

### Audit Logging

```python
# app/middleware/audit_logger.py
import json
from datetime import datetime

async def log_audit_event(
    event_type: str,  # "CREATE", "UPDATE", "DELETE"
    resource_type: str,  # "sales_invoice", "product", etc
    resource_id: str,
    user_id: str,
    changes: dict,  # Before/after values
    status: str = "success"  # "success" or "failure"
):
    """Log significant events for compliance/audit purposes."""
    audit_entry = {
        "timestamp": datetime.utcnow().isoformat(),
        "event_type": event_type,
        "resource_type": resource_type,
        "resource_id": resource_id,
        "user_id": user_id,
        "changes": changes,
        "status": status,
    }
    
    # Log to audit table for queryability
    session.add(AuditLog(**audit_entry))
    await session.commit()
    
    # Also log to file for immutability
    with open("/var/log/smriti-audit.log", "a") as f:
        f.write(json.dumps(audit_entry) + "\n")
```

### Sensitive Data Masking

Never log passwords, API keys, PII:
```python
def mask_sensitive_fields(data: dict, sensitive_fields: List[str]) -> dict:
    """Mask sensitive fields in logs."""
    masked = data.copy()
    for field in sensitive_fields:
        if field in masked:
            masked[field] = "***REDACTED***"
    return masked

# Usage
audit_data = {
    "username": "user@example.com",
    "password": "secret123",
    "api_key": "sk-12345",
}
logged_data = mask_sensitive_fields(
    audit_data,
    sensitive_fields=["password", "api_key"]
)
# Result: {"username": "user@example.com", "password": "***REDACTED***", "api_key": "***REDACTED***"}
```

---

## 9. Security Checklist

- [ ] TLS/HTTPS enabled for all traffic
- [ ] Certificate valid and renewed (check 30 days before expiry)
- [ ] Rate limiting configured on API endpoints
- [ ] CORS origins explicitly configured (no `*` in production)
- [ ] JWT secrets >= 32 chars, stored securely (never in git)
- [ ] Token expiry times set (access: 15min, refresh: 30 days)
- [ ] Database passwords changed from defaults
- [ ] Database connection encrypted (SSL required)
- [ ] All user inputs validated (frontend + backend)
- [ ] Sensitive data masked in logs
- [ ] Audit logging enabled for critical operations
- [ ] Secret rotation process documented
- [ ] Security headers configured (HSTS, CSP, X-Frame-Options)
- [ ] Error messages don't leak sensitive information
- [ ] SQL injection prevented (use parameterized queries)
- [ ] CSRF tokens enabled on state-changing requests
- [ ] Admin users have unique, strong passwords
- [ ] MFA enabled for privileged accounts

---

## 10. Incident Response

### If Secrets Are Compromised

```bash
# IMMEDIATE ACTIONS
# 1. Disable compromised token/key
# 2. Generate new secret
# 3. Update secret store
# 4. Restart affected services
# 5. Notify security team
# 6. Review audit logs for unauthorized access

# Example: JWT secret compromise
NEW_SECRET=$(python -c "import secrets; print(secrets.token_urlsafe(32))")

# Update in secret manager
aws secretsmanager update-secret \
  --secret-id smriti/production/secrets \
  --secret-string "{\"JWT_SECRET\":\"$NEW_SECRET\"}"

# Restart backend to use new secret
kubectl rollout restart deployment/smriti-backend

# Invalidate all existing tokens (optional, if token blacklist implemented)
redis-cli FLUSHDB 0  # Clear token cache if using Redis

# Log incident
echo "SECURITY INCIDENT: JWT secret compromised at $(date) - rotated" >> /var/log/security-incidents.log
```

---

**Next Steps**: Review this guide with your security team before production deployment.
