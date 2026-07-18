<!--
  Title: Product Identity Engine Migration Guide
  Version: 1.0
  Status: Draft
  Owner: Architecture & Data Migration
  Reviewers: Product, Engineering, Operations
  Last Updated: 2026-07-18
  Dependencies: PRODUCT_IDENTITY_ENGINE.md, PRODUCT_IDENTITY_ENGINE_CONFIGURATION.md
  Related Documents: PRODUCT_IDENTITY_ENGINE_TEST_PLAN.md, PRODUCT_IDENTITY_ENGINE_NFR.md
  Change History:
    - v1.0 2026-07-18 Created.
-->

# Product Identity Engine Migration Guide

## Purpose

Describes the migration strategy for moving existing SKU and barcode data into the new PIE architecture.

## Migration Goals

- preserve existing SKU identifiers and barcodes
- minimize downtime for inventory operations
- validate legacy mappings before cutover
- support rollback to legacy state if needed

## Migration Phases

### Phase 1: Discovery

- inventory existing SKU identifiers, barcode formats, and import sources
- document legacy business keys and duplicate handling rules
- identify provider pool mappings and external GS1 usage

### Phase 2: Mapping

- map legacy SKU attributes to PIE identity fields
- establish barcode provider mapping rules
- define fallback behavior for unsupported legacy codes
- create transformation scripts and validation rules

### Phase 3: Migration Execution

- import legacy SKU identities into PIE with simulation mode enabled
- validate barcode assignments and conflict detection
- onboard legacy suppliers / brands in PIE rule scope
- perform rollback tests with sample datasets

### Phase 4: Cutover

- promote PIE to active identity source for new SKU creation
- route existing SKU lookups to PIE where possible
- maintain legacy SKU read-only mode for historical data
- continue reconciliation until full trust is established

## Rollback Strategy

- keep legacy identity store in read-only mode during migration
- preserve original legacy relationships until PIE is validated
- support automated rollback of migration batches on failure
- mark migrated records with provenance and cutover metadata

## Data Validation

- validate business key uniqueness across legacy and new records
- verify GS1 checksum and barcode format compliance
- reconcile legacy barcodes with PIE provider pool state
- generate migration audit reports for every batch

## Legacy Mapping

- provide a translation table for legacy SKU codes → PIE business keys
- preserve original master data values as audit attributes
- support dual lookup keys during transition period

## Existing Barcode Migration

- import existing barcode assignments with provider provenance
- classify codes as GS1-managed, internal, or custom
- detect and resolve conflicts between legacy and PIE assignments
- maintain legacy barcode history for compliance and traceability
