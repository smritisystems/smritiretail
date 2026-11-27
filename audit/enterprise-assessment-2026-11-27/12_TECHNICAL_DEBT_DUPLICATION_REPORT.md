# Technical Debt and Duplication Report

## Observed shape

- About 870 frontend TS/TSX files; approximately 96 backend API Python files, 77 ORM/model files, 219 service Python files and 284 migration files in the current working tree.
- `main.py` imports many API modules and mounts them from a registry. Some modules are mounted under more than one prefix (for example universal master/import aliases); compatibility and legacy routes coexist with canonical routes.
- Frontend has `apiFetchV1` as the canonical API client and an explicitly deprecated `apiFetch` wrapper. Multiple domain components and legacy stores remain.
- Backend domain concerns appear in route, service, repository, schema and ORM layers; not every business workflow was traced to determine whether all rules consistently reside in services.
- `src/bootstrap/di.ts` provides PostgreSQL, SQLite, memory and IndexedDB repository implementations. Their relationship to the primary FastAPI database path should remain clearly documented and tested.
- Docs and declarations vary by date/version: README identifies Python 3.13/PostgreSQL 17; Compose/Dockerfile identify Python 3.11/PostgreSQL 15. Existing docs use module `Done` statuses that explicitly do not certify runtime completion.
- Numerous pre-existing uncommitted changes and untracked migrations/tests mean a clean release artifact cannot be assessed from the current worktree alone.

## Maintainability risks

1. Large route/module surface and alias mounts increase route ownership, API-contract and deprecation burden.
2. Frontend local database providers, offline sync, local caches and backend-authoritative APIs need an explicit source-of-truth contract per data type.
3. Migration graph and table ownership must be validated on clean Control Plane and tenant databases; schema drift repairs are present in untracked files.
4. Inconsistent docs/version claims can cause deployment/runtime mismatch.
5. App-wide route-to-component/service/schema traceability and dead-code detection were not run, so no dead-code counts are asserted.

## Recommended actions

- Establish an API registry contract test for one canonical route per operation and explicit legacy sunset dates.
- Keep tenant resolution and authorization in a single audited dependency path.
- Define repository/provider lifecycle and offline reconciliation ownership; remove unused abstractions only after dependency tracing.
- Add migration graph/scope checks and clean-install comparisons to CI using disposable databases.
- Maintain a single tested stack-version matrix and regenerate documentation/version metadata from authoritative manifests.

**Maintainability: 4.5/10.** The project has substantial reusable building blocks, but breadth, compatibility layers, unverified data-provider paths and release drift raise ongoing change risk.
