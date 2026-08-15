<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.16.0
  Created      : 2026-08-15
  Modified     : 2026-08-15
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# SMRITI Database Routing Architecture Specification v1.0

**Status: AUDIT_COMPLETE**  
**Centralized Resolver:** `app.services.company_database_resolver.CompanyDatabaseResolver`

---

## 1. Routing Security Invariants
- No client-controlled arbitrary database name injection.
- Fail-closed evaluation (Unauthorized user -> 403 Forbidden).
- No cross-company database query execution.
