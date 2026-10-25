<!--
  Project      : SMRITI Retail OS
  Repository   : SMRITIRetailNX
  Author       : Copilot
  Version      : 1.0.0
  Created      : 2026-10-25
  Classification: Internal
-->

# Billing and Customer UX Convergence Plan v1.0.0

## 1. Objective
Complete a controlled UX refactor that keeps one Billing Window and shared billing engine, connects existing bulk-entry tools through the active item pipeline, resolves keyboard shortcut collisions, simplifies the default customer workflow, implements configuration- and authorization-driven Customer Business Tabs, and aligns affected UI with the existing SMRITI theme presets and tokens.

## 2. Business Motivation
Billing and customer workflows currently expose duplicated or disconnected entry tools, shortcut conflicts, information-dense headers, and profile tabs that change labels without changing access. The refactor must improve cashier throughput and customer-master clarity without weakening pricing, tax, authorization, persistence, or statutory behavior.

## 3. Scope
- UX-only frontend changes to the active billing and customer workspaces, shared keyboard behavior, and relevant design tokens.
- Connect barcode/CSV and paste entry into one item-resolution and backend-preview flow.
- Preserve existing production routes and existing business controls until equivalent behavior is verified.
- Keep database migrations, backend business rules, pricing policy changes, tax logic, and posting-contract changes out of scope.
- Treat the approved Customer-Type/Capability/Permission matrix as a prerequisite for final tab visibility rules.

## 4. Current State
- Active shell aliases for retail, credit, and tax billing render `BillingWorkspace`; it hosts `BillingTerm`.
- `BarcodeCSVImportModal` has no active workspace consumer. `BulkAddItemsModal` is consumed by the deprecated `SmritiBillingStudio`, not the active terminal.
- The active terminal has direct/barcode and F2 lookup entry. Recall and Customer PO can hydrate lines through separate paths; CSV/paste are not connected to it.
- `BillingWorkspace` and `BillingTerm` both handle F1. BillingTerm also maps F1 to direct-entry focus while BillingWorkspace maps it to workspace navigation.
- Customer profile tabs currently derive labels from customer type and hardcoded name/code heuristics. The profile receives role/name, not a resolved permission set or branch capability context.
- Customer 360 has no direct customer search control.
- Billing and customer workspace styles include local color literals alongside the existing preset/token theme.
- A browser walkthrough of the active terminal showed an authoritative preview result while configured add-on factors remained outside the preview/posting contract; settlement is fail-closed rather than posting mismatched totals.

## 5. Gap Analysis
| Requirement | Current evidence | Planned treatment |
|---|---|---|
| One billing workspace | Production route aliases in `TabRenderer.tsx` render `BillingWorkspace` | Keep aliases; verify all production billing entry points and avoid adding a second window |
| Bulk paste and CSV | Import modals are not wired to active `BillingTerm` | Integrate both as adapters to the shared item-resolution/preview path |
| Unified item validation | Direct entry/F2 share the terminal; recall and PO bypass that exact path | Route supported imports and hydrated lines through common validation before settlement |
| Shortcut safety | F1 listeners overlap; Launchpad has independent F-key quick actions | Establish one active-workspace shortcut owner and update visible labels/tests |
| Billing density | Customer and transaction context occupy separate header zones | Compact optional context while keeping payment, invoice, and statutory controls accessible |
| Customer tabs | Labels change; visibility and activation do not follow a permission matrix | Implement central tab policy and dirty-state-safe activation after matrix approval |
| Customer 360 search | No direct search field | Add accessible API-backed search and preserve existing navigation |
| Theme consistency | Local hardcoded colors coexist with preset theme tokens | Convert only touched surfaces to existing tokens and validate light/dark/high-contrast presets |
| Backend preview add-ons | Preview does not model configured freight/add-on/deduction rows | Keep fail-closed behavior; backend contract/policy work requires separate approval |
| Fulfillment | Packing-slip linkage and consolidated posting atomicity are not verified | Do not change fulfillment controls in this UX phase; retain blockers for a separately approved backend remediation |

## 6. Architecture Impact
- No API contract, database schema, or migration changes are planned.
- `BillingWorkspace` remains the single billing host and `BillingTerm` remains the active terminal.
- Imported items must enter the same active line pipeline and be subject to the existing backend-authoritative preview before settlement.
- Customer tab visibility is presentation-only authorization; backend authorization remains authoritative.
- The existing theme preset engine remains the source for palette and density behavior.

## 7. Proposed Design
1. Keep the canonical `BillingWorkspace` route aliases and prove the production surface through route and UI checks.
2. Place paste and CSV import affordances inside the active Billing Window. Adapt their output into shared item resolution, line construction, and preview validation; surface row failures without silently dropping rows.
3. Give each keyboard action one active owner. Preserve F11 for direct item entry and F7/F8 for settlement; resolve F1 and Launchpad collisions in the active context.
4. Compact optional transaction details and customer context by default, keeping customer identity, essential billing parameters, totals, payment, and invoice completion visible.
5. Add direct Customer 360 search backed by the existing CRM search API.
6. Centralize business-tab policy over customer type, company/branch capabilities, and resolved user permissions. Preserve dirty data and select a still-authorized tab when the type changes.
7. Collapse nonessential fields only after checking registry, serialization, and statutory consumers; do not delete field state or APIs.
8. Apply existing theme tokens to modified surfaces and validate both light and dark presets plus responsive breakpoints.
9. Preserve the fail-closed settlement guard while add-ons are absent from the authoritative preview/posting contract.

## 8. Files Created
- `docs/implementation/billing/Billing_Customer_UX_Convergence_Plan_v1.0.0.md`

## 9. Files Modified
- Planned: `src/components/billing/BillingWorkspace.tsx`, `src/components/billing/BillingTerm.tsx`, active import components, `src/components/customer/CustMasterWs.tsx`, `src/components/customer/customerProfileTabs.ts`, `src/components/customer/corporate360/Customer360DashboardView.tsx`, `src/components/launchpad/FioriLaunchpad.tsx`, `src/components/launchpad/launchpadCatalog.ts`, relevant theme-token files, and focused tests.
- Existing uncommitted files are not to be reset, reverted, or reformatted as part of this plan.

## 10. Dependencies
- Existing `apiFetchV1` CRM, product-resolution, and billing-preview endpoints.
- Active `BillingWorkspace`/`BillingTerm` state and canonical preview builder.
- Existing customer identity, branch/capability, and menu-permission sources; their current coverage must be confirmed before enforcing tab policy.
- `ThemeContext`, `theme_presets.ts`, and CSS design tokens.
- Vitest, TypeScript, browser runtime, and isolated backend pytest environment for baseline validation.

## 11. Risks
- Paste/CSV adapters may contain local-only pricing or tax values; these must not bypass backend preview.
- Existing configured add-ons can prevent settlement until preview and posting support them; changing that requires separate backend approval.
- The Customer Business Tab matrix is not present in the current request context, so visibility mappings cannot be safely guessed.
- Global key listeners may coexist when workspaces are mounted; shortcut ownership must be tested in both Launchpad and Billing.
- `F:\SMRITRretailNX` is the active `smritisystems/smritiretail` repository, while `.agents/AGENTS.md` prescribes `D:\Smriti_Retail_OS`, whose remote is `erpnbook/smriti`. Do not edit or transfer work to that different repository.
- The backend baseline suite is still running against an isolated test database and has emitted failures/errors; final counts remain pending.

## 12. Rollback Strategy
Keep each phase limited to explicit UX files and tests. Revert only the new phase's exact diff if its validation fails; do not revert existing worktree changes, alter migrations, or reset either worktree.

## 13. Verification Plan
- Capture pre-change browser evidence for the active Billing Window and Customer Profile.
- Check that every production billing route opens the same `BillingWorkspace`/`BillingTerm`.
- Exercise direct scan, F2 selection, paste, CSV import, recall, and Customer PO flows; verify preview freshness and row-level error visibility.
- Exercise keyboard shortcuts from both Launchpad and Billing, with focus in inputs, dialogs, and the workspace background.
- Change Customer Type with saved and unsaved data; verify tab visibility, active-tab fallback, and dirty-state preservation once the approved matrix is supplied.
- Test Customer 360 search, loading/error/empty states, navigation, and keyboard access.
- Capture after screenshots and validate representative desktop/mobile widths and theme presets.
- Run focused Vitest suites, full frontend tests, `npm run lint`, and the backend suite in the isolated environment.
- Confirm no API/schema/migration changes and review `git diff --check`.

## 14. Test Plan
- Focused billing workspace, item import, shortcut, customer profile, and Customer 360 Vitest suites.
- Full `npm test -- --run` and `npm run lint`.
- Backend `python -m pytest -q` in the project test container against the isolated database clone; do not use the shared application database.
- Browser walkthroughs for import, settlement guard, customer tab switching, Customer 360 search, theme changes, and responsive layout.

## 15. Documentation Impact
- Update this plan's status as phases complete.
- Add a versioned billing/customer UX walkthrough and index it after implementation evidence exists.
- Update the implementation index and changelog for the completed phase.
- Review `docs/documentation_registry.yml` if present; otherwise report that the registry is absent.

## 16. Deployment Plan
No deployment, database migration, or production data mutation is included. Validate locally in the active repository and isolated test environment only.

## 17. Status
In Progress — active Billing Window import adapters, shortcut corrections, Customer 360 direct search, and the first compact billing hierarchy pass are implemented. TypeScript and focused billing regressions pass. Full frontend tests retain the same eight failures recorded at baseline; backend validation is blocked by the suite's hard-coded `smriti001` target conflicting with the enforced isolated-database guard. Visual validation was not completed because the integrated browser client was unavailable. Customer Business Tab policy remains gated on the approved Customer-Type/Capability/Permission matrix.

## 18. Related ADRs
- `docs/adr/ADR-0042_Canonical_Billing_Consolidation.md`
- `docs/adr/ADR-0058_Statutory_Section_15_GST_Computation_Engine.md`

## 19. Related Walkthroughs
- `docs/walkthrough/billing/Billing_Desk_UX_Transformation_v6.89.0.md`
- `docs/walkthrough/billing/Billing_Unified_UX_Migration_And_Legacy_Retirement_v1.0.0.md`

## 20. Execution Evidence — 2026-10-25
- Added active `BillingTerm` actions for barcode paste/bulk add and validated CSV import. Both adapters pass item code and quantity through the existing `/universal/items/resolve` → `/products/resolve` fallback and append only resolved catalog lines. Imported prices and tax totals are not trusted; the changed cart triggers the existing backend billing preview. Import failures are reported with item codes, and completed-invoice read-only mode blocks imports.
- Corrected the fallback resolver branch so successful `/products/resolve` responses are accepted rather than reported as missing products.
- Removed the duplicate F1 direct-entry binding. Billing owns F1 workspace focus, F11 direct entry, F6 promotions, F7 exact cash, F8 settlement, and F12 hold; EOD remains available through the workspace menu rather than taking a settlement shortcut. Launchpad quick-action handlers now respect consumed events and editable targets, and its duplicate F4 assignment is unique.
- Added direct Customer 360 search using the existing `/crm/customers/directory` modal. Selecting a different customer returns through Customer Master's existing authoritative loader; unsaved changes require confirmation before switching.
- API/database compatibility: no API contracts or schemas were changed and no migration was added. Existing product resolution, billing preview, and customer directory endpoints are reused.
- Validation: `npm run lint` passed; focused billing/shortcut/Customer 360 tests passed (6 files, 42 tests); `npm run build` exited 0 with the existing circular-chunk warning. The full frontend suite ran 2029 tests: 2021 passed and 8 failed in the same five baseline files (`autoPopulate`, `paymentModeHarmonization`, `printingFailClosedSafety`, `proposCatalogCache`, and `supplierCommercialTermsRichText`).
- Backend suite executed in the isolated runner and exited 1: 806 failed, 1819 passed, 16 skipped, 208 warnings, and 263 errors. The shared test fixture and many tests hard-code `smriti001`; the test safety guard correctly rejects that non-`smriti_test_*` database name. Do not treat the backend suite as passed or infer all failures are product regressions.
- Visual validation: not performed. The local Vite server was ready, but the integrated browser client could not connect; no screenshot was captured.
- 2026-10-25 compact billing hierarchy pass: removed the duplicate visible channel selector, moved channel/source/transaction controls and staff/recall controls into collapsed Billing details, tightened the customer and summary cards, reduced summary width to provide more grid room, and concentrated the footer on Hold, Print, and Settle & Save. Print, Hold, exact cash, payment details, add-ons, transporter, remarks, import, recall, and supporting workspace actions remain accessible. Existing shortcut bindings were preserved; screenshot shortcut labels were not copied because they conflict with the actual F6/F7/F8/F12 bindings.
- Compact-pass focused validation: baseline before edits was 15 passing tests across three billing suites. After the refactor, five focused billing workflow/shortcut suites passed (43 tests), and `npm run lint` passed. A production build and browser screenshots are still required.
- Remaining gates: obtain the approved Customer Business Tab matrix; complete live visual/responsive and theme checks; resolve backend suite database-fixture mismatch; retain the fail-closed add-on and fulfillment limitations documented above.
