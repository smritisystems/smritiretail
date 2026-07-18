# MC-AUDIT-ENTITY-METADATA Evidence Ledger

PENDING ARCHITECT AUTHORIZATION

## Scope
- Audit `MetadataRegistry` dead-method usage in `src/services/metadataRegistry.ts`
- Audit `WorkflowEngine` import/call sites in `src/services/workflowEngine.ts`
- Compare `masters_registry.ts` metadata model shape with actual `Customer` entity usage in `customerStore.ts`, `customerValidation.ts`, and `customerPolicyEngine.ts`
- Identify runtime metadata consumers, API metadata endpoints, and metadata ownership boundaries

## Repository fingerprint
- Commit SHA: `617570892cd1e5f0169c4aa1429b5e8cffbe620a`
- Branch: `smritiNX`
- Timestamp: `2026-07-17 09:16:17 +0530`
- Commit summary: `feat(purchase): add legacy purchase config endpoints and reorder conversion logic`

## Metadata architecture inventory
- `src/masters_registry.ts` — static master schema definitions, global audit fields, and the concrete `MASTER_REGISTRY` list used by the master management UI.
- `src/services/metadataRegistry.ts` — runtime in-memory registry for modules, screens, reports, forms, APIs, databases, and print templates.
- `src/components/SmritiBaseModule.tsx` — only active registration site for `MetadataRegistry` modules.
- `src/components/AboutSmritiTab.tsx` / `src/components/AboutSmritiWidget.tsx` — runtime consumer of `MetadataRegistry.getModules()` and backend `/metadata` application metadata endpoint.
- `src/components/MasterManagementTab.tsx` — uses static `MASTER_REGISTRY`, `GLOBAL_AUDIT_FIELDS`, and dynamically loads lookup master metadata from `/masters/lookup-types`.
- `src/components/ReportDesignerTab.tsx` — consumes runtime report metadata via `/reports/studios` and uses report scheduling APIs.
- `src/print_engine/print_store.tsx` + `src/components/PrintStudioTab.tsx` — print template registration and runtime print provider for generated print formats.
- `src/services/customerValidation.ts` — static customer profile validation layer, used by the customer UI and tests.
- `src/services/customerPolicyEngine.ts` — customer policy resolution and credit status engine, consumed by billing/business logic UI.
- `src/types.ts` — concrete entity definitions, including `Customer`, `CustomerGroup`, `ReportDefinition`, and `PrintTemplate`.

## Architectural caveats
- The absence of source call sites for `MetadataRegistry.registerScreen`, `registerReport`, `registerForm`, `registerApi`, `registerDatabase`, and `registerPrintTemplate` does not prove the code is safe to delete.
- Possible runtime uses that are not visible in static search include plugin-like dynamic registration, dynamic import/barrel export patterns, backend registration, or future extension points.
- All evidence in this report is valid for the exact git fingerprint shown above.

## Architecture Audit v1.0 categories

### Metadata
- `src/masters_registry.ts` holds the static master schema and registry used by the master management UI.
- `src/services/metadataRegistry.ts` is a runtime registry type system for modules, screens, reports, forms, APIs, databases, and print templates.
- Runtime consumers are limited to module metadata via `MetadataRegistry.getModules()` in `src/components/AboutSmritiTab.tsx`.
- Backend application metadata is exposed separately by `backend/app/api/v1/metadata.py` and consumed by `AboutSmritiTab.tsx` and `AboutSmritiWidget.tsx`.
- No runtime registration was found for screens, reports, forms, APIs, databases, or print templates.

### Validation
- Static/UI validation is in `src/services/customerValidation.ts`, used by `src/components/CustomerMasterTab.tsx` and `src/tests/customerCrmLoyaltyDecoupling.test.ts`.
- API validation is implied by `/customers/validate-add` in `CustomerMasterTab.tsx`, but the backend implementation is outside this frontend audit.
- `MasterField.required` in `masters_registry.ts` provides metadata for field requiredness, but does not include business rule logic such as mobile or GSTIN formats.

### Workflow
- Workflow definitions exist in `src/services/workflowEngine.ts` for document types and role-based transitions.
- No client-side import or runtime execution of `WorkflowEngine` was found in the repository.
- `ApprovalMatrixTab.tsx` and related UI may represent workflow intent, but they do not appear to consume `WorkflowEngine` directly.

### Permissions
- `ModuleMetadata.permissions?` and `ScreenMetadata.requiredPermissions?` are present in the metadata registry schema.
- The actual application uses `currentUser.role` checks in UI components and backend auth APIs for permission enforcement.
- There is no evidence of a centralized permissions engine wired through `MetadataRegistry`.

### Forms
- `FormMetadata` exists in the runtime registry schema, but no registration call sites or consumers were found.
- Actual form implementations are hardcoded in the UI (`CustomerMasterTab.tsx`, `MasterManagementTab.tsx`, and other component trees).
- `MasterManagementTab.tsx` builds dynamic master forms from `MASTER_REGISTRY` plus lookup metadata loaded from `/masters/lookup-types`.

### Reports
- `ReportMetadata` exists in the runtime registry schema, but no registration call sites were found.
- Report metadata is instead consumed from the backend at `/reports/studios` in `src/components/ReportDesignerTab.tsx`.
- `src/types.ts` defines `ReportDefinition`, a separate report model that is not the same as `ReportMetadata`.

### Printing
- `PrintTemplateMetadata` exists in `src/services/metadataRegistry.ts` but has no observed registration or consumption.
- The print runtime is implemented in `src/print_engine/print_store.tsx` and consumed by `PrintStudioTab.tsx` and `PrintPreviewModal.tsx`.
- This indicates printing is architected as a separate engine rather than part of `MetadataRegistry`.

### Search
- Search appears to be component-local filtering and audit logging; no central search metadata system is visible in the current code.
- There is no evidence of an indexed metadata search layer connected to `MetadataRegistry`.

---

## 1. MetadataRegistry dead-method audit

### Search command used

```powershell
Get-ChildItem -Path src -Recurse -Include *.ts,*.tsx -File | Select-String -Pattern 'registerScreen\(' | Select-Object Path,LineNumber,Line
```

### Results

- `registerScreen`:
  - Definition only in `src/services/metadataRegistry.ts:134`.
  - No external call sites found in `src` using the exact search command above.

- `registerReport`:
  - Definition only in `src/services/metadataRegistry.ts:138`.
  - No external call sites found in `src` using the exact search command above.

- `registerForm`:
  - Definition only in `src/services/metadataRegistry.ts:142`.
  - No external call sites found in `src` using the exact search command above.

- `registerApi`:
  - Definition only in `src/services/metadataRegistry.ts:146`.
  - No external call sites found in `src` using the exact search command above.

- `registerDatabase`:
  - Definition only in `src/services/metadataRegistry.ts:150`.
  - No external call sites found in `src` using the exact search command above.

- `registerPrintTemplate`:
  - Definition only in `src/services/metadataRegistry.ts:154`.
  - No external call sites found in `src` using the exact search command above.

- `registerModule`:
  - Definition in `src/services/metadataRegistry.ts:130`.
  - Call site in `src/components/SmritiBaseModule.tsx:49`.
  - Call site in `src/components/SmritiBaseModule.tsx:67`.

### `get*` counterpart audit

- `getScreens`:
  - Definition in `src/services/metadataRegistry.ts:162`.
  - Caller in `src/services/metadataRegistry.ts:189` via `screens: this.getScreens()` inside `getAllMetadata()`.

- `getReports`:
  - Definition in `src/services/metadataRegistry.ts:166`.
  - Caller in `src/services/metadataRegistry.ts:190` via `reports: this.getReports()`.

- `getForms`:
  - Definition in `src/services/metadataRegistry.ts:170`.
  - Caller in `src/services/metadataRegistry.ts:191` via `forms: this.getForms()`.

- `getApis`:
  - Definition in `src/services/metadataRegistry.ts:174`.
  - Caller in `src/services/metadataRegistry.ts:192` via `apis: this.getApis()`.

- `getDatabases`:
  - Definition in `src/services/metadataRegistry.ts:178`.
  - Caller in `src/services/metadataRegistry.ts:193` via `databases: this.getDatabases()`.

- `getPrintTemplates`:
  - Definition in `src/services/metadataRegistry.ts:182`.
  - Caller in `src/services/metadataRegistry.ts:194` via `printTemplates: this.getPrintTemplates()`.

### Comments

- The six `register*` methods (`registerScreen`, `registerReport`, `registerForm`, `registerApi`, `registerDatabase`, `registerPrintTemplate`) have no external invocation sites found in the repository.
- Only `registerModule` is actively invoked from `src/components/SmritiBaseModule.tsx`.
- All `get*` methods are used internally by `getAllMetadata()` within `src/services/metadataRegistry.ts`.
- Runtime consumer evidence is limited to `MetadataRegistry.getModules()` in `src/components/AboutSmritiTab.tsx`; no `register*` runtime registration is confirmed.
- Printed metadata registration and report metadata are owned by separate systems: `print_engine` and report APIs, not `MetadataRegistry`.

---

## 2. WorkflowEngine caller audit

### Search command used

```powershell
Get-ChildItem -Path src -Recurse -Include *.ts,*.tsx -File | Select-String -Pattern 'WorkflowEngine' | Select-Object Path,LineNumber,Line
```

### Results

- `src/services/workflowEngine.ts:36` — `export class WorkflowEngine {`
- No additional import or call sites found in `src` for `WorkflowEngine` using the exact search command above.

### Comments

- `WorkflowEngine` is defined in `src/services/workflowEngine.ts` but is not imported or referenced elsewhere in the repository.
- This indicates `WorkflowEngine` currently has no active consumers beyond its own definition.

---

## 3. Entity-definition pattern comparison

### Search commands used

```powershell
Get-ChildItem -Path src -Recurse -Include *.ts,*.tsx -File | Select-String -Pattern 'export interface MasterConfig' | Select-Object Path,LineNumber,Line
Get-ChildItem -Path src -Recurse -Include *.ts,*.tsx -File | Select-String -Pattern 'export interface MasterField' | Select-Object Path,LineNumber,Line
Get-ChildItem -Path src -Recurse -Include *.ts,*.tsx -File | Select-String -Pattern 'export const GLOBAL_AUDIT_FIELDS' | Select-Object Path,LineNumber,Line
Get-ChildItem -Path src -Recurse -Include *.ts,*.tsx -File | Select-String -Pattern 'export interface Customer' | Select-Object Path,LineNumber,Line
Get-ChildItem -Path src -Recurse -Include *.ts,*.tsx -File | Select-String -Pattern 'export function validateCustomerProfile' | Select-Object Path,LineNumber,Line
Get-ChildItem -Path src -Recurse -Include *.ts,*.tsx -File | Select-String -Pattern 'export function resolveCustomerPolicy' | Select-Object Path,LineNumber,Line
Get-ChildItem -Path src -Recurse -Include *.ts,*.tsx -File | Select-String -Pattern 'export function checkCreditStatus' | Select-Object Path,LineNumber,Line
Get-ChildItem -Path src -Recurse -Include *.ts,*.tsx -File | Select-String -Pattern 'export const initialCustomers' | Select-Object Path,LineNumber,Line
```

### Master metadata shape

- `src/masters_registry.ts:26` — `export interface MasterConfig {`
- `src/masters_registry.ts:36` — `export interface MasterField {`
- `src/masters_registry.ts:45` — `export const GLOBAL_AUDIT_FIELDS: MasterField[] = [`

#### MasterConfig shape
- `id: string`
- `name: string`
- `category: string`
- `icon: string`
- `fields: MasterField[]`
- `status?: "planned" | "live"`
- `isLookup?: boolean`

#### MasterField shape
- `name: string`
- `label: string`
- `type: "text" | "number" | "select" | "checkbox" | "date" | "textarea"`
- `required?: boolean`
- `options?: string[]`

#### GLOBAL_AUDIT_FIELDS coverage
- `status`, `created_by`, `modified_by`, `created_at`, `updated_at`, `notes`
- The audit field set is metadata-layer only and is defined globally in `src/masters_registry.ts:45`.

### Customer entity actual definition

- Primary structural type: `src/types.ts:465` — `export interface Customer {`
- Customer group shape: `src/types.ts:411` — `export interface CustomerGroup {`

#### Customer model fields (selected, actual type definition)
- Core identity and contact: `id`, `name`, `mobile`, `phone?`, `email?`, `alternateMobile?`
- Financial/credit: `outstanding?`, `creditLimit?`, `creditLimitOverride?`, `creditDaysOverride?`, `openingBalance?`, `openingBalanceType?`, `creditDays?`, `graceDays?`, `creditHold?`, `unlimitedCredit?`, `priceListId?`, `salesperson?`, `territory?`, `route?`
- Business classification: `group?`, `loyaltyPoints?`, `gstNumber?`, `pan?`, `customerType?`, `aadhaar?`, `loyaltyMember?`, `leadSource?`
- Address: billing/shipping address fields and `shippingSameAsBilling?`
- Demographics: `dateOfBirth?`, `anniversaryDate?`, `gender?`, `occupation?`, `preferredLanguage?`
- Status/audit: `status?`, `photoUrl?`, `notes?`, `createdDate?`

> Exact fields are from `src/types.ts:465` and the related `Customer` usage in the service files below.

### Customer service and discipline coverage

| File | Role | Coverage | Line references |
| --- | --- | --- | --- |
| `src/services/customerStore.ts` | Customer persistence and sync | Imports `Customer` type, seeds `initialCustomers`, persists updates with API calls, and references `Customer` objects through `persistCustomerChange(customer: Customer)` | `src/services/customerStore.ts:27`, `src/services/customerStore.ts:162`, `src/services/customerStore.ts:606` |
| `src/services/customerValidation.ts` | Customer field validation | Validates customer profile fields and business data formats for `name`, `mobile`, `email`, `gstNumber` | `src/services/customerValidation.ts:21`, `src/services/customerValidation.ts:27`, `src/services/customerValidation.ts:31`, `src/services/customerValidation.ts:40`, `src/services/customerValidation.ts:45` |
| `src/services/customerPolicyEngine.ts` | Customer policy and credit controls | Resolves credit and billing policies using customer overrides and group defaults; checks credit hold, unlimited credit, auto-block sales, and usage thresholds | `src/services/customerPolicyEngine.ts:40`, `src/services/customerPolicyEngine.ts:45`, `src/services/customerPolicyEngine.ts:49`, `src/services/customerPolicyEngine.ts:50`, `src/services/customerPolicyEngine.ts:82`, `src/services/customerPolicyEngine.ts:88` |

### Comparison table: `MasterConfig` / `MasterField` vs `Customer` / service coverage

| Dimension | `masters_registry.ts` | `Customer` actual usage | Missing in `masters_registry.ts` | Missing in `Customer` actual usage |
| --- | --- | --- | --- | --- |
| Structural metadata | `MasterConfig` defines schema metadata (`id`, `name`, `category`, `icon`, `fields`, `status`, `isLookup`) and `MasterField` defines field metadata (`label`, `type`, `required`, `options`) | `Customer` defines concrete business fields and customer data shape in `src/types.ts:465` | Does not define actual customer business fields such as `mobile`, `gstNumber`, `creditLimit`, `billingAddress`, `loyaltyPoints` | Does not define metadata-layer properties like `label`, `field type`, `options`, `workflowEnabled` or `auditEnabled` |
| Audit/record fields | `GLOBAL_AUDIT_FIELDS` adds `status`, `created_by`, `modified_by`, `created_at`, `updated_at`, `notes` at `src/masters_registry.ts:45` | Customer has `status?` and `createdDate?` only, but lacks explicit `created_by` / `modified_by` fields in the type | Provides explicit audit metadata fields; structured audit fields are available for registry masters | Customer entity lacks the same explicit audit ownership fields and only has a generic `createdDate?` |
| Validation focus | `MasterField.required` indicates requiredness and `type` indicates input semantics | `customerValidation.ts` validates `name`, `mobile`, `email`, `gstNumber` only | Master metadata can represent requiredness and field type, but does not enforce business-specific rules like mobile regex or GSTIN format | Validation logic exists only in `customerValidation.ts`; master metadata does not encode those exact business rules |
| Policy / workflow | `MasterConfig.fields` can represent form fields and workloads indirectly, but no workflow semantics beyond `status`/`isLookup` | `customerPolicyEngine.ts` adds billing policy semantics (`creditHold`, `autoBlockSales`, `allowBackOrders`, `maxDiscountPercent`, `taxInclusive`, etc.) | No direct support for customer credit/discount/approval policy semantics | Customer policy semantics are not captured by master metadata types and are outside the registry model |
| Permissions and business context | `ScreenMetadata` and `ModuleMetadata` in registry support `requiredPermissions?` and module ownership | `Customer` actual usage has no direct permission metadata; policies are resolved separately | Metadata registry supports permission metadata in other metadata types, but not in `MasterField` itself | Customer entity usage does not include permissions metadata or role-based access declarations |
| Lifecycle and lookup semantics | `MasterConfig.status` and `isLookup` are explicit lifecycle/lookup markers | `Customer` has `status?` and `group?`, but no `isLookup` marker | Master metadata can declare lookup masters, categories, and life-cycle state explicitly | Customer entity is concrete and lacks schema-level lookup metadata |
| Metadata ownership | `masters_registry.ts` is owned by the UI master management layer and is loaded statically at runtime | `Customer` is owned by the domain type system and service layer | None — these metadata models are distinct and not derived from one another | None — `Customer` lacks master-definition metadata semantics |
| Runtime metadata store | None; `masters_registry.ts` is a static export referenced directly by `MasterManagementTab` | `Customer` runtime objects are persisted via API and localStorage in `customerStore.ts` | The registry does not own runtime Customer state | The Customer runtime model does not own registry field metadata |

### Key findings

- `masters_registry.ts` is a metadata model for master entity definitions, not a concrete customer data model.
- The customer domain is defined as a concrete `Customer` type in `src/types.ts:465`, and service files add usage and behavior on top of it.
- `customerValidation.ts` covers a narrow validation subset; it does not attempt to validate the full `Customer` shape or audit fields.
- `customerPolicyEngine.ts` covers credit and billing policy concerns, not schema metadata or audit field registration.
- `GLOBAL_AUDIT_FIELDS` in `src/masters_registry.ts:45` provides audit-field metadata that is not directly mirrored by the `Customer` type.
- `Customer` actual usage includes many business and financial fields that are outside the metadata registry's field metadata semantics.

---

## Evidence sources

- `src/services/metadataRegistry.ts:130-154` — method definitions for `registerModule`, `registerScreen`, `registerReport`, `registerForm`, `registerApi`, `registerDatabase`, `registerPrintTemplate`.
- `src/services/metadataRegistry.ts:162-194` — getter definitions and `getAllMetadata()` caller references.
- `src/components/SmritiBaseModule.tsx:49`, `src/components/SmritiBaseModule.tsx:67` — active `registerModule` call sites.
- `src/components/AboutSmritiTab.tsx:73`, `src/components/AboutSmritiTab.tsx:83` — runtime consumer of backend `/metadata` and `MetadataRegistry.getModules()`.
- `src/components/AboutSmritiWidget.tsx:35` — backend `/metadata` app metadata consumer.
- `src/components/ReportDesignerTab.tsx:195` — runtime consumer of `/reports/studios` report metadata.
- `src/components/MasterManagementTab.tsx:69` — runtime consumer of `/masters/lookup-types` dynamic master metadata.
- `src/components/PrintPreviewModal.tsx:762`, `src/components/PrintStudioTab.tsx:61-79`, `src/print_engine/print_store.tsx:94-98` — print template registration and provider runtime.
- `src/services/workflowEngine.ts:36` — `WorkflowEngine` definition and no other repo references.
- `src/masters_registry.ts:26`, `src/masters_registry.ts:36`, `src/masters_registry.ts:45` — metadata interface and global audit-field shape.
- `src/types.ts:465` — concrete `Customer` interface definition.
- `src/services/customerStore.ts:27`, `src/services/customerStore.ts:162`, `src/services/customerStore.ts:606` — customer persistence and object usage.
- `src/components/CustomerMasterTab.tsx:22`, `src/components/CustomerMasterTab.tsx:87` — `validateCustomerProfile` consumer in the customer UI.
- `src/services/customerValidation.ts:21-47` — customer validation logic and field checks.
- `src/components/BusinessLedgerTab.tsx:33`, `src/components/drilldown/DrillDownSidePanel.tsx:18`, `src/components/drilldown/DrillDownSidePanel.tsx:115` — `resolveCustomerPolicy` consumers.
- `src/components/AdvancedBillingEngine.tsx:18`, `src/components/AdvancedBillingEngine.tsx:462` — `checkCreditStatus` consumer.
- `src/services/customerPolicyEngine.ts:40-50`, `src/services/customerPolicyEngine.ts:82-138` — policy evaluation / credit-hold logic.
- `backend/app/api/v1/metadata.py:1-41` — backend `/metadata` endpoint definition.

---

## Notes

- All search evidence was collected with PowerShell `Select-String` because `rg` was not available in the terminal environment.
- No files were modified, deleted, or refactored in this pass.
