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

# ADR-003: 200-Year Engineering Longevity & Maintainability Standard

**Status:** APPROVED — v1.0 (2026-07-28)  
**Deciders:** Jawahar Ramkripal Mallah (Chief Systems Architect & Creator)  

---

## Context
SMRITI Retail OS is designed for a **15 to 200-year maintainability horizon**. No third-party framework lasts forever. We need an architectural decision that guarantees system longevity independent of specific framework lifecycles.

---

## Decision
We freeze **Rule GR-000 (Business Capability Before Technology)** and **Rule GR-001 (Single Source of Truth - SSOT)**:
1. Architecture is designed exclusively around permanent retail capabilities (`Inventory`, `Sales`, `Purchase`, `Accounting`, `CRM`, `POS`), never around third-party libraries.
2. Every business rule, calculation, component, and validation logic has **EXACTLY ONE** authoritative implementation. Duplication is strictly prohibited.
3. AI agents and engineers MUST execute the 5-step search chain (`Search` → `Find` → `Reuse` → `Extend` → `Create`) before writing new code.

---

## Consequences
- **Positive**: Eliminates code drift, duplicate calculation bugs, and framework lock-in.
- **Negative**: Requires strict architecture review before introducing new files or endpoints.
