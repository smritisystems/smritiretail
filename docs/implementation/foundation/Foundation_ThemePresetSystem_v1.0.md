# Theme Preset System — Implementation Plan v1.0
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

**Plan ID:** IMPL-FOUNDATION-THEME-v1.0  
**Status:** Completed  
**Created:** 2026-10-11  
**Commits:** `36c780b1`, `15e34409`

---

## 1. Objective

Replace the binary light/dark toggle with a named, extensible **Theme Preset Package** system that bundles colour mode, accent colour, layout density, and font scale into a single composable unit. Each preset is named, branded, and tailored to a specific SMRITI operator context.

---

## 2. Business Motivation

| Pain Point | Impact |
|---|---|
| Single light/dark toggle has no personality or role context | Cashier POS screens look identical to manager dashboards |
| Scrollbar accent hardcoded to SAP blue, ignores active theme | Visual inconsistency across presets |
| `UserProfileTab` local state not synced to `ThemeContext` | Changing theme in Profile has no live effect until page reload |
| Seed users initialise to `theme: "dark"` but ThemeContext default is `enterprise-light` | Flash of incorrect theme on first login |
| Backend `/preferences` endpoint accepts raw `dict` — no validation | Any JSON can overwrite preferences |

---

## 3. Scope

**In Scope:**
- 5 named presets: Enterprise Light, Enterprise Dark, POS Night Mode, Retail Day, High Contrast
- Density token layer (compact / comfortable / spacious)
- Font scale tokens (sm / md / lg)
- Header preset switcher dropdown
- Profile tab visual tile picker (replaces 2-button toggle)
- Backend `UserPreferencesSchema` + `PreferencesUpdate` typed body
- Audit trail for preference changes

**Out of Scope:**
- Custom accent colour picker (future)
- Per-module density overrides (future)
- Dark/light mode media-query auto-detection (future)

---

## 4. Current State (Pre-Implementation)

- `ThemeContext.tsx`: boolean light/dark only, no preset concept
- `index.css`: `font-size: 13px` hardcoded, no density variables
- `smriti_scroll.css`: `rgba(37,99,235,…)` hardcoded in 3 places
- `UserProfileTab.tsx`: local `useState<theme>`, never called `ThemeContext.setTheme`
- `schemas/user.py`: `UserPreferencesSchema` had only `theme`, `language`, `timeZone`
- `services/user.py`: `update_preferences()` accepted raw `dict` with no audit

---

## 5. Gap Analysis

| Area | Gap | Resolved By |
|---|---|---|
| Theme engine | Binary toggle only | `ThemeContext v2.0` — `setPreset()` + `applyPresetToDOM()` |
| CSS tokens | No density/font-scale layer | `index.css` density tier blocks |
| Scrollbar | Hardcoded accent | `smriti_scroll.css` → `color-mix(var(--c-theme-primary))` |
| Profile UI | 2 buttons, not synced | 5-tile visual picker, `setPreset` on save |
| Header | Sun/Moon icon only | `PresetSwitcher` dropdown with swatch list |
| Backend schema | Missing preset fields | `UserPreferencesSchema` + `PreferencesUpdate` |
| Backend service | Raw dict, no audit | Typed merge, `USER_PREFERENCES_UPDATED` audit |
| Seed defaults | theme `dark` mismatch | All seeds aligned to `enterprise-light` / `pos-dark` |
| Types | `UserPreferences` missing fields | `presetId`, `density`, `fontScale`, `accentOverride` added |

---

## 6. Architecture Impact

```
[HTML <root>]
  data-theme="light|dark"        ← set by ThemeContext.applyPresetToDOM()
  data-density="compact|..."     ← NEW — activates spacing token tier
  style="--c-theme-primary:#..." ← NEW — dynamic accent override
  style="--font-base:13px"       ← NEW — font scale

[ThemeContext v2.0]
  activePreset: ThemePreset      ← NEW — full preset object
  setPreset(id)                  ← NEW — primary API
  toggleTheme()                  ← COMPAT alias
  setTheme(mode)                 ← COMPAT alias

[theme_presets.ts]               ← NEW — single source of truth
  5 × ThemePreset objects

[UserPreferencesSchema (Python)]
  + presetId, density, fontScale, accentOverride

[PUT /api/v1/users/{id}/preferences]
  Body: PreferencesUpdate        ← TYPED — was raw dict
  + USER_PREFERENCES_UPDATED audit entry
```

---

## 7. Proposed Design

See `src/config/theme_presets.ts` for canonical preset definitions. The CSS strategy uses CSS attribute selectors (`[data-density="compact"]`) rather than CSS-in-JS to keep the runtime cost zero — all density tokens resolve at paint time.

---

## 8. Files Created

| File | Purpose |
|---|---|
| `src/config/theme_presets.ts` | Canonical 5-preset definitions — single source of truth |

---

## 9. Files Modified

| File | Change Summary |
|---|---|
| `src/contexts/ThemeContext.tsx` | v2.0 — preset engine, `applyPresetToDOM()`, `setPreset()` |
| `src/index.css` | Density token layer + `var(--font-base)` |
| `src/smriti_scroll.css` | 3× `rgba` → `color-mix(var(--c-theme-primary))` |
| `src/types.ts` | `UserPreferences` + `presetId`, `density`, `fontScale`, `accentOverride` |
| `src/components/UserProfileTab.tsx` | Phase 1 sync fix + 5-tile preset grid |
| `src/layout_engine/layout_manager.tsx` | `PresetSwitcher` dropdown replaces Sun/Moon |
| `src/state/store.ts` | Seed defaults aligned to `enterprise-light` / `pos-dark` |
| `backend/app/schemas/user.py` | `UserPreferencesSchema` extended; `PreferencesUpdate` added |
| `backend/app/services/user.py` | Typed update, audit trail, enterprise-light default |
| `backend/app/api/v1/users.py` | Typed `PreferencesUpdate` body; `Body` import removed |

---

## 10. Dependencies

- Vite 5.4.21 — frontend build (confirmed passing)
- React 18 — `ThemeContext` / `ThemeProvider` pattern
- Pydantic v2 — `model_dump(exclude_none=True)`, `@field_validator` classmethod
- SQLAlchemy async — existing `preferences_json` Text column (no migration needed)

---

## 11. Risks

| Risk | Mitigation |
|---|---|
| Unknown preset ID from external client | `validate_preset_id` accepts unknown values gracefully |
| `color-mix()` browser support | Supported in Chromium 111+, Firefox 113+, Safari 16.2+ — sufficient for enterprise desktop |
| Existing users have no `presetId` in stored JSON | `getPresetById()` falls back to `enterprise-light`; `ThemeContext` also falls back via `LS_THEME` legacy key |

---

## 12. Rollback Strategy

1. Revert commits `36c780b1` and `15e34409` via `git revert`
2. `smriti-preset` localStorage key will be absent — `ThemeContext` falls back to `smriti-theme` legacy key
3. `preferences_json` column stores additional fields as extra JSON keys — they are ignored by old schema without error

---

## 13. Verification Plan

- TSC: `npx tsc --noEmit` → exit 0
- Vite build: `npx vite build` → 3708 modules, exit 0
- Python: `py_compile` → exit 0 on 3 backend files
- Manual: open app, click PresetSwitcher, confirm `data-theme`, `data-density`, `--c-theme-primary` change on `<html>`

---

## 14. Test Plan

| Scenario | Expected |
|---|---|
| Select "POS Night Mode" in header | `data-theme=dark`, `data-density=compact`, `--c-theme-primary=#10B981` |
| Select "Retail Day" | `data-theme=light`, `data-density=spacious`, `--c-theme-primary=#E9730C` |
| Save preset in Profile tab | `setPreset()` called immediately; notification shows preset name |
| Reload browser | Active preset restored from `smriti-preset` localStorage key |
| GET user from API | `preferences` JSON includes `presetId`, `density`, `fontScale` |
| PUT preferences with `{presetId: "pos-dark"}` | Returns updated user; audit log has `USER_PREFERENCES_UPDATED` |
| PUT preferences with invalid density | Pydantic coerces to `comfortable` |

---

## 15. Documentation Impact

- Walkthrough: `docs/walkthrough/foundation/Foundation_ThemePresetSystem_v1.0.md`
- CHANGELOG: updated
- Implementation Index: `docs/implementation/README.md` — row added

---

## 16. Deployment Plan

1. `git push` from `D:\Smriti_Retail_OS` → remote
2. `git pull origin smritiNX` on `F:\Smriti9` (test environment)
3. No DB migration — `preferences_json` Text column absorbs new fields

---

## 17. Status

**Completed** — 2026-10-11  
Commits: `36c780b1` (frontend), `15e34409` (backend)  
TSC: 0 errors · Vite: 3708 modules · py_compile: 0 errors

---

## 18. Related ADRs

- ADR: CSS Variable Token Architecture (existing)
- ADR: FastAPI System-of-Record Policy (AGENTS.md)

---

## 19. Related Walkthroughs

- `docs/walkthrough/foundation/Foundation_ThemePresetSystem_v1.0.md`
