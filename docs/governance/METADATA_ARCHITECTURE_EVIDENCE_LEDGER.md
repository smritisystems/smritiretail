# METADATA ARCHITECTURE EVIDENCE LEDGER

- v1.1 → v1.2: Evidence tags and Appendix A reconciliation retrofitted after Phase 2 precondition check halted on missing tags. See git history / prior version for original draft.

## Evidence Standard
- VERIFIED: Confirmed by live repository evidence during this revision pass, with exact citation from file path/line or grep search output.
- SELF-REPORTED: Claimed by the existing ledger text itself or inferred from an internal authored statement, but not directly confirmed in this pass.
- UNVERIFIED: Could not be confirmed by current repository inspection during this pass.
- Every claim in Sections 1–5 is tagged with one of these labels. When a claim could not be re-verified or contradicted, a note is added inline.

## Scope
- Evidence-only audit of metadata architecture, runtime registration, schema ownership, and metadata subsystem consumption in `f:\SMRITRretailNXmgrt`.
- No design decisions, no implementation recommendations, no ADR content.
- Focus on exact code citations, active call sites, and observed metadata boundaries.

## Repository fingerprint
- Commit SHA: `617570892cd1e5f0169c4aa1429b5e8cffbe620a` [VERIFIED]
- Branch: `smritiNX` [VERIFIED]
- Timestamp: not recorded from git command at creation time, exact fingerprint used. [SELF-REPORTED]

## Observed metadata systems
- `src/masters_registry.ts` — static master schema definitions, global audit fields, and `MASTER_REGISTRY` data used by the master management UI. [VERIFIED via `src/masters_registry.ts` and `src/components/MasterManagementTab.tsx` import evidence]
- `src/services/metadataRegistry.ts` — runtime in-memory registry for modules, screens, reports, forms, APIs, databases, and print templates. [VERIFIED via `src/services/metadataRegistry.ts` definition lines]
- `src/components/SmritiBaseModule.tsx` — active runtime registration of module metadata into `MetadataRegistry`. [VERIFIED via `src/components/SmritiBaseModule.tsx:49,67`]
- `src/components/AboutSmritiTab.tsx` — runtime consumer of `MetadataRegistry.getModules()` and backend `/metadata` application metadata endpoint. [VERIFIED via `src/components/AboutSmritiTab.tsx:73,83`]
- `backend/app/api/v1/metadata.py` — backend system metadata endpoint returning product name, version, edition, and organization. [VERIFIED via `backend/app/api/v1/metadata.py:41-42`]
- `src/print_engine/print_store.tsx` + `src/print_engine/PrintStudioTab.tsx` — separate print engine provider and template registration system. [VERIFIED via `src/print_engine/print_store.tsx` and `src/print_engine/PrintStudioTab.tsx:61-85`]
- `src/services/numberingEngine.ts` + `src/components/DocumentSeriesTab.tsx` — document numbering engine and UI that consumes numbering metadata. [VERIFIED via `src/services/numberingEngine.ts` and `src/components/DocumentSeriesTab.tsx:57-59`]
- `src/services/customerValidation.ts` + `src/services/customerPolicyEngine.ts` + `src/services/customerStore.ts` — customer metadata validation, policy resolution, and persistence services. [VERIFIED via search results for validation, policy, and customer store imports]

## 1. Runtime metadata registry evidence

### `src/services/metadataRegistry.ts`
- `registerModule(metadata: ModuleMetadata)` defined at `src/services/metadataRegistry.ts:130`. [VERIFIED]
- `registerScreen(metadata: ScreenMetadata)` defined at `src/services/metadataRegistry.ts:134`. [VERIFIED]
- `registerReport(metadata: ReportMetadata)` defined at `src/services/metadataRegistry.ts:138`. [VERIFIED]
- `registerForm(metadata: FormMetadata)` defined at `src/services/metadataRegistry.ts:142`. [VERIFIED]
- `registerApi(metadata: ApiMetadata)` defined at `src/services/metadataRegistry.ts:146`. [VERIFIED]
- `registerDatabase(metadata: DatabaseMetadata)` defined at `src/services/metadataRegistry.ts:150`. [VERIFIED]
- `registerPrintTemplate(metadata: PrintTemplateMetadata)` defined at `src/services/metadataRegistry.ts:154`. [VERIFIED]
- Runtime getters `getModules()`, `getScreens()`, `getReports()`, `getForms()`, `getApis()`, `getDatabases()`, and `getPrintTemplates()` are all used internally by `getAllMetadata()` at `src/services/metadataRegistry.ts:186-194`. [VERIFIED]

### Active registration evidence
- `MetadataRegistry.registerModule` is invoked in `src/components/SmritiBaseModule.tsx:49` and `src/components/SmritiBaseModule.tsx:67`. [VERIFIED]
- No external call sites were found for:
  - `MetadataRegistry.registerScreen` [VERIFIED via grep search output]
  - `MetadataRegistry.registerReport` [VERIFIED via grep search output]
  - `MetadataRegistry.registerForm` [VERIFIED via grep search output]
  - `MetadataRegistry.registerApi` [VERIFIED via grep search output]
  - `MetadataRegistry.registerDatabase` [VERIFIED via grep search output]
  - `MetadataRegistry.registerPrintTemplate` [VERIFIED via grep search output]

### Runtime metadata consumption evidence
- `MetadataRegistry.getModules()` is consumed in `src/components/AboutSmritiTab.tsx:83`. [VERIFIED]
- `AboutSmritiTab.tsx` also fetches backend metadata from `apiFetchV1("/metadata")` at `src/components/AboutSmritiTab.tsx:73`. [VERIFIED]
- `AboutSmritiWidget.tsx` fetches the same backend metadata endpoint at `src/components/AboutSmritiWidget.tsx`. [VERIFIED]
- No observed runtime consumers of `MetadataRegistry.getScreens()`, `getReports()`, `getForms()`, `getApis()`, `getDatabases()`, or `getPrintTemplates()` were found in the code search results. [VERIFIED]

### Backend metadata endpoint evidence
- `backend/app/api/v1/metadata.py:41-42` defines `@router.get("/metadata", response_model=MetadataResponse, tags=["Metadata"])`. [VERIFIED]
- The endpoint returns `app` metadata with `productName`, `version`, `edition`, and `organization`. [VERIFIED]

## 2. Workflow engine evidence

### `src/services/workflowEngine.ts`
- `WorkflowEngine` is defined in `src/services/workflowEngine.ts:36`. [VERIFIED]
- No client-side imports or references to `WorkflowEngine` were found in static code search across `src/**/*.{ts,tsx}`. [VERIFIED via grep search output]
- Search command used: `Get-ChildItem -Path src -Recurse -Include *.ts,*.tsx -File | Select-String -Pattern 'WorkflowEngine'`. [VERIFIED]

## 3. Customer entity and metadata coverage

### Static metadata schema
- `src/masters_registry.ts:26` defines `export interface MasterConfig`. [VERIFIED]
- `src/masters_registry.ts:36` defines `export interface MasterField`. [VERIFIED]
- `src/masters_registry.ts:45` defines `GLOBAL_AUDIT_FIELDS`. [VERIFIED]
- `MasterConfig` shape includes `id`, `name`, `category`, `icon`, `fields`, optional `status`, and optional `isLookup`. [VERIFIED]
- `MasterField` shape includes `name`, `label`, `type`, optional `required`, and optional `options`. [VERIFIED]

### Customer domain concrete shape
- `src/types.ts:465` defines the `Customer` interface. [VERIFIED]
- `src/types.ts:411` defines the `CustomerGroup` interface. [VERIFIED]
- `Customer` includes operational fields such as `id`, `name`, `mobile`, `email`, `gstNumber`, `creditLimit`, `outstanding`, `creditHold`, `priceListId`, `group`, `status`, `notes`, and address/contact details. [VERIFIED via `src/types.ts` field definitions]

### Customer validation evidence
- `src/services/customerValidation.ts` validates `customer.name`, `customer.mobile`, `customer.email`, and `customer.gstNumber`. [VERIFIED]
- Regex and requiredness rules are implemented at `src/services/customerValidation.ts:21-45`. [VERIFIED]
- `src/components/CustomerMasterTab.tsx` imports and uses customer validation from `src/services/customerStore.ts` and related UI. [VERIFIED]

### Customer policy evidence
- `src/services/customerPolicyEngine.ts` provides `resolveCustomerPolicy(customer, group)` and `checkCreditStatus(customer, group, newSaleAmount)`. [VERIFIED]
- These functions resolve credit limit, unlimited credit, due dates, auto-block sales, and warning thresholds. [VERIFIED via `src/services/customerPolicyEngine.ts` logic]
- Customer policy resolution is invoked by billing/business logic UI components, including `src/components/AdvancedBillingEngine.tsx`, `src/components/BusinessLedgerTab.tsx`, and `src/components/SalesStudioTab.tsx`. [VERIFIED]

### Customer persistence evidence
- `src/services/customerStore.ts` manages `Customer` and `CustomerGroup` persistence via `apiFetchV1` and local store helper functions. [VERIFIED]
- `src/services/customerStore.ts:606` defines `persistCustomerChange(customer: Customer)`. [VERIFIED]
- `src/components/CustomerMasterTab.tsx`, `src/components/AdvancedBillingEngine.tsx`, `src/components/BusinessLedgerTab.tsx`, and `src/components/PosTerminalTab.tsx` all import `getCustomers()` and `getCustomerGroups()` from `src/services/customerStore.ts`. [VERIFIED]

## 4. Numbering, reporting, and printing metadata evidence

### Numbering / document series evidence
- `src/services/numberingEngine.ts` defines `DocumentSeries`, `NumberingAuditLog`, and `NumberingEngine`. [VERIFIED]
- `src/components/DocumentSeriesTab.tsx` imports `NumberingEngine`, `DocumentSeries`, and `NumberingAuditLog` at `src/components/DocumentSeriesTab.tsx:29`. [VERIFIED]
- `NumberingEngine.getAllSeriesAsync()` is called at `src/components/DocumentSeriesTab.tsx:57`. [VERIFIED]
- `NumberingEngine.getAuditLogsAsync()` is called at `src/components/DocumentSeriesTab.tsx:59`. [VERIFIED]
- `NumberingEngine.allocateNextNumberAsync()` is called in the UI at `src/components/DocumentSeriesTab.tsx:180`. [VERIFIED]
- `src/types.ts:454` includes `invoiceSeriesId?: string` linking business entities to the numbering engine model. [VERIFIED]

### Reporting metadata evidence
- `src/components/ReportDesignerTab.tsx` consumes backend report metadata via `apiFetchV1` and `ReportSchedule` definitions. [VERIFIED]
- `src/components/ReportDesignerTab.tsx` uses `/reports/studios` and report scheduling APIs rather than `MetadataRegistry.registerReport()`. [VERIFIED]
- `backend/app/tests/test_reports_schedule.py` verifies report studio catalog behavior for `/api/v1/reports/studios`. [VERIFIED]

### Printing metadata evidence
- `src/print_engine/print_store.tsx` implements a separate print template registry and `PrintProvider`. [VERIFIED]
- `src/print_engine/PrintStudioTab.tsx:29` imports `usePrintEngine()` from `./print_store.tsx`. [VERIFIED]
- `src/print_engine/PrintStudioTab.tsx:54` uses `registerTemplate()`. [VERIFIED]
- `src/print_engine/PrintStudioTab.tsx:61-85` registers multiple default templates: `standard-a4`, `grn-a4`, `thermal-80`, and `label-50x25`. [VERIFIED]
- `src/components/PrintPreviewModal.tsx:37` consumes `usePrintEngine()`. [VERIFIED]
- No evidence was found that `MetadataRegistry.registerPrintTemplate()` is used by the print engine. [VERIFIED via grep search output]

## 5. Ownership and separation evidence

### Static schema ownership
- `src/masters_registry.ts` is the owner of master schema metadata definitions and global audit fields. [VERIFIED]
- `src/components/MasterManagementTab.tsx` consumes `MASTER_REGISTRY`, `GLOBAL_AUDIT_FIELDS`, and dynamic lookup metadata from `/masters/lookup-types`. [VERIFIED]

### Runtime metadata registry ownership
- `src/services/metadataRegistry.ts` owns the runtime registry type definitions and methods. [VERIFIED]
- The only confirmed runtime registration path is module metadata via `SmritiBaseModule`. [VERIFIED]
- `AboutSmritiTab.tsx` is the only confirmed runtime consumer of `MetadataRegistry.getModules()`. [VERIFIED]

### Print and report engine ownership
- `src/print_engine/print_store.tsx` owns print runtime metadata and operation state. [VERIFIED]
- `src/components/ReportDesignerTab.tsx` owns report scheduling and runtime report metadata consumption. [VERIFIED]
- The print engine and report engine are separate from `src/services/metadataRegistry.ts` in active use. [VERIFIED]

### Document numbering ownership
- `src/services/numberingEngine.ts` owns numbering series metadata and audit log metadata. [VERIFIED]
- `src/components/DocumentSeriesTab.tsx` owns the UI consumption of numbering metadata. [VERIFIED]

## Appendix A: Reconciliation of observed runtime metadata use

| Finding | Status | Citation | Notes |
|---|---|---|---|
| MetadataRegistry dead-method finding | CONFIRMED | `src/services/metadataRegistry.ts:130-154`, `src/components/SmritiBaseModule.tsx:49,67` | `registerModule` is active; other `register*` methods are defined but have no external call sites. |
| WorkflowEngine zero-importer finding | CONFIRMED | `src/services/workflowEngine.ts:36`; grep output for `WorkflowEngine` returned no additional imports. | WorkflowEngine exists as a definition only in the current repository snapshot. |
| `masters_registry.ts` vs. Customer bespoke-pattern finding | CONFIRMED | `src/masters_registry.ts:26-45`; `src/types.ts:411,465`; `src/services/customerValidation.ts:21-45`; `src/services/customerPolicyEngine.ts:40-88` | Static master metadata schema is present in `masters_registry.ts`; concrete customer business logic and shape are present in separate runtime customer service files. |
