Document      : SMRITI Cross-Module Validation & Integration Audit — Standing Directive
Version       : 1.1 — read-only audit process, evidence ledger seeded from live repository,
                Section 10 adds import-linter/dependency-cruiser as continuous enforcement
Status        : DRAFT — pending architect review and lock, same as every prior Master Command
Prepared by   : Claude (AI agent), based on direct code audit of SMRITRretailNX-main
Applies to    : erpnbook / SMRITRretailNX
Relationship to other directives : This is NOT "Master Command 3" — that name stays reserved
                for Accounting Foundation per Master Command 2 Section 10's roadmap. This is a
                standing, repeatable AUDIT process — run it per module, any time, independent of
                the Master Command build sequence. It produces findings. It does not produce
                code changes. Anything it finds that needs fixing gets its own scoped Master
                Command, written after a human reads the findings — same discipline as every
                directive so far.
Supersedes    : the "SMRITI Retail OS — Cross Module Validation & Integration Audit" prompt
                draft (structure and checklist categories retained; the auto-create, auto-merge,
                and unbounded-fix rules are removed and replaced — see Section 0)

---

## 0. Read this first (agent instructions)

**This is a read-only audit. You do not create files. You do not modify files. You do not merge
anything. You do not fix anything.** Every module produces a findings report (Section 6). A
human reads every report before any code changes get authorized. If you finish a module and
you're tempted to "just fix this one small thing while you're in there" — don't. Write it down
as a finding instead. This rule exists because of a specific, verified incident: an execution
agent working from an earlier directive wired a frontend action to a backend endpoint
(`/workflow/...`) that didn't exist, because its instructions implied "if it's missing, build
toward it" rather than "if you can't find it, stop and report." That is the exact failure mode
this directive is structured to prevent. If you cannot find a component with a `grep`,
`find`, or equivalent command, the finding is **"not found"** — not an inference about what it
should look like, not a component you build to fill the gap.

**Do not invent modules.** The source prompt this directive replaces included a "dependency
matrix" listing a "Modern Trade" module and a "Cost" module, both marked pre-verified. Neither
exists anywhere in this repository (`grep -rln "Modern Trade|ModernTrade|SecondarySales" .` and
`find . -iname "*cost*"` both return nothing). That matrix was a generic retail-industry
template, not an audit of this codebase. Section 1 below replaces it with the real module list
and a dependency matrix built from actual foreign-key references — extend that matrix, don't
build a new one from assumption.

---

## 1. Evidence ledger (seeded — verify and extend, don't rebuild from scratch)

### 1.1 Real module inventory, as it exists today

Derived directly from the repository, not from a template:

| Domain | Frontend (`src/components/`) | Backend model (`backend/app/models/`) | Backend API (`backend/app/api/v1/`) | Backend service (`backend/app/services/`) | Legacy Express (`src/routes/`) |
|---|---|---|---|---|---|
| Sales | `SalesStudioTab.tsx` | `sales.py` (`SalesInvoice`, `SalesInvoiceItem`) | `sales.py` | `sales.py` | `sales.ts` |
| Purchase | `PurchaseStudioTab.tsx` | `purchase.py` (`Supplier`, `PurchaseOrder`, `PurchaseOrderItem`, `PurchaseReceipt`, `PurchaseReceiptItem`) | `purchase.py` | `purchase.py` | `purchase.ts` |
| POS | `PosTerminalTab.tsx`, `PosProfilesTab.tsx` | `pos.py` | `pos.py` | `pos.py` | `pos.ts` |
| Inventory / Stock | `InventoryForecastWidget.tsx`, `StockLedgerTab.tsx`, `ItemMasterTab.tsx` | `inventory.py` (`Product`, `StockMovement`, `Store`, `Warehouse`) | `inventory.py` | `inventory.py` | `inventory.ts` (**note: this file is the ledger stub, not stock — see Master Command 2 Section 1.2**) |
| Masters (Tier-1/Tier-2) | `MasterManagementTab.tsx` | `master_lookup.py`, `tenant.py` (`Company`, `Branch`) | `masters.py`, `master_lookup.py` | — | *(decommissioned — Master Command 1)* |
| CRM | `CrmStudioTab.tsx`, `CustomerMasterTab.tsx` | `crm.py` (`Customer`, `CustomerGroup`) | `crm.py` | `crm.py` | `customers.ts` |
| Loyalty | `LoyaltyStudioTab.tsx` | *(check — not confirmed in this ledger)* | — | `spif.py` | — |
| Supplier Payment | `SupplierDashboardTab.tsx` | `supplier_payment.py` | `supplier_payment.py` | `supplier_payment.py` | — |
| Numbering | `DocumentSeriesTab.tsx` | `numbering.py` | `numbering.py` | `numbering.py` | `numbering.ts` |
| Barcode | `BarcodeStudioTab.tsx`, `BarcodeMappingSection.tsx` | `barcode.py` | `barcode.py` | — | `barcode.ts` |
| Terms/Print | `TermsEngineTab.tsx`, `PrintPreviewModal.tsx` | `terms.py` | `terms.py` | `terms.py` | `terms.ts` |
| Attributes/Variants | `AttributeManagerSection.tsx`, `VariantTemplateSection.tsx`, `AttributeAnalyticsSection.tsx` | `attributes.py` | `attributes.py` | `attributes.py` | — |
| Auth/Users | `LoginScreen.tsx`, `UserProfileTab.tsx`, `StaffManagementTab.tsx` | `auth.py`, `role.py` | `auth.py`, `users.py`, `roles.py` | `auth.py`, `user.py` | `auth.ts`, `users.ts` |
| Reports | `ReportDesignerTab.tsx`, `QuickReportsWidget.tsx` | — | `reports.py` | `reports.py` | `reports.ts` |
| Workflow (status transitions) | consumed by `SalesStudioTab.tsx`, `PurchaseStudioTab.tsx`, `ApprovalMatrixTab.tsx` | — | **not found — see Master Command 2 Section 1** | `workflowEngine.js` (Express only) | `system.ts` (`/api/workflow/:docType/:id/:action`) |
| Accounting/Ledger | `BusinessLedgerTab.tsx`, `AccountingSyncTab.tsx` | **not found — Decision B, Master Command 1** | — | — | `inventory.ts` (`ledgerEntries`, in-memory) |
| Company Provisioning | `SetupWizard/` | — | **not built — Master Command 1 Phase 5, pending** | — | `system.ts` (`/api/company/setup`, non-functional per Master Command 1 evidence) |

Rows marked "not found," "not confirmed," or "not built" are **known gaps carried forward from
prior audits, not new findings to re-derive.** Your job on those rows is to re-verify they're
still accurate (repos change), not to treat them as a surprise or to fill them in yourself.

### 1.2 Real cross-module dependency matrix (from actual foreign keys, not assumption)

Built from `grep -n "ForeignKey(" backend/app/models/*.py`:

| Depends on → | Company/Branch | Users | Customers/CustomerGroup | Products | Suppliers | Purchase Orders/Receipts | Sales Invoices | Shifts/Cash Registers | Document Series | Print Templates | Master Types/Values |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Auth (`User`) | ✓ (`company_id`, `branch_id`) | | | | | | | | | | |
| Branch (`tenant.py`) | ✓ (`company_id`) | | | | | | | | | | |
| Sales (`SalesInvoice`) | | | ✓ (`customer_id`) | | | | | ✓ (`shift_id`) | | | |
| Sales (`SalesInvoiceItem`) | | | | ✓ (`product_id`) | | | ✓ (`invoice_id`) | | | | |
| Purchase (`PurchaseOrderItem`) | | | | ✓ (`product_id`) | | ✓ (`order_id`) | | | | | |
| Purchase (`PurchaseReceipt`) | | | | | ✓ (`supplier_id`) | ✓ (`order_id`, nullable) | | | | | |
| Purchase (`PurchaseReceiptItem`) | | | | ✓ (`product_id`) | | ✓ (`receipt_id`) | | | | | |
| POS (session/shift) | | ✓ (`cashier_id`) | | | | | | ✓ (`register_id`) | | | |
| Supplier Payment | | | | | ✓ (`supplier_id`) | | | | | | |
| Numbering | | | | | | | | | ✓ (self, `series_id`) | | |
| Barcode | | | | | | | | | | ✓ (`template_id`) | |
| Master Lookup (`MasterValue`) | | | | | | | | | | | ✓ (self-referential, `master_type_id`/`parent_value_id`) |
| CRM (`Customer`) | | | ✓ (`customer_group_id`) | | | | | | | | |

Read this as: **Sales depends on CRM (customer) and POS (shift). Purchase depends on Supplier
and Inventory (product). Neither Sales nor Purchase currently has a foreign key into an
Accounting/Ledger table** — confirms, from the schema level rather than the route level, that
Master Command 1 Decision B (no Chart of Accounts model exists) and Master Command 2's finding
(no ledger/voucher models exist) are consistent with each other. Extend this table as you audit
each module — add rows/columns for anything this ledger missed, but cite the actual
`ForeignKey(...)` line when you do.

### 1.3 Known findings from prior audits — don't rediscover these, verify and build on them

- **Pattern: backend built ahead of frontend, zero callers.** Found three times already:
  `master_entities` (Master Command 1, resolved), the FastAPI Sales/Purchase/POS layer (Master
  Command 2, in progress), and `GET /api/v1/auth/tenants` (found this session, unresolved, low
  stakes). When you audit a module and find a backend component with no frontend caller, this is
  now an established pattern in this codebase — name it as such in your report rather than
  treating each instance as a novel discovery.
- **Duplicated GST calculation** (Master Command 2, Section 1.3): `sales.ts`, `services/sales.py`,
  and `services/purchase.py` each have their own formula. Consolidation is scoped to Master
  Command 2, not this audit — if you find a fourth instance, report it there, don't fix it here.
- **Workflow engine gap**: `system.ts`'s `WorkflowEngine` (`/api/workflow/:docType/:id/:action`)
  has no FastAPI equivalent and is a hard dependency for both Sales and Purchase status
  transitions. Still unresolved as of this ledger.
- **Credential exposure, fixed**: a prior version of `LoginScreen.tsx` rendered plaintext
  SYSADMIN/MANAGER/CASHIER credentials on the login screen. Removed. When auditing Auth/Users,
  confirm it hasn't regressed and check for anything with a similar shape elsewhere (hardcoded
  credentials, tokens, or secrets committed as literals).
- **`BaseEntity` convention** (`backend/app/db/base.py`): every model should extend it. Known
  exceptions: `Company`/`Branch` (`tenant.py`) — hand-rolled, missing `deleted_at`/`deleted_by`/
  `version`, already flagged out-of-scope for remediation by Master Command 1.

---

## 2. Objective

Produce an accurate, evidence-backed picture of what exists, what's missing, what's duplicated,
and what's disconnected across every real SMRITI module — as a report a human reads and acts on,
not as an agent-executed fix pass. Preserve everything Master Command 1 and 2 already
established: no speculative architecture, no self-certification, evidence over inference.

---

## 3. Rules of engagement

1. **One module at a time**, from Section 1.1's table. Do not run this across multiple modules
   in a single unsupervised pass. Finish a module's report, stop, wait for the next instruction.
2. **Read-only.** No file creation, no edits, no merges, no `DELETE`/`DROP`/migration writes.
   The only output is the report in Section 6.
3. **"Not found" is a valid, final answer.** If a component referenced elsewhere doesn't exist
   when you `grep`/`find` for it, that's the finding. Do not build it, stub it, or infer its
   shape "so the report looks complete."
4. **Cite the command, not the conclusion.** Every finding needs the actual command and its
   actual output (or a representative excerpt) attached — same evidence standard as Master
   Command 1 and 2. "Tests appear comprehensive" is not a finding. "`grep -c 'assert ' file` →
   29" is.
5. **Duplicates get reported, not merged.** If you find two implementations of the same logic,
   describe both, cite both, and stop there. Which one survives and how the merge happens is an
   architect decision, then a separate scoped directive — not something resolved inside an audit
   pass.
6. **Don't silently resolve ambiguity.** If a module's boundary is unclear (e.g., is a piece of
   logic Sales's or Inventory's?), say so explicitly in the report rather than picking one and
   moving on.

---

## 4. Per-module audit checklist

For the module under audit, check each of the following and cite evidence for each line — a
blank or "not applicable" is fine, a claim with no command behind it is not:

**Code layer**
- API routes (list each, with method + path, from the actual router file)
- Service/business logic layer
- Repository/data-access layer (or direct ORM queries if no separate repository exists — say
  which)
- Database models — do they extend `BaseEntity`? If not, is that a known exception (Section 1.3)
  or new?
- Pydantic/TypeScript schemas
- Validators (server-side and client-side)
- Tests — count `assert`/`expect` statements, don't just confirm a test file exists
- Frontend pages/components that call this module's APIs — and which APIs, if any, have zero
  callers (Section 1.3 pattern)

**Integration layer**
- Every foreign key this module's models declare (extend Section 1.2's matrix)
- Every foreign key *into* this module's tables from elsewhere
- Imports — any circular import, any import of a file that doesn't exist, any orphaned file that
  nothing imports
- For modules with both an Express and a FastAPI implementation: which one does the frontend
  actually call right now (check with `grep`, don't assume from file existence — Master Command
  2 Section 1.1/1.2 is the template for this check)

**Contract layer**
- Request/response schema for each endpoint
- Error-handling shape (what does a 4xx/5xx actually return?)
- Auth/permission checks present on each write endpoint
- API version — is anything on this module still on a legacy contract shape

**Data layer**
- Migrations — do they chain cleanly to a single head (`alembic heads`)? Additive-only, or do
  any modify existing columns destructively?
- Constraints, indexes, cascade rules on the FKs found above

**Quality gates** — run these, paste actual output, don't characterize in prose only:
- Backend: `ruff`, `mypy`, `pytest` (scoped to this module's test files), `bandit`, `pip-audit`
- Frontend: `tsc --noEmit`, `eslint`, build (`vite build` or equivalent)

**Security** (only for modules handling auth, payments, or PII — CRM, Auth, POS, Supplier
Payment; skip elsewhere unless something surfaces)
- Auth/authorization checks on every write route
- SQL injection surface (raw queries vs. parameterized/ORM)
- Secrets or credentials as literals in code (per the login-screen precedent, Section 1.3)
- Input validation on user-supplied fields

---

## 5. Process

1. Pick the next module from Section 1.1 (human directs which one, or proceed in table order if
   told to).
2. Work through Section 4's checklist for that module only.
3. Extend Section 1.2's dependency matrix with anything new this module's audit surfaces.
4. Produce the report (Section 6).
5. **Stop.** Wait for the report to be read before starting the next module.

Do not proceed to "Full Platform Validation" (Section 8) until every module in Section 1.1 has
an individual report a human has reviewed.

---

## 6. Per-module report template

```
Module: <name>
Audited against: <commit/zip reference>

Existing components (with evidence):
  - <component> — <file:line or command output confirming it>

Missing components (referenced elsewhere, not found):
  - <what's missing> — <where it's referenced from> — <command that confirmed absence>

Duplicate implementations found:
  - <description> — <both locations cited> — NOT merged, flagged for architect decision

Orphaned / disconnected code:
  - <backend component with zero frontend callers, or vice versa> — <grep command + result>

Dependency matrix additions:
  - <new rows/columns for Section 1.2, with the FK line cited>

Quality gate results (pasted, not summarized):
  - ruff: <output>
  - mypy: <output>
  - pytest: <pass/fail counts>
  - bandit / pip-audit: <output>
  - tsc --noEmit: <output>
  - eslint: <output>

Security notes (if applicable to this module):
  - <finding> — <evidence>

Assumptions made / ambiguity not resolved:
  - <anything you couldn't determine with certainty — state it, don't guess>

Recommended next step:
  - <e.g. "needs a scoped Master Command for X" — do NOT include a fix, just the recommendation>
```

---

## 7. What happens with findings

Findings are not authorization to act. After each module report:
- A human (architect) reads it.
- Anything requiring a code change gets its own scoped Master Command, written the same way
  Master Command 1 and 2 were — with its own evidence ledger, its own phases, its own
  verification gates.
- This directive's agent does not carry findings forward into fixes without that separate,
  explicitly-authorized directive existing first.

---

## 8. Full-platform rollup (only after every module has an individual, human-reviewed report)

Produce a single summary document aggregating:
- The complete dependency matrix (Section 1.2, fully extended)
- Every "missing," "duplicate," and "orphaned" finding across all modules, in one list
- Full quality-gate results per module, in one table
- A prioritized list of recommended follow-up Master Commands, ranked by what's blocking what
  (e.g., the workflow engine gap blocks both Sales and Purchase cutover — that ordering matters)

Call this a **Findings Summary**, not a "Compliance Report" and not a "certification." Nothing
in this process empowers an agent to certify the platform — that framing overstates what a
self-generated report can actually attest to. The summary's job is to make the next set of
decisions easier for a human, not to declare the platform validated.

---

## 9. Explicitly out of scope for this directive

- Creating, merging, or fixing anything — that's Section 0/3, restated because it's the rule
  most likely to get quietly bent under time pressure, per the precedent in Section 1.3.
- Any module not in Section 1.1's table. If you believe a real module is missing from that
  table, say so and cite what you found — don't add speculative rows for modules that don't
  exist (per Section 0's "Modern Trade"/"Cost" note).
- Architecture decisions about which duplicate implementation survives — Section 3.5.
- Anything already explicitly out of scope in Master Command 1 or 2 (Plugin Framework, Metadata
  Registry, Business Engine layer, CQRS, Event Sourcing, Microservices) — this audit may surface
  evidence relevant to those future decisions, but does not authorize acting on it.

---

## 10. Automated enforcement — turning Section 1.2 from a document into a CI check

A human (or an agent, in a Section-3-compliant pass) re-verifying the dependency matrix by hand
every time doesn't scale. Two companion config files make it continuous instead:

- **`.importlinter`** (backend) — encodes the layering rule (`app.api` → `app.services` →
  `app.models`, never reversed) and independence contracts for domain pairs Section 1.2 found
  *no* foreign-key relationship between (Purchase↔CRM, Purchase↔POS, Master Lookup↔every
  transactional domain, Barcode↔every transactional domain). Run via `lint-imports` from
  `backend/`; add to the CI workflow (`.github/workflows/ci.yml` already exists — this is one
  more step in it, not a new pipeline).
- **`.dependency-cruiser.js`** (frontend) — two rules specific to a real structural risk in this
  repo (`src/components` and `src/routes` share one `tsconfig.json`, so nothing currently stops
  a browser component from importing Node-only Express code), plus standard circular-dependency
  and orphan detection. The orphan check is the automated version of the "built but unwired"
  pattern this audit has now found three times by hand (`master_entities`, the FastAPI
  Sales/Purchase/POS layer, `GET /api/v1/auth/tenants`) — a hit doesn't mean delete the file, it
  means add a finding to that module's report per Section 6.

**These are seed contracts, not a finished architecture map.** Every contract in `.importlinter`
traces to a specific `grep -n "ForeignKey("` result already in Section 1.2 — extend both files
only when a module's audit pass confirms a new relationship (or confirms one doesn't exist), the
same evidence bar as everything else in this directive. A contract that fails on first run isn't
necessarily wrong — it might mean Section 1.2 missed a real relationship, which is itself a
finding: report it, don't just delete the contract to make CI pass.
