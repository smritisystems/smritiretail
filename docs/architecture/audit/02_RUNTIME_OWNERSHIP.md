# Runtime Ownership Matrix

## Audit ID

AUD-002

## Title

Runtime Ownership Matrix

## Purpose

Record ownership for key frontend runtime concerns and ensure accountable governance across shell, header, event, and polyfill runtime areas.

## Scope

- Workspace shell and kernel header ownership
- Header metadata publishing ownership
- Event coordination and action registry ownership
- Polyfill and runtime compatibility ownership
- Responsive and theme runtime ownership

## Evidence

- Source files that show ownership and runtime responsibility
- Ownership mapping for shell, header, event, and polyfill modules

## Current State

This matrix records ownership for the key runtime concerns found in the current SMRITI Retail OS frontend architecture.

## Problems

This matrix records ownership for the key runtime concerns found in the current SMRITI Retail OS frontend architecture.

It makes ownership explicit for:

- header rendering and metadata publishing
- workspace shell layout
- event coordination
- action registration and execution
- browser polyfills
- theme and responsive runtime behavior
- currency formatting

## Ownership Matrix

| Runtime Concern | Primary Owner | Secondary Owner | Evidence | Notes |
| --- | --- | --- | --- | --- |
| Workspace shell container | `src/layout_engine/components/WorkspaceShell.tsx` | `src/layout_engine/layout_store.tsx` | Shell renders nine-region layout and kernel header | Shell is canonical host for all studios |
| Kernel header rendering | `src/layout_engine/components/WorkspaceKernelHeader.tsx` | `src/layout_engine/components/WorkspaceShell.tsx` | Subscribes to `WorkspaceEventBus HeaderUpdate` | Centralized header with POS focus support |
| Header metadata publishing | `src/components/sales/SalesInvoiceStudio.tsx` | any document studio requiring header data | publishes `HeaderUpdate` on mount/unmount | Partial adoption visible in sales invoice studio |
| Document action toolbar | `src/components/workspace/WorkspaceFormActions.tsx` | `src/framework/sawf/components/DocumentHeader.tsx` | shared action button primitive | Reuse over duplication is required |
| Event coordination bus | `src/layout_engine/WorkspaceEventBus.ts` | `WorkspaceAnalyticsEngine` | defines workspace event types and publish/subscribe | UI coordination hub for shell, analytics, theme, mode |
| Action registry and execution | `src/layout_engine/WorkspaceActionRegistry.ts` | `src/layout_engine/WorkspaceEventBus.ts` | executes registered actions and emits `ActionExecuted` | Single source of truth for studio actions |
| Navigation / breadcrumbs | `src/layout_engine/WorkspaceNavigationEngine.ts` | `src/layout_engine/components/WorkspaceShell.tsx` | breadcrumb sync in shell | Workspace navigation trail is centralized |
| Global search runtime | `src/layout_engine/GlobalSearchEngine.ts` | `src/layout_engine/components/WorkspaceKernelHeader.tsx` | search input rendered by kernel header | Search provider is supported in header layout |
| Responsive layout / breakpoints | `src/layout_engine/responsive_manager.ts` | `src/styles/smriti-tokens.css` | breakpoint and adaptive rendering rules | Should align with `SMRITI_RESPONSIVE_RULEBOOK` |
| Theme runtime | `src/context/ThemeContext.tsx` | `src/styles/smriti-tokens.css` | theme events and CSS token runtime | Theme state flows through event bus |
| Browser global polyfills | `src/polyfill.ts` | `vite.config.ts` | sets `window.process`, `window.Buffer`, and `globalThis` | Required for vendor dependencies (Buffer/process) |
| Buffer compatibility | `public/buffer.min.js` | `vite.config.ts` | vendor runtime compatibility banner and alias | Critical for browser `Buffer` references |
| Currency formatting | `src/utils/formatters.ts` | `src/kernel/upr/configuration/RegionalRegistry.ts` | `formatCurrency` uses `Intl.NumberFormat` | Should be audited via regional registry rules |
| Document studio shell compliance | `src/framework/sawf/components/DocumentStudio.tsx` | `src/framework/sawf/components/DocumentHeader.tsx` | header comment says header is provided by shell | Confirms shell/header separation is intended |
| Inventory dashboard shell usage | `src/components/inventory/InventoryDashboardWorkspace.tsx` | `src/components/inventory/StockOperationsWorkspace.tsx` | uses `WorkspaceShell` directly | Example of shell adoption outside document studios |

## Findings

- `WorkspaceShell` is clearly the canonical shell container and should remain the only approved runtime workspace wrapper.
- `WorkspaceKernelHeader` is the single source of truth for header rendering, making it the natural owner of workspace title and metadata display.
- Runtime header metadata ownership is currently distributed to studios that publish `HeaderUpdate` events, but only a small set of studios currently use that pattern.
- `WorkspaceFormActions` provides a reusable document action primitive; any studio that requires save/post/print controls should reuse it rather than implementing custom toolbar actions.
- The runtime event bus is the principal coordination mechanism for UI state changes. Any cross-component runtime behavior should flow through `WorkspaceEventBus` instead of direct component coupling.
- Polyfill ownership is explicit and should not be duplicated. `src/polyfill.ts` plus Vite build config is the canonical runtime dependency bridge for browser Node-globals.
- Currency formatting is centralized in utility code, but numeric display conventions may still be implemented in multiple places. A dedicated audit of currency rendering should follow this runtime ownership mapping.

## Recommendations

1. Enforce a runtime ownership rule in architecture governance:
   - `WorkspaceShell` owns workspace layout and zones.
   - `WorkspaceKernelHeader` owns visible header rendering.
   - Studios own metadata publishing via `WorkspaceEventBus`.
   - `WorkspaceActionRegistry` owns action definitions and execution.
   - `WorkspaceEventBus` owns event coordination.
   - `src/polyfill.ts` owns browser global polyfills.

2. Expand the usage of `WorkspaceFormActions` for all document and form-based studios.

3. Audit each studio for `HeaderUpdate` publish compliance:
   - If a studio needs title/status metadata in the shell header, it must publish `HeaderUpdate`.
   - If a studio renders its own header, it should be refactored or flagged for migration.

4. Add a governance rule that any runtime polyfill or global injection must be documented and versioned in `docs/architecture/audit`.

5. Add a follow-up artifact for `COMPONENT_OWNERSHIP_MATRIX.md` and `THEME_PURITY_AUDIT.md` to extend this runtime ownership mapping.

## Action Items

- [ ] Add runtime ownership checks to the architecture review checklist.
- [ ] Confirm all document studios currently using `WorkspaceShell` also adopt the kernel-managed header.
- [ ] Add a repository query to detect direct `require(` usage in frontend code.
- [ ] Ensure `src/polyfill.ts` remains before any application code that depends on `Buffer` or `process`.
- [ ] Keep `public/buffer.min.js` and Vite `define` replacement logic synchronized with any vendor dependency changes.
