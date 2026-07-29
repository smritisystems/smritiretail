# SMRITI API Governance & Versioning Standard

**Status:** FROZEN — v1.0 (2026-07-28)  
**Reference ADR:** ADR-005 (API Governance), AOP-003 (Backward Compatibility)

---

## 1. Gateway URIs
| Gateway | Path | Audience |
| :--- | :--- | :--- |
| Public API | `/api/public/v1/*` | Portal, Website, Mobile, SDK |
| Internal API | `/api/internal/v1/*` | Workspace Frontend (authenticated) |

## 2. REST Verb Conventions
| Operation | HTTP Method | Example |
| :--- | :--- | :--- |
| List / Search | `GET` | `GET /api/internal/v1/products?q=rice` |
| Create | `POST` | `POST /api/internal/v1/products` |
| Full Update | `PUT` | `PUT /api/internal/v1/products/{id}` |
| Partial Update | `PATCH` | `PATCH /api/internal/v1/products/{id}` |
| Delete | `DELETE` | `DELETE /api/internal/v1/products/{id}` |

## 3. Endpoint Naming Convention
```text
✅  /api/internal/v1/products
✅  /api/internal/v1/sales-invoices
✅  /api/internal/v1/stock-movements
❌  /items          (ambiguous plural — prohibited)
❌  /GetProduct     (verb in path — prohibited)
❌  /product_list   (underscore + list suffix — prohibited)
```

## 4. Response Envelope
All list endpoints return a standard paginated envelope:
```json
{
  "items": [...],
  "total": 142,
  "page": 1,
  "per_page": 25,
  "trace_id": "uuid-v4"
}
```

## 5. Headless Contract Rule
- Business modules MUST NOT return `HTMLResponse`, `RedirectResponse`, or Jinja2 templates.
- Return ONLY type-safe Pydantic v2 DTOs.

## 6. Deprecation Lifecycle (AOP-003)
`Experimental` ──► `Supported` ──► `Deprecated` ──► `Removed`
- Minimum deprecation period before removal: **6 months**.
- Breaking changes require a new major version path (`/v2/`).

## 7. OpenAPI Requirements
- Every endpoint has `summary`, `description`, `tags`, and `responses` documented.
- Auto-generated OpenAPI 3.1 spec served at `/api/docs` and `/api/redoc`.
