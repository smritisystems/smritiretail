# Customer Directory Workspace Controls and Export

## Purpose

Correct Customer Master directory controls identified during the customer table UX audit.

## Scope

Workspace layout switching, directory export scope and fields, separate catalogue and directory navigation, and session-storage test setup.

## Files Created

- `docs/walkthrough/customer/Customer_Directory_Workspace_Controls_And_Export_v6.99.17.md`

## Files Modified

- `src/components/customer/CustMasterWs.tsx`
- `src/services/customerStore.ts`
- `src/tests/custFlow.test.ts`
- `src/tests/custLookup.test.ts`
- `CHANGELOG.md`
- `docs/walkthrough/README.md`

## Architecture Decisions

- Workspace switching updates the presentation layout state and does not mutate customer business data.
- Directory export receives the currently displayed filtered page and the five summary fields represented in the directory.
- Catalogue navigation remains independent and is hidden while directory mode is active.

## Design Rationale

The directory is server paginated, so its export must use its own page rows and summary fields. Giving the catalogue navigator an explicit label and hiding it in directory mode prevents its local 100-record position from being confused with the server directory page.

## Implementation Summary

- The workspace menu now switches from Classic to Enterprise layout.
- Directory exports use customer code, name, phone, group, and status from the current filtered page. Catalogue exports retain their previous data and columns.
- The catalogue record count is explicitly labeled and not shown in directory mode. Directory pagination has a visible result range and a non-shrinking footer.
- The session cache projection accepts both `Customer` and `RetailCustomerRecord` shapes and maps equivalent field names. Customer flow and lookup test mocks expose session storage.

## Tests Executed

- `npm test -- --run src/tests/customerMasterLifecycle.test.tsx src/tests/custFlow.test.ts src/tests/custLookup.test.ts`
- Customer-related test set: 20 files, 171 tests passed.
- `npm run lint`
- `npm run build`
- `docker compose up -d --no-deps --build smriti-web`
- `Invoke-WebRequest -Uri http://localhost:8101/ -UseBasicParsing`

## Verification Results

- Focused Customer tests: 3 files passed, 36 tests passed.
- Customer-related tests: 20 files passed, 171 tests passed.
- TypeScript validation succeeded with no diagnostics.
- Vite production build succeeded. Existing circular chunk, large chunk, and static/dynamic import warnings remain.
- The web container is healthy and the demo returned HTTP 200. The API container remained healthy.
- Interactive browser clicks were not available in this environment, so menu actions and export downloads were not manually exercised.

## Known Limitations

- Directory export contains the current filtered page (up to 25 rows), not every matching customer across all pages.
- No interactive browser validation was available; built output, tests, and HTTP health were verified.
- `docs/documentation_registry.yml` was not present, so no registry-based documentation mapping could be applied.

## Future Work

- Add a browser-level Customer Directory test for workspace switching, directory export scope, and pagination visibility.
- Consider an explicit “export all filtered results” operation if business users need cross-page exports.

## Related ADRs

- None identified for this scoped UX correction.

## Related RFCs

- None identified for this scoped UX correction.
