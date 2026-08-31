<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.0.0
  Created      : 2026-08-21
  Modified     : 2026-08-21
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: Universal F2 Headless Master Browse & Product Endpoint Alignment

**Module / Area:** Foundation & POS / Drilldown Master Lookup  
**Version:** v6.0.0  
**Date:** 2026-08-21  
**Status:** Completed  

---

## 1. Purpose
To establish and verify a 100% headless test pipeline for the Universal F2 Master Browse engine (eliminating GPU-accelerated headed Chrome browser overhead and associated IDE crash risks) while aligning the product catalog endpoints between React client components and FastAPI backend routers.

---

## 2. Scope
- Headless execution and verification of 18 Master Field Category inferences and keyboard simulations.
- Diagnostic resolution of HTTP 404 (`/api/v1/inventory/products`) by standardizing canonical `/api/v1/products` endpoints.
- Addition of backend route aliases in FastAPI `main.py` for `/api/v1/inventory/products`.
- Safe typing and defensive array normalization for product catalog responses.

---

## 3. Files Created
- `src/tests/f2Browse.test.ts` (Headless Vitest verification suite covering 23 test cases)

---

## 4. Files Modified
- `src/components/drilldown/GlobalF2BrowseDlg.tsx` (Aligned product fetch to `/products?page_size=100` and defensive payload handling)
- `src/components/billing/propos/ProPosBillingTerm.tsx` (Aligned product search to `/products/search` and pruned unused modal setter)
- `backend/app/main.py` (Added `/inventory/products` router alias)
- `docs/walkthrough/README.md` (Updated master walkthrough index)

---

## 5. Architecture Decisions
- **AD-1: Pure Headless Testing:** All UI keystroke and DOM context inferences must be verified via Node.js/Vitest DOM simulation without opening GUI browser windows inside the IDE session.
- **AD-2: Dual Route Alias Mapping:** FastAPI mounts the inventory router at both `/api/v1/products`, `/api/v1/inventory`, and `/api/v1/inventory/products` to preserve forward and backward compatibility.

---

## 6. Design Rationale
When headed browsers are launched from within development tasks, GPU/VRAM contention with Electron/IDE processes can lead to sudden UI crashes. By utilizing in-memory DOM abstractions, the test suite executes in <500ms with zero process interference.

---

## 7. Implementation Summary
- Refactored `GlobalF2BrowseDlg.tsx` data loader to query `/products?page_size=100` and extract `items` whether returned as a raw array or a paginated envelope.
- Updated `ProPosBillingTerm.tsx` barcode/stock lookup to invoke `/products/search?q=...` instead of the non-existent nested path.
- Registered `/inventory/products` on the FastAPI `main.py` router table.

---

## 8. Tests Executed
```powershell
npx vitest run src/tests/f2Browse.test.ts src/tests/fieldSearch.test.ts
```

---

## 9. Verification Results
```text
 RUN  v4.1.10 F:/SMRITRretailNX

 ✓ src/tests/f2Browse.test.ts (23 tests) 13ms
 ✓ src/tests/fieldSearch.test.ts (14 tests) 12ms

 Test Files  2 passed (2)
      Tests  37 passed (37)
   Start at  21:37:36
   Duration  536ms (transform 84ms, setup 0ms, import 168ms, tests 25ms, environment 0ms)
```

---

## 10. Known Limitations
None identified for the headless F2 browse engine.

---

## 11. Future Work
- Extend headless test suites to include comprehensive end-to-end multi-currency POS tenders.

---

## 12. Related ADRs
- `ADR-0021`: System of Record Architecture (FastAPI Core)
- `ADR-0034`: Headless DOM Context Testing Standard

---

## 13. Related RFCs
- `RFC-0089`: Universal F2 Master Lookup Protocol
