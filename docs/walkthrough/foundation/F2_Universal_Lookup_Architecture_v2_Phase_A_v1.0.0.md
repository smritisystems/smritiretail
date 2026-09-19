<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 1.0.0
  Created      : 2026-09-02
  Modified     : 2026-09-02
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# F2 Universal Lookup Architecture v2 — Phase A Implementation Walkthrough

**Area:** Foundation / Platform UX Protocol  
**Version:** 1.0.0  
**Date:** 2026-09-02  
**Commit:** `1d3a9c31`  
**Batch:** `F2-ARCH-V2-PHASE-A`

---

## 1. Purpose

Establish the single authoritative F2 keyboard dispatcher for the SMRITI Retail OS platform, replacing the fragmented `ActiveFieldContext`-based F2 handler with a clean, typed, and architecturally governed platform protocol.

---

## 2. Scope

- **Phase A (this walkthrough):** Infrastructure — dispatcher, registry, promoted dialog, modified providers
- **Phase B (future):** Screen-by-screen migration to `useF2Screen()` + `FieldAdapter`
- **Phase C (future):** Remove legacy `GlobalF2BrowseModal` and `insertValueIntoActiveField` no-op
- **Phase D (future):** Production load verification and BI/GST consumer audit

---

## 3. Files Created

| File | Purpose |
|:---|:---|
| `src/context/F2DispatcherContext.tsx` | Single authoritative F2 dispatcher, `LookupEntity` type, `LookupResult` contract, `FieldAdapter`, `useF2Screen()` |
| `src/services/f2LookupRegistry.ts` | Authoritative `LOOKUP_REGISTRY` — 23 canonical entities, column defs, permissions, scoping |
| `src/components/drilldown/UniversalBrowseEngine.tsx` | Promoted F2 browse dialog — canonical APIs, FieldAdapter result, focus restoration |
| `src/tests/f2UniversalArchV2.test.ts` | 32-test headless verification suite |

---

## 4. Files Modified

| File | Change |
|:---|:---|
| `src/context/ActiveFieldContext.tsx` | v7.0.0 — removed F2 keydown listener; `insertValueIntoActiveField` now a deprecated no-op |
| `src/contexts/ShortcutContext.tsx` | v3.17.0 — F2 registered as `f2_universal_lookup` system shortcut |
| `src/App.tsx` | v3.18.0 — `F2DispatcherProvider` added; `UniversalBrowseEngine` mounted |
| `src/services/globalFieldRegistry.ts` | `LookupGroup` type expanded to all 23 canonical entities; endpoint annotated canonical-only |

---

## 5. Architecture Decisions

### Decision 1: Single `window.addEventListener("keydown")` in `F2DispatcherProvider`

**Rationale:** The architectural rule states "F2 is a platform protocol, not a screen-specific feature." One listener eliminates dual-dispatch, event ordering ambiguity, and competing handlers.

**Alternative rejected:** Keeping the listener in `ActiveFieldContext` would have required the context to know about every screen's field configuration — a violation of single-responsibility.

### Decision 2: 4-Tier Resolution Priority

```
Tier 1: data-f2-entity attribute (explicit, highest trust)
Tier 2: useF2Screen() fieldOverrides map (screen-declared)
Tier 3: useF2Screen() defaultEntity (screen default)
Tier 4: inferFieldCategory() heuristic (lowest trust, no guess on "general")
```

**Rationale:** Explicit attributes are always more reliable than heuristics. Screens that have registered via `useF2Screen()` know their context; tiers 3/4 exist for unregistered screens and field-level fallback.

### Decision 3: FieldAdapter replaces `insertValueIntoActiveField` prototype-setter

**Rationale:** The prototype-setter pattern (`Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")`) is fragile — it depends on React internals, fails silently in some environments, and creates a coupling between the dialog and the DOM rather than component state. The `FieldAdapter` is a plain callback that gives the screen complete control over how the result is applied.

### Decision 4: `GlobalF2BrowseModal` retained during Phase A

**Rationale:** Removing it immediately while screens still call `useActiveField().openF2Modal()` would break existing screen integrations. Phase B will migrate screens one by one; Phase C removes the legacy dialog.

### Decision 5: `general` entity never opens the dialog

**Rationale:** "Ambiguous inference MUST NOT guess an entity." Opening a generic browse without a clear entity type would present undefined behavior to the user. The dispatcher explicitly no-ops on `general`.

---

## 6. Design Rationale

### Canonical API Routing (Gate 11E compliance)

The `LOOKUP_REGISTRY` enforces the Gate 11E canonical product-domain architecture:

| Entity | Canonical Endpoint | Prohibited Endpoint |
|:---|:---|:---|
| `variant` | `/api/v1/variants` | ~~`/api/v1/products`~~ |
| `item` | `/api/v1/items` | ~~`/api/v1/products`~~ |
| `item_barcode` | `/api/v1/item-barcodes` | ~~`/api/v1/products`~~ |

The `GlobalF2BrowseDlg.tsx` (legacy, retained) still calls `/api/v1/products`. `UniversalBrowseEngine.tsx` does not — it fetches from `LOOKUP_REGISTRY[entity].endpoint` exclusively.

### LookupResult Contract Versioning

`contractVersion: "2.0.0"` on every `LookupResult` and every `LookupRegistryEntry` allows future breaking changes to be discovered at compile time. Screens can check `result.contractVersion` if they depend on specific fields.

---

## 7. Implementation Summary

### Phase A Infrastructure — 8 files, 2274 insertions, 77 deletions

**`F2DispatcherContext.tsx`** (315 lines):
- `LookupEntity` union (24 values including `general`)
- `LEGACY_CATEGORY_TO_ENTITY` alias map (22 ActiveFieldCategory → LookupEntity)
- `LookupResult` typed interface with `contractVersion`, `itemId`, `variantId`, `barcodeId`
- `FieldAdapter` type
- `F2ScreenContext` interface + `useF2Screen()` hook
- `F2DispatcherProvider` with single `window.addEventListener("keydown")`, 4-tier resolution, re-entry guard, focus restoration
- `useF2Dispatcher()` consumer hook

**`f2LookupRegistry.ts`** (357 lines):
- `LookupRegistryEntry` interface with `contractVersion`, `endpoint`, `searchFields`, `defaultReturnField`, `defaultDisplayField`, `permissions`, `tenantScoped`, `branchScoped`, `defaultLimit`, `displayColumns`, `enabled`
- `LOOKUP_REGISTRY` — 23 entries covering all non-general entities
- `resolveLookupEntry()` — returns `null` for `general` and unknown entities
- `hasLookupPermission()` — role-based UI hint check

**`UniversalBrowseEngine.tsx`** (815 lines):
- Reads `isOpen`, `resolvedEntity`, `initialSearchValue` from `F2DispatcherContext`
- Fetches from `LOOKUP_REGISTRY[entity].endpoint` (canonical APIs only)
- Returns result via `commitResult(LookupResult)` → `FieldAdapter`
- Keyboard: ArrowUp/Down, PageUp/Down, Home, End, Enter, Escape; F2 explicitly blocked
- Column config persisted to `smriti_f2_v2_columns` localStorage key (separate from legacy key)
- 23-tab switcher driven by `ENTITY_TAB_DEFS` array

**`ActiveFieldContext.tsx`** v7.0.0:
- Removed: `handleGlobalF2` + `window.addEventListener("keydown", handleGlobalF2)`
- Removed: prototype-setter implementation of `insertValueIntoActiveField`
- Added: deprecation no-op + `console.warn` in dev mode
- Retained: `focusin`/`focusout`/`input` listeners for contextual metadata and HUD display

---

## 8. Tests Executed

```
Command: npx vitest run src/tests/f2UniversalArchV2.test.ts src/tests/f2Browse.test.ts src/tests/fieldSearch.test.ts src/tests/globalFieldRegistry.test.ts src/tests/proPosKeys.test.ts
```

```
 RUN  v4.1.10 F:/SMRITRretailNX

 ✓ src/tests/fieldSearch.test.ts (14 tests) 10ms
 ✓ src/tests/f2Browse.test.ts (23 tests) 12ms
 ✓ src/tests/f2UniversalArchV2.test.ts (32 tests) 29ms
 ✓ src/tests/proPosKeys.test.ts (15 tests) 7ms
 ✓ src/tests/globalFieldRegistry.test.ts (4 tests) 7ms

 Test Files  5 passed (5)
      Tests  88 passed (88)
   Start at  07:34:00
   Duration  884ms
```

---

## 9. Verification Results

### TypeScript
```
Command: npx tsc --noEmit
Exit code: 0
Stdout: (empty)
Stderr: (empty)
```
**Zero TypeScript errors.**

### Test Results
```
88/88 passing across 5 test files
```

### API Routing Compliance
Test `2.4 NO registry entry references /products` — **PASS**. The `LOOKUP_REGISTRY` contains zero references to `/products`.

### Git Diff Summary
```
commit 1d3a9c31
 8 files changed, 2274 insertions(+), 77 deletions(-)
 create mode 100644 src/components/drilldown/UniversalBrowseEngine.tsx
 create mode 100644 src/context/F2DispatcherContext.tsx
 create mode 100644 src/services/f2LookupRegistry.ts
 create mode 100644 src/tests/f2UniversalArchV2.test.ts
```

---

## 10. Known Limitations

1. **Phase B not yet executed** — Screen components still call `useActiveField().openF2Modal()` which delegates to the legacy `GlobalF2BrowseModal`. `UniversalBrowseEngine` will only open when a screen explicitly calls `useF2Dispatcher().openLookup()` or when `F2` is pressed with a field that resolves via the 4-tier priority chain.
2. **Tier-4 heuristic still active** — `inferFieldCategory()` provides a safety net for unregistered screens, but it remains the weakest tier and can still produce sub-optimal entity resolution for ambiguous field names.
3. **GlobalF2BrowseModal still calls `/api/v1/products`** — This will remain until Phase C. Only `UniversalBrowseEngine` uses canonical APIs.
4. **`insertValueIntoActiveField` still called by `GlobalSearch.tsx`** — Now a no-op; `GlobalSearch` must be migrated to use `F2Dispatcher` result callbacks in a follow-up task.

---

## 11. Future Work

| Phase | Task | Target |
|:---|:---|:---|
| Phase B | Migrate each screen to `useF2Screen()` + `data-f2-entity` | Per screen, 9 priority screens |
| Phase B | Remove `openF2Modal()` calls from screens | After screen migration |
| Phase C | Delete `GlobalF2BrowseModal` | After Phase B complete |
| Phase C | Remove `insertValueIntoActiveField` no-op | After Phase B complete |
| Phase C | Migrate `GlobalSearch.tsx` to F2Dispatcher result path | Follow-up task |
| Phase D | Production load verification | After Phase C |

---

## 12. Related ADRs

- Gate 11E Phase 3A/3B — Dead-column retirement (prerequisite: `/api/v1/products` is compatibility-only)
- SMRITI Backend System-of-Record Policy — FastAPI + Postgres sole backend

---

## 13. Related RFCs

- F2 Universal Lookup Architecture v2 Design Review (approved pre-implementation)
- SMRITI Platform Architecture & Communication Layer — `src/lib/apiFetchV1.ts` mandate
