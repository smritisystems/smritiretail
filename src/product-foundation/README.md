# SMRITI Product Foundation

This package contains the executable Product Foundation engine implementations for the Business Engine Program.

## Module Structure

The Product Foundation is organized into six cohesive foundation modules:
- commerce
- inventory
- finance
- workflow
- document
- intelligence

Each module can contain multiple engines that are implemented incrementally as reuse emerges from real Studio usage.

## Standard Engine Contract

Every engine should follow the same internal layout:
- api
- contracts
- domain
- application
- infrastructure
- adapters
- tests
- benchmarks
- README.md
- CHANGELOG.md
- index.ts

No engine should introduce a different folder convention.

## Capability Maturity Levels (CML)

Each capability should be tracked with a maturity level:
- CML-0 — Planned
- CML-1 — Prototype
- CML-2 — Validated in one Studio
- CML-3 — Shared by at least two Studios
- CML-4 — Standard Product Foundation default
- CML-5 — Strategic, eligible for Platform consideration

## Capability Manifests

Every capability should include a machine-readable manifest in its own folder. These manifests carry immutable IDs, ownership, maturity, release ring, version, Studio adoption, dependencies, and API visibility.

The catalog is generated from these manifests by running:
- npm run generate:capability-catalog

This keeps the governance model executable and prevents the catalog from drifting away from the codebase.

## Promotion Rule

A capability should only enter Product Foundation after it has been validated in production and adopted by a second Studio.

## Ownership Rule

Every Product Foundation module should have exactly one owner. Studios consume these modules but do not modify their business logic directly.

## Release Rings

Capabilities should be rolled out through:
- Experimental
- Pilot
- General Availability
- Foundation Standard
