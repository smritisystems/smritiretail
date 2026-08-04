# SPK Experience Runtime Mapping

Version: v1.0
Status: ARCHITECTURE FROZEN
Owner: SMRITI Architecture Council
Runtime: SPK
Review: Only through ADR

## Overview

The existing SMRITI runtime architecture is frozen on `SPK` as the canonical Experience Runtime. `SPK` is the platform kernel and runtime boundary; the listed UX artifacts implement the experience layer on top of that kernel without introducing a new runtime engine.

**Architecture Rule:** SPK is the only runtime execution kernel. No additional runtime kernel, experience kernel, UX kernel, or duplicate execution engine may be introduced without an Architecture Decision Record (ADR) demonstrating that the existing SPK cannot satisfy the requirement.

This mapping document shows how the following pieces collectively implement the UX runtime:

- `SPK`
- `SmritiExperienceContext`
- `WorkspaceShell`
- `WorkspaceNavigationEngine`
- `WidgetEngine`
- `WorkspacePersonalizationEngine`
- `AdaptiveWorkspaceStore`
- `NavigationRegistry`
- `DashboardRegistry`

## Canonical Runtime: SPK

`SPK` is the canonical platform runtime. It is implemented in:

- `src/kernel/SPK.ts`

Key runtime responsibilities in `SPK`:

- Kernel lifecycle: `SPK.start()`, `SPK.shutdown()`
- Service registry: `SPK.services.register()`, `SPK.services.resolve()`
- Command bus: `SPK.commands.registerHandler()`, `SPK.commands.execute()`
- Event bus: `SPK.events.subscribe()`, `SPK.events.emit()`
- Lookup providers: `SPK.ule.registerProvider()`, `SPK.ule.search()`
- Navigation metadata facade: `SPK.navigation.getSidebar()`, `SPK.navigation.getDomains()`
- Dashboard runtime facade: `SPK.dashboard.getDashboard()`, `SPK.dashboard.renderWidget()`
- Configuration, security, licensing, and workflow facades for runtime context

`SPK` is bootstrapped in:

- `src/bootstrap/di.ts`

There, `SPK.start()` is called and runtime services, commands, and lookup providers are registered.

## UX Runtime Components

### SmritiExperienceContext

- File: `src/context/SmritiExperienceContext.tsx`

Role:

- Provides the canonical React experience context for UI components
- Wraps the adaptive workspace store and extended experience flags
- Exposes:
  - `mode`
  - `config`
  - `industryPack`
  - `compactMode`, `touchMode`, `largeFontMode`, `keyboardMode`, `accessibilityMode`
  - `setMode()` and experience preference setters
  - `canRender(featureKey)` (delegates to `AdaptiveWorkspaceStore`)
  - `isTabAllowed(tabId)`

This context is the UX runtime contract for all client components, enforcing runtime behavior without direct `mode ===` checks.

### WorkspaceShell

- File: `src/layout_engine/components/WorkspaceShell.tsx`

Role:

- Universal studio shell container for all workspaces
- Hosts the nine-region experience layout:
  - header
  - breadcrumb bar
  - smart action bar
  - filter strip
  - workspace body
  - inspector panel
  - notification tray
  - status bar
  - AI panel slot
- Uses the following runtime services:
  - `useSmritiExperience()` for adaptive UX state
  - `WorkspaceNavigationEngine` for navigation and breadcrumbs
  - `WorkspaceActionRegistry` for action rendering
  - `WorkspaceEventBus` for workspace lifecycle and notifications
  - `adaptiveWorkspaceStore.canRender()` for feature gating
  - `WorkspaceHealthMonitor` to record workspace load health

Purpose:

- Enforces the shell boundary for every workspace
- Keeps shell logic separate from domain-specific studios
- Provides a shared runtime host for UX concerns

### WorkspaceNavigationEngine

- File: `src/layout_engine/WorkspaceNavigationEngine.ts`

Role:

- Navigation runtime engine for workspaces
- Manages:
  - current route and history stack
  - back/forward navigation
  - breadcrumbs
  - bookmarks/pins
  - recent workspace list
  - deep link resolution
  - bottom navigation items
- Integrates with:
  - `WorkspaceRegistry` for workspace metadata
  - `NavigationRegistry` for domain/sidebar metadata
  - `WorkspaceEventBus` for `WorkspaceOpened` events

This engine provides the runtime navigation API that UI renderers consume.

### WidgetEngine

- File: `src/layout_engine/WidgetEngine.ts`

Role:

- Lifecycle manager for live dashboard widgets
- Manages widget mounting, unmounting, refresh, and resize
- Publishes widget lifecycle events to `WorkspaceEventBus`
- Filters widgets by adaptive mode using `AdaptiveWorkspaceStore`
- Uses `DashboardRegistry` metadata to compute visible widgets

This engine is the runtime execution layer for dashboard widgets and widget lifecycle telemetry.

### WorkspacePersonalizationEngine

- File: `src/layout_engine/WorkspacePersonalizationEngine.ts`

Role:

- Persistent personalization runtime storage
- Manages:
  - dashboard layout persistence per workspace
  - pinned actions
  - remembered filters
  - density setting
  - last workspace selection
  - recent operations
- Persists state to localStorage under `smriti_sxp_personalization`
- Publishes `FilterChanged` events via `WorkspaceEventBus`

This engine provides runtime memory for user experience state without embedding persistence in studios.

### AdaptiveWorkspaceStore

- File: `src/layout_engine/adaptive_workspace_store.ts`

Role:

- Central adaptive visibility registry and workspace mode store
- Defines modes: `SIMPLE`, `HYBRID`, `ADVANCED`
- Implements frozen feature visibility matrix:
  - `timeline`, `reservations`, `batch_serial`, `cost_layers`, `raw_ledger`, `api_inspector`, `diagnostics`, `lock_inspector`
- Controls:
  - `getMode()` / `setMode()`
  - `getConfig()`
  - `isTabAllowed(tabId)`
  - `canRender(featureKey, mode?)`
- Persists current mode to `localStorage` under `smriti_workspace_mode`

This store is the runtime rules engine for feature visibility, mode gating, and workspace availability.

### NavigationRegistry

- File: `src/kernel/upr/navigation/NavigationRegistry.ts`

Role:

- Universal Platform Registry (UPR) for domain and sidebar metadata
- Declares domain definitions and module associations
- Provides:
  - `getDomains()`
  - `getDomain(id)`
  - `getModuleIdsForDomain(domainId)`
  - `getSidebar(activeDomainId)`
- Used by:
  - `NavigationRenderer` UI
  - `WorkspaceNavigationEngine`
  - `SPK.navigation` facade

This is the canonical metadata store for domain-driven navigation.

### DashboardRegistry

- File: `src/kernel/upr/dashboard/DashboardRegistry.ts`

Role:

- UPR metadata registry for dashboards and widgets
- Declares dashboard definitions and default widget lists
- Provides runtime access to:
  - `getDashboard(id)`
  - `getDashboards()`
  - `renderWidget(widgetId, dashboardId, context)`
- Works with `WidgetEngine` to filter and surface widgets

This registry is the runtime metadata source for dashboard composition.

## How the pieces work together

`SPK` is the authoritative runtime kernel.

- `SPK.navigation` delegates to `NavigationRegistry`
- `SPK.dashboard` delegates to `DashboardRegistry`
- `SPK` is bootstrapped before UX runtime starts and registers services/commands/lookup providers

`AdaptiveWorkspaceStore` defines the runtime workspace mode and feature gating rules.

`SmritiExperienceContext` exposes those runtime rules to React components and adds UX state dimensions.

`WorkspaceShell` is the runtime host for studios and composes shell regions with navigation, actions, filters, and status.

`WorkspaceNavigationEngine` drives runtime navigation, history, breadcrumbs, and domain-aware workspace selection.

`WidgetEngine` manages widget lifecycles and renders dashboard widgets based on `DashboardRegistry` metadata and adaptive visibility.

`WorkspacePersonalizationEngine` preserves runtime personalization state and exposes it to workspace-level experiences.

## Missing capabilities

These are the only runtime gaps identified in the current implementation, chosen to extend the existing architecture rather than duplicate it:

1. `SPK` does not currently expose a first-class `experience` or `workspace` facade.
   - Missing capability: a canonical `SPK.experience` or `SPK.workspace` API that directly surfaces `SmritiExperienceContext` runtime dimensions, workspace lifecycle, personalization, and navigation from the kernel boundary.
   - Extension recommendation: add a thin facade in `SPK` that delegates to the existing `AdaptiveWorkspaceStore`, `WorkspaceNavigationEngine`, `WorkspacePersonalizationEngine`, and `NavigationRegistry`.

2. Adaptive UX gating is split between `AdaptiveWorkspaceStore` and `SPK.security.evaluateAccess()`.
   - Missing capability: a shared platform runtime policy that links feature gating, licensing, and permission evaluation under one `SPK`-level registry contract.
   - Extension recommendation: augment `SPK.security` or `SPK.configuration` with a platform-level feature gate service that delegates to `AdaptiveWorkspaceStore.canRender()` and `LicenseRegistry.isFeatureEnabled()`.

3. Dashboard metadata and personalization are separated.
   - Missing capability: a runtime join point for dashboard definitions and saved dashboard layout metadata.
   - Extension recommendation: expose a shared runtime query such as `SPK.dashboard.getDashboardLayout(dashboardId)` that merges `DashboardRegistry` widget definitions with `WorkspacePersonalizationEngine` layout state.

4. Workspace lifecycle hooks are defined in `WorkspaceRegistry` metadata but not surfaced through `SPK`.
   - Missing capability: a kernel-facing workspace lifecycle contract for `initialize`, `activate`, `deactivate`, `destroy`.
   - Extension recommendation: add a `SPK.workspace` or `SPK.sdk` hook registration path that reuses `WorkspaceRegistry` metadata, instead of creating a new runtime layer.

5. Deep link resolution and workspace route discovery are currently only in `WorkspaceNavigationEngine`.
   - Missing capability: a kernel-side `SPK.navigation.resolveDeepLink()` facade.
   - Extension recommendation: expose the existing `resolveDeepLink()` through `SPK.navigation`.

## Conclusion

The existing codebase already implements the UX runtime through the frozen `SPK` kernel plus the listed UX services. No new runtime engine is needed. The only meaningful gaps are integration facades and shared runtime query surfaces that should extend the current architecture instead of duplicating it.

## Related Documents

→ `SMRITI_EXPERIENCE_PLATFORM_ARCHITECTURE_v1.0.md`

→ `SPK_Experience_Runtime_Mapping.md`

→ `SMRITI_ARCHITECTURE_DEPENDENCY_MAP.md`

→ `SMRITI_DESIGN_STUDIO_SPECIFICATION.md`

→ `SMRITI_UX_GOVERNANCE.md`
