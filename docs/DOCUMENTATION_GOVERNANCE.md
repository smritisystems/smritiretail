<!--
  Project         : SMRITI Retail OS
  Organization    : SmritiSys
  Document        : Documentation Governance
  Version         : 1.0.0
  Created         : 2026-07-31
  Status          : Active
-->

# SMRITI Retail OS Documentation Governance

This document defines how the documentation set should be maintained.

## Canonical entry points

The following documents are the preferred public entry points:

- [HOME.md](HOME.md)
- [DOCUMENTATION_MAP.md](DOCUMENTATION_MAP.md)
- [QUICK_START.md](QUICK_START.md)
- [README.md](README.md)

## Document lifecycle policy

### Active
Use for current product behavior, current setup, and current operating procedures.

### Reference
Use for historical design discussions, legacy architecture notes, or older implementation walkthroughs that are still useful for context.

### Superseded
Use only when a doc is replaced by a newer canonical version. Such files should be clearly marked and linked to the current source of truth.

## Ownership expectations

- Home and map pages must stay current.
- Architecture and security pages are canonical system references.
- Walkthroughs are historical and explanatory, not operational source-of-truth docs.
- Installation and troubleshooting pages must reflect the latest verified setup path.

## Maintenance rule

Every major product change should update at least one canonical doc and one supporting doc if needed.

## Recommended cleanup pattern

1. keep one landing page
2. keep one map page
3. keep one fast-start page
4. archive or label superseded docs
5. link all new docs from the map instead of duplicating them
