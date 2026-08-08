<!--
  Project      : SMRITI Retail OS
  Organization : SmritiSys
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
  Version      : 1.0.0
  Created      : 2026-08-03
  Classification: Architecture Policy
-->

# SMRITI Inventory Kernel v1.x — Change Policy

**Status:** ACTIVE & ENFORCED  
**Date:** 2026-08-03  
**Author:** Jawahar Ramkripal Mallah (Chief Systems Architect)

---

## 1. Overview & Classification

Following the completion of Phase 7, the SMRITI Inventory Kernel v1.x architecture is frozen and closed. Future development must comply strictly with this 3-tier classification policy.

---

## 2. Change Policy Tiers

### Tier A: Allowed Without Version Change (Internal Maintenance)
- Performance optimizations and SQL index additions
- Bug fixes and error handling refinements
- Internal code refactoring inside existing engine namespaces
- Observability, metric collection, and structured logging additions
- Non-breaking linter and typing fixes

### Tier B: Allowed in Minor Versions (v1.x Backward-Compatible Extensions)
- New `document_posting_profiles` entries
- Additional `lock_type` enumerations (e.g. `CUSTOM_HOLD`)
- New `TimelineEngine` filter capabilities
- Additional non-breaking methods on `InventoryCommandFacade` or `InventoryQueryFacade`
- Non-breaking optional fields on DTOs and event payloads

### Tier C: Prohibited in v1.x — Deferred to v2.0
- Introduction of new Level 1 engines or core architectural layers
- Modification of immutable database triggers (`trg_inventory_ledger_immutability`)
- Direct table mutation by consumer business modules
- Breaking changes to public SDK function signatures, DTOs, or event schemas
- Alterations to core architectural governance rules (Rules LIM-006, IK001–IK016)

---

## 3. Enforcement Strategy

All pull requests touching `backend/app/services/inventory/` or `backend/app/models/inventory_kernel.py` must run the 16-gate certification suite (`test_inventory_kernel_certification_full.py`). Any PR breaking backward compatibility or attempting Tier C changes will be blocked automatically by CI.
