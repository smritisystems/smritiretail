# Frontend and UX Assessment

## Inventory

The React/TypeScript frontend has an application shell in `src/App.tsx`, feature and domain components, shell/navigation, context providers, layout/workspace management, state, services, printing, sync/offline modules and shared UI elements. The current `src/` tree has approximately 870 TypeScript/TSX files. The root app lazy-loads login, password reset, company selection and several standalone views.

The app has dedicated UI for item master, purchase/GRN, sales/billing, POS, customers/CRM, barcode, WMS, reports, staff, setup, backup and administration. Shared dialogs, empty states, skeletons, tables, confirm dialogs, typeahead and lifecycle controls are present.

## Positive evidence

- TypeScript check (`npm run lint`, which runs `tsc --noEmit`) passed.
- Many modules have dedicated Vitest coverage, including billing, purchase, sales returns, inventory, CRM/loyalty, barcode, reports and workspace/navigation.
- An API client centralizes JWT/tenant headers and refresh; the deprecated wrapper delegates to the canonical client.
- Error boundaries, notifications, inactivity timeout, responsive shell/layout and local/offline synchronization capabilities exist in code.

## Observed gaps and risks

- **Session token exposure (EA-SEC-02):** remediation is implemented in the working tree. Browser clients now use server-set HttpOnly access/refresh cookies with CSRF and origin checks; frontend bearer-token persistence and JavaScript-readable token-cookie creation have been removed. Focused regression tests were added; database-backed auth tests were not run.
- **UX behavior not visually verified:** no browser session or screenshot-based review was conducted. Responsive behavior, accessibility, dead buttons, loading/error/empty states, and mobile layouts remain unverified.
- **Backend contract consistency:** many components call the shared client, but all screen-to-route workflows and payloads were not traced. `apiFetch` remains explicitly deprecated.
- **Complexity/duplication:** extensive top-level and nested component trees plus multiple stores, local repositories and alternate client APIs raise consistency/maintenance cost; not every component was measured for duplication.
- **Offline mode:** local cache/sync behavior exists, but real multi-device conflict handling and reconciliation were not executed.
- **Test signal:** full frontend run completed with one five-second timeout (2,346/2,347 passed); the timed-out print-architecture test passed when run alone with a longer timeout. This can be load-sensitive in CI.

## Score

**Frontend Engineering: 6.0/10. UX Consistency: 5.0/10.** Strong application and test footprint, but runtime visuals, accessibility, permission visibility, state reconciliation and real API integration remain unproven.

No frontend code was changed. Related findings and follow-up are in [08_SECURITY_ASSESSMENT.md](./08_SECURITY_ASSESSMENT.md), [11_TESTING_QUALITY_ASSESSMENT.md](./11_TESTING_QUALITY_ASSESSMENT.md) and the [risk register](./13_RISK_REGISTER_REMEDIATION_ROADMAP.md).
