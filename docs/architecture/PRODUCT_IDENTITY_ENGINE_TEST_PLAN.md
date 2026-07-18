<!--
  Title: Product Identity Engine Test Plan
  Version: 1.0
  Status: Draft
  Owner: QA & Engineering
  Reviewers: Product, Architecture, DevOps
  Last Updated: 2026-07-18
  Dependencies: PRODUCT_IDENTITY_ENGINE.md, PRODUCT_IDENTITY_ENGINE_API_SPEC.md, PRODUCT_IDENTITY_ENGINE_ERRORS.md
  Related Documents: PRODUCT_IDENTITY_ENGINE_NFR.md, PRODUCT_IDENTITY_ENGINE_MIGRATION.md
  Change History:
    - v1.0 2026-07-18 Created.
-->

# Product Identity Engine Test Plan

## Purpose

Defines a comprehensive test strategy for PIE, covering unit, integration, performance, concurrency, recovery, and import validation.

## Test Categories

### Unit Tests

- Rule evaluation logic
- Business key generation
- Fingerprint hashing
- Barcode provider selection
- Error code mapping
- Permission and authorization logic

### Integration Tests

- API contract validation
- End-to-end create SKU and import flows
- Barcode assignment with GS1 provider simulation
- Rule inheritance and scope resolution
- Audit event generation

### Load Tests

- Bulk import of 100k rows
- Concurrent barcode assignments
- Simulated high-volume identity lookup traffic
- Provider failure and fallback behavior

### Concurrency Tests

- Parallel imports for different business units
- Concurrent barcode reservation and assignment conflicts
- Idempotent retry behavior for repeated requests

### Recovery Tests

- Rollback on partial import failures
- Transaction retry for transient provider errors
- Audit trail accuracy after rollback

### GS1 Validation Tests

- GS1 checksum validation for assigned codes
- Pool exhaustion behavior and fallback handling
- Provider error handling and retry policies

### Import Tests

- Header alias mappings and auto-map behavior
- Strict vs permissive import validations
- Duplicate business key detection on import
- Rule simulation and preview report accuracy

## Test Environment

- Development: local mock providers and test databases
- Staging: integration with real barcode provider sandboxes
- Production-like: scaled import and lookup validation

## Acceptance Criteria

- All unit tests pass with 100% coverage for rule and barcode logic
- API contract tests pass for documented request/response shapes
- Bulk import performance meets NFR targets
- Rollback operations restore consistent state
- Security policies enforced in API tests

## Regression Testing

- Add regression cases for every resolved bug in PIE
- Maintain a minimum set of import, barcode, and rule evaluation regression tests
- Validate error catalog codes remain stable for API consumers
