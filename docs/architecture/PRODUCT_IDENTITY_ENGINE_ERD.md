<!--
  Project      : SMRITI Retail OS
  Repository   : SMRITIRetailNX
  Organization : AITDL NETWORKS

  Version    : 1.0.0
  Created    : 2026-07-18
  Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
-->

# Product Identity Engine ERD

This document describes the key entity relationships for the SMRITI Product Identity Engine.

## 1. Overview

The engine is centered on identity rules, business keys, and barcode assignments. It preserves history via decision logs, import jobs, and event records.

## 2. Entity Relationships

```
+-----------------+        +----------------+        +------------------+
| identity_rules  |<-------| business_keys  |------->| products         |
+-----------------+        +----------------+        +------------------+
          ^                             |
          |                             |
          |                             +--------------+
          |                                            |
          |                                   +------------------+
          |                                   | barcode_mappings |
          |                                   +------------------+
          |                                            |
          |                                            |
+------------------------+                     +----------------+
| identity_rule_history  |                     | barcode_pool   |
+------------------------+                     +----------------+

 +---------------------+      +--------------------+
 | identity_decisions  |      | import_jobs        |
 +---------------------+      +--------------------+
              |                     |
              |                     |
         +----------------+   +--------------+
         | barcode_history|   | import_rows  |
         +----------------+   +--------------+

 +---------------------+
 | identity_templates  |
 +---------------------+

 +----------------------------+
 | barcode_providers          |
 +----------------------------+
```

## 3. Key Relationships

- `identity_rules` drives how business keys are generated.
- `business_keys` links a SKU to a specific identity rule version.
- `barcode_mappings` stores all barcode values assigned to a SKU.
- `barcode_pool` tracks barcode lifecycle and assignment state.
- `identity_decisions` records the decision made for each evaluation request.
- `import_jobs` and `import_rows` capture spreadsheet import outcomes.
- `barcode_history` records lifecycle events for barcodes.
- `identity_rule_history` preserves rule version changes.
- `identity_templates` provide reusable identity field sequences.
- `barcode_providers` manage provider-specific barcode policies and types.

## 4. Entity Descriptions

### identity_rules
Governance rules for identity creation and barcode policy. Includes scope, field order, normalization, and lifecycle state.

### business_keys
Generated identity keys with human-readable text, normalized form, fingerprint, and rule version reference.

### barcode_pool
Barcode values available for assignment, with lifecycle status and reservation state.

### barcode_mappings
Mapping of barcode values to SKU records, including type and primary/secondary status.

### identity_decisions
Decisions produced by identity evaluation, including matched rule, action taken, and explanation.

### import_jobs / import_rows
Import metadata and row-level outcomes for spreadsheet-driven SKU loads.

### barcode_history
Audit trail for barcode assignment, reuse, release, and lifecycle events.

### identity_rule_history
Versioned rule changes with reasons, approvals, and effective dates.

### identity_templates
Reusable presets for common industry identity configurations.

### barcode_providers
Registry for GS1, internal, vendor, marketplace, and custom barcode providers.

## 5. Optional Indexes

- `business_keys(fingerprint)`
- `identity_decisions(fingerprint)`
- `barcode_pool(status)`
- `identity_rules(status, priority)`

This ERD document supports implementation planning and database design for the Product Identity Engine.
