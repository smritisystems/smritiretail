# SMRITI Platform — Master Constitution v1.0.0

**Status:** FROZEN — Level 1 Platform Constitution v1.0.0  
**Effective Date:** 2026-08-03  
**Organization:** SmritiSys / SMRITI Books  
**Chief Systems Architect:** Jawahar Ramkripal Mallah  

---

## Preamble

The **SMRITI Platform Constitution** is the supreme architectural law governing SMRITI Retail OS. It sits directly above all specialized kernel constitutions (*Inventory Kernel Constitution*, *UX Kernel Constitution*, *Accounting Kernel Constitution*, *Pricing Kernel Constitution*, *Workflow Kernel Constitution*, *Security Kernel Constitution*).

Every business module, microservice, frontend workspace, plugin, and extension MUST adhere strictly to the 8 Supreme Platform Constitutional Principles.

---

## 1. The Eight Supreme Platform Constitutional Principles

```text
 ┌────────────────────────────────────────────────────────────────────────┐
 │                    SMRITI MASTER PLATFORM CONSTITUTION                 │
 ├────────────────────────────────────────────────────────────────────────┤
 │ 1. Kernel First             │ 5. Extension Through Registries           │
 │ 2. Metadata First           │ 6. Backward Compatibility & SemVer      │
 │ 3. Consumer Isolation       │ 7. Test-Driven Certification Gates      │
 │ 4. Public Contracts First   │ 8. Platform Before Product              │
 └────────────────────────────────────────────────────────────────────────┘
```

### Principle 1: Kernel First
Capabilities shared across two or more business domains MUST be engineered as reusable, decoupled Platform Kernels before business module logic is constructed. Business modules are generic consumers of kernel capability.

### Principle 2: Metadata First
All user interfaces, workspace navigation, entity definitions, validation rules, workflow state machines, report schemas, and security access policies MUST be declared through Universal Registries (`SPK.registry`). Hardcoded procedural code, switch-case branches, and static TSX forms are strictly prohibited.

### Principle 3: Consumer Isolation & Zero Ownership of Platform Logic
Consumer business domains (Sales, Purchase, POS, WMS, Marketplace, Consignment) MUST NOT implement custom inventory state calculation, custom UI shells, or un-tokenized component trees. Consumer domains consume published Query and Command Facades and NEVER directly mutate platform state tables (`product.stock`, `journal_entries`).

### Principle 4: Public Contracts & Facades First
Every platform kernel MUST publish a stable, typed public facade (`InventoryQueryFacade`, `InventoryCommandFacade`, `SPK.navigation`, `SPK.forms`, `SPK.security`). Internal kernel implementation details may evolve, but public facade contracts MUST remain strictly backward compatible.

### Principle 5: Extension Through Registries (Plugin Architecture)
Industry Packs (Manufacturing, Restaurant, Medical, Jewellery) and third-party extensions MUST extend platform functionality exclusively by registering metadata into platform registries (`SPK.register()`). Modifying core kernel source code to support industry-specific variations is strictly prohibited.

### Principle 6: Backward Compatibility & Semantic Versioning
Platform Kernels follow strict Semantic Versioning (`MAJOR.MINOR.PATCH`). Breaking changes to public facade contracts or constitutional rules are strictly forbidden within a Major version and require an approved Architecture Decision Record (ADR) and a Major version release.

### Principle 7: Test-Driven Certification Gates
No business domain module or kernel capability may be declared "Certified" or "Production Ready" without empirical, un-truncated pass output from automated integration test suites validating architectural boundaries, replay determinism, SLA performance, and linter zero-violation gates.

### Principle 8: Platform Before Product
Infrastructure consistency, long-term maintainability, strict linter enforcement, and architectural governance ALWAYS take precedence over short-term ad-hoc feature creation.

---

## 2. Platform Constitutional Hierarchy

```text
                        SMRITI Platform Constitution (Master)
                                       │
        ┌──────────────────────────────┼──────────────────────────────┐
        │                              │                              │
        ▼                              ▼                              ▼
Inventory Kernel Constitution  UX Kernel Constitution       Security Kernel Constitution
        │                              │                              │
        ▼                              ▼                              ▼
Accounting Constitution        Pricing & Tax Constitution    Workflow Constitution
        │                              │                              │
        └──────────────────────────────┼──────────────────────────────┘
                                       │
                                       ▼
                         Certified Business Domains
              (Sales, Purchase, POS, WMS, Marketplace, Consignment)
```

---

## 3. Platform Architecture Layers

- **Layer 1: Platform Kernels (Stable)** — Inventory, UX, Security, Accounting, Pricing, Tax, Workflow, Dashboard, AI Skills.
- **Layer 2: Platform Services** — Notification, Universal Search, Universal Reports, Universal Printing, Audit & Telemetry.
- **Layer 3: Certified Business Domains** — Sales (SI_001), Purchase (PI_001), POS (POS001), Warehouse (WMS001), Marketplace (MP001), Consignment (CS001).
