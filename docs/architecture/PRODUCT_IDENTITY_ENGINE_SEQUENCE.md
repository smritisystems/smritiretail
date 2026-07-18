<!--
  Title: Product Identity Engine Sequence Diagrams
  Version: 1.0
  Status: Draft
  Owner: Enterprise Architecture
  Reviewers: Product, Architecture, Engineering
  Last Updated: 2026-07-18
  Dependencies: PRODUCT_IDENTITY_ENGINE.md, PRODUCT_IDENTITY_ENGINE_API_SPEC.md
  Related Documents: PRODUCT_IDENTITY_ENGINE_STATE_MACHINE.md, PRODUCT_IDENTITY_ENGINE_ERRORS.md
  Change History:
    - v1.0 2026-07-18 Created.
-->

# Product Identity Engine Sequence Diagrams

## Purpose

This document describes the key runtime flows for SMRITI Product Identity Engine (PIE), including SKU creation, import, barcode reuse, barcode generation, rule evaluation, and rollback.

## Sequence Diagrams

### 1. Create SKU

```mermaid
sequenceDiagram
    participant UI as User Interface
    participant API as PIE API
    participant Rule as Rule Engine
    participant Barcode as Barcode Service
    participant Store as Identity Store

    UI->>API: POST /pie/skus
    API->>Rule: validate and evaluate identity rules
    Rule-->>API: business key, fingerprint, barcode candidate
    API->>Barcode: reserve or issue barcode
    Barcode-->>API: barcode assignment
    API->>Store: persist SKU identity record
    Store-->>API: identity record created
    API-->>UI: 201 Created
```

### 2. Import SKU

```mermaid
sequenceDiagram
    participant Importer
    participant API
    participant Rule
    participant Barcode
    participant Store
    participant Audit

    Importer->>API: POST /pie/imports
    API->>Rule: simulate rules for each row
    Note over Rule: validate business key and fingerprint
    Rule-->>API: decisions and barcode suggestions
    API->>Barcode: reserve / assign requested barcode
    API->>Store: save import transaction and audit log
    Store-->>API: transaction committed
    API->>Audit: log decision history
    API-->>Importer: import report
```

### 3. Reuse Barcode

```mermaid
sequenceDiagram
    participant UI
    participant API
    participant Store
    participant Barcode

    UI->>API: POST /pie/barcodes/reuse
    API->>Store: verify barcode availability and context
    Store-->>API: barcode eligible
    API->>Barcode: mark barcode reused / bound
    Barcode-->>API: reuse confirmed
    API-->>UI: 200 OK
```

### 4. Generate Barcode

```mermaid
sequenceDiagram
    participant API
    participant BarcodeProvider
    participant Store

    API->>BarcodeProvider: request new barcode
    BarcodeProvider-->>API: barcode issued
    API->>Store: persist barcode assignment and pool metadata
    Store-->>API: assignment recorded
    API-->>Client: barcode returned
```

### 5. Rule Evaluation

```mermaid
sequenceDiagram
    participant API
    participant RuleEngine
    participant Config

    API->>RuleEngine: evaluate rules for SKU payload
    RuleEngine->>Config: fetch active rule set
    Config-->>RuleEngine: rule definitions
    RuleEngine-->>API: evaluation result, warnings, errors
```

### 6. Rollback

```mermaid
sequenceDiagram
    participant Operator
    participant API
    participant Store
    participant Audit

    Operator->>API: POST /pie/rollback
    API->>Store: locate transaction history
    Store-->>API: history retrieved
    API->>Store: reverse assignment state
    Store-->>API: rollback completed
    API->>Audit: log rollback event
    Audit-->>API: rollback audit stored
    API-->>Operator: 200 Rolled back
```
