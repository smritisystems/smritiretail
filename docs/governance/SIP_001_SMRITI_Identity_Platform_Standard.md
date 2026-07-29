<!--
  Project      : SMRITI Retail OS
  Repository   : SMRITIRetailNX
  Organization : AITDL NETWORKS

  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritisys.com | aitdl.com | erpnbook.com | smritibooks.com
  Version      : 1.0.0
  Created      : 2026-07-21
  Modified     : 2026-07-21
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal Architecture Standard (SIP-001)
-->

# SIP-001 — SMRITI Identity Platform Standard

**Status:** MANDATORY — v1.0 (2026-07-21)  
**Applies To:** SMRITI Digital Platform, Ecosystem Portals & Retail OS Core

---

## 1. Executive Overview

**SIP-001** defines the single identity, authentication, single sign-on (SSO), and role-based access control (RBAC) governance framework across the **SMRITI Digital Platform**. It ensures that all 8 Ecosystem Portals (Marketing, Customer Portal, Live Docs, Marketplace, Developer Portal, Partner Hub, Community, and SMRITI Academy) authenticate through a unified, secure identity provider.

```text
                           SMRITI Digital Platform

               ┌─────────────────────────────────────────┐
               │ SIP-001 Identity & Portal Gateway (SSO) │
               └────────────────────┬────────────────────┘
                                    │
      ┌─────────────────────────────┼─────────────────────────────┐
      │                             │                             │
      ▼                             ▼                             ▼
Public Website Tier         Portal Platform Tier         Retail OS Core Tier
• Marketing                 • Customer Workspace         • Sales & POS Billing
• Documentation             • SMRITI Academy LMS         • WMS & Inventory
• Marketplace Hub           • Developer Portal           • Accounting & Tax
• Community                 • Partner Hub                • Operations & AI
```

---

## 2. Core Pillars of SIP-001

### A. Unified Single Sign-On (SSO)
- All authenticated portals (Customer, Developer, Partner, Academy, Retail OS Core) share a single token issuance authority.
- Tokens follow OAuth2 / JWT specification containing `sub`, `tenant_id`, `roles`, `portal_permissions`, and `exp`.

### B. Role-Based Access Control (RBAC) & Portal Permissions
- Permission checks follow the structure `<portal>.<action>` (e.g., `academy.read`, `customer.licenses.manage`, `developer.api_keys`).
- Unauthenticated requests to restricted portals return HTTP 401 Unauthorized / HTTP 403 Forbidden.

### C. Multi-Tenant Isolation
- Every authenticated session carries a mandatory `TenantContext` containing `tenant_id` and `organization_name`.
- Cross-tenant data leakages are prevented at the database and service boundary layers.

### D. Portal Compatibility Manifests (CMP-001 Alignment)
- Each portal registers a `Portal Manifest` verifying compatibility with:
  - `minimum_foundation`: `v1.0`
  - `minimum_kernel`: `v12.1.0`

---

## 3. Compliance & Enforcement

1. **No Separate Auth Systems:** No portal or module may implement its own user database or password hashing algorithm outside SIP-001.
2. **Audit Trail Logging:** All portal access events, token refreshes, and permission checks are logged via the Telemetry Engine for security auditing.
