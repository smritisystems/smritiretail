<!--
  Project      : SMRITI Retail OS
  Repository   : SMRITRretailNX
  Organization : AITDL NETWORKS

  Founders

  * Pushpa Devi Jawahar Mallah
    * Founder & Chairperson
    * Phone: +91 9324117007
    * Email: founder@aitdl.com

  * Jawahar Ramkripal Mallah
    * Founder, Chief Executive Officer (CEO) & Chief Software Architect
    * Email: founder@aitdl.com

  * Websites: smritisys.com | aitdl.com | erpnbook.com | smritibooks.com

  * Version    : 1.0.0
  * Created    : 2026-07-18
  * Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
  * License    : Proprietary Commercial Software
-->

# SMRITI Product Identity Engine (PIE)

**Status:** ARCHITECTURE BLUEPRINT / READY FOR IMPLEMENTATION

> The SMRITI Product Identity Engine provides a governance-grade identity service for product SKUs, barcode assignment, and master identity rules. It is designed to be the core Product Identity & Barcode Governance Engine (PIBGE) for the ERP platform.

## 1. Purpose

SMRITI PIE is an enterprise-grade identity governance platform that:

- defines SKU identity using configurable business rules
- evaluates and assigns identity keys across categories and business domains
- manages GS1 and alternate barcode providers
- preserves complete audit and decision history
- supports imports, simulations, rollback, and governance workflows

## 2. Scope

Includes:

- Product Identity rules and business key calculation
- Barcode assignment and provider mapping
- Rule versioning, scope, priority, and inheritance
- Event-driven audit and history
- Import decision logging and quality reporting
- Governance workflow for rule approval and publication

Excludes (future scope):

- Customer / Supplier / Asset identity domains (framework ready)
- Full marketplace synchronization
- EPC/RFID and digital product passport issuance

## 3. Core Architecture

### 3.1 Module Tree

```
Inventory
 └── Product Identity Engine
      ├── Identity Rule Builder
      ├── Rule Version History
      ├── Business Key Registry
      ├── GS1 Assignment Engine
      ├── Barcode Provider Registry
      ├── Barcode Lifecycle / Pool
      ├── Barcode History
      ├── Decision Log
      ├── Import History
      ├── Rule Simulator
      ├── Rollback Manager
      ├── Audit Trail
      ├── Identity Confidence Engine
      ├── Governance Dashboard
      └── Reports & Analytics
```

### 3.2 Service Boundaries

- `Identity Service` — evaluates rules and returns business keys
- `Barcode Service` — assigns, reuses, and validates barcodes
- `Rule Management Service` — creates, versions, publishes, and simulates rules
- `Audit Service` — records immutable events and decision traces
- `Import Service` — processes spreadsheet imports and logs row-level outcomes

## 4. Domain Concepts

### 4.1 Identity Domains

PIE is designed to support multiple identity domains via a shared engine:

- Product Identity
- Customer Identity
- Supplier Identity
- Warehouse Identity
- Asset Identity
- Employee Identity
- Document Identity

This document focuses on Product Identity.

### 4.2 Rule Scope and Inheritance

Rules are configurable by scope and priority:

- Global
- Company
- Branch
- Department
- Category
- Brand
- Supplier
- Product Type

Rule selection uses:

1. scope matching
2. applicability filters
3. priority ranking
4. inheritance override

### 4.3 Business Key

A business key is the normalized unique identity for a SKU defined by a rule.

- Human-readable key
- Normalized key
- Fingerprint (SHA-256 hash)

### 4.4 Barcode Providers

PIE supports multiple barcode provider types:

- GS1
- Internal
- Vendor
- Marketplace
- Legacy
- Third-party
- Custom generator

### 4.5 Lifecycle and Policies

Barcode policy configuration defines how PIE behaves:

- Reuse Existing
- Always Generate
- Manual Approval
- Generate on First Sale
- Generate on Purchase
- Generate on Production

Lifecycle states for barcode values include:

- Available
- Reserved
- Assigned
- Verified
- Printed
- Active
- Suspended
- Replaced
- Retired
- Cancelled

### 4.6 Identity Confidence

The engine assigns a confidence score based on match quality:

- 100% Exact Match → Reuse Barcode
- 90-99% Likely Match → Suggest Review
- 70-89% Possible Duplicate → Manual Approval
- <70% No Match / Create New

## 5. Data Model

> See also: [Product Identity Engine ERD](./PRODUCT_IDENTITY_ENGINE_ERD.md) for entity relationships and implementation planning.


### 5.1 Tables / Entities

#### `identity_rules`

- `id`
- `name`
- `domain` (`product`, `customer`, etc.)
- `scope` (global/company/branch/category/brand)
- `priority`
- `field_sequence` (ordered fields list)
- `normalize_case`
- `ignore_spaces`
- `ignore_special_chars`
- `include_inactive_skus`
- `duplicate_policy`
- `auto_create_sku`
- `auto_assign_barcode`
- `reuse_existing_barcode`
- `barcode_policy`
- `status` (`draft`,`testing`,`simulation`,`pending_approval`,`published`,`active`,`deprecated`,`archived`)
- `effective_date`
- `created_by`
- `created_at`
- `approved_by`
- `approved_at`
- `reason`
- `version`
- `metadata`

#### `identity_rule_history`

- `id`
- `identity_rule_id`
- `rule_version`
- `previous_config`
- `new_config`
- `changed_by`
- `changed_at`
- `reason`
- `approval_status`
- `effective_date`

#### `business_keys`

- `id`
- `sku_id`
- `rule_version_id`
- `domain`
- `business_key_text`
- `normalized_key`
- `fingerprint`
- `key_components`
- `confidence_score`
- `source`
- `created_at`
- `created_by`
- `is_current`

#### `barcode_providers`

- `id`
- `name`
- `type`
- `description`
- `config`
- `created_at`
- `updated_at`

#### `barcode_pool`

- `id`
- `provider_id`
- `barcode_value`
- `barcode_type`
- `status`
- `reserved_by`
- `reserved_at`
- `assigned_to_sku_id`
- `assigned_at`
- `printed_at`
- `activated_at`
- `suspended_at`
- `replaced_at`
- `retired_at`
- `cancelled_at`
- `metadata`

#### `barcode_mappings`

- `id`
- `sku_id`
- `provider_id`
- `barcode_value`
- `barcode_type`
- `is_primary`
- `status`
- `assigned_at`
- `expires_at`
- `created_at`
- `updated_at`

#### `barcode_history`

- `id`
- `sku_id`
- `barcode_value`
- `provider_id`
- `barcode_type`
- `action`
- `rule_version_id`
- `decision_id`
- `user_id`
- `timestamp`
- `reason`
- `source`

#### `identity_decisions`

- `id`
- `business_key_value`
- `fingerprint`
- `rule_version_id`
- `matched_rule_id`
- `sku_found`
- `action`
- `barcode_value`
- `barcode_type`
- `confidence_score`
- `import_job_id`
- `user_id`
- `timestamp`
- `explain_text`
- `is_simulation`

#### `import_jobs`

- `id`
- `file_name`
- `domain`
- `uploaded_by`
- `company`
- `branch`
- `started_at`
- `completed_at`
- `total_rows`
- `reused_count`
- `generated_count`
- `failed_count`
- `status`
- `metadata`

#### `import_rows`

- `id`
- `import_job_id`
- `row_number`
- `business_key_value`
- `fingerprint`
- `barcode_found`
- `barcode_created`
- `validation_errors`
- `status`
- `confidence_score`
- `created_at`

#### `events`

- `id`
- `event_type`
- `domain`
- `entity_id`
- `entity_type`
- `payload`
- `created_at`
- `created_by`
- `metadata`

#### `identity_templates`

- `id`
- `name`
- `domain`
- `description`
- `field_sequence`
- `default_policy`
- `metadata`
- `created_at`
- `updated_at`

#### `identity_confidence_rules`

- `id`
- `name`
- `threshold_exact`
- `threshold_likely`
- `threshold_possible`
- `created_at`
- `updated_at`

### 5.2 Concrete Schema Examples

#### `identity_rules` (PostgreSQL)

```sql
CREATE TABLE identity_rules (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  domain text NOT NULL,
  scope jsonb NOT NULL,
  priority integer NOT NULL DEFAULT 100,
  field_sequence jsonb NOT NULL,
  normalize_case boolean NOT NULL DEFAULT true,
  ignore_spaces boolean NOT NULL DEFAULT true,
  ignore_special_chars boolean NOT NULL DEFAULT true,
  include_inactive_skus boolean NOT NULL DEFAULT false,
  duplicate_policy text NOT NULL DEFAULT 'block',
  auto_create_sku boolean NOT NULL DEFAULT false,
  auto_assign_barcode boolean NOT NULL DEFAULT false,
  reuse_existing_barcode boolean NOT NULL DEFAULT true,
  barcode_policy text NOT NULL DEFAULT 'reuse_existing',
  status text NOT NULL DEFAULT 'draft',
  effective_date timestamptz,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  approved_by text,
  approved_at timestamptz,
  reason text,
  version integer NOT NULL DEFAULT 1,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);
```

#### `business_keys`

```sql
CREATE TABLE business_keys (
  id uuid PRIMARY KEY,
  sku_id uuid REFERENCES products(id),
  rule_version_id uuid NOT NULL,
  domain text NOT NULL,
  business_key_text text NOT NULL,
  normalized_key text NOT NULL,
  fingerprint text NOT NULL,
  key_components jsonb NOT NULL,
  confidence_score integer NOT NULL DEFAULT 100,
  source text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by text,
  is_current boolean NOT NULL DEFAULT true
);
CREATE INDEX idx_business_keys_fingerprint ON business_keys(fingerprint);
```

#### `barcode_pool`

```sql
CREATE TABLE barcode_pool (
  id uuid PRIMARY KEY,
  provider_id uuid NOT NULL,
  barcode_value text NOT NULL UNIQUE,
  barcode_type text NOT NULL,
  status text NOT NULL DEFAULT 'available',
  reserved_by text,
  reserved_at timestamptz,
  assigned_to_sku_id uuid REFERENCES products(id),
  assigned_at timestamptz,
  printed_at timestamptz,
  activated_at timestamptz,
  suspended_at timestamptz,
  replaced_at timestamptz,
  retired_at timestamptz,
  cancelled_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX idx_barcode_pool_status ON barcode_pool(status);
```

#### `identity_decisions`

```sql
CREATE TABLE identity_decisions (
  id uuid PRIMARY KEY,
  business_key_value text NOT NULL,
  fingerprint text NOT NULL,
  rule_version_id uuid NOT NULL,
  matched_rule_id uuid,
  sku_found boolean NOT NULL,
  action text NOT NULL,
  barcode_value text,
  barcode_type text,
  confidence_score integer NOT NULL,
  import_job_id uuid,
  user_id text,
  timestamp timestamptz NOT NULL DEFAULT now(),
  explain_text text,
  is_simulation boolean NOT NULL DEFAULT false
);
CREATE INDEX idx_identity_decisions_fingerprint ON identity_decisions(fingerprint);
```

## 6. API Contract

> See detailed API definitions in [PRODUCT_IDENTITY_ENGINE_API_SPEC.md](./PRODUCT_IDENTITY_ENGINE_API_SPEC.md).

### Identity Rule Management

- `GET /identity/rules`
- `GET /identity/rules/{ruleId}`
- `POST /identity/rules`
- `PUT /identity/rules/{ruleId}`
- `POST /identity/rules/{ruleId}/publish`
- `POST /identity/rules/{ruleId}/simulate`
- `POST /identity/rules/{ruleId}/rollback`
- `GET /identity/rules/{ruleId}/history`

### Business Identity Evaluation

- `POST /identity/evaluate`
  - payload:
    - `domain`
    - `scope`
    - `skuData`
    - `ruleId` (optional)
  - response:
    - `businessKey`
    - `normalizedKey`
    - `fingerprint`
    - `matchedRuleId`
    - `confidence`
    - `suggestedAction`
    - `keyComponents`

- `POST /identity/simulate`
  - payload:
    - `domain`
    - `scope`
    - `skuSamples`
    - `ruleId` (optional)
  - response:
    - `results`
      - `businessKey`
      - `fingerprint`
      - `conflicts`
      - `warnings`
      - `recommendedRule`

### Example Requests

#### Evaluate Business Identity

```json
POST /identity/evaluate
{
  "domain": "product",
  "scope": {
    "company": "SMRITI-Retail",
    "branch": "Mumbai",
    "category": "Footwear"
  },
  "skuData": {
    "articleNo": "SH100",
    "color": "Black",
    "size": "8",
    "brand": "NIKE"
  }
}
```

```json
{
  "businessKey": "SH100|BLACK|8",
  "normalizedKey": "sh100:black:8",
  "fingerprint": "d2d2f0f1c2d05bc248398837abb35f08f5230b479d5588a19bd6c8b139083d8f",
  "matchedRuleId": "0a1b2c3d-...",
  "confidence": 100,
  "suggestedAction": "reuse_barcode",
  "keyComponents": {
    "articleNo": "SH100",
    "color": "Black",
    "size": "8"
  }
}
```

#### Simulate Rule Batch

```json
POST /identity/simulate
{
  "domain": "product",
  "scope": {
    "company": "SMRITI-Retail"
  },
  "skuSamples": [
    { "articleNo": "SH100", "color": "Black", "size": "8" },
    { "articleNo": "SH100", "color": "Black", "size": "9" }
  ],
  "ruleId": "0a1b2c3d-..."
}
```

```json
{
  "results": [
    {
      "businessKey": "SH100|BLACK|8",
      "fingerprint": "...",
      "conflicts": 0,
      "warnings": [],
      "recommendedRule": "Footwear Rule V5"
    },
    {
      "businessKey": "SH100|BLACK|9",
      "fingerprint": "...",
      "conflicts": 0,
      "warnings": [],
      "recommendedRule": "Footwear Rule V5"
    }
  ]
}
```

### Barcode Assignment

- `POST /barcode/assign`
  - payload:
    - `domain`
    - `skuData`
    - `providerId`
    - `barcodeType`
    - `policy`
    - `ruleId` (optional)
  - response:
    - `barcodeValue`
    - `status`
    - `decisionId`
    - `ruleVersionId`
    - `providerId`

- `POST /barcode/reuse`
  - payload:
    - `domain`
    - `businessKey`
    - `providerId`
    - `ruleId` (optional)
  - response:
    - `barcodeValue`
    - `status`
    - `decisionId`

- `POST /barcode/release`
  - payload:
    - `barcodeValue`
    - `providerId`
    - `reason`
  - response:
    - `releaseStatus`
    - `releasedAt`

- `GET /barcode/history`
- `GET /barcode/pool`
- `GET /barcode/pool/{barcodeId}`

### Example Barcode Assignment

```json
POST /barcode/assign
{
  "domain": "product",
  "skuData": {
    "articleNo": "SH100",
    "color": "Black",
    "size": "9",
    "brand": "NIKE"
  },
  "providerId": "cbf0a5f3-...",
  "barcodeType": "GS1-128",
  "policy": "reuse_existing",
  "ruleId": "0a1b2c3d-..."
}
```

```json
{
  "barcodeValue": "8901234567002",
  "status": "assigned",
  "decisionId": "f0e1d2c3-...",
  "ruleVersionId": "0a1b2c3d-...",
  "providerId": "cbf0a5f3-..."
}
```

### Example Existing Barcode Reuse

```json
POST /barcode/reuse
{
  "domain": "product",
  "businessKey": "SH100|BLACK|8",
  "providerId": "cbf0a5f3-..."
}
```

```json
{
  "barcodeValue": "8901234567001",
  "status": "reused",
  "decisionId": "a1b2c3d4-..."
}
```

### Decision and Audit

- `GET /decision/{decisionId}`
- `GET /decision/history`
- `GET /rule/history`
- `GET /import/jobs`
- `GET /import/jobs/{jobId}`
- `GET /identity/templates`
- `POST /identity/templates`

## 7. UI Design

### 7.1 Product Identity Console

Sections:

- Rule Builder
- Rule Version Timeline
- Rule Decision Tree Viewer
- Simulation & Impact Preview
- Policy Configuration
- Template Library
- Rule Approval Workflow
- Data Quality Dashboard

### 7.2 Barcode Governance Hub

Sections:

- Barcode Pool Dashboard
- Barcode Lifecycle Timeline
- Barcode Mapping Explorer
- Assignment Audit Log
- Import History Dashboard
- Conflict & Duplicate Insights

### 7.3 Governance & Compliance

Sections:

- Rule Approval Board
- Effective Date Scheduler
- Simulation / Test Mode
- Change Reason Capture
- Permissions & Audit Access

## 8. Workflows

### 8.1 SKU Save / Import Workflow

1. User submits SKU/import row
2. System selects active identity rule using scope, priority, and inheritance
3. Identity Service builds normalized business key and fingerprint
4. Search for existing SKU or business key
5. Evaluate confidence
6. If match exists and policy allows → reuse barcode
7. Else if policy requires → reserve and assign barcode
8. Persist business key and barcode mapping
9. Emit immutable events and history records
10. If import, record row-level import outcome

### 8.2 Rule Change Workflow

1. Administrator edits rule
2. System saves new rule version
3. Rule enters `testing` or `simulation`
4. Admin runs simulation or preview
5. Rule is approved and published
6. Rule becomes active at effective date
7. All future decisions use new rule version
8. History retains earlier key versions and decisions

### 8.3 Barcode Assignment Workflow

1. Barcode request arrives with SKU and provider context
2. Barcode Service evaluates policy
3. If no existing mapping and policy allows → reserve next available barcode
4. Assign barcode to SKU and create mapping record
5. Log `BARCODE_ASSIGNED` event and decision trace
6. If barcode existed → log `BARCODE_REUSED`

## 9. Non-Functional Requirements

- Identity lookup < 50 ms
- Barcode assignment < 100 ms
- Support 100,000-row import with conflict reporting
- Concurrent assignment safety and idempotency
- Horizontal scalability for rule evaluation and barcode pool
- Observability for rule execution, assignment throughput, failures
- Strong security and role-based permissions

## 10. Governance Principles

- Business identity is immutable once referenced by transactions
- Rule changes create new versions rather than rewriting history
- Audit records are append-only
- Decisions remain explainable and recoverable
- Barcode assignments are traceable to rules, imports, and users

## 11. Phased Roadmap

> See also: [Product Identity Engine Implementation Plan](./PRODUCT_IDENTITY_ENGINE_IMPLEMENTATION_PLAN.md) for phased deliverables, tasks, and acceptance criteria.


### Phase 1 (MVP)
- Identity rules and business keys
- Rule versioning and scope
- GS1 barcode assignment
- Basic import integration
- Audit trail and decision log

### Phase 2
- Rule simulator and impact analysis
- Identity templates
- Barcode provider registry
- Multiple barcode mappings per SKU
- Confidence scoring and data quality dashboard
- Governance workflow and approvals

### Phase 3
- AI recommendation layer
- Event-driven identity service
- Global identity registry and marketplace sync
- EPC/RFID / GS1 Digital Link support
- Digital product passport capabilities

## 12. Future Extensions

- Multi-domain identity engine for customer, supplier, asset, warehouse, and document identities
- Plugin architecture for external barcode generators, marketplace adapters, and GS1 vendors
- Identity confidence and duplicate detection machine learning
- Full audit analytics dashboards and governance reporting

---

## 13. Recommended Naming

User-facing module: **Product Identity**

Internal engine: **Business Identity Engine (BIE)** or **Product Identity & Barcode Governance Engine (PIBGE)**

This architecture is ready to serve as the foundation for a long-lived ERP identity governance platform.
