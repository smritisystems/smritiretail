# Foundation — Theme Preset System v1.0
<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Version      : 1.0.0
  Created      : 2026-10-11
  Modified     : 2026-10-11
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

**Walkthrough ID:** WLK-FOUNDATION-THEME-v1.0  
**Commits:** `36c780b1`, `15e34409`  
**Date:** 2026-10-11  
**Author:** Jawahar Ramkripal Mallah

---

## 1. Purpose

Document the design, implementation, and verification of the SMRITI Theme Preset System — a named, composable visual configuration system replacing the binary light/dark toggle. A preset bundles colour mode, accent colour, layout density, and font scale into a single persisted unit.

---

## 2. Scope

Full-stack: React frontend (ThemeContext, CSS, UI components) + FastAPI backend (schema, service, router endpoint).

---

## 3. Files Created

| File | Description |
|---|---|
| `src/config/theme_presets.ts` | Canonical preset definitions — single source of truth for all 5 presets |
| `docs/implementation/foundation/Foundation_ThemePresetSystem_v1.0.md` | This implementation plan |
| `docs/walkthrough/foundation/Foundation_ThemePresetSystem_v1.0.md` | This walkthrough |

---

## 4. Files Modified

| File | Change |
|---|---|
| `src/contexts/ThemeContext.tsx` | v2.0 — preset engine (`setPreset`, `applyPresetToDOM`, `activePreset`) |
| `src/index.css` | Density token layer (compact/comfortable/spacious); `font-size: var(--font-base)` |
| `src/smriti_scroll.css` | 3× hardcoded `rgba(37,99,235,…)` → `color-mix(var(--c-theme-primary), ...)` |
| `src/types.ts` | `UserPreferences` + `presetId`, `density`, `fontScale`, `accentOverride` |
| `src/components/UserProfileTab.tsx` | Phase 1 sync fix; 5-tile visual preset picker; tab renamed |
| `src/layout_engine/layout_manager.tsx` | Header `PresetSwitcher` dropdown replaces Sun/Moon icon |
| `src/state/store.ts` | Seed defaults: admin/manager → `enterprise-light`; cashier → `pos-dark` |
| `backend/app/schemas/user.py` | `UserPreferencesSchema` extended; `PreferencesUpdate` schema added |
| `backend/app/services/user.py` | Typed merge, `enterprise-light` default, `USER_PREFERENCES_UPDATED` audit |
| `backend/app/api/v1/users.py` | Typed `PreferencesUpdate` body; unused `Body` import removed |

---

## 5. Architecture Decisions

### A. CSS Attribute Selector Strategy (not CSS-in-JS)
Density tiers are applied via `[data-density="compact"]` on `<html>`. This keeps runtime cost zero — all token resolution happens at CSS parse time, not JavaScript runtime.

### B. `color-mix()` for Dynamic Scroll Accents
Rather than duplicating 3 accent values per theme, the scrollbar CSS uses `color-mix(in srgb, var(--c-theme-primary) N%, transparent)`. This automatically follows the active preset's accent.

### C. Backward-Compatible ThemeContext
`toggleTheme()` and `setTheme(mode)` are kept as aliases. All existing callers (30+ components across the codebase) work without modification.

### D. Preset ID as Single Persisted Key
Only `presetId` is persisted — not the full preset object. This allows preset metadata (label, description, swatchBg) to evolve without touching user data.

### E. No DB Migration Required
`preferences_json` is already a `Text` column that stores arbitrary JSON. New fields merge into it without any schema migration.

---

## 6. Design Rationale

Five presets were chosen to map to distinct SMRITI operator contexts:

| Preset ID | Operator Context | Differentiator |
|---|---|---|
| `enterprise-light` | Office admin / B2B desktop | SAP Fiori–inspired, comfortable density |
| `enterprise-dark` | Night shift / low-light office | Navy dark, same comfortable density |
| `pos-dark` | Cashier POS terminal | Emerald accent, **compact** density, small font |
| `retail-day` | Shop-floor touch monitor | Amber accent, **spacious** density, large font |
| `high-contrast` | Accessibility | Yellow-on-black, WCAG AA+ |

The selection of `comfortable` as the base density ensures existing layouts are not broken for users who do not change their preset.

---

## 7. Implementation Summary

### Phase 1 — Bug Fix: ThemeContext Sync
`UserProfileTab.tsx` maintained local `useState<theme>` that was never passed to `ThemeContext`. Fixed by removing the local state, reading `activePreset` from `useTheme()`, and calling `setPreset(selectedPresetId)` on form submit.

### Phase 2 — Density Token Layer (`index.css`)
Added three `[data-density]` CSS attribute selector blocks providing 10 spacing tokens each. `html` font-size changed from hardcoded `13px` to `var(--font-base, 13px)`.

### Phase 3 — Preset Config (`theme_presets.ts`)
New file. Contains `ThemePreset` interface, `THEME_PRESETS` array (5 items), `getPresetById()` helper, `FONT_SCALE_MAP`, and `DEFAULT_PRESET_ID`.

### Phase 4 — ThemeContext v2.0
`applyPresetToDOM(preset)` sets four DOM targets atomically:
1. `data-theme` on `<html>` → CSS palette selector
2. `data-density` on `<html>` → spacing token tier
3. `--c-theme-primary` inline style → accent override
4. `--font-base` inline style → font scale

### Phase 5 — UI: Header Switcher + Profile Tile Grid
- Header: pill button shows active preset swatch dot + label. Click opens a dropdown with all 5 presets. Closes on backdrop click.
- Profile tab: 5 visual tiles with `swatchBg` background, `swatchAccent` circle, description, density/font badges. Active tile has blue ring + `CheckCircle` icon.

### Phase 6 — Backend Extension
- `UserPreferencesSchema`: `presetId`, `density`, `fontScale`, `accentOverride` fields with `field_validator` guards.
- `PreferencesUpdate`: partial-update schema (all fields `Optional`) for `PUT /preferences`. Uses `model_dump(exclude_none=True)` for merge semantics.
- `update_preferences()`: now writes `USER_PREFERENCES_UPDATED` audit log entry.

### Phase 7 — Scroll CSS Fix
Three `rgba(37,99,235,…)` values in `smriti_scroll.css` replaced with `color-mix()` expressions referencing `--c-theme-primary`. The scrollbar accent now automatically follows the active preset.

---

## 8. Tests Executed

| Test | Command | Result |
|---|---|---|
| TypeScript type check | `npx tsc --noEmit` | Exit 0 — 0 errors |
| Production bundle | `npx vite build` | Exit 0 — 3708 modules transformed |
| Python syntax check | `python -m py_compile <3 files>` | Exit 0 — 0 errors |

---

## 9. Verification Results

**Evidence:**

```
TSC:       npx tsc --noEmit        → exit 0, stdout empty
Vite:      npx vite build          → exit 0, ✓ 3708 modules transformed
py_compile: python -m py_compile … → exit 0, PASS: 0 syntax errors

Commit 36c780b1: 8 files changed, 459 insertions(+), 79 deletions(-)
  create mode 100644 src/config/theme_presets.ts

Commit 15e34409: 3 files changed, 115 insertions(+), 14 deletions(-)
```

**Interpretation:**  
All static analysis tools passed. No type errors, no build errors, no syntax errors. The implementation is structurally sound. Functional E2E verification (selecting presets in browser, confirming DOM attribute changes) is recommended during test environment deployment.

**Recommendation:**  
Deploy to `F:\Smriti9` via `git pull` on the test machine. Manually verify DOM attribute changes when switching presets using browser DevTools.

---

## 10. Known Limitations

- `accentOverride` field is persisted to the backend but not yet wired to a UI colour picker — stored for future use.
- `color-mix()` requires Chromium 111+, Firefox 113+, Safari 16.2+. Older browsers will fall back to transparent scrollbar thumbs.
- Test environment deployment was not performed in this session (test drive `F:\Smriti9` not present on development machine).

---

## 11. Future Work

- Custom accent colour picker in Profile tab (sends `accentOverride` to backend)
- Per-module density overrides (e.g., POS always compact regardless of preset)
- Auto-detection: `prefers-color-scheme` media query sets initial preset on first visit
- Backend endpoint `GET /users/{id}/preferences` to expose preferences as a first-class resource
- Preset export/import for enterprise IT provisioning

---

## 12. Related ADRs

- ADR: CSS Variable Token Architecture
- ADR: FastAPI + Postgres System-of-Record Policy (AGENTS.md)

---

## 13. Related RFCs

- RFC: SMRITI Theme Preset Audit Request (pre-implementation)
