<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.25.0
  Created      : 2026-08-15
  Modified     : 2026-08-15
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# SMRITI License and Ownership Forensic Audit v1.0

**Audit Date:** 2026-08-15  
**Audit Status:** USER DECISION REQUIRED  

---

## 1. Summary of Findings

A forensic inspection of repository licensing declarations, file headers, and root metadata documents reveals a formal conflict between first-party copyright headers and root license text files:

### Primary Declarations (Source Code & README)
- **`README.md`**:
  - `Copyright : © AITDL.com and SMRITIBooks.com. All Rights Reserved.`
  - `License   : Proprietary Commercial Software`
- **Source Code Header Blocks** (`.ts`, `.tsx`, `.py`, `.sql`):
  - `Copyright : © SMRITIBooks.com. All Rights Reserved.`
  - `License   : Proprietary Commercial Software`
  - `Classification: Internal`

### Contradictory Root Text File
- **`COPYING`**: Contains full text of the **GNU General Public License v3.0** (GPL-3.0), dated 29 June 2007.

---

## 2. Governance Directive & Classification

Per SMRITI Governance Rules and Phase 3 forensic check policy:
- **No License Auto-Selection**: AI agents must never select, alter, or remove a license document based on subjective preference.
- **Classification**: **`USER DECISION REQUIRED`**
- **Action Taken**: Preserved all license files (`COPYING`, `NOTICE`, `THIRD_PARTY_LICENSES.md`) untouched. Documented the exact discrepancy for owner/legal decision.

---

## 3. Recommendation for Repository Owner

The owner/executive team should explicitly confirm whether:
1. SMRITI Retail OS source code is **Proprietary Commercial Software** (in which case the root `COPYING` file should be updated to reflect the proprietary license text), OR
2. SMRITI Retail OS is dual-licensed / open-source under GPL-3.0.
