# Runtime Dependency Map

## Audit ID

AUD-001

## Title

Runtime Dependency Map

## Purpose

Capture the current frontend runtime dependency surface for the SMRITI Retail OS workspace shell, header, event coordination, and browser compatibility stack.

## Scope

- Browser polyfills and runtime globals
- Workspace shell/header runtime flow
- Event coordination and action execution
- Theme, search, and regional formatting runtime dependencies

## Evidence

- Source files and configuration linked to runtime dependency behavior
- Comments and imports from shell/header/runtime modules
- Vite build config and polyfill files

## Current State

This document captures the current frontend runtime dependency surface for the SMRITI Retail OS workspace shell, header, event coordination, and browser compatibility stack.

## Problems

This document captures the current frontend runtime dependency surface for the SMRITI Retail OS workspace shell, header, event coordination, and browser compatibility stack.

The repository already contains explicit runtime dependency controls for the browser environment:

- `src/polyfill.ts` provides Node-compatible globals (`process`, `Buffer`, `global`) for browser execution.
- `vite.config.ts` defines global replacements and pre-bundles `buffer` to prevent runtime `Buffer` and `require` failures.
- `public/buffer.min.js` is a standalone browser polyfill that supports vendor chunks referencing `Buffer`.

The canonical runtime flow is:

1. browser loads `public/buffer.min.js` and app scripts
2. Vite-built bundle uses `globalThis.Buffer` and `process.env` replacements
3. `src/polyfill.ts` executes early in the app entry sequence
4. `WorkspaceShell` and `WorkspaceKernelHeader` render the central workspace UI
5. `WorkspaceEventBus` and `WorkspaceActionRegistry` coordinate cross-component runtime activity

## Dependency Map

### Browser Compatibility / Polyfills

- `src/polyfill.ts`
  - Defines `window.process`, `window.Buffer`, `globalThis.Buffer`, `window.global`, and `globalThis.process`
  - Ensures browser runtime compatibility for libraries written against Node globals

- `vite.config.ts`
  - `define.global = "globalThis"`
  - `define.Buffer = "globalThis.Buffer"`
  - `optimizeDeps.include = ["buffer"]`
  - `resolve.alias.buffer = "buffer/"`
  - `build.rollupOptions.output.banner` copies `window.Buffer` to `globalThis.Buffer`

- `public/buffer.min.js`
  - Standalone browser buffer polyfill bundle referenced by runtime HTML

### Workspace Shell / Header / Layout Runtime

- `src/layout_engine/components/WorkspaceShell.tsx`
  - Nine-region shell container
  - Renders kernel-managed header, breadcrumb bar, smart action bar, filter strip, body, inspector, notification tray, and status bar
  - Subscribes to `WorkspaceNavigationEngine` and `WorkspaceEventBus`

- `src/layout_engine/components/WorkspaceKernelHeader.tsx`
  - Centralized header renderer
  - Subscribes to `WorkspaceEventBus` for `HeaderUpdate`
  - Renders title, subtitle, search field, notifications, and profile controls
  - Supports POS focus mode via `posFocus`

- `src/components/workspace/WorkspaceFormActions.tsx`
  - Shared form action primitive for document-level save/post/print workflows
  - Used by `src/framework/sawf/components/DocumentHeader.tsx`

### Event Coordination and Actions

- `src/layout_engine/WorkspaceEventBus.ts`
  - Central bus for UI coordination events
  - Includes `HeaderUpdate`, `ActionExecuted`, `ThemeChanged`, `ModeChanged`, `HealthReport`, and more

- `src/layout_engine/WorkspaceActionRegistry.ts`
  - Canonical action registry and executor
  - Registers actions at module load time
  - Publishes `ActionExecuted` events to `WorkspaceEventBus`

### Search, Navigation, and Adaptive Behavior

- `src/layout_engine/GlobalSearchEngine.ts`
  - Search provider for workspace-level global search

- `src/layout_engine/WorkspaceNavigationEngine.ts`
  - Navigation trail and breadcrumb engine
  - Used by `WorkspaceShell` for breadcrumb sync

- `src/layout_engine/responsive_manager.ts`
  - Responsive layout rules referenced by adaptive workspace components
  - `src/styles/smriti-tokens.css` mirrors breakpoints via CSS custom properties

### Theme and UX Runtime

- `src/context/ThemeContext.tsx`
  - Runtime theme coordination and theme change events
  - Connects to `WorkspaceEventBus`

- `src/styles/smriti-tokens.css`
  - Semantic design token definitions and breakpoint mappings

### Currency and Regional Formatting

- `src/utils/formatters.ts`
  - `formatCurrency()` for Indian Rupees using `Intl.NumberFormat("en-IN", { currency: "INR" })`

- `src/kernel/upr/configuration/RegionalRegistry.ts`
  - Platform-level regional defaults, including `defaultCurrency`

### Document Studio and Shell Usage

- `src/framework/sawf/components/DocumentStudio.tsx`
  - Explicitly comments that the header is provided by `WorkspaceShell` via `WorkspaceEventBus`
  - No local document header is rendered inside the studio container

- `src/components/sales/SalesInvoiceStudio.tsx`
  - Publishes `HeaderUpdate` events with title, document number, status, and `posFocus`
  - Clears header updates on unmount

- `src/components/inventory/InventoryDashboardWorkspace.tsx`
  - Uses `WorkspaceShell` directly for dashboard workspace rendering

## Evidence

- `src/main.tsx`
  - Loads `SEEFProvider` and then renders `<App />` after `PlatformBootstrap.executeBootSequence()` completes

- `src/App.tsx`
  - Imports `LayoutEngineProvider` and `LayoutManager`
  - Confirms the app roots into the layout engine provider

- `src/framework/sawf/components/DocumentStudio.tsx`
  - `// Header is provided by Workspace Kernel (WorkspaceShell) via WorkspaceEventBus`

- `src/components/sales/SalesInvoiceStudio.tsx`
  - `WorkspaceEventBus.publish("HeaderUpdate", {...}, "sales.invoice")`

- `src/layout_engine/components/WorkspaceKernelHeader.tsx`
  - Subscribes to `WorkspaceEventBus.subscribe("HeaderUpdate", ...)`

- `src/layout_engine/components/WorkspaceShell.tsx`
  - Renders `<WorkspaceKernelHeader initialTitle={metadata.title} />`
  - Uses `WorkspaceEventBus.subscribe("HealthReport"...)`

- `vite.config.ts`
  - Contains runtime global definitions and `buffer` dependency management

## Findings

- The runtime dependency stack is intentionally hybrid: browser ESM app code depends on Node-like globals provided by a polyfill layer.
- `Buffer` and `process` are not native browser APIs, so runtime stability depends on the polyfill declarations in `src/polyfill.ts` and `vite.config.ts`.
- `WorkspaceShell` is the canonical render host for workspaces and header content. Local workspace header implementations should be avoided.
- There is already a clear design rule in code/comments: document studios must publish header metadata to the kernel header rather than render a local header.
- Currency formatting is centralized through `formatCurrency()` and platform regional defaults, but there is evidence of UI-level string concatenation in other modules that should be audited separately.
- Existing source comments include mojibake like `Â©` and `â‚¹`; this is a sign that UTF-8 canonicalization is required for docs and source file comments.

## Recommendations

1. Preserve the current polyfill architecture as the canonical runtime compatibility layer.
   - Keep `src/polyfill.ts` and `vite.config.ts` in sync.
   - Ensure `public/buffer.min.js` remains the authoritative standalone polyfill for vendor bundle compatibility.

2. Add a repository lint or search audit to detect `require(` and bare `Buffer` usage in source files.
   - Prevent new runtime anti-patterns from creeping into the ESM frontend.

3. Treat `WorkspaceShell` as the only approved shell container.
   - Enforce the `WorkspaceShell` / `WorkspaceKernelHeader` combination as the runtime standard for all workspaces.

4. Audit all studios for `HeaderUpdate` publication.
   - Studios that need to update the header must publish `HeaderUpdate` via `WorkspaceEventBus`, not mount a separate header.

5. Normalize file encoding to UTF-8 and fix mojibake in comments and documentation.
   - This preserves canonical audit artifacts and prevents misleading symbol rendering in the codebase.

## Action Items

- [ ] Document the runtime dependency map in architecture governance artifacts.
- [ ] Add a code check that flags `require(` usage in frontend source files.
- [ ] Verify vendor chunk startup order to ensure `Buffer` is available before any bundle code references it.
- [ ] Audit all documented shell workspaces to confirm `WorkspaceShell` usage and `HeaderUpdate` compliance.
- [ ] Clean up encoding issues in source headers and docs to preserve canonical Markdown quality.
