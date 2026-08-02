# SMRITI Inventory Kernel Constitution

**Status:** FROZEN — v1.0.0 (FROZEN ARCHITECTURE CONSTITUTION)  
**Effective Date:** 2026-08-03  
**Organization:** SmritiSys / SMRITI Retail OS  
**Author:** Jawahar Ramkripal Mallah, Chief Systems Architect & Creator  

---

## Preamble

The **SMRITI Inventory Kernel** is the canonical foundation of truth for physical stock, reserved commitments, commercial availability, and movement auditability across all retail business domains. 

To ensure architectural integrity, auditability, and multi-tenant safety across enterprise deployments, this Constitution defines the **8 Immutable Principles**, the **Public Compatibility Contract**, the **Versioning Policy**, and the **RC3 Decision Engine Boundary**. These rules take precedence over feature requests, consumer requirements, and UI abstractions.

---

## The 8 Immutable Principles

### Principle 1: Inventory is Ledger-First
State is not a mutable variable; it is the deterministic aggregation of immutable historical movement events. `products.stock` is a cached projection maintained exclusively by database triggers (`trg_inventory_state_reconciliation`).

### Principle 2: Strict Interface Boundaries
Consumers MUST interact with inventory exclusively through published Inventory Kernel interfaces (`InventoryQueryFacade`, `InventoryCommandFacade`, `InventoryAvailabilityService`, `InventoryReservationService`). Direct database writes, direct `StockMovement` creation, or independent inventory calculations in consumer services are strictly prohibited.

### Principle 3: Inventory State Engine Computes Facts Only
The kernel calculates current state, availability, reservations, and timeline projections based strictly on registered movement behaviors. It does not contain domain business logic, pricing logic, tax calculations, or customer credit rules.

### Principle 4: Business Decisions Belong Outside the Kernel
The kernel answers *"Is quantity X available?"* (`can_fulfill`) and *"Reserve quantity X"* (`reserve`). It NEVER decides whether a customer is worthy of credit, whether a discount applies, or whether an invoice should be generated.

### Principle 5: Replay Must Always Reproduce State
Given an identical stream of `StockMovement` records in identical sequence, the Inventory State Engine MUST deterministically produce identical values for On Hand, Reserved, Available, and Warehouse balances every single time.

### Principle 6: Kernel Extensions Occur Through Registries, Never Through Modification
New movement types, industry pack behaviors (Medical, Jewellery, Footwear, Pharmacy), and channel projections MUST be registered via `MovementTypeRegistry` / `MovementProvider` extension points. Modifying core kernel calculation logic to support consumer-specific movement types is strictly prohibited.

### Principle 7: State Calculations are Deterministic
Text heuristics on completed documents (`reference_doc_type` string matches) are forbidden (Kernel Invariant I-002). State buckets are populated exclusively via explicit movement taxonomy flags (`MovementBehavior`) or explicit pending-state annotations.

### Principle 8: Movement Taxonomy Defines Behavior
Every movement type registered in the kernel declares its direction (`+1`, `-1`, `0`) and flag impact (`affects_physical_stock`, `affects_reservation`, `affects_transit`, `affects_channel_stock`, `affects_inventory_value`). Behavior is metadata-driven, not procedurally hardcoded.

---

## Public Compatibility Contract (v1.x Guarantee)

To guarantee stability for SDK developers, team contributors, and consumer applications:

```text
┌───────────────────────────────────────────────────────────────────┐
│                    GUARANTEED STABLE (v1.x)                       │
│  ✓ InventoryQueryFacade                                          │
│  ✓ InventoryCommandFacade                                        │
│  ✓ DTO Schemas & State Data Contracts                            │
│  ✓ Error Code Taxonomy (InventoryErrorCode)                       │
│  ✓ Event Schema (StockMovementEvent v1.0.0)                      │
│  ✓ Movement Registry & MovementProvider Plugin Interface         │
└───────────────────────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────────────────┐
│                     MAY CHANGE INTERNALLY                         │
│  ✓ SQL trigger implementation & PL/pgSQL function internals       │
│  ✓ Internal replay loop optimizations                             │
│  ✓ In-memory caching layers                                       │
│  ✓ ORM mapping & underlying database query optimization           │
│  ✓ Internal repository helper routines                            │
└───────────────────────────────────────────────────────────────────┘
```

---

## Constitution Versioning Policy

Changes to the Inventory Kernel follow semantic versioning rules:

| Version Level | Change Criteria | Approval Required |
|---|---|---|
| **Major (vX.0.0)** | Any modification to an Immutable Principle or breaking change to a Guaranteed Stable interface | Chief Systems Architect + Formal ADR |
| **Minor (v1.X.0)** | New additive registry capability, new movement flag, or new facade endpoint | Architecture Review + ADR |
| **Patch (v1.0.X)** | Bug fixes, performance optimizations, documentation clarifications, or refactoring without contract changes | Standard PR + Test Suite |

---

## RC3 Boundary Definition — External Decision Engine

To preserve kernel encapsulation, operational decision engines are explicitly placed OUTSIDE the kernel boundary (scheduled for RC3 execution in consumer orchestration layers):

```text
┌───────────────────────────────────────────────────────────────────┐
│            EXTERNAL DECISION ENGINE (RC3 - OUTSIDE KERNEL)        │
│  • Warehouse Selection & Multi-Site Sourcing                      │
│  • Split Shipment & Fulfillment Order Routing                     │
│  • Substitute SKU Recommendation                                  │
│  • Marketplace Inventory Allocation Strategy                       │
│  • FEFO / FIFO Batch Selection Rules                              │
│  • Wave Picking & Carrier Optimization                            │
└───────────────────────────────────────────────────────────────────┘
```

---

## Two-Tier SLA Architecture

```text
┌───────────────────────────────────────────────────────────────────┐
│                      SLA TIER 1: PLATFORM SLA                     │
│  • Measures: In-memory calculation, registry evaluation, replay   │
│  • Target: < 5 ms for 1,000 movements                             │
│  • Environment: Infrastructure-agnostic                           │
└───────────────────────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────────────────┐
│                     SLA TIER 2: DEPLOYMENT SLA                    │
│  • Measures: DB round-trips, ORM serialisation, SQL triggers       │
│  • Target: Query < 100 ms, Mutation < 250 ms                      │
│  • Environment: PostgreSQL / asyncpg driver / infrastructure      │
└───────────────────────────────────────────────────────────────────┘
```

---

## Enforcement & Governance

1. **Automated CI Guards:** Rules #1, #7, and #8 are enforced continuously by static analysis and runtime test suites.
2. **ADR Requirement:** Any proposed change to the kernel calculation equation, movement taxonomy interface, or facade contract requires a formal Architecture Decision Record (ADR) approved by the Chief Systems Architect.
3. **Regression Suite:** Every pull request MUST pass the full 16-gate certification suite (`test_inventory_kernel_certification_full.py`) without exception.
4. **Inventory Kernel Closure Rule (MANDATORY)**: Inventory Kernel v1.x is architecturally closed. No new Level 1 engines, orchestration layers, or breaking public APIs may be introduced within the v1 major version.
5. **Backward Compatibility Rule (MANDATORY)**: All public SDK contracts (`InventoryCommandFacade`, `InventoryQueryFacade`), DTOs, documents, events, and facade APIs must remain strictly backward compatible throughout the v1 major version.
