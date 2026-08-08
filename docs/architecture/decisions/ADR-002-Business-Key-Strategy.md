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

# ADR-002: Business Key Strategy

## Status
Draft

## Context
SKU identity requires a deterministic business key that remains stable across product lifecycle changes, while allowing configurable identity rules for categories and regions.

## Decision
Use a rule-driven business key strategy whereby a business key is constructed from one or more authoritative product attributes and contextual scope values.

- Use category, department, brand, gender, size, color, and variant attribute values as the core business key inputs.
- Support rule scope inheritance so the most specific rule defines identity for a category or brand.
- Persist the generated business key and fingerprint as the canonical identity reference.

## Consequences
- Enables stable SKU identity across updates
- Supports conflict detection for duplicate merchandise definitions
- Requires rule versioning and audit tracking
