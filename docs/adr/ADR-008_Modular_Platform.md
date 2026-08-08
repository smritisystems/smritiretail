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

# ADR-008: Domain-Driven Modular Monolith & Capability Isolation

**Status:** APPROVED — v1.0 (2026-07-28)  
**Deciders:** Jawahar Ramkripal Mallah (Chief Systems Architect & Creator)  

---

## Context
A monolithic codebase without strict module boundaries degrades into a tangled web over time. Microservices add early network complexity. A Modular Monolith balances clean isolation with simple deployment.

---

## Decision
1. **Module Structure**: Backend functionality is partitioned into self-contained domain modules (`backend/app/modules/inventory/`, `sales/`, `purchase/`, `crm/`, `accounting/`, `pos/`, `barcode/`, `reports/`).
2. **Module Contents**: Each module encapsulates its own `api/`, `services/`, `repositories/`, `models/`, `schemas/`, `events/`, and `tests/`.
3. **Cross-Module Isolation**: Direct imports across internal module repositories are forbidden. Communication uses Published Service Interfaces or Domain Events.

---

## Consequences
- **Positive**: Clear domain ownership; easy path to extract microservices if scaling requires it in future decades.
- **Negative**: Requires strict module boundary discipline enforced by architectural linters.
