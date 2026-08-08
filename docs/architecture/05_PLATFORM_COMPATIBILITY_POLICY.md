<!--
Author & Creator:
Jawahar Ramkripal Mallah

Founder:
SmritiSys
AITDL Networks

Role:
Chief Systems Architect

Web:
smritisys.com | smritibooks.com | aitdl.com

Email:
jawahar.mallah@gmail.com

Copyright © 2026 SmritiSys.
All Rights Reserved.
-->

# Platform Compatibility Policy v1.0

## Status

- Version: 1.0
- Purpose: Define how SMRITI platform versions, kernel contracts, definitions, policies, and plugins remain compatible over time

## 1. Compatibility Model

SMRITI uses a layered compatibility model:

```text
Platform Version
  ↓
Kernel Version
  ↓
Pipeline Version
  ↓
Definition Version
  ↓
Policy Version
  ↓
Plugin Compatibility
```

## 2. Compatibility Contract

The platform supports the following compatibility expectations:

### Platform Compatibility
- Platform v1.x must remain backward compatible with existing frozen contracts.
- Major platform changes require ADR review and migration planning.

### Definition Compatibility
- Document definitions should remain loadable under the current platform version unless explicitly versioned.
- Definitions should follow the current schema contract.

### Policy Compatibility
- Policies should remain compatible with existing policy interfaces.
- New optional capabilities may be added without breaking existing policies.

### Plugin Compatibility
- Plugins should target the declared platform and SDK version.
- A plugin must not depend on hidden or unstable internal APIs.

## 3. Versioning Rules

### Minor Version Changes
Minor changes may add:
- new optional policies
- new optional document capabilities
- new report definitions
- new notification channels

These must not break existing integrations.

### Major Version Changes
Major version changes may introduce:
- breaking contract changes
- revised lifecycle behavior
- revised schema requirements

These require:
- ADR approval
- migration guide
- compatibility window

## 4. Compatibility Matrix

Example compatibility expectation:

```text
Platform v1.0
  supports
Definition v1.x
Policy v1.x
Plugin SDK v1.x
```

## 5. Compatibility Guardrails

The following guardrails must be preserved:
- frozen kernel contracts remain valid
- pipeline contracts remain valid
- policy interfaces remain valid
- lifecycle state machine remains valid
- event contracts remain valid

## 6. Extension Compatibility Rule

Any new extension should be introduced in a backward-compatible manner.

If a new capability requires a contract change, it must be treated as a platform evolution and handled through ADR review.
