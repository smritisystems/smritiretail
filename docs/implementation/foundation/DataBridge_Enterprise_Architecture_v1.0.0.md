<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 1.0.0
  Created      : 2026-10-06
  Modified     : 2026-10-06
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal — Implementation Plan (IPGP-v1.0)
-->

# SMRITI DataBridge Enterprise Architecture & SMRITI-X v1.0 Implementation Plan

**Plan ID:** IP-DATABRIDGE-v1.0.0  
**Status:** Approved — Architecture Frozen (Pre-Implementation)  
**Target Capability:** `cap_databridge` (`DATABRIDGE`)  
**Standard Contract:** `SMRITI-X v1.0`  
**Governing Policies:** Universal Author Details & File Header Policy (UADHP), Implementation Plan Governance Policy (IPGP), Human-Readable Error Policy (HREP), Multi-Tenant Ownership Contract (`ownership.py`).

---

## 1. Executive Summary

SMRITI DataBridge is the unified, premium enterprise data exchange, migration, and interoperability subsystem of SMRITI Retail OS. It provides secure, auditable, two-phase import, export, reconciliation, and schema mapping across Web, REST API, and omnichannel (WhatsApp) interfaces.

This implementation plan establishes the architectural blueprint to build SMRITI DataBridge by extending, hardening, and consolidating SMRITI's proven components (`universal_import.py`, `globalExportService.ts`, `GlobalGridImportModal.tsx`, `HeaderAliasRegistry.ts`, and `PostgresEventOutbox`) while formally deprecating and retiring legacy mock endpoints (`exchange.py`).

```text
SMRITI DataBridge (Capability Hub)
        │
        ├── Ingestion & Parser (CSV, XLSX, SMRITI-X JSON)
        ├── Dynamic Header Normalizer & Mapping Engine
        ├── Two-Phase Preview & Reconciliation Engine
        ├── Atomic Domain Writer & Entity Adapters
        ├── Asynchronous Outbox Worker Pipeline (>5,000 rows)
        ├── Client & Server Streaming Export Engine
        └── Immutable WORM Compliance Audit Journal
                 │
                 ▼
             SMRITI-X
        Canonical Exchange Standard
```

---

## 2. Problem Statement

Prior to SMRITI DataBridge, data exchange within the repository suffered from architectural fragmentation:
1. **Parallel & Mock Implementations:** `backend/app/api/v1/exchange.py` existed as an un-governed mock module returning synthetic task logs and referencing the decommissioned `Product` table rather than the canonical `Item`/`ItemVariant` domain model.
2. **Synchronous Memory Bottlenecks:** `backend/app/api/v1/universal_import.py` capped imports at 5,000 rows, lacking an asynchronous background queue for multi-megabyte enterprise catalogs.
3. **Channel-Coupling Risk:** Informal proposals risked coupling data import/export tightly to WhatsApp chatbots rather than establishing WhatsApp as a standard transport client over a generic, governed data bridge.
4. **Ad-hoc Export Logic:** Multiple divergent export routines existed across frontend React utilities, report endpoints, and Tally services without a shared canonical format.

---

## 3. Goals

- **Unify All Import/Export:** Consolidate catalog, pricing, customer, and transaction data exchange under a single, authoritative service boundary (`backend/app/services/databridge/`).
- **Channel Neutrality:** Ensure identical validation, parsing, matching, and commit behavior whether initiated via Web UI, REST API, or WhatsApp.
- **SMRITI-X v1.0 Compliance:** Establish the formal, self-describing JSON/CSV/XLSX exchange contract with cryptographic SHA-256 tamper evidence.
- **Strict Database-per-Tenant Isolation:** Guarantee that zero business data is queried or persisted through the `smritisys` control-plane database.
- **Idempotency & Immutability:** Enforce SHA-256 payload deduplication and absolute barcode immutability for existing transactional SKUs.
- **Asynchronous Scalability:** Process payloads $>5,000$ rows asynchronously using SMRITI's native `PostgresEventOutbox` worker without blocking HTTP server event loops.

---

## 4. Non-Goals

- **NO Direct Table Insertion into Ledgers:** DataBridge will never bypass domain services to write directly to `stock_movements`, `general_ledger_entries`, or `journal_vouchers`.
- **NO Ad-hoc Queuing System:** DataBridge will not introduce Celery, RabbitMQ, or Python threading pools; it must use SMRITI's proven PostgreSQL Transactional Outbox.
- **NO WhatsApp-Exclusive Logic in Core:** The DataBridge core service will have zero dependencies on Meta Cloud API, Gupshup, or Twilio SDKs.
- **NO Modification to Historical Primary Keys:** DataBridge will match on business natural keys (`item_code`, `variant_sku`, `barcode`, `code`), never exposing internal database UUIDs as mandatory keys.

---

## 5. Existing Architecture Evaluation

The pre-implementation audit verified the following active codebase baseline:

| Subsystem | Active Component | Architectural Role | Current Limitation |
|---|---|---|---|
| **Core Import** | `universal_import.py` | Two-phase preview and commit with `IM001ControlledFieldValidator` pre-caching. | Synchronous; 5,000 row limit; only `ITEM_MASTER` and `PRICE_BOOK` committed. |
| **Grid UI Import** | `GlobalGridImportModal.tsx` | Multi-mode (Paste/File/Scanner) import wizard. | Operates in-memory before submitting JSON to backend. |
| **Header Mapping** | `HeaderAliasRegistry.ts` | 440 lines of field aliases and fuzzy matching. | Client-side only; requires server-side reflection. |
| **Client Export** | `globalExportService.ts` | Pure JS RFC4180 CSV, TSV, OpenXML XLSX, JSON generator. | Client-side memory limits for datasets $>20,000$ rows. |
| **Audit Journal** | `ComplianceImmutableAuditLog` | WORM SHA-256 chained regulatory log. | Used in `universal_import.py:493` for commit idempotency. |
| **Async Outbox** | `PostgresEventOutbox` | `SELECT FOR UPDATE SKIP LOCKED` non-blocking worker. | Configured for platform events; ready for DataBridge batch worker. |
| **Tenant Routing** | `get_company_db` in `deps.py` | Multi-tenant dynamic database connection pool. | Guarantees business data isolates to `smritiXXX`. |
| **Legacy Exchange** | `exchange.py` | Mock CRUD endpoints for tasks and mappings. | Stubbed (`EXLOG-002`); syntax error in join; targets deprecated `Product`. |

---

## 6. Reuse Strategy

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│                        REUSED CODEBASE ASSETS                                │
├──────────────────────────┬───────────────────────────────────────────────────┤
│ Asset                    │ Specific Reuse Pattern                            │
├──────────────────────────┼───────────────────────────────────────────────────┤
│ universal_import.py      │ Two-phase /preview and /commit state machine      │
│ IM001ControlledFieldVal. │ O(14) batch MasterLookup resolution algorithm     │
│ HeaderAliasRegistry.ts   │ Canonical dictionary of column aliases            │
│ GlobalGridImportModal    │ 3-step Wizard UI (Input -> Mapping -> Preview)    │
│ globalExportService.ts   │ Pure TypeScript OpenXML XLSX and CSV serializers  │
│ ComplianceImmutableAudit │ SHA-256 payload hashing and WORM replay checks    │
│ PostgresEventOutbox      │ Stage -> Claim -> Settle background batch worker  │
│ get_company_db           │ Dynamic tenant connection pool router             │
└──────────────────────────┴───────────────────────────────────────────────────┘
```

---

## 7. SMRITI DataBridge Architecture

```text
                                CLIENT / INGRESS LAYER
       ┌───────────────────────────────┬───────────────────────────────┐
       │ Web UI (GlobalGridImportModal)│ External API (/api/v1/bridge) │
       └───────────────┬───────────────┴───────────────┬───────────────┘
                       │                               │
                       ▼                               ▼
       ┌───────────────────────────────────────────────────────────────┐
       │                SMRITI Ingress Guard Pipeline                  │
       │  1. JWT Auth -> 2. TenantContext -> 3. Entitlement Guard      │
       │  4. RBAC Check -> 5. Payload Rate Limiting                    │
       └───────────────────────────────┬───────────────────────────────┘
                                       │
                                       ▼
       ┌───────────────────────────────────────────────────────────────┐
       │                  SMRITI DataBridge Engine                     │
       │  backend/app/services/databridge/                             │
       │                                                               │
       │  ├── parser/        (Streaming CSV, XLSX, SMRITI-X JSON)      │
       │  ├── normalizer/    (Deterministic Header Alias Matching)     │
       │  ├── validator/     (Schema, Dimension, Business Invariants)  │
       │  ├── matcher/       (Natural Key & Barcode Conflict Engine)   │
       │  ├── preview/       (Reconciliation Report & Difference Diff) │
       │  ├── writer/        (Atomic Domain Entity Adapters)           │
       │  └── outbox/        (Postgres Transactional Outbox Worker)    │
       └───────────────────────────────┬───────────────────────────────┘
                                       │
                                       ▼
       ┌───────────────────────────────────────────────────────────────┐
       │                 Tenant Database (smritiXXX)                   │
       │  - items / item_variants / item_barcodes                      │
       │  - parties / price_books / customers / suppliers              │
       │  - compliance_immutable_audit_logs (SHA-256 Idempotency)      │
       │  - integration_outbox_events (Batch Queue)                    │
       └───────────────────────────────────────────────────────────────┘
```

---

## 8. SMRITI-X Specification (v1.0)

### 8.1 Schema Definition
`SMRITI-X` is the canonical, machine-to-machine exchange standard for SMRITI Retail OS.

```json
{
  "$schema": "https://smritibooks.com/schemas/smriti-x-1.0.json",
  "format": "SMRITI-X",
  "version": "1.0.0",
  "source": {
    "system": "SMRITI Retail OS",
    "version": "6.70.7",
    "tenant_id": "smriti001",
    "company_id": "COMP-001",
    "branch_id": "BR-MAIN-001",
    "environment": "PRODUCTION"
  },
  "transmission": {
    "correlation_id": "corr-4a8b1c9d-20261006",
    "batch_id": "bat-20261006-0001",
    "exported_at": "2026-10-06T08:30:00Z",
    "actor_id": "usr-system-admin",
    "checksum_sha256": "3a7b9c1d...",
    "record_count": 1500
  },
  "contract": {
    "entity": "ITEM_MASTER",
    "schema_version": "2.2.0",
    "mode": "FULL_CATALOG",
    "dependencies": [
      { "entity": "MASTER_LOOKUP", "version": "1.0" }
    ]
  },
  "records": [
    {
      "record_id": "rec-0001",
      "action": "UPSERT",
      "payload": {
        "item_code": "OXFORD-CLASSIC-01",
        "item_name": "Classic Derby Leather Shoe",
        "category": "Footwear",
        "brand": "SMRITI",
        "hsn_code": "6403",
        "tax_rate": 18.0,
        "variants": [
          {
            "sku": "OXFORD-BLK-42",
            "size": "42",
            "color": "Black",
            "mrp": 4999.00,
            "selling_price": 3999.00,
            "barcodes": ["8901234567890"]
          }
        ]
      }
    }
  ]
}
```

### 8.2 Forbidden Attributes
The SMRITI-X specification strictly forbids the inclusion of:
- `password`, `hashed_password`, `salt`, `pin_hash`
- `jwt_token`, `auth_token`, `session_token`, `api_key`
- PostgreSQL internal database connection strings, credentials, or internal autoincrement sequence IDs
- Unvalidated arbitrary JSON objects without schema declaration.

---

## 9. Entity Release Roadmap

```text
Entity Rollout Phases:
├── Phase 1: Safe Master Data (Immediate Core)
│   ├── Item (items)
│   ├── ItemVariant (item_variants)
│   ├── ItemBarcode (item_barcodes)
│   ├── MasterLookup (master_values: category, brand, uom, size, color)
│   ├── CustomerGroup (customer_groups)
│   └── PriceBook (price_books)
│
├── Phase 2: Dependency-Sensitive Entities
│   ├── Customer (customers) & Delivery Locations
│   ├── Supplier (suppliers) & Supplier Bank Accounts
│   ├── PriceBookEntry (price_book_entries)
│   ├── Warehouse (warehouses) & WarehouseLocation (warehouse_locations)
│   └── Universal Party (parties, party_roles)
│
└── Phase 3: Transactional Entities (Strict Lifecycle Invariants)
    ├── Opening Stock (via StockAccountingBoundaryService)
    ├── Purchase Orders (via PurchaseService)
    ├── Goods Receipt Notes (GRN) (via GoodsReceiptService)
    ├── Sales Invoices (via CanonicalSalesWriter)
    └── Payments (via PaymentsEngine)
```

---

## 10. API Contract (`/api/v1/databridge/*`)

All endpoints execute strictly under the SMRITI Governance Middleware Chain:
`OAuth2 JWT` $\rightarrow$ `TenantContext` $\rightarrow$ `get_company_db` $\rightarrow$ `require_databridge_entitlement` $\rightarrow$ `require_role/require_permission`.

| Method | Endpoint | Description | Request Payload | Response Contract |
|---|---|---|---|---|
| `POST` | `/api/v1/databridge/preview` | Two-phase preview and pre-validation. Resolves rows against live lookup tables and checks barcode conflicts. | `DataBridgePreviewRequest` | `DataBridgePreviewResponse` (reconciliation report, blocking errors, warnings) |
| `POST` | `/api/v1/databridge/commit` | Commits verified preview payload within an atomic database transaction. Chained to WORM audit log. | `DataBridgeCommitRequest` (idempotency key required) | `DataBridgeCommitResponse` (created, updated, skipped, failed counts) |
| `POST` | `/api/v1/databridge/async/submit` | Submits large dataset ($>5,000$ rows) to Transactional Outbox for asynchronous background execution. | `Multipart Upload` or `SMRITI-X JSON` | `DataBridgeAsyncJobResponse` (`job_id`, status `PENDING`) |
| `GET` | `/api/v1/databridge/async/status/{job_id}` | Polls or inspects background job progress, row metrics, and error logs. | None | `DataBridgeJobStatusResponse` (`progress_percent`, `processed_rows`) |
| `POST` | `/api/v1/databridge/export` | Generates streaming dataset export in CSV, XLSX, or SMRITI-X JSON with PII sanitization. | `DataBridgeExportRequest` (entity, filters, scope) | `StreamingResponse` (RFC4180 CSV / OpenXML XLSX / JSON) |
| `GET` | `/api/v1/databridge/templates/{entity}` | Downloads canonical, pre-populated XLSX template containing live lookup dropdowns. | Query params: `format` (`xlsx`/`csv`) | `StreamingResponse` (.xlsx template) |
| `GET` | `/api/v1/databridge/mappings/{entity}` | Retrieves registered header mapping translations for external formats. | None | `List[DataBridgeMappingDTO]` |

---

## 11. Import Architecture

```text
[Upload / Ingress]
        │
        ▼
[Security Check & Antivirus Sanity]
        │
        ▼
[Format Detection (CSV, XLSX, SMRITI-X JSON)]
        │
        ▼
[Header Normalization via HeaderAliasRegistry]
        │
        ▼
[Batch Pre-Validation (IM001ControlledFieldValidator - O(14) Lookups)]
        │
        ▼
[Natural Key Matching & Barcode Immutability Guard]
        │
        ├── Error Detected ──► Return Detailed Reconciliation Report (Blocking)
        │
        ▼
[Preview Approval from Operator]
        │
        ▼
[Atomic Transactional Domain Commit (Postgres Session)]
        │
        ├── Record Chained WORM Audit (ComplianceImmutableAuditLog)
        └── Dispatch Event to Outbox (integration_outbox_events)
```

---

## 12. Export Architecture

1. **Client-Side Small Exports ($\le 5,000$ rows):** Handled via `globalExportService.ts` utilizing browser memory, producing instant RFC4180 CSV or OpenXML ZIP spreadsheets without server load.
2. **Server-Side Large Exports ($> 5,000$ rows):** Generated via FastAPI `StreamingResponse` utilizing SQLAlchemy chunked cursor streams (`yield_per(1000)`), serializing directly into the response socket.
3. **Mandatory PII Redaction:** All export pipelines pass through `sanitizeExportRecord`, stripping passwords, auth tokens, secret keys, and internal database connection parameters.

---

## 13. Mapping Architecture

- **Automatic Matching:** Maps incoming headers against `HeaderAliasRegistry.ts` using normalized string distance (`_clean_code`, case folding, punctuation stripping).
- **Explicit Confirmation:** If confidence $< 0.85$, the field is marked `UNMAPPED` in `GlobalGridImportModal.tsx`, requiring operator manual assignment.
- **Persistent Template Storage:** User-confirmed mappings are saved in `databridge_mapping_templates` in the tenant database for repeated imports.

---

## 14. Validation Architecture

Validation is layered into four deterministic gates:

```text
Gate 1: Structural Validation
  - UTF-8 encoding valid, MIME type permitted, delimiter detected.
Gate 2: Schema Type Validation
  - Number fields contain valid decimals; dates match ISO-8601; required columns present.
Gate 3: Dimension & Domain Validation
  - IM-001: Category, Brand, Gender, UOM match active System Master Lookup values.
  - IM-008: Y/N boolean parsing strictly enforced.
  - IM-009: is_service_yn=True forces is_inventory_yn=False.
Gate 4: Business Integrity & Barcode Immutability
  - Barcode does not clash with existing different SKU.
  - Selling price does not exceed MRP.
  - Tax rate matches statutory GST tiers (0%, 5%, 12%, 18%, 28%).
```

---

## 15. Idempotency & Repeat Safety

- **Ingress Hashing:** Every import payload is digested into an SHA-256 checksum:
  $$\text{Payload Hash} = \text{SHA256}(\text{IdempotencyKey} + \text{SerializedContent})$$
- **WORM Audit Lock:** Checked against `compliance_immutable_audit_logs`. If `event_type == 'DATABRIDGE_COMMIT'` and `payload_hash` matches an existing committed record within 24 hours, the engine returns `idempotent_replay: true` without re-executing writes.

---

## 16. Security Standards

- **Authentication:** Strict OAuth2 Bearer JWT.
- **Authorization:** Granular RBAC permissions:
  - `databridge:import:preview`
  - `databridge:import:commit`
  - `databridge:export`
  - `databridge:admin`
- **File Safety:** Uploaded files cannot exceed 50 MB. Executable macros (`.xlsm`, `.vbs`, `.exe`) are rejected with `HTTP 400 Bad Request`.

---

## 17. Tenant Isolation Architecture

- **Strict Database Boundary:** Business data never touches `smritisys`.
- **Tenant Context Verification:** `TenantContext` is extracted from verified JWT claims. Cross-company access attempts raise `HTTP 403 Forbidden` (`Header Tampering Forbidden`).
- **Connection Pinning:** `get_company_db` injects connection parameters explicitly bound to the company's dedicated database.

---

## 18. Premium Capability Architecture

SMRITI DataBridge is registered as a non-core, premium capability:

```python
# In backend/app/db/seed_cap_master.py
(
    "cap_databridge",
    "DATABRIDGE",
    "SMRITI DataBridge Enterprise Integration Hub",
    "PLATFORM",
    "Secure enterprise data import, export, reconciliation, and canonical SMRITI-X exchange.",
    ["INVENTORY", "REPORTING"],  # Dependencies
    False,                       # is_core (Premium)
    False,                       # default_enabled (Requires explicit subscription)
    "v1.0.0",
    "ACTIVE"
)
```

**Entitlement Enforcement Guard:**
```python
async def require_databridge_entitlement(
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_company_db),
):
    binding = await db.scalar(
        select(TenantCapabilityBinding).where(
            TenantCapabilityBinding.capability_code == "DATABRIDGE",
            TenantCapabilityBinding.is_enabled == True,
            TenantCapabilityBinding.status == "ACTIVE"
        )
    )
    if not binding:
        raise HTTPException(
            status_code=403,
            detail="Access Denied: SMRITI DataBridge capability is not activated for this company."
        )
```

---

## 19. Asynchronous Large File Processing

Datasets exceeding 5,000 rows bypass synchronous request timeouts:

```text
[Client Uploads Large File]
        │
        ▼
[DataBridge Controller: Generates Job ID & Stages File]
        │
        ▼
[Stages Event in integration_outbox_events (Status: PENDING)]
        │
        ▼
[HTTP 202 Accepted Returned to Client with job_id]
        │
        ▼
[PostgresEventOutbox Worker Claims Job via SELECT FOR UPDATE SKIP LOCKED]
        │
        ├── Processes in 1,000-row transactional chunks
        ├── Updates job progress percentage
        └── Commits final state to ComplianceImmutableAuditLog
```

---

## 20. Staging File Storage Architecture

An abstract file storage driver decouples DataBridge from local disk paths:

```python
class IDataBridgeFileStorage(ABC):
    @abstractmethod
    async def stage_file(self, company_id: str, file_bytes: bytes, filename: str) -> str:
        """Saves file to secure staging area and returns storage URI."""
        pass

    @abstractmethod
    async def retrieve_file(self, storage_uri: str) -> bytes:
        """Retrieves staged bytes."""
        pass

    @abstractmethod
    async def purge_expired(self, max_age_hours: int = 48) -> int:
        """Cleans up temporary staging artifacts."""
        pass
```
- **Development/Standard Mode:** `LocalEncryptedFileStorage` writing to `artifacts/databridge_staging/` with SHA-256 verification.
- **Enterprise Cloud Mode:** S3 / GCS compliant blob storage driver.

---

## 21. WhatsApp Channel Architecture

```text
[WhatsApp User sends CSV/XLSX or command]
        │
        ▼
[Webhook Ingress: backend/app/api/v1/communicator.py]
        │
        ├── 1. HMAC SHA-256 Signature Verification
        ├── 2. Sender Phone Number mapped to authorized User / Party
        └── 3. Rate Limit & Spam Defense
        │
        ▼
[Stages Document into IDataBridgeFileStorage]
        │
        ▼
[DataBridge Execution Engine runs Preview]
        │
        ▼
[CommunicatorEngine replies with formatted WhatsApp Interactive Message]:
"Preview Complete: 420 valid items, 0 errors, 2 price changes. Reply 'CONFIRM' to import."
        │
        ▼
[User replies 'CONFIRM' within 10-minute expiry window]
        │
        ▼
[DataBridge Commits Transaction & Sends Success Receipt PDF]
```

---

## 22. AI Safety & Non-Bypass Governance

If Gemini or an AI conversational agent interacts with DataBridge:
1. **AI Cannot Execute Directly:** AI agents can only generate structured `DataBridgePreviewRequest` or `DataBridgeExportRequest` payloads.
2. **Deterministic Rules Authoritative:** If an AI model claims a row is valid, but `IM001ControlledFieldValidator` flags a missing category, the system **MUST REJECT** the row.
3. **No Conversational Destruction:** AI interfaces are hard-blocked from invoking destructive overwrites, tenant resets, or database truncations.

---

## 23. Audit, Compliance & Observability

- **Immutable Journaling:** Every commit writes an entry to `compliance_immutable_audit_logs`.
- **Distributed Tracing:** Every operation carries `correlation_id` propagated through all logs and outbox events.
- **Metrics Tracked:**
  - Import latency per 1,000 rows
  - Error frequency by lookup code
  - Outbox job claim duration and lag.

---

## 24. Testing Strategy

1. **Unit Tests:** Header normalization fuzzy matches, PII sanitization redaction, SMRITI-X schema validators.
2. **Integration Tests:**
   - Multi-tenant isolation verification (confirming company A cannot read company B's staged files).
   - Barcode immutability conflict tests (attempting to import duplicate barcode with mismatched SKU).
   - Idempotency replay verification with identical payload hashes.
3. **End-to-End Tests:**
   - Full cycle: `GlobalGridImportModal` upload $\rightarrow$ `/preview` $\rightarrow$ inspection $\rightarrow$ `/commit` $\rightarrow$ DB verification.
   - Outbox worker large file batching ($10,000$ simulated rows).
   - WhatsApp webhook HMAC rejection and confirmation expiration.

---

## 25. Rollout Strategy

- **Phase 0:** Architecture Freeze & Implementation Plan Approval (Current Step).
- **Phase 1:** Core DataBridge Service Foundation (`backend/app/services/databridge/`).
- **Phase 2:** Catalog Adapters (`Item`, `ItemVariant`, `ItemBarcode`).
- **Phase 3:** CSV, XLSX, and SMRITI-X JSON Importers/Exporters.
- **Phase 4:** Asynchronous Large File Outbox Pipeline.
- **Phase 5:** Customer, Supplier, and Price Book Adapters.
- **Phase 6:** Transactional Document Adapters (PO, GRN, Sales Invoice).
- **Phase 7:** Capability Registration (`cap_databridge`) & Entitlement Gating.
- **Phase 8:** Production WhatsApp Integration.

---

## 26. Migration & Legacy Deprecation Strategy (`exchange.py`)

### 26.1 Dependency & Caller Inventory
The audit identified active callers of `/exchange`:
- Frontend: `src/components/DataExchangeTab.tsx` (1,270 lines) calls `/exchange/partners`, `/exchange/logs`, `/exchange/mappings`, `/exchange/validate`, `/exchange/commit`.
- Backend Test Suite: `backend/app/tests/test_exchange.py`, `backend/app/tests/t_api_v1_migr.py`.
- Routing Registry: `backend/app/main.py:408` and `backend/app/services/workspace_ui_svc.py:181`.

### 26.2 Deprecation Plan
1. **Milestone 1:** Implement `/api/v1/databridge/*` as the canonical backend.
2. **Milestone 2:** Add redirect/shim in `exchange.py` logging deprecation warnings while forwarding calls to `databridge`.
3. **Milestone 3:** Refactor `src/components/DataExchangeTab.tsx` into `DataBridgeStudioTab.tsx` targeting `/api/v1/databridge/*`.
4. **Milestone 4:** Remove `backend/app/api/v1/exchange.py` and retire `data_exchange_tasks` table via Alembic migration.

---

## 27. Risks & Mitigations

| Risk | Impact | Mitigation Strategy |
|---|---|---|
| **Memory exhaustion on large uploads** | High | Enforce 5,000-row boundary: payloads above threshold are diverted to streaming outbox processing. |
| **Catalog corruption via invalid lookup values** | Critical | Enforce `IM001ControlledFieldValidator` before any commit can occur. |
| **Barcode clash across suppliers** | Critical | Strict barcode immutability: existing barcodes mapped to different SKUs are rejected with `EXISTING_CONFLICT`. |
| **Cross-tenant data leakage** | Catastrophic | Hard-pin all queries to `get_company_db`; enforce `company_id` filter on all lookups. |

---

## 28. Dependencies

- PostgreSQL 15+ (with `pgcrypto` for SHA-256 and JSONB support)
- SQLAlchemy 2.0 AsyncIO
- openpyxl (read-only, data-only mode)
- pako (pure TypeScript client-side OpenXML ZIP generation)
- Meta Cloud API / Gupshup Webhook Gateway (for Phase 8).

---

## 29. Acceptance Criteria

- [x] All 10 audit questions addressed and frozen.
- [x] `cap_databridge` capability registered in Control Plane catalog.
- [x] Phase 1 Core Foundation service boundary, API namespace, and 7-stage guard chain implemented.
- [x] Zero business queries executed against `smritisys` (verified with `SMRITI-TENANT-001`).
- [x] Strangler-fig preservation of `backend/app/api/v1/exchange.py` verified with zero breaking changes.
- [ ] Phase 2: Catalog Domain Adapters (`ItemMaster`, `ItemVariant`, `ItemBarcode`, `PriceBook`).
- [ ] Phase 3: Parties & Master Data Adapters (`Customer`, `Supplier`, `Branch`, `Account`).
- [ ] Phase 4: SMRITI-X Parser, Validator & Serializer (JSON/CSV/XLSX).
- [ ] Phase 5: Interactive Preview & Reconciliation Engine.
- [ ] Phase 6: Hardware & External Integrations.
- [ ] Phase 7: Asynchronous Large-File Processing Engine.
- [ ] Phase 8: Frontend DataBridge Workspace Studio.
- [ ] Phase 9: Strangler-Fig Migration & Legacy Decommissioning.
