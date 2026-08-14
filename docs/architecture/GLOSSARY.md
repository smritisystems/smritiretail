<!--
  Title: Architecture Glossary
  Version: 1.0
  Status: Draft
  Owner: Enterprise Architecture
  Reviewers: Product, Engineering
  Last Updated: 2026-07-18
  Dependencies: PRODUCT_IDENTITY_ENGINE.md
  Related Documents: PRODUCT_IDENTITY_ENGINE_API_SPEC.md
  Change History:
    - v1.0 2026-07-18 Created.
-->

# Architecture Glossary

## Purpose

Defines key terms and abbreviations used across the Product Identity Engine and SMRITI architecture documentation.

## Terms

- **Business Key**: A deterministic, rule-driven identifier derived from authoritative product attributes that represents SKU identity.
- **Barcode Provider**: An entity or service that issues barcodes, including GS1 authorities, internal issuers, or custom connectors.
- **Fingerprint**: A hash or checksum that uniquely represents a SKU identity payload to detect collisions and duplicates.
- **GS1**: Global standards organization for product barcodes and supply chain identifiers.
- **Identity Store**: The persistence layer that stores current SKU identity records, barcode assignments, and lifecycle state.
- **Import Simulation**: A preflight evaluation of import payloads against rules and barcode assignment logic without committing data.
- **PIE**: Product Identity Engine, the governance service for SKU identity and barcode management.
- **Rule Scope**: The domain over which a rule applies, such as product category, brand, region, or business unit.
- **Rule Inheritance**: The mechanism by which more specific rules override or extend broader rules.
- **SKU**: Stock Keeping Unit, representing a specific product variant.
- **State Machine**: A lifecycle model defining valid state transitions for identities, barcodes, or import transactions.
- **Workflow**: A defined process for approving, publishing, or rolling back identity decisions.
- **Audit Trail**: The append-only history of PIE decisions, assignments, and governance actions.
- **Provider Pool**: A pool of available barcodes managed by a barcode provider.
- **Rollback**: An operation that reverts a previous import or assignment transaction to maintain consistency.
- **NFR**: Non-Functional Requirement, covering performance, availability, scalability, and reliability goals.
- **ADR**: Architecture Decision Record, a document capturing the rationale behind an architectural choice.
