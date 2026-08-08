<!--
  Project      : SMRITI Retail OS
  Document     : SXP Platform Constitution V1
  File         : docs/sdk/SXP_PLATFORM_CONSTITUTION_V1.md
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Version      : 1.0.0  (FROZEN — 2026-08-03)
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal — Platform Governance
-->

# SXP Platform Constitution V1

**Studio Experience Platform — Constitutional Governance Document**
**Status: FROZEN v1.0 — 2026-08-03**
**Supersedes:** All informal SXP design notes and sprint retrospectives.
**Authority:** This document governs every studio built on SMRITI Retail OS.

---

## Preamble

The Studio Experience Platform (SXP) v1.0 is the stable UX foundation of SMRITI Retail OS.
It was designed with one principle above all others:

> **Power of an Enterprise ERP. Simplicity of WhatsApp.**

This constitution records what is frozen, what may be extended, and what is permanently prohibited.
Every engineer, every AI agent, and every studio team operates within these rules.

No new studio, module, or feature may modify platform layer APIs without an approved
Architecture Decision Record (`docs/adr/ADR-xxx.md`).

---

## Part I — Platform Principles

### P-001: Governance Over Convention
All navigation, forms, workflows, reports, permissions, and configurations are declared
through registry metadata. Procedural `if/switch` logic in UI components is prohibited.

### P-002: Manifest-Driven Studios
Every business domain self-registers via a co-located `*.manifest.ts` file on side-effect
import. No core platform file is modified to add a new studio.

### P-003: Adaptive Disclosure
The platform reveals capability progressively. Simple users see simple UX.
Advanced users unlock advanced features. Mode is never hidden — it is deferred.

```
SIMPLE   — Essential actions only. Scan-first. Zero configuration.
HYBRID   — Operational controls visible. Suitable for trained staff.
ADVANCED — Full platform capability. Diagnostics, ledger, raw events.
```

### P-004: Offline-First Operations
Every action that can be queued offline must be queued offline.
The platform never shows HTTP error codes to end users.
User-facing language: "Working offline" — not "503 Service Unavailable".

### P-005: AI is Advisory Only (AOP-001)
AI skills may recommend. They may never automatically post financial or
inventory transactions. Every AI result must set `isAdvisoryOnly: true`.

### P-006: Plain Language Always (Fiori Principle)
User-facing labels use plain English, not ERP terminology.
- ✅ "Receive Stock" — not "GRN Posting"
- ✅ "Today's Stock" — not "Inventory Dashboard"
- ✅ "Something went wrong" — not "Error 500"
- ✅ "Nothing here yet" — not "No records found"

### P-007: Scanner First (SWEF P-007)
Warehouse and POS scanner workflows must complete in ≤ 3 interactions.
`scanner_action` mode enforces a maximum of 3 wizard steps via `OperationLauncher`.

---

## Part II — Stable Platform APIs

The following APIs are frozen. Their signatures, behaviour, and contracts
do not change without a breaking-change ADR and a major version increment.

### 2.1 Navigation (WNG-001 — WNG-005, FROZEN v1.0)

| API | Contract |
|---|---|
| `WorkspaceRegistry.register(manifest)` | Registers a workspace by manifest |
| `WorkspaceRegistry.get(id)` | Returns workspace manifest or undefined |
| `SPK.navigation.getSidebar(activeDomain)` | Returns sidebar items for a domain |

**Prohibited:** Hardcoded domain checks (`if (domain === "sales")`), second persistent sidebars,
procedural navigation construction.

### 2.2 Forms (UFR-001 — UFR-006, FROZEN v1.0)

| API | Contract |
|---|---|
| `SPK.forms.getForm(entityId)` | Returns form definition from FormRegistry |
| `SPK.fields.getFieldControl(fieldType)` | Returns UI control component for a field type |
| `SPK.validation.validate(rules, value)` | Executes validation rules |
| `SPK.layouts.getGridSpan(section, breakpoint)` | Returns responsive column span |

**Prohibited:** Handcrafted TSX form components, inline `switch(field.type)` blocks,
hardcoded layout column values.

### 2.3 Actions (WorkspaceActionRegistry, FROZEN)

```typescript
WorkspaceActionRegistry.register(action: WorkspaceActionDef): void
WorkspaceActionRegistry.execute(actionId: string, ctx: ActionExecutionContext): Promise<ActionResult>
WorkspaceActionRegistry.unregister(actionId: string): void
```

`ActionExecutionContext` fields: `tenantId`, `userId`, `workspaceId`, `mode`, `payload?`

**Contract:** `execute()` is the single entry point for all action invocation.
Direct component-to-component calls that bypass the registry are prohibited.

### 2.4 Event Bus (WorkspaceEventBus, FROZEN)

```typescript
WorkspaceEventBus.publish(type: WorkspaceEventType, payload, sourceId?): WorkspaceEvent
WorkspaceEventBus.subscribe(type, handler): () => void
WorkspaceEventBus.clearAll(): void
```

**Stable event types:**
`WorkspaceOpened` · `WorkspaceClosed` · `FilterChanged` · `SelectionChanged` ·
`ActionExecuted` · `WidgetLoaded` · `WidgetRefreshed` · `ThemeChanged` ·
`ModeChanged` · `SyncCompleted` · `OfflineStateChanged` · `CommandPaletteOpened` · `HealthReport`

**Adding new event types:** Allowed, additive, no ADR required.
**Removing or renaming event types:** Breaking change — ADR required.

### 2.5 Adaptive Workspace (FROZEN)

```typescript
adaptiveWorkspaceStore.setMode(mode: WorkspaceMode): void
adaptiveWorkspaceStore.getMode(): WorkspaceMode
adaptiveWorkspaceStore.canRender(featureKey: string, mode?: WorkspaceMode): boolean
ADAPTIVE_VISIBILITY_MATRIX   // frozen — modification requires ADR
```

**Adding new feature keys:** Requires ADR (matrix change).
**Changing existing visibility rules:** Requires ADR (breaking UX change).

### 2.6 Offline (OfflineExperienceManager, FROZEN)

```typescript
OfflineExperienceManager.registerHandler(type, handler): void
OfflineExperienceManager.enqueue(type, payload): OfflineOperation
OfflineExperienceManager.syncAll(): Promise<void>
OfflineExperienceManager.getPendingCount(): number
OfflineExperienceManager.getQueue(): ReadonlyArray<OfflineOperation>
OfflineExperienceManager.clearSynced(): void
```

### 2.7 Analytics (WorkspaceAnalyticsEngine, FROZEN)

```typescript
WorkspaceAnalyticsEngine.track(type, workspaceId?, metadata?): void
WorkspaceAnalyticsEngine.getAll(): ReadonlyArray<AnalyticsEvent>
WorkspaceAnalyticsEngine.getByType(type): ReadonlyArray<AnalyticsEvent>
WorkspaceAnalyticsEngine.getTopActions(n?): Array<{actionId, count}>
WorkspaceAnalyticsEngine.getAverageSessionDuration(workspaceId): number
WorkspaceAnalyticsEngine.clearAll(): void
```

**Storage:** `localStorage` under key `sxp:analytics:events`. Rolling window: 500 events.

### 2.8 Global Search (GlobalSearchEngine, FROZEN)

```typescript
GlobalSearchEngine.search(query: string): SearchResult[]
GlobalSearchEngine.registerSource(source: SearchSource): void
GlobalSearchEngine.unregisterSource(id: string): void
GlobalSearchEngine.getSources(): SearchSource[]
```

---

## Part III — Stable SDK

### 3.1 Widget SDK

The following widget components are platform assets. They must not be modified
for domain-specific purposes. Domain requirements must be met via props.

| Component | Props Contract | Memo |
|---|---|---|
| `SummaryCard` | title, value, unit, subtitle, icon, accent | ✅ |
| `TrendCard` | title, data, unit, positive, changeLabel | ✅ |
| `KPIProgressCard` | title, current, target, unit, direction, icon | ✅ |
| `AlertCard` | alerts, maxVisible, onDismiss | ✅ |
| `ActionCard` | action, onSelect, badge, badgeColor | ✅ |
| `TimelineCard` | title, adapter, entityId | ✅ |

All 6 are wrapped in `React.memo`. Props must be stable references (use `useMemo`/`useCallback`
at the call site) to benefit from memoization.

### 3.2 Skeleton SDK

| Component | Use When |
|---|---|
| `SkeletonCard` | KPI / summary card loading state |
| `SkeletonRow` | Table / list row loading state |
| `SkeletonTimeline` | Timeline event loading state |
| `SkeletonDashboard` | Full dashboard initial load |

**Rule:** Never use raw `<div>Loading...</div>` in any workspace. Always use a skeleton.
**Rule:** Never hardcode skeleton colours. Always use `--sxp-skeleton-base` and `--sxp-skeleton-shimmer`.

### 3.3 Empty State SDK

| Component | Trigger |
|---|---|
| `EmptyState` (variant="no-data") | List with zero records |
| `EmptyState` (variant="no-results") | Search returned zero hits |
| `EmptyState` (variant="offline") | Network unavailable |
| `EmptyState` (variant="error") | API failure |
| `EmptyState` (variant="restricted") | Permission denied |
| `EmptyInventory` | Inventory list is empty |
| `EmptyPOS` | POS bill list is empty |
| `EmptyOrders` | Sales or Purchase order list is empty |
| `EmptySearchResults` | Global search no results |
| `OfflineBanner` | Offline state notification |

**Rule:** Every empty state must suggest the next action via `cta` prop.
**Rule:** "Nothing here yet" not "No Data". Plain language always.

### 3.4 QuickActionBar SDK

`QuickActionBar` is the universal action toolbar for all studios. Studios must not
build their own custom toolbars. All actions go through `QuickActionBar` props.

```typescript
interface QuickActionBarProps {
  domainLabel?: string;
  primaryAction?: QuickAction;   // Always visible, filled, leftmost
  onScan?(): void;               // Always icon-only
  actions?: QuickAction[];       // Filtered by visibleIn adaptive mode
  maxInline?: number;            // Default: 3
  mode?: WorkspaceMode;
  workspaceId?: string;
}
```

### 3.5 Operation Wizard SDK (SWEF P-007)

`OperationWizard` enforces the 3-interaction rule for scanner workflows.

```typescript
interface OperationDef {
  actionId: string;
  mode: "scanner_action" | "guided_form" | "confirmation";
  context: ActionExecutionContext;
  steps: OperationStep[];   // Clipped to MAX_STEPS[mode] at runtime
}

MAX_STEPS = { scanner_action: 3, guided_form: 6, confirmation: 2 }
```

**Contract:** `buildXxxWizard()` factory functions are the only permitted way to
construct `OperationDef` objects. Inline `OperationDef` literals in components are prohibited.

---

## Part IV — Design Token System (FROZEN)

All visual values must come from the token system. Hardcoded colours, sizes, and
durations in component `style={}` props are a violation unless quoting a token variable.

### 4.1 Token Files

| File | Scope |
|---|---|
| `src/styles/sxp-tokens.css` | Typography, spacing, colour, radius, shadow, z-index |
| `src/styles/motion-tokens.css` | Durations, easing curves, keyframes |

### 4.2 Approved Durations

| Name | Value | Use |
|---|---|---|
| `--sxp-motion-fast` | 100ms | Hover, focus, badge updates |
| `--sxp-motion-normal` | 160ms | Panel transitions, tab switching |
| `--sxp-motion-slow` | 240ms | Modal enter/exit, page transitions |

**Prohibited:** Any numeric duration not from this table (e.g. `transition: all 300ms`).
**Required:** `prefers-reduced-motion` support — all durations collapse to 0ms via CSS.

### 4.3 Approved Surface Tokens (Dark Mode)

| Token | Value | Use |
|---|---|---|
| `--sxp-surface-1` | `#141826` | Page background |
| `--sxp-surface-2` | `#1F2430` | Cards, panels |
| `--sxp-surface-3` | `#2B3242` | Modals, tooltips, dropdowns |
| `--sxp-skeleton-base` | `#1F2430` | Skeleton resting state |
| `--sxp-skeleton-shimmer` | `#2B3242` | Skeleton shimmer highlight |

### 4.4 Semantic Colour Contract (Fiori)

| Semantic Role | Use |
|---|---|
| `--sxp-success` | Completed, in stock, confirmed |
| `--sxp-warning` | Low stock, pending, approaching limit |
| `--sxp-danger` | Out of stock, failed, overdue |
| `--sxp-info` | Informational, neutral status |
| `--sxp-brand` | Primary action, selection |

**Prohibited:** Using brand colours for semantic status. Do not use `--sxp-brand` to indicate success or warning.

---

## Part V — Accessibility Standard (WCAG AA — FROZEN)

### 5.1 Dialog Accessibility Contract

Every modal or overlay must implement:
- `role="dialog"` (or `role="alertdialog"` for critical confirmations)
- `aria-modal="true"`
- `aria-labelledby` pointing to the dialog heading element
- `aria-describedby` pointing to the supporting description element
- Focus trap: Tab/Shift-Tab cycle within the dialog
- `Escape` key closes the dialog
- Auto-focus on first focusable element on mount

### 5.2 Interactive Element Contract

Every button, card, and link must have:
- `aria-label` when the visible label is ambiguous or icon-only
- `id` attribute for testing and ARIA relationships
- `onKeyDown` Enter/Space handler when the element is not a native `<button>`

### 5.3 Decorative Content

Icons, emojis, and decorative images must carry `aria-hidden="true"`.
Status icons in result panels (✅ ❌) must use `role="alert"` on the containing element.

### 5.4 Screen Reader Utilities

```css
.sxp-sr-only   /* Visually hidden but readable by screen readers */
```

Loading states must include `<span className="sxp-sr-only">Loading…</span>`.

### 5.5 Focus Ring

The platform focus ring is defined globally:
```css
*:focus-visible { box-shadow: var(--sxp-focus-ring); }
```
Individual components must not override this with `outline: none` without providing
an equivalent visible focus indicator.

---

## Part VI — Backward Compatibility Rules

### 6.1 Additive-Only Rule for Interfaces
Public interfaces (`WorkspaceActionDef`, `ActionExecutionContext`, `OperationDef`,
`WorkspaceManifest`, `SearchSource`) may only have optional fields added.
Removing or renaming a field is a breaking change.

### 6.2 Registry Stability
`WorkspaceRegistry`, `WorkspaceActionRegistry`, `DashboardRegistry`,
`OfflineExperienceManager` — method signatures are frozen. New overloaded
signatures may be added; existing overloads may not change.

### 6.3 Event Type Stability
`WorkspaceEventType` values may be added. They may not be removed or renamed
without a deprecation period of ≥ 1 major version and an ADR.

### 6.4 CSS Token Stability
`--sxp-*` token names may not be renamed. New tokens may be added.
Deprecated tokens must remain defined (pointing to their replacement) for ≥ 1 major version.

---

## Part VII — Extension Rules

### 7.1 Adding a New Studio
1. Create `src/components/{domain}/{domain}.manifest.ts`
2. Declare actions, workspaces, and widgets using the manifest schema
3. Import as a side-effect in the domain's entry component
4. Run `npx tsc --noEmit` — 0 errors required
5. Complete all SXP certification gates (`SXP_CERTIFICATION_STANDARD_V1.md`)
6. No core platform file is modified

### 7.2 Adding a New Widget Type
Widget types are platform assets. New widget types require:
1. ADR documenting the need and prop contract
2. Implementation in `src/components/shared/widgets/`
3. `React.memo` wrapping
4. Exported from `src/components/shared/WidgetComponents.ts` barrel

### 7.3 Adding a New Event Type
Additive — no ADR required. Add to `WorkspaceEventType` union and
document the payload shape in a code comment at the subscribe call site.

### 7.4 Adding a New Adaptive Feature Key
New feature keys in `ADAPTIVE_VISIBILITY_MATRIX` require an ADR because
they affect the visible capability surface for all users at all modes.

### 7.5 Adding an AI Skill
All AI skills must be declared in `AIRegistry` (`SPK.ai`) per UAR-001.
Skills must set `isAdvisoryOnly: true` per AOP-001.
Skills execute exclusively through `SPK.ai.executeSkill()` per UAR-002.

---

## Part VIII — Deprecation Policy

1. A feature is marked deprecated in its JSDoc with `@deprecated since vX.Y.Z — use Foo instead`.
2. A deprecation notice is added to `docs/sdk/DEPRECATION_LOG.md`.
3. The deprecated API remains functional for a minimum of one major platform version.
4. After the deprecation window, removal requires an ADR and a major version increment.

---

## Part IX — Versioning Policy

| Increment | Trigger |
|---|---|
| **Patch** (x.x.Z) | Bug fixes, documentation corrections, token value adjustments |
| **Minor** (x.Y.0) | New optional fields, new event types, new widget types, new studio certification |
| **Major** (X.0.0) | Breaking interface changes, removed APIs, renamed tokens, ADAPTIVE_VISIBILITY_MATRIX changes |

Platform layer version is tracked in `package.json` (`smriti-retail-os`).
Studio manifests carry their own independent `version` field.

---

## Part X — Breaking Change Policy

A breaking change is any change that requires existing studio code to be modified
in order to continue functioning.

**Process:**
1. Author files `docs/adr/ADR-xxx.md` documenting motivation, alternatives considered, and migration guide.
2. ADR is reviewed and approved by the Chief Systems Architect.
3. A deprecation period is announced (minimum: one minor release cycle).
4. Migration tooling or a codemod is provided where feasible.
5. The change is released in a major version increment only.

---

## Appendix A — Platform Layer Inventory (v1.0)

The following files constitute the frozen Platform Layer v1.
They may be patched for bugs but not architecturally modified without an ADR.

### Runtime Kernel
| File | Role |
|---|---|
| `src/layout_engine/WorkspaceRegistry.ts` | Studio manifest registry |
| `src/layout_engine/WorkspaceActionRegistry.ts` | Action definition + execution |
| `src/layout_engine/WorkspaceEventBus.ts` | Typed pub/sub event bus |
| `src/layout_engine/adaptive_workspace_store.ts` | Mode state + ADAPTIVE_VISIBILITY_MATRIX |
| `src/layout_engine/GlobalSearchEngine.ts` | Federated search engine |
| `src/layout_engine/OfflineExperienceManager.ts` | Offline queue + sync |
| `src/layout_engine/WorkspaceAnalyticsEngine.ts` | Local analytics (localStorage) |

### Shared UI
| File | Role |
|---|---|
| `src/components/shared/OperationLauncher.tsx` | Scanner wizard + OperationWizard (WCAG AA) |
| `src/components/shared/SkeletonLoader.tsx` | Theme-aware skeleton loaders |
| `src/components/shared/EmptyState.tsx` | Plain-language empty states with CTAs |
| `src/components/shared/QuickActionBar.tsx` | Universal studio action toolbar |
| `src/components/shared/widgets/SummaryCard.tsx` | KPI summary widget |
| `src/components/shared/widgets/TrendCard.tsx` | Sparkline trend widget |
| `src/components/shared/widgets/KPIProgressCard.tsx` | Progress bar widget |
| `src/components/shared/widgets/AlertCard.tsx` | Alert list widget |
| `src/components/shared/widgets/ActionCard.tsx` | Action tile widget |
| `src/components/shared/widgets/TimelineCard.tsx` | Timeline event widget |

### Design System
| File | Role |
|---|---|
| `src/styles/sxp-tokens.css` | Typography, spacing, colour, radius, shadow, z-index tokens |
| `src/styles/motion-tokens.css` | Duration, easing, keyframe tokens |

### SDK Documents
| File | Role |
|---|---|
| `docs/sdk/UX_WORKSPACE_SDK_V1.md` | Workspace SDK reference |
| `docs/sdk/SXP_CERTIFICATION_STANDARD_V1.md` | Studio certification gates |
| `docs/sdk/SXP_PLATFORM_CONSTITUTION_V1.md` | This document |

---

## Appendix B — Studio Certification Status (as of v1.0)

| Studio | Gates Passed | Status |
|---|---|---|
| Inventory Studio | 11/12 | ✅ CONDITIONALLY APPROVED |
| POS Studio | 12/12 | ✅ APPROVED |
| Sales Studio | 11/12 | ✅ CONDITIONALLY APPROVED |
| Purchase Studio | 12/12 | ✅ CONDITIONALLY APPROVED |

---

## Appendix C — Development Wave Plan

Per the product direction established during Sprint 3 review, engineering effort
shifts entirely to business capabilities after this document is ratified.

### Wave 1 — Core Retail (Active)
Inventory Studio · Sales Studio · Purchase Studio · POS Studio

### Wave 2 — Extended Commerce
CRM · Accounting · Finance · Banking · Manufacturing

### Wave 3 — Intelligence & Automation
AI Copilot · Reporting Engine · Workflow Studio · Approval Engine · Mobile Warehouse

**Rule:** Every Wave 2 and Wave 3 studio must be built on SXP Platform Layer v1
using the manifest-driven approach. No platform modifications are permitted.

---

*This document is ratified and frozen as of 2026-08-03.*
*Next constitutional revision: SXP Platform Constitution V2 (requires Major version increment).*
