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

# SMRITI Control Plane Architectural Boundary Specification v1.0

**Status: APPROVED_BOUNDARY**  
**Official Control Plane Database:** `smritisys`  
**Effective Date:** 2026-08-15

---

## 1. Boundary Principles
1. **`smritisys` Ownership**: Product-level governance (Identity, Tenancy, Roles, Menus, Themes, Workspace Profiles, Audit).
2. **Company Business DB Ownership**: Operational transactions (Sales, Purchases, Inventory, Stock Ledger, Accounting).
3. **User Personalization**: Browser `localStorage` (Theme toggle, sidebar width, zoom level).
4. **Runtime State**: Application memory (Modal states, active text inputs).
