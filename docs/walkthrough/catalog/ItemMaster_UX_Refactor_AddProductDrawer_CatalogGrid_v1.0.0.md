<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 1.0.0
  Created      : 2026-09-28
  Modified     : 2026-09-28
  Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# ItemMaster UX Refactor -- 5-Tab AddProductDrawer & Rich Catalog Grid v5.0

**Walkthrough ID:** WT-CATALOG-001
**Area:** Item Master / Catalog
**Version:** 1.0.0
**Date:** 2026-09-28
**Commits:** `0d986acb`, `41069e77`
**Branch:** `smritiNX`

---

## 1. Purpose

Refactor the Item Master UX from a plain table layout to a rich product catalog screen matching the new Footwear Products design spec. Introduces a full-screen 5-tab Add Product wizard that POSTs to the FastAPI backend.

---

## 2. Scope

| Area | In Scope |
|---|---|
| Frontend | AddProductDrawer.tsx (new), ItemCatalogGrid.tsx (refactor), ItemMasterWs.tsx (version bump), App.tsx (mapper fixes), types.ts (Product type extension) |
| Backend | Wire validation only -- confirmed correct POST endpoint /api/v1/inventory/ |
| Testing | TypeScript tsc --noEmit (exit 0) |

---

## 3. Files Created

| File | Lines | Description |
|---|---|---|
| src/components/itemMaster/AddProductDrawer.tsx | 787 | 5-tab full-screen Add Product wizard modal |

---

## 4. Files Modified

| File | Change |
|---|---|
| src/components/itemMaster/ItemCatalogGrid.tsx | Full refactor v4.6.0 -> v5.0.0 |
| src/components/itemMaster/ItemMasterWs.tsx | Version bump v5.0.0 -> v5.1.0 |
| src/App.tsx | Product mapper: added primaryImageUrl, buyingPrice, isActive |
| src/types.ts | Product interface: added buyingPrice, isActive fields |

---

## 5. Architecture Decisions

### AD-1: Full-screen modal over side-drawer
Needed for 4-column form layout on Tab 1. A side-drawer compresses the layout below usability at 1366x768.

### AD-2: Tab-per-domain grouping
5 tabs: Basic Information, Pricing, Tax & Inventory, Attributes, Additional Info. Mirrors ProductBase schema domain boundaries.

### AD-3: POST to /api/v1/inventory/ not /api/v1/products/
Canonical endpoint is mounted at /inventory/. No /products/ route exists. Initial implementation targeted /products/ -- corrected in 41069e77.

### AD-4: price = dealer price, mrp = retail price
Backend enforces mrp >= price. price = selling/dealer price, mrp = maximum retail price. Fixed from both = retailPrice.

### AD-5: buyingPrice and isActive promoted to Product interface
Typed members instead of (p as any) casts. Mapped in App.tsx fetchSystemState.

---

## 6. Design Rationale

- Filter bar with 5 dropdowns matches footwear product attribute structure
- 20-column table shows all commercially significant fields in one row
- Pagination 10/25/50/100 per page prevents DOM overload on large catalogs
- Numbered tab wizard (1-5) sets clear mental model for data completeness

---

## 7. Implementation Summary

**Commit 0d986acb (UX Refactor):**
- Created AddProductDrawer.tsx: 5 tabs, image preview, tag management, POST to /inventory/
- Refactored ItemCatalogGrid.tsx: FilterSelect components, 20-column table, Th/Td/PageBtn sub-components, formatINR helper, getAttr extractor

**Commit 41069e77 (Wire Validation Fixes):**

| Issue | Root Cause | Fix |
|---|---|---|
| 1 -- 404 on Add Product | POST to /products (no such route) | Changed to /inventory/ |
| 2 -- Wrong price semantics | price = mrp = retailPrice | price = dealerPrice, mrp = retailPrice |
| 3 -- Blank product images | primary_image_url not in App.tsx mapper | Added primaryImageUrl mapping |
| 4 -- Dealer Price blank / Status always Active | buying_price/is_active not mapped | Added buyingPrice/isActive to mapper and Product type |

---

## 8. Tests Executed

| Test | Command | Result |
|---|---|---|
| TypeScript compile (post-TS fix) | npx tsc --noEmit | 0 errors (task-89) |
| TypeScript compile (post-wire-fix) | npx tsc --noEmit | 0 errors (task-192) |

---

## 9. Verification Results

```
# task-89 (post commit 0d986acb):
Exit code: 0, Stdout: (empty), Stderr: (empty)

# task-192 (post commit 41069e77):
Exit code: 0, Stdout: (empty), Stderr: (empty)

# git log --oneline -3:
41069e77 fix(ItemMaster): wire validation fixes -- 4 issues found and resolved
0d986acb feat(ItemMaster): refactor UX -- new 5-tab AddProductDrawer + rich catalog grid v5.0
30312b86 docs(audit): publish Tattly Threads import readiness matrix v2.2

# git push origin smritiNX:
30312b86..41069e77  smritiNX -> smritiNX
```

---

## 10. Known Limitations

1. is_tax_inclusive not persisted (not in ProductCreate schema)
2. Product image upload is client-side preview only -- no server upload yet
3. Article/Design/Brand dropdowns use static options (not from master_lookup API)
4. opening_stock sets stock directly on product row, no StockMovement audit trail

---

## 11. Future Work

- Wire Brand, Category, Product Type selects to /api/v1/master_lookup/
- Implement SPIF image upload endpoint and wire productImage in drawer
- Add inline row Edit / Duplicate / Delete in Actions column
- Wire More Filters button to advanced filter panel
- Wire Columns button to ItemViewConfig column visibility

---

## 12. Related ADRs

- ADR: FastAPI + Postgres Sole Backend (AGENTS.md Rule 1)
- ADR: apiFetchV1 as exclusive API communication layer (AGENTS.md API Communication Policy)

---

## 13. Related RFCs

- RFC: Item Master UX Phase 2 -- Footwear Product Catalog Redesign (design screenshot provided 2026-09-28)
