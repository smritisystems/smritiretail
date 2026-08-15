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

# SMRITI Multi-Company Database Architecture Specification v1.0

**Status: COMPANY_CODE_STANDARD_UPDATED — ZERO DATABASE PROVISIONING**  
**Audit Timestamp:** 2026-08-15 06:00:48 UTC  
**Official Control Plane DB:** `smritisys`  
**Official Company Business DB Naming Standard:** `smriti<3-character-alphanumeric-code>`

---

## 1. Official Alphanumeric Company Code Standard (`smriti<A-Z0-9>`)

| Rule | Specification | Example |
|---|---|---|
| **Prefix** | Exactly `smriti` | `smriti` |
| **Separator** | **NO** underscore, hyphen, space | `smritiABC` (NOT `smriti_ABC`) |
| **Company Code** | Exactly 3 alphanumeric characters `[A-Z0-9]` | `001`, `ABC`, `A01`, `MUM`, `TT1` |
| **Case Normalization** | Lowercase automatically converted to UPPERCASE | `abc` -> `ABC` (`smritiABC`) |
| **Reserved Code 000** | `000` is permanently reserved | `smriti000` (Forbidden) |
| **Reserved Code SYS** | `SYS` is permanently reserved for Control Plane | `smritisys` (Control Plane) |

```text
PostgreSQL Server
│
├── smritisys (SMRITI Control Plane)
│
├── smriti001 (Company Business DB #001)
├── smriti007 (Company Business DB #007)
├── smritiABC (Company Business DB #ABC)
├── smritiMUM (Company Business DB #MUM)
└── smritiTT1 (Company Business DB #TT1)
```

---

## 2. Server-Side Generator Logic

```python
def generate_company_database_name(company_code: str) -> str:
    """Generates server-side database name: smriti<3-character-alphanumeric>."""
    code = str(company_code).strip().upper()
    if len(code) != 3 or not code.isalnum():
        raise ValueError("Company code must be exactly 3 alphanumeric characters [A-Z0-9].")
    if code in ("000", "SYS"):
        raise ValueError(f"Company code '{code}' is permanently reserved.")
    return f"smriti{code}"
```
