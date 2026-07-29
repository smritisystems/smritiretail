# SMRITI Security Architecture Standard

**Status:** FROZEN — v1.0 (2026-07-28)  
**Reference ADR:** ADR-009 (Security Architecture), AOP-005 (Authorization Isolation)

---

## 1. Authentication Protocol
- **Scheme**: OAuth2 Password Bearer flow with JWT (RFC 7519).
- **Algorithm**: HS256 (symmetric) for local deployments; RS256 (asymmetric) for multi-tenant cloud.
- **Access Token TTL**: 60 minutes.
- **Refresh Token TTL**: 7 days.

## 2. API Authorization Rules
| Gateway | Enforcement |
| :--- | :--- |
| `/api/public/v1/*` | OAuth2 Bearer JWT + IP Rate Limiting + CORS Origin Isolation |
| `/api/internal/v1/*` | Bearer JWT + `X-Internal-Service-Key` mutual auth |

## 3. RBAC Permission Scopes
All API endpoints enforce granular scopes:
```python
✅  Depends(require_permission("ITEM.CREATE"))
✅  Depends(require_permission("SALES.INVOICE.VIEW"))
❌  # No auth dependency on endpoint — prohibited
```

## 4. Tenant Data Isolation
All repository queries MUST inject `TenantContext`:
```python
# ✅ Correct
async def get_products(self, tenant_id: UUID, company_id: UUID):
    return await self.db.execute(
        select(ProductModel).where(
            ProductModel.tenant_id == tenant_id,
            ProductModel.company_id == company_id
        )
    )
```

## 5. Sensitive Data Rules
- Passwords: Bcrypt hashed (cost factor ≥ 12).
- API Keys: SHA-256 hashed at storage; never stored in plaintext.
- PII Fields (mobile, email, GSTIN): Logged only in audit trail, never in application debug logs.

## 6. Audit Trail (AOP-006)
Every mutating API call (POST/PUT/PATCH/DELETE) MUST emit an Audit Log entry:
```json
{
  "trace_id": "uuid",
  "user_id": "uuid",
  "action": "ITEM.UPDATE",
  "entity_type": "Product",
  "entity_id": "uuid",
  "timestamp": "ISO8601"
}
```
