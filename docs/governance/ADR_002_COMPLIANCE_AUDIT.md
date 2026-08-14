# ADR-002 Compliance Audit

PENDING ARCHITECT AUTHORIZATION

Date: 2026-07-17
Status: Audit Report
Branch: `smritiNX`
Commit SHA: `617570892cd1e5f0169c4aa1429b5e8cffbe620a`

## Summary

This audit validates the current repository implementation against ADR-002 metadata architecture governance. It confirms the live ownership boundaries for module metadata, static master metadata, workflow metadata, numbering metadata, print/report metadata, and customer business validation.

## Findings

### 1. Module metadata runtime registry

- `src/services/metadataRegistry.ts` is the active runtime registry for module metadata.
- `MetadataRegistry.registerModule()` is invoked in `src/components/SmritiBaseModule.tsx:49` and `src/components/SmritiBaseModule.tsx:67`.
- `MetadataRegistry.getModules()` is consumed in `src/components/AboutSmritiTab.tsx:83`.
- `src/components/AboutSmritiTab.tsx:73` also fetches application metadata from the backend endpoint `apiFetchV1("/metadata")`.
- The other runtime registration methods defined in `src/services/metadataRegistry.ts` are not observed as active call sites in the repository.

### 2. Static master schema metadata

- `src/masters_registry.ts` defines the canonical static master schema metadata.
- `MasterConfig` and `MasterField` interfaces are defined in `src/masters_registry.ts:26-45`.
- `GLOBAL_AUDIT_FIELDS` is defined in `src/masters_registry.ts:45-58`.
- `src/components/MasterManagementTab.tsx` imports and uses `MASTER_REGISTRY` and `GLOBAL_AUDIT_FIELDS`.

### 3. Workflow metadata ownership

- The canonical workflow/status-transition metadata implementation is in `backend/app/api/v1/workflow.py`.
- `backend/app/main.py:109` mounts the workflow router:
  - `app.include_router(workflow.router, prefix=settings.API_V1_STR + "/workflow", tags=["Workflow"])  # AD-3: Core Workflow`
- Frontend workflow action call sites include:
  - `src/components/SalesStudioTab.tsx:523` — `apiFetchV1(`/workflow/SalesInvoice/${inv.id}/approve`, { method: "POST" })`
  - `src/components/SalesStudioTab.tsx:537` — `apiFetchV1(`/workflow/SalesInvoice/${inv.id}/cancel`, { method: "POST" })`
  - `src/components/SalesStudioTab.tsx:764` — generic `apiFetchV1(`/workflow/${docType}/${id}/${action}`, { method: "POST" })`
  - `src/components/PurchaseStudioTab.tsx:516` — `apiFetchV1(`/workflow/PurchaseOrder/${id}/${action}`, { method: "POST" })`
  - `src/components/ApprovalMatrixTab.tsx:111` — direct `fetch(`/api/v1/workflow/${docType}/${id}/${action}`)`.
- The frontend still contains `src/services/workflowEngine.ts:36`, but this `WorkflowEngine` class has no active client-side import or runtime consumer in `src/**/*.{ts,tsx}`.
- The live workflow action path is the backend FastAPI workflow router.

### 4. Numbering metadata ownership

- `src/services/numberingEngine.ts` owns numbering series metadata and audit log metadata.
- `src/components/DocumentSeriesTab.tsx` imports `NumberingEngine` and calls:
  - `NumberingEngine.getAllSeriesAsync()` at `src/components/DocumentSeriesTab.tsx:57`
  - `NumberingEngine.getAuditLogsAsync()` at `src/components/DocumentSeriesTab.tsx:59`
  - `NumberingEngine.allocateNextNumberAsync()` at `src/components/DocumentSeriesTab.tsx:180`
- This confirms live numbering metadata ownership and consumption.

### 5. Print metadata ownership

- `src/print_engine/print_store.tsx` provides a standalone print engine and `PrintProvider`.
- `src/print_engine/PrintStudioTab.tsx` registers print templates with `registerTemplate()` at `src/print_engine/PrintStudioTab.tsx:61-85`.
- This demonstrates that print template metadata is owned by the print subsystem rather than by `MetadataRegistry` runtime registration.

### 6. Report metadata ownership

- `src/components/ReportDesignerTab.tsx` consumes report metadata from backend APIs, including `apiFetchV1("/reports/studios")` at `src/components/ReportDesignerTab.tsx:195`.
- The report runtime is driven by backend report APIs and frontend report designer UI rather than by `MetadataRegistry.registerReport()`.
- The backend metadata endpoint is defined in `backend/app/api/v1/metadata.py:41`.

### 7. Customer validation and policy ownership

- `src/services/customerPolicyEngine.ts` owns customer policy resolution via `resolveCustomerPolicy()` and `checkCreditStatus()`.
- Customer metadata persistence and cache helpers are implemented in `src/services/customerStore.ts` with `getCustomers()`, `getCustomerGroups()`, and `saveCustomers()`.
- Multiple UI components consume these services, including:
  - `src/components/AdvancedBillingEngine.tsx`
  - `src/components/BusinessLedgerTab.tsx`
  - `src/components/CustomerMasterTab.tsx`
  - `src/components/PosTerminalTab.tsx`
- This confirms the customer business domain is managed outside the static `masters_registry.ts` generic schema.

## Conclusion

The repository is compliant with ADR-002 evidence boundaries in the current snapshot:

- `src/services/metadataRegistry.ts` is canonical for runtime module metadata only.
- `src/masters_registry.ts` is canonical for static master schema metadata and audit field definitions.
- `backend/app/api/v1/workflow.py` is canonical for workflow/status-transition metadata.
- Print, report, and numbering metadata are owned by their subsystem engines and not centrally registered through `MetadataRegistry`.
- Customer business validation and policy ownership remain separate from generic master schema metadata.

## Architecture Drift Note

Finding:
- The repository contains both runtime workflow endpoints actively used by the application and a standalone `WorkflowEngine` implementation.

Evidence:
- `backend/app/main.py:109` — mounted workflow router at `/api/v1/workflow`
- `src/components/SalesStudioTab.tsx:523` — `apiFetchV1(`/workflow/SalesInvoice/${inv.id}/approve`, { method: "POST" })`
- `src/components/SalesStudioTab.tsx:537` — `apiFetchV1(`/workflow/SalesInvoice/${inv.id}/cancel`, { method: "POST" })`
- `src/components/SalesStudioTab.tsx:764` — generic workflow action `apiFetchV1(`/workflow/${docType}/${id}/${action}`, { method: "POST" })`
- `src/components/PurchaseStudioTab.tsx:516` — `apiFetchV1(`/workflow/PurchaseOrder/${id}/${action}`, { method: "POST" })`
- `src/components/ApprovalMatrixTab.tsx:111` — direct fetch to `/api/v1/workflow/${docType}/${id}/${action}`
- `src/services/workflowEngine.ts:36` — `WorkflowEngine` class definition

Assessment:
- Current evidence should determine whether `WorkflowEngine` is:
  - the canonical runtime implementation,
  - a legacy implementation retained during migration,
  - an alternate implementation,
  - or RESERVED for future use.
- If ownership cannot be proven directly from code, classify the status as UNVERIFIED rather than ACTIVE or UNUSED.

This note documents architectural drift only. It does not recommend deletion, refactoring, or migration.

## Evidence Limitations

This audit is limited to evidence available in the audited repository at the recorded commit.

Absence of a static call site is not, by itself, evidence that a component is unused. Components that may participate through dynamic registration, dependency injection, reflection, plugin discovery, configuration, or future migration paths have been classified according to the available evidence only.

This audit documents compliance and architectural drift. It does not authorize implementation changes.

## Notes

- The audit is based on the live repository state at commit `617570892cd1e5f0169c4aa1429b5e8cffbe620a` on branch `smritiNX`.
- No generation artifacts were required to validate these metadata ownership boundaries.
