# 🔐 SECRETS MANAGEMENT GUIDE - SMRITI Retail OS

## CRITICAL: Hardcoded Secrets Have Been Removed

**Status:** ✅ All hardcoded secrets removed from `.env`  
**Date:** 2026-08-31  
**Impact:** Production deployments must use secure secrets management

---

## SECURITY ISSUE - RESOLVED

### ⛔ Previous State (INSECURE)
```env
JWT_SECRET_KEY=9a12c418-5a48-43d9-90b5-555a6d71b87a          # ❌ COMPROMISED
INTERNAL_SERVICE_KEY=smriti_secret_fallback_key               # ❌ COMPROMISED
SGIP_VAULT_MASTER_KEY=sgip_vault_master_secret_key_12345      # ❌ COMPROMISED
```

### ✅ Current State (SECURE)
```env
JWT_SECRET_KEY=${JWT_SECRET_KEY}                              # Requires environment variable
INTERNAL_SERVICE_KEY=${INTERNAL_SERVICE_KEY}                  # Requires environment variable
SGIP_VAULT_MASTER_KEY=${SGIP_VAULT_MASTER_KEY}                # Requires environment variable
```

---

## IMMEDIATE ACTIONS REQUIRED

### 1. ⚠️ ROTATE ALL SECRETS IMMEDIATELY (Production Systems)

If these hardcoded secrets were ever used in production:

```bash
# Generate new secure secrets
python backend/generate_secrets.py --format env --output /tmp/new-secrets.env

# Load into your secrets manager (see options below)
# Verify old secrets are no longer in use
# Update all systems to use new secrets
```

### 2. Set Up Secrets Management (Choose One)

---

## SECRETS SETUP OPTIONS

### Option 1: Environment Variables (Development Only)

**⚠️ Security Level:** LOW - Use only for local development

```bash
# Terminal 1: Set environment variables
export JWT_SECRET_KEY=$(openssl rand -hex 32)
export INTERNAL_SERVICE_KEY=$(openssl rand -hex 32)
export SGIP_VAULT_MASTER_KEY=$(openssl rand -hex 32)

# Terminal 2: Run application (inherits environment)
python -m uvicorn backend.app.main:app --port 8000
```

**Files:**
- `.env` - Updated to use `${VAR_NAME}` placeholders
- `.env.example` - Safe to commit (no secrets)

---

### Option 2: Docker Secrets (Recommended for Docker Compose)

**⚠️ Security Level:** MEDIUM - Good for containerized deployments

```bash
# Step 1: Generate secrets
python backend/generate_secrets.py --format env

# Step 2: Create Docker secrets
echo "your-jwt-secret-here" | docker secret create jwt_secret -
echo "your-internal-service-key" | docker secret create internal_service_key -
echo "your-vault-master-key" | docker secret create vault_master_key -

# Step 3: Update docker-compose.yml
docker stack deploy -c docker-compose.yml smriti
```

**docker-compose.yml Example:**
```yaml
services:
  smriti-api:
    image: smriti-api:3.30.0
    secrets:
      - jwt_secret
      - internal_service_key
      - vault_master_key
    environment:
      JWT_SECRET_KEY_FILE: /run/secrets/jwt_secret
      INTERNAL_SERVICE_KEY_FILE: /run/secrets/internal_service_key
      SGIP_VAULT_MASTER_KEY_FILE: /run/secrets/vault_master_key

secrets:
  jwt_secret:
    external: true
  internal_service_key:
    external: true
  vault_master_key:
    external: true
```

**Update backend/app/settings.py:**
```python
import os
from pathlib import Path

def get_secret(env_var: str, file_var: str) -> str:
    """Get secret from environment variable or Docker secret file."""
    # Check if file-based secret exists (Docker)
    secret_file = os.getenv(file_var)
    if secret_file and Path(secret_file).exists():
        return Path(secret_file).read_text().strip()
    
    # Fall back to environment variable
    secret = os.getenv(env_var)
    if not secret:
        raise ValueError(f"Secret not found: {env_var} or {file_var}")
    
    return secret

JWT_SECRET_KEY = get_secret("JWT_SECRET_KEY", "JWT_SECRET_KEY_FILE")
INTERNAL_SERVICE_KEY = get_secret("INTERNAL_SERVICE_KEY", "INTERNAL_SERVICE_KEY_FILE")
```

---

### Option 3: HashiCorp Vault (Production Grade)

**⚠️ Security Level:** HIGH - Industry standard for secrets management

```bash
# Step 1: Start Vault
docker run --cap-add=IPC_LOCK -p 8200:8200 vault:latest

# Step 2: Initialize and unseal
vault operator init
vault operator unseal <key>

# Step 3: Authenticate and store secrets
vault login <token>
vault kv put secret/smriti/production \
  jwt_secret_key="$(openssl rand -hex 32)" \
  internal_service_key="$(openssl rand -hex 32)" \
  sgip_vault_master_key="$(openssl rand -hex 32)"

# Step 4: Configure application to read from Vault
```

**backend/app/vault_client.py:**
```python
import hvac
import os

def init_vault():
    """Initialize Vault client and load secrets."""
    client = hvac.Client(
        url=os.getenv("VAULT_ADDR", "http://localhost:8200"),
        token=os.getenv("VAULT_TOKEN")
    )
    
    # Read secrets
    response = client.secrets.kv.read_secret_version(
        path="smriti/production"
    )
    
    return response['data']['data']

# Usage
secrets = init_vault()
JWT_SECRET_KEY = secrets['jwt_secret_key']
INTERNAL_SERVICE_KEY = secrets['internal_service_key']
```

---

### Option 4: Cloud Provider Secrets Manager

**⚠️ Security Level:** VERY HIGH - Recommended for cloud deployments

#### AWS Secrets Manager
```python
import boto3

def get_aws_secret(secret_name: str) -> str:
    session = boto3.session.Session()
    client = session.client(
        service_name='secretsmanager',
        region_name=os.getenv('AWS_REGION', 'us-east-1')
    )
    response = client.get_secret_value(SecretId=secret_name)
    return response['SecretString']

JWT_SECRET_KEY = get_aws_secret('smriti/jwt-secret')
```

#### Azure Key Vault
```python
from azure.identity import DefaultAzureCredential
from azure.keyvault.secrets import SecretClient

def get_azure_secret(secret_name: str) -> str:
    credential = DefaultAzureCredential()
    client = SecretClient(
        vault_url=os.getenv('AZURE_VAULT_URL'),
        credential=credential
    )
    return client.get_secret(secret_name).value

JWT_SECRET_KEY = get_azure_secret('jwt-secret')
```

#### Google Cloud Secret Manager
```python
from google.cloud import secretmanager

def get_gcp_secret(secret_id: str, version_id: str = "latest") -> str:
    client = secretmanager.SecretManagerServiceClient()
    project_id = os.getenv('GCP_PROJECT_ID')
    name = f"projects/{project_id}/secrets/{secret_id}/versions/{version_id}"
    response = client.access_secret_version(request={"name": name})
    return response.payload.data.decode("UTF-8")

JWT_SECRET_KEY = get_gcp_secret('smriti-jwt-secret')
```

---

## GENERATING SECURE SECRETS

### Using Python Script (Recommended)
```bash
# Generate all secrets at once
python backend/generate_secrets.py --format env --output .env.production

# Different formats available
python backend/generate_secrets.py --format export --output secrets.sh
python backend/generate_secrets.py --format json --output secrets.json
python backend/generate_secrets.py --format docker
```

### Using OpenSSL
```bash
# Generate 32-byte (256-bit) hex string
openssl rand -hex 32

# Generate 64-byte (512-bit) hex string
openssl rand -hex 64

# Generate multiple secrets
for secret in JWT_SECRET INTERNAL_KEY VAULT_KEY; do
  echo "$secret: $(openssl rand -hex 32)"
done
```

### Using Python
```python
import secrets

# Generate hex secret (32 bytes = 256 bits)
secret = secrets.token_hex(32)
print(secret)

# Generate base64 secret
import base64
secret = base64.b64encode(secrets.token_bytes(32)).decode()
print(secret)
```

---

## PRODUCTION DEPLOYMENT CHECKLIST

- [ ] **Generate new secrets** using `generate_secrets.py`
- [ ] **Never commit secrets to git** - ensure `.env` contains only `${VAR}` placeholders
- [ ] **Add to .gitignore:**
  ```
  .env
  .env.*.env
  secrets.sh
  secrets.json
  /tmp/secrets*
  ```
- [ ] **Choose secrets management solution** (Docker, Vault, Cloud provider)
- [ ] **Load secrets in production environment** (not from .env file)
- [ ] **Test application startup** with new secrets
- [ ] **Rotate secrets periodically** (every 90 days minimum)
- [ ] **Monitor secret access** and audit logs
- [ ] **Document secrets rotation procedure**

---

## VERIFYING SECURITY

### Check for Hardcoded Secrets in Git
```bash
# Search for hardcoded secrets in history
git log -p --all -S "JWT_SECRET_KEY" | grep -i "secret"

# Search in current code
grep -r "9a12c418-5a48-43d9-90b5-555a6d71b87a" .
grep -r "smriti_secret_fallback_key" .
grep -r "sgip_vault_master_secret" .
```

### Pre-commit Hook (Prevent Secrets Leak)
```bash
# .git/hooks/pre-commit
#!/bin/bash
if grep -r "JWT_SECRET_KEY\s*=\s*[a-z0-9]" .; then
  echo "ERROR: Hardcoded secrets detected!"
  exit 1
fi
```

### GitHub Actions Secret Scanning
```yaml
# .github/workflows/security.yml
name: Secret Scanning
on: [push, pull_request]
jobs:
  secret-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: TruffleHog Secret Scan
        uses: trufflesecurity/trufflehog@main
```

---

## TROUBLESHOOTING

### "Secret not found" Error
```python
# Check if environment variable is set
import os
print(os.getenv("JWT_SECRET_KEY"))  # Should not be None

# For Docker secrets
import pathlib
secret_file = "/run/secrets/jwt_secret"
if pathlib.Path(secret_file).exists():
    print(pathlib.Path(secret_file).read_text())
```

### Secrets Not Loading in Docker Compose
```bash
# Verify secrets were created
docker secret ls

# Check service can access secrets
docker exec <container> cat /run/secrets/jwt_secret

# Verify environment variables
docker exec <container> env | grep SECRET
```

---

## REFERENCES

- [OWASP Secrets Management](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html)
- [HashiCorp Vault Documentation](https://www.vaultproject.io/docs)
- [Docker Secrets Documentation](https://docs.docker.com/engine/swarm/secrets/)
- [AWS Secrets Manager](https://docs.aws.amazon.com/secretsmanager/)
- [Azure Key Vault](https://docs.microsoft.com/en-us/azure/key-vault/)
- [Google Cloud Secret Manager](https://cloud.google.com/secret-manager/docs)

---

**Last Updated:** 2026-08-31  
**Status:** ✅ Hardcoded secrets removed  
**Action:** Implement one of the secure options before production deployment
