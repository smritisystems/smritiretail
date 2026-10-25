# Billing and Customer UX Convergence — Phase 2 Continuation v1.0.0

**Date:** 2026-10-25  
**Status:** Partially verified  
**Scope:** Active billing imports, shortcut ownership, compact Billing Desk hierarchy, and Customer 360 direct search

## Compact Billing Desk hierarchy pass

The active BillingTerm header now shows the current billing channel as a status label rather than a second editable selector. Transaction source, channel, bill type, transaction type, operator, and recall controls remain reachable in collapsed **Billing details**. The customer summary and Bill Summary cards use tighter spacing; the summary panel is narrower to increase item-grid width.

The footer now focuses on **Hold**, **Print**, and the primary **Settle & Save** action. Exact-cash settlement and the existing transporter, payment, add-on/deduction, and remarks drawers are accessible through **More**. Bulk paste, validated CSV, recall, printing, packing slips, sales documents, attachments, and supporting workflows remain available. Existing shortcut bindings were preserved; reference-image labels that conflict with current F6/F7/F8/F12 actions were not adopted.

The running Billing Desk was inspected at 1344×768. The latest compact B2B Credit screenshot is attached to the task conversation; it shows the collapsed details layout, billing-level salesperson selector, GST (RO) column, and the compact summary. The cart was intentionally left empty and no invoice was posted.

## B2B grid and salesperson assignment

- The billing-level salesperson selector and direct-entry/per-line selectors use the active staff directory returned by `GET /staff?limit=200`. There is no hard-coded demo salesperson list.
- Direct-entry lines inherit the invoice salesperson when the entry default still matches the previous invoice selection; existing line assignments remain independently editable.
- Each posted invoice line now carries its selected `salesperson_name` through the existing line payload. Existing backend line schema/service mapping support this field; no schema, API, or financial calculation change was made.
- `GST (RO)` displays the line's existing resolved `gstPercentage`; it is not an editable tax control.
- The live directory currently includes active users across roles, and no approved sales-person eligibility rule was found. Restricting the list to a guessed role would risk hiding valid personnel, so eligibility remains a policy question.
- A catalog item could not be safely added for a line-row screenshot: the attempted sample barcode was not registered in this tenant's Product List and the resolver correctly blocked it. The item-level selector is present in the direct-entry row and per-line implementation, but an actual resolved line was not visually exercised. No settle/save action was taken.
- The screenshot also exposes an existing empty-cart `+₹150.00` add-on and the Billing Desk title/header overlapping the application header at this viewport. Neither financial behavior nor shared shell layout was changed in this UX continuation.

## Billing import walkthrough

1. Open the canonical Billing Workspace and choose **More**.
2. Choose **Paste Barcodes / Bulk Add** or **Validated CSV Import**.
3. Confirm the selected rows. The import adapters forward only item codes and quantities into the active terminal's canonical resolver; client-side import prices and tax totals do not become billing authority.
4. Resolved catalog lines are appended together, and the existing backend-authoritative billing preview recalculates the invoice. Review the preview and any item-code validation errors before settlement.
5. When viewing a completed invoice read-only, both import actions are disabled and the item handler also rejects additions.

The fallback product resolver now accepts a successful `/products/resolve` response. A failed or inactive product remains blocked with the existing not-found/inactive handling and an import error summary.

## Keyboard walkthrough

| Context | Shortcut | Action |
|---|---|---|
| Billing Workspace | F1 | Return to the Billing Workspace from an auxiliary view |
| Billing Workspace | F2 | Universal item/SKU lookup |
| Billing terminal | F6 | Promotional discounts |
| Billing terminal | F7 | Exact-cash settlement |
| Billing terminal | F8 | Tender settlement |
| Billing terminal | F11 | Focus direct item entry |
| Billing terminal | F12 | Hold/park the active invoice |
| Launchpad | F3 | Article / Design Master quick action |

EOD Z-Report remains available from the Billing Workspace menu and does not take F8 away from settlement.

The Launchpad now ignores already-consumed key events and editable targets. Its quick-action shortcuts are checked for duplicates; the former duplicate F4 assignment was changed to F3.

## Customer 360 search walkthrough

1. Open a customer in Customer 360.
2. Select **Search customer** to open the existing customer-directory search modal.
3. Select a different result to load it through Customer Master's existing customer loader.
4. If the current profile has unsaved changes, confirm before switching; choosing the current customer again does not reload or discard local state.

## Verification

- `npm run lint`: passed.
- Focused tests: 6 files, 42 tests passed.
- Latest compact-pass regression run: 5 billing workflow/shortcut suites, 43 tests passed; `npm run lint` passed.
- Latest validation after the B2B grid/salesperson refinements: `npm run lint` passed; the same 5 focused billing suites passed (43 tests); `git diff --check` passed; `npm run build` exited 0. Vite reported the existing circular manual-chunk warning.
- Live visual check: Billing Desk at B2B Wholesale / Credit, 1344×768, details collapsed. Screenshot attached in the task conversation. The empty-cart state means per-line GST and salesperson selection were not visually exercised on a resolved line.
- Full frontend suite: 2021 passed, 8 failed (2029 total). The failures remain in the five baseline suites: `autoPopulate`, `paymentModeHarmonization`, `printingFailClosedSafety`, `proposCatalogCache`, and `supplierCommercialTermsRichText`.
- Backend suite: executed but failed (806 failed, 1819 passed, 16 skipped, 208 warnings, 263 errors). The test fixture and many tests target `smriti001`, which the enforced safety guard rejects because isolated test databases must be named `smriti_test_*`. Backend validation is not passed.
- Responsive/theme checks beyond the 1344×768 live screenshot remain unverified. The browser screenshot reveals the shell/header overlap noted above; line-level selection still needs a resolved catalog item for full live walkthrough evidence.
- API/database compatibility: no API contract, database schema, or migration changes were made. Existing product resolver, billing preview, and customer directory endpoints are reused.

## Remaining work and risks

- Customer Business Tab visibility still requires the approved Customer-Type / company-branch capability / permission matrix. No mapping has been inferred.
- Perform the browser walkthrough and capture before/after screenshots when the browser runtime is available.
- Complete density and theme checks across responsive widths and presets.
- Capture actual before/after screenshots and verify scanner input, dropdown placement, menu overflow, and customer switching in the running UI.
- Billing preview still excludes configured add-on/freight rows; settlement remains fail-closed when totals cannot be reconciled.
- Packing-slip transfer and consolidated posting atomicity remain unsupported and were not changed.

## Configuration-driven Billing Policy Continuation

The later policy implementation adds customer-level default sales channel and PO-reference requirement fields through additive migration `v1544`. Company and branch policy still defines the eligible channels, sources, bill types, and cash/credit transaction types. The Billing Desk loads the effective policy when a customer is selected, filters its controls, and sends the resolved values with the invoice. The canonical posting writer revalidates company/branch eligibility, customer credit and PO constraints, then stores the resolved billing configuration in the invoice `rule_snapshots`; it does not add a bill-type invoice column.

Credit-limit overrides require an explicit `sales_billing.OVERRIDE_CREDIT` grant, the central credit policy to permit overrides, customer-group override eligibility, and a non-empty reason. Both direct invoice and Customer PO billing ingress now forward the trusted actor and authorization result to the canonical writer. The estimated credit exposure still uses the pre-posting cart/tender estimate, so exact exposure against final tax-inclusive totals remains a risk.

### Continuation verification (2026-10-25)

- Focused frontend regression: 3 files, 10 tests passed; `npm run lint` passed.
- Backend authorization regression: 2 isolated tests passed, covering denial without explicit permission and propagation of an authorized override through Customer PO billing.
- Backend profile/service run against a disposable PostgreSQL container: 2 passed and 2 failed. The failures are existing assertions in `test_services.py` (duplicate-customer status expects 400 but service returns 409; product creation omits newly mandatory master attributes). Backend validation is therefore partial, not passed.
- Modified backend Python modules compiled successfully; Alembic reports `v1544` as the sole head. The profile-engine test also applied the full migration lineage on a disposable test database. No migration was applied to the running application database.
- The live B2B Billing Workspace was opened at `http://localhost:8101` and captured with an empty cart. This confirms the current workspace renders, but the policy configuration modal, credit override journey, populated-row layout, and responsive states were not visually exercised in this continuation.
- Customer PO posting authorization has focused tests. Branch policy is now passed into the canonical profile check. No deployed-schema comparison was made.

### Remaining policy and source-workflow limitations

- Source choices for Sales Order and consolidated packing-slip billing remain unavailable from the active terminal; the Sales Order option is disabled, and consolidated fulfillment remains a separate preview/finalize workflow. These paths are not claimed as unified or atomically connected to the Billing Desk.
- The customer default channel is applied by the active Billing Desk when loading transaction policy; final posting verifies channel eligibility but does not independently infer a customer channel for older clients that omit the channel.
- The documentation registry named in `.agents/AGENTS.md` (`docs/documentation_registry.yml`) is not present in the repository checkout; this walkthrough is the directly affected existing documentation.
