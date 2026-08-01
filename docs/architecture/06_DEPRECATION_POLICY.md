# Deprecation Policy v1.0

## Status

- Version: 1.0
- Purpose: Define how SMRITI handles outdated platform features, interfaces, and APIs without causing uncontrolled breakage

## 1. Core Rule

The platform must never remove a capability abruptly.

The default lifecycle is:

```text
Never Remove
  ↓
Deprecate
  ↓
Warn
  ↓
Provide Migration Guide
  ↓
Remove in Next Major Version
```

## 2. Deprecation Process

When a capability becomes obsolete:

1. Mark it as deprecated
2. Emit clear warnings in documentation and runtime messaging where possible
3. Provide an explicit migration path
4. Keep the old path working for at least one compatibility window
5. Remove it only in the next major version

## 3. Examples

### Example A: Old Factory API

```text
PipelineFactory.fromDefinition()
  → deprecated
  → use PipelineFactory.fromDocumentDefinition()
  → removed in v2
```

### Example B: Legacy Policy Hook

A legacy policy hook may be retained in compatibility mode while a new policy interface is introduced.

## 4. Deprecation Guidelines

Deprecation should:
- be documented clearly
- include replacement guidance
- include a reasonable migration timeline
- avoid silent breakage

## 5. Non-Goals

This policy does not permit:
- removing capabilities without notice
- silently changing public contracts
- forcing breaking changes into minor releases

## 6. Governance Rule

Any removal of a deprecated capability must be reviewed as a major-version change and documented in the relevant ADR and release notes.
