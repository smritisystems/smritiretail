<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.75.0
  Created      : 2026-08-28
  Modified     : 2026-08-28
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Implementation Plan: ProPOS Offline Master Catalog Cache & Scanner Lookup (v1.0.0-GA)

## 1. Objective
Establish a high-speed local master catalog caching and multi-index search engine for ProPOS client terminals, enabling sub-millisecond barcode scanner resolution, fuzzy product search, customer lookups, and background cache hydration while operating in offline and WAN-degraded retail environments.

## 2. Business Motivation
POS cashiers cannot wait for remote network roundtrips during every barcode scan at peak retail checkout counters. Having the entire active product inventory, tax matrices, and customer directory indexed locally ensures instant checkout responsiveness regardless of connectivity status.

## 3. Scope
- Local multi-index product catalog cache (`ProPosMasterCatalogCache`).
- Sub-millisecond primary and alias barcode resolution (`lookupByBarcode`).
- Fuzzy multi-field search (`searchProducts` across code, name, category, SKU).
- Robust phone number normalization and customer search (`lookupCustomer`).
- Automated background hydration from FastAPI backend (`/products`, `/crm/customers`).

## 4. Current State
The offline transaction push sync engine (`ProPosOfflineSyncEngine`) was operational, but edge product lookups required real-time network connectivity.

## 5. Gap Analysis
- Needed local caching and barcode indexing module.
- Needed phone normalization for customer lookup matching.

## 6. Architecture Impact
- Re-verifies Rule 1 & Rule 2: Catalog hydration occurs via `apiFetchV1` (`/api/v1/products`, `/api/v1/crm/customers`) from the canonical FastAPI + PostgreSQL backend.

## 7. Proposed Design
```text
┌─────────────────────────────────────────────────────────────┐
│              PROPOS MASTER CATALOG CACHE (EDGE)             │
├─────────────────────────────────────────────────────────────┤
│  1. Scanner / Barcode Gun Input (8901234567890)             │
│  2. lookupByBarcode() -> Primary/Alias/Code Hash Map (<1ms) │
│  3. lookupCustomer() -> Normalized 10-Digit Phone / GSTIN   │
│  4. syncCatalogFromServer() -> Hydrates from FastAPI Engine │
└─────────────────────────────────────────────────────────────┘
```

## 8. Files Created
- `src/sync/ProPosMasterCatalogCache.ts`
- `src/tests/proposCatalogCache.test.ts`
- `docs/implementation/pos/ProPOS_Master_Catalog_Cache_v1.0.0.md`
- `docs/walkthrough/pos/ProPOS_Master_Catalog_Cache_v1.0.0.md`

## 9. Files Modified
- `docs/implementation/README.md`
- `docs/walkthrough/README.md`
- `CHANGELOG.md`

## 10. Dependencies
- Vitest 4.1+
- TypeScript 5.6+

## 11. Risks
- *Risk:* Memory growth with massive enterprise catalogs (>100k SKUs).
  *Mitigation:* Retains only lightweight index projections in memory.

## 12. Rollback Strategy
Modular client service that can be toggled without altering core billing components.

## 13. Verification Plan
- Unit tests verifying barcode resolution, fuzzy search, customer phone matching, and API hydration.
- Full Vitest suite pass rate (`356/356 green`).

## 14. Test Plan
- Run `npm test`.

## 15. Documentation Impact
- Update Developer Guide for offline catalog operations.

## 16. Deployment Plan
- Build and bundle with frontend client package.

## 17. Status
Completed & Verified (`356/356 frontend tests green`).

## 18. Related ADRs
- `ADR-001`: FastAPI Sole System of Record.
- `ADR-019`: Offline-First POS Edge Synchronization Architecture.

## 19. Related Walkthroughs
- `docs/walkthrough/pos/ProPOS_Master_Catalog_Cache_v1.0.0.md`.
