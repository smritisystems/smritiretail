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

# Platform Change Process v1.0

## Status

- Version: 1.0
- Purpose: Define the process for making changes to the SMRITI platform core

## Core Rule

Any change to the platform must be justified by one of the following:

1. It is required to fix a critical defect
2. It is required for a security issue
3. It is required for backward-compatible performance improvement
4. It is required to support a cross-document capability that cannot be expressed through definitions or policies

## Decision Flow

```text
Need identified
  ↓
Can it be solved with Definition or Policy?
  ↓
YES → implement through extension
  ↓
NO  → create ADR
  ↓
Architecture review
  ↓
Approval
  ↓
Implement change
  ↓
Tests and compatibility validation
```

## ADR Requirements

Every platform change must include:
- problem statement
- proposed design
- impact on frozen contracts
- migration strategy if needed
- backward compatibility notes
- testing plan

## Review Gates

Changes to the platform core require approval from:
- architecture owner
- relevant domain owner
- release owner

## Enforcement

The platform constitution is the governing document.
If a change conflicts with the constitution, it must be treated as an exception and reviewed explicitly.
